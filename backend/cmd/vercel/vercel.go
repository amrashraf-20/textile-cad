// Package vercel exposes the API together with the built SPA so it can be run as
// one binary on hosts that give a single process a single port (Vercel's Go
// runtime, bare containers, ...).
package vercel

import (
	"io/fs"

	"textilecad/backend/internal/app"
)

// Run starts the HTTP server, serving the frontend from static.
func Run(static fs.FS) {
	app.Run(static)
}
