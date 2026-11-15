package main

import "textilecad/backend/internal/app"

func main() {
	// The standalone API: a reverse proxy (nginx, a PaaS router, ...) serves
	// the SPA and forwards /api to this process.
	app.Run(nil)
}
