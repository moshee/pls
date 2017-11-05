package bindata_files

import (
	"path/filepath"
	"time"

	"ktkr.us/pkg/vfs/bindata"
)

func init() {
	bindata.RegisterFile(filepath.Join("templates", "errors", "errors.tmpl"), time.Unix(1509835468, 0), []byte("{{ define \"400\" }}{{ .Error }}{{ end }}\n{{ define \"404\" }}{{ .Error }}{{ end }}\n{{ define \"500\" }}{{ .Error }}{{ end }}\n"))
	bindata.RegisterFile(filepath.Join("templates", "index.tmpl"), time.Unix(1509836752, 0), []byte("{{ define \"index\" }}\n{{ with $.Data }}\n<!doctype html>\n<html>\n  <head>\n    <title>pls go</title>\n    <link href=\"https://fonts.googleapis.com/css?family=Tinos|Rubik:400,700&amp;subset=latin-ext\" rel=\"stylesheet\">\n    <link rel=\"stylesheet\" href=\"/static/style.css\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  </head>\n  <body>\n    <div id=\"shroud\"></div>\n    <div id=\"follower\">\n      <svg id=\"loader\">\n        <circle id=\"loader-bg\" cx=\"100\" cy=\"100\" r=\"100\"></circle>\n        <circle id=\"loader-track\" cx=\"100\" cy=\"100\" r=\"96\"></circle>\n        <path id=\"loader-bar\"></path>\n        <button id=\"cancel-upload\" type=\"button\">Cancel</button>\n      </svg>\n    </div>\n    <section id=\"main\">\n      <header>\n        <h1><a href=\"/\">pls go</a></h1>\n        <canvas id=\"vis\" width=\"256\" height=\"32\"></canvas>\n        <input type=\"file\" id=\"file-upload\" class=\"hidden\">\n        <button type=\"button\" id=\"upload\">Upload</button>\n      </header>\n      <ul id=\"songlist\">\n        {{ range . }}\n        {{ template \"song\" . }}\n        {{ end }}\n      </ul>\n      <footer><span id=\"track-count\">{{ len . }}</span> track(s).</footer>\n    </section>\n    <script src=\"/static/vis.pls.js\"></script>\n    <script src=\"/static/key.pls.js\"></script>\n    <script src=\"/static/pls.js\"></script>\n    <script>\n      Pls.init({\n        vis: {\n          bars: 64\n        }\n      });\n    </script>\n  </body>\n</html>\n{{ end }}\n{{ end }}\n\n{{ define \"song\" }}\n        <li class=\"song{{ if .Fresh }} fresh{{ end }}\" data-id=\"{{ .ID }}\" data-slug=\"{{ .Slug }}\">\n          <button class=\"delete-song\" type=\"button\">\xe2\x95\xb3</button>\n          <a href=\"/{{ .ID }}/{{ .Slug }}\" title=\"{{ .Filename }}\">\n            {{ with .Tags }}\n            <h2>{{ with .Artist }}{{ . }} \xe2\x80\x94 {{ end }}{{ .Title }}</h2>\n              {{ if .Album }}\n            <h3><span>{{ .Album }}</span>{{ if not .Date.IsZero }} <time>({{ .Date.Year }})</time>{{ end }}, on {{ $.Date.Format \"2006-01-02\" }}</h3>\n              {{ else if not .Date.IsZero }}\n            <h3><time>{{ .Date.Format \"2006\" }}</time>, on {{ $.Date.Format \"2006-01-02\" }}</h3>\n              {{ else }}\n            <h3>on {{ $.Date.Format \"2006-01-02\" }}</h3>\n              {{ end }}\n            {{ else }}\n            <h2>{{ $.Filename }}</h2>\n            <h3>on {{ $.Date.Format \"2006-01-02\" }}</h3>\n            {{ end }}\n            <aside class=\"meta\">\n              <div class=\"duration\"><span class=\"current-time\"></span><span class=\"total-time\">{{ .Duration }}</span></div>\n            </aside>\n          </a>\n          <audio src=\"/file/{{ .ID }}\" preload=\"none\" title=\"{{ with .Tags }}{{ with .Artist }}{{ . }} \xe2\x80\x94 {{ end }}{{ .Title }}{{ end }}\">\n            Web Audio unsupported.\n          </audio>\n          <div class=\"player-track\">\n            <div class=\"player-bar playback-bar\"></div>\n            <div class=\"player-bar buffer-bar\"></div>\n          </div>\n        </li>\n{{ end }}\n"))
}
