package api

import (
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"
)

// spaCSP replaces the API's locked-down policy: the single-page app needs to
// load its own scripts, styles and fonts.
const spaCSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

// WithStatic serves the built SPA (frontend/dist) from the API process. Every
// route that is not an API endpoint falls back to index.html so client-side
// routing keeps working.
func (s *Server) WithStatic(fsys fs.FS) *Server {
	s.static = fsys
	return s
}

func (s *Server) serveSPA(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeError(w, http.StatusNotFound, "not_found", "Not found")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if name == "" || strings.HasSuffix(r.URL.Path, "/") {
		name = path.Join(name, "index.html")
	}

	data, err := fs.ReadFile(s.static, name)
	if err != nil {
		// Unknown path: hand it to the SPA router.
		name = "index.html"
		data, err = fs.ReadFile(s.static, name)
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", "Not found")
			return
		}
	}

	h := w.Header()
	h.Set("Content-Security-Policy", spaCSP)
	if name == "index.html" {
		h.Set("Content-Type", "text/html; charset=utf-8")
		h.Set("Cache-Control", "no-cache")
	} else {
		if ctype := contentType(path.Ext(name)); ctype != "" {
			h.Set("Content-Type", ctype)
		} else {
			h.Set("Content-Type", "application/octet-stream")
		}
		h.Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	h.Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write(data)
	}
}
