module ktkr.us/pkg/pls

go 1.20

replace ktkr.us/pkg/sound => /home/moshee/projects/go/src/ktkr.us/pkg/sound

replace ktkr.us/pkg/irc => /home/moshee/projects/go/src/ktkr.us/pkg/irc

require (
	github.com/pkg/errors v0.9.1
	ktkr.us/pkg/airlift v0.4.1
	ktkr.us/pkg/fmtutil v0.1.0
	ktkr.us/pkg/gas v0.1.0
	ktkr.us/pkg/irc v0.0.0-00010101000000-000000000000
	ktkr.us/pkg/sound v0.0.0-00010101000000-000000000000
	ktkr.us/pkg/vfs v0.1.0
)

require (
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	golang.org/x/crypto v0.0.0-20210317152858-513c2a44f670 // indirect
	golang.org/x/sys v0.0.0-20210320140829-1e4c9ba3b0c4 // indirect
)
