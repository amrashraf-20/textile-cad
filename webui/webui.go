// Package webui embeds the compiled single-page app so the Go binary can serve
// it without a separate web server. The dist directory is filled by the build
// (see vercel.json); the committed placeholder only keeps `go build` working
// before any frontend build has run.
package webui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// Dist returns the embedded frontend rooted at the dist directory.
func Dist() fs.FS {
	dist, err := fs.Sub(files, "dist")
	if err != nil {
		return nil
	}
	return dist
}
