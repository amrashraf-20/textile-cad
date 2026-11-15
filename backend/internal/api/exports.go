package api

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"

	"textilecad/backend/internal/model"
	"textilecad/backend/internal/store"
	"textilecad/backend/internal/weave"
)

func (s *Server) exportWIF(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.requirePro(w, u) {
		return
	}
	d, err := s.store.GetDesign(r.Context(), u.ID, chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load design")
		return
	}
	body := weave.WIF(d.Name, d.WarpEnds, d.WeftPicks, d.WeaveData, d.WarpColors, d.WeftColors)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", attachment(d, "wif"))
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(body))
}

func (s *Server) exportCSV(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	d, err := s.store.GetDesign(r.Context(), u.ID, chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load design")
		return
	}
	body := weave.CSV(d.WeaveData)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", attachment(d, "csv"))
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(body))
}

// attachment builds a Content-Disposition header that keeps the user's own
// (possibly Arabic) design name in modern browsers and always falls back to a
// unique ASCII filename. Without the id suffix, every Arabic-named design
// would download as "design.wif" and overwrite the previous one.
func attachment(d *model.Design, ext string) string {
	base := safeFilename(d.Name)
	if base == "design" {
		compact := strings.ReplaceAll(d.ID, "-", "")
		if len(compact) > 8 {
			compact = compact[:8]
		}
		base = "design-" + compact
	}
	fallback := base + "." + ext
	encoded := strings.ReplaceAll(url.QueryEscape(safeOriginal(d.Name, ext)), "+", "%20")
	return "attachment; filename=\"" + fallback + "\"; filename*=UTF-8''" + encoded
}

// safeOriginal keeps the design name readable for the RFC 5987 filename* value
// while stripping path separators and control characters.
func safeOriginal(name, ext string) string {
	name = strings.TrimSpace(name)
	name = strings.Map(func(r rune) rune {
		switch {
		case r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|':
			return '-'
		case r < 0x20 || r == 0x7f:
			return -1
		}
		return r
	}, name)
	if name == "" {
		return "design." + ext
	}
	if !strings.Contains(strings.ToLower(name), "."+ext) {
		name += "." + ext
	}
	return name
}

func safeFilename(name string) string {
	if name == "" {
		return "design"
	}
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		case r == ' ':
			out = append(out, '_')
		}
	}
	if len(out) == 0 {
		return "design"
	}
	if len(out) > 60 {
		out = out[:60]
	}
	return string(out)
}
