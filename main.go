// Command server runs the whole app from one process: the JSON API plus the
// built single-page frontend. Hosts that give a single port (Vercel's Go
// runtime, plain containers) can therefore deploy the project as-is.
package main

import (
	"textilecad/backend/cmd/vercel"
	"textilecad/webui"
)

func main() {
	vercel.Run(webui.Dist())
}
