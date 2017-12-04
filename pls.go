package main

// TODO: read durations on server to get rid of preload
// TODO: provide multiple <source> formats
// TODO: transcode formats to mp3 and ogg (ffmpeg/libav?)
// TODO: MP4/AAC support

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	"ktkr.us/pkg/airlift/cache"
	"ktkr.us/pkg/fmtutil"
	"ktkr.us/pkg/gas"
	"ktkr.us/pkg/gas/out"
	"ktkr.us/pkg/irc"
	"ktkr.us/pkg/sound"
	_ "ktkr.us/pkg/sound/mp3"
	_ "ktkr.us/pkg/sound/vorbis"
	"ktkr.us/pkg/vfs"
	"ktkr.us/pkg/vfs/bindata"
)

//go:generate bindata -skip=*.sw[nop] templates static

var (
	songPath  string
	fileCache *cache.Cache
	ircClient *irc.Client
)

var IRCConf struct {
	Network    string
	Channel    string
	ChannelKey string
}

type Song struct {
	ID       string
	Filename string
	Slug     string
	Tags     sound.Tags `json:"-"`
	Duration string
	Size     fmtutil.Bytes
	Date     time.Time
	Fresh    bool
}

type Songs []*Song

func (s Songs) Len() int           { return len(s) }
func (s Songs) Less(i, j int) bool { return s[i].Date.After(s[j].Date) }
func (s Songs) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

func init() {
	u, err := user.Current()
	if err != nil {
		log.Fatal(err)
	}
	songPath = filepath.Join(u.HomeDir, ".pls")
	os.MkdirAll(songPath, 0755)

	if err := gas.EnvConf(&IRCConf, "IRC_"); err != nil {
		log.Print(err)
	}
}

func main() {
	var (
		flagRsrc = flag.String("rsrc", "", "static resources source")
		fs       vfs.FileSystem
		err      error
	)

	flag.Parse()

	runtime.GOMAXPROCS(runtime.NumCPU())

	fileCache, err = cache.New(songPath)
	if err != nil {
		log.Fatal(err)
	}

	if *flagRsrc != "" {
		log.Print("using disk filesystem")
		fs, err = vfs.Native(*flagRsrc)
		if err != nil {
			log.Fatal(err)
		}
		out.TemplateFS(fs)
	} else {
		log.Print("using binary filesystem")
		fs = bindata.Root
		out.TemplateFS(bindata.Root)
	}

	if IRCConf.Network != "" {
		ircClient = &irc.Client{
			Addr:     IRCConf.Network,
			Nick:     "pls",
			User:     "plsgo",
			Realname: "irc pls go",
		}

		ircClient.HandleFunc("001", func(c *irc.Client, m *irc.Message) {
			c.JOIN(IRCConf.Channel, IRCConf.ChannelKey)
		})

		go func() {
			for {
				if err = ircClient.Connect(); err != nil {
					log.Printf("irc: %v", err)
				} else {
					err = ircClient.Run()
					if err == nil {
						return
					}
					log.Printf("irc: %v", err)
				}

				log.Println("reconnecting in 5 seconds")
				time.Sleep(5 * time.Second)
			}
		}()
	}

	gas.New().
		StaticHandler("/static", vfs.Subdir(fs, "static")).
		Post("/upload", postUpload).
		Get("/favicon.ico", nothing).
		Get("/tracks", getTracks).
		Delete("/file/{id}", deleteSong).
		Get("/file/{id}", getSong).
		Get("/{id}", getIndex).
		Get("/{id}/{filename}", getIndex).
		Get("/", getIndex).Ignition()
}

func nothing(g *gas.Gas) (int, gas.Outputter) {
	return 404, nil
}

func lookupSong(id string) (*Song, error) {
	fi := fileCache.Stat(id)
	name := filenamePart(fi.Name())
	s := &Song{
		ID:       id,
		Filename: name,
		Slug:     generateSlug(name),
		Size:     fmtutil.Bytes(fi.Size()),
		Date:     fi.ModTime(),
	}

	f, err := os.Open(fileCache.Get(id))
	if err != nil {
		return nil, err
	}

	redoTags := false

	meta, _, err := sound.DecodeMeta(f)
	if err != nil {
		s.Duration = "--:--"
		log.Print(errors.Wrap(err, "decode meta "+name))
		redoTags = true
	} else {
		s.Duration = fmtutil.HMS(meta.Duration())
		if tags, ok := meta.(sound.Tags); ok {
			s.Tags = tags
		} else {
			redoTags = true
		}
	}

	if redoTags {
		f.Seek(0, os.SEEK_SET)
		tags, _, err := sound.DecodeTags(f)

		if err != nil {
			log.Print(name)
			return nil, errors.Wrap(err, "decode tags "+name)
		} else {
			s.Tags = tags
		}
	}
	f.Close()

	return s, nil
}

func getIndex(g *gas.Gas) (int, gas.Outputter) {
	ids := fileCache.SortedIDs()
	reverse(ids)

	songs := make(Songs, len(ids))
	for i, id := range ids {
		song, err := lookupSong(id)
		if err != nil {
			return 500, out.Error(g, err)
		}
		songs[i] = song
	}

	if g.Wants() == "application/json" {
		return 200, out.JSON(songs)
	}

	return 200, out.HTML("index", songs)
}

func getTracks(g *gas.Gas) (int, gas.Outputter) {
	ids := fileCache.SortedIDs()
	reverse(ids)
	return 200, out.JSON(ids)
}

type Err struct {
	Error string
}

func postUpload(g *gas.Gas) (int, gas.Outputter) {
	filename, err := url.QueryUnescape(g.Request.Header.Get("X-Pls-Filename"))
	if filename == "" {
		if err != nil {
			return 500, out.JSON(&Err{"filename: " + err.Error()})
		}
		return 400, out.JSON(&Err{"missing filename"})
	}

	id, err := fileCache.Put(g.Body, filename, conf)
	if err != nil {
		return 500, out.JSON(&Err{err.Error()})
	}

	path := fileCache.Get(id)
	f, err := os.Open(path)
	if err != nil {
		return 500, out.JSON(&Err{err.Error()})
	}

	// If it fails, whatever
	meta, _, err := sound.DecodeMeta(f)
	if err != nil {
		//log.Print(err)
		return 500, out.JSON(&Err{err.Error()})
	}
	//log.Print(tags)

	tags, ok := meta.(sound.Tags)
	if !ok {
		f.Seek(0, os.SEEK_SET)
		tags, _, err = sound.DecodeTags(f)
		if err != nil {
			return 500, out.JSON(&Err{err.Error()})
		}
	}

	var (
		fi          = fileCache.Stat(id)
		slug        = generateSlug(filename)
		artistTitle string
		albumYear   string
	)

	song := &Song{
		ID:       id,
		Filename: filename,
		Slug:     slug,
		Tags:     tags,
		Duration: fmtutil.HMS(meta.Duration()),
		Size:     fmtutil.Bytes(fi.Size()),
		Date:     time.Now(),
		Fresh:    true,
	}

	if ircClient != nil {
		go func() {
			if tags == nil || tags.Artist() == "" && tags.Title() == "" {
				artistTitle = filename
			} else {
				if tags.Artist() != "" {
					artistTitle = tags.Artist() + " — "
				}
				artistTitle += tags.Title()

				albumYear = tags.Album()
				if date := tags.Date(); !date.IsZero() {
					if albumYear != "" {
						albumYear += ", "
					}
					albumYear += strconv.Itoa(date.Year())
				}

				albumYear = " (" + albumYear + ")"
			}

			post := fmt.Sprintf("New song: \x02%s\x02%s <https://%s/%s/%s>", artistTitle, albumYear, g.Host, id, slug)
			ircClient.PRIVMSG(IRCConf.Channel, post)
		}()
	}

	return 201, out.HTML("song-wrapper", song)
}

func deleteSong(g *gas.Gas) (int, gas.Outputter) {
	id := g.Arg("id")
	err := fileCache.Remove(id)
	if err != nil {
		return 500, out.JSON(&Err{err.Error()})
	}
	return 204, nil
}

func getSong(g *gas.Gas) (int, gas.Outputter) {
	id := g.Arg("id")
	if id == "" {
		return 400, out.JSON(&Err{"missing ID"})
	}

	path := fileCache.Get(id)

	http.ServeFile(g, g.Request, path)
	return g.Stop()
}

func filenamePart(name string) string {
	a := strings.SplitN(name, ".", 2)
	if len(a) == 2 {
		return a[1]
	}
	return name
}

func generateSlug(s string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case ' ', '#':
			return '_'
		default:
			return r
		}
	}, s)
}

func reverse(ids []string) {
	for i, j := 0, len(ids)-1; j > i; i, j = i+1, j-1 {
		ids[i], ids[j] = ids[j], ids[i]
	}
}

/*
func readTags(r io.Reader) (sound.Tags, error) {
	/*
		tags, err := id3v2.Decode(rs)
		if err == nil {
			return tags, nil
		}

		rs.Seek(0, os.SEEK_SET)

		_, comment, err := r.ReadVorbisComment()
		if err != nil {
			return nil, err
		}

	tags, _, err := sound.DecodeTags(r)
	return tags, err
	//return comment, nil
}
*/
