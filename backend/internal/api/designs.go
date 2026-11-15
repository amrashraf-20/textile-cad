package api

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"textilecad/backend/internal/auth"
	"textilecad/backend/internal/model"
	"textilecad/backend/internal/store"
)

const (
	maxGridFree = 16
	maxGrid     = 100
	freeQuota   = 5
)

var hexRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var defaultWarpColors = []string{"#23364C", "#D92D20", "#E4E4E1", "#2E90FA"}
var defaultWeftColors = []string{"#FFFFFF", "#F2F4F7", "#D92D20", "#23364C"}

type designPayload struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	WarpEnds    int         `json:"warpEnds"`
	WeftPicks   int         `json:"weftPicks"`
	WeaveData   [][]int     `json:"weaveData"`
	CellColors  [][]*string `json:"cellColors"`
	WarpColors  []string    `json:"warpColors"`
	WeftColors  []string    `json:"weftColors"`
	Settings    map[string]any `json:"settings"`
	Thumbnail   string      `json:"thumbnail"`
}

func (p *designPayload) normalize() {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" {
		p.Name = "Untitled design"
	}
	if len([]rune(p.Name)) > 120 {
		p.Name = string([]rune(p.Name)[:120])
	}
	p.Description = strings.TrimSpace(p.Description)
	if len([]rune(p.Description)) > 1000 {
		p.Description = string([]rune(p.Description)[:1000])
	}
	if p.WarpEnds < 2 {
		p.WarpEnds = 2
	}
	if p.WarpEnds > maxGrid {
		p.WarpEnds = maxGrid
	}
	if p.WeftPicks < 2 {
		p.WeftPicks = 2
	}
	if p.WeftPicks > maxGrid {
		p.WeftPicks = maxGrid
	}

	weave := make([][]int, p.WeftPicks)
	for r := range weave {
		weave[r] = make([]int, p.WarpEnds)
		if r < len(p.WeaveData) {
			for c := 0; c < p.WarpEnds && c < len(p.WeaveData[r]); c++ {
				if p.WeaveData[r][c] == 1 {
					weave[r][c] = 1
				}
			}
		}
	}
	p.WeaveData = weave

	if len(p.CellColors) == 0 {
		p.CellColors = [][]*string{}
	} else {
		cells := make([][]*string, p.WeftPicks)
		for r := range cells {
			cells[r] = make([]*string, p.WarpEnds)
			if r < len(p.CellColors) {
				for c := 0; c < p.WarpEnds && c < len(p.CellColors[r]); c++ {
					if p.CellColors[r][c] != nil && hexRe.MatchString(*p.CellColors[r][c]) {
						v := strings.ToUpper(*p.CellColors[r][c])
						cells[r][c] = &v
					}
				}
			}
		}
		p.CellColors = cells
	}

	p.WarpColors = normalizeColors(p.WarpColors, p.WarpEnds, defaultWarpColors)
	p.WeftColors = normalizeColors(p.WeftColors, p.WeftPicks, defaultWeftColors)
	if p.Settings == nil {
		p.Settings = map[string]any{}
	}
	if len(p.Thumbnail) > 400_000 {
		p.Thumbnail = ""
	}
}

func normalizeColors(in []string, n int, palette []string) []string {
	out := make([]string, n)
	for i := 0; i < n; i++ {
		if i < len(in) && hexRe.MatchString(in[i]) {
			out[i] = strings.ToUpper(in[i])
		} else {
			out[i] = palette[i%len(palette)]
		}
	}
	return out
}

func (s *Server) listDesigns(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	items, err := s.store.ListDesigns(r.Context(), u.ID)
	if err != nil {
		s.log.Error("list designs", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not load designs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) createDesign(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in designPayload
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	in.normalize()

	if !s.isPro(u) && (in.WarpEnds > maxGridFree || in.WeftPicks > maxGridFree) {
		writeError(w, http.StatusForbidden, "plan_required", "Free plan supports up to 16x16. Upgrade to Pro for 100x100.")
		return
	}
	if !s.isPro(u) {
		n, err := s.store.CountDesigns(r.Context(), u.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not check quota")
			return
		}
		if n >= freeQuota {
			writeError(w, http.StatusForbidden, "quota_reached", "Free plan stores up to 5 designs. Upgrade to Pro for unlimited.")
			return
		}
	}

	d := &model.Design{
		UserID:      u.ID,
		Name:        in.Name,
		Description: in.Description,
		WarpEnds:    in.WarpEnds,
		WeftPicks:   in.WeftPicks,
		WeaveData:   in.WeaveData,
		CellColors:  in.CellColors,
		WarpColors:  in.WarpColors,
		WeftColors:  in.WeftColors,
		Settings:    in.Settings,
		Thumbnail:   in.Thumbnail,
	}
	if err := s.store.CreateDesign(r.Context(), d); err != nil {
		s.log.Error("create design", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not save design")
		return
	}
	s.audit(r, &u.ID, "design.create", "design", d.ID, nil)
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) getDesign(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) updateDesign(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := chi.URLParam(r, "id")
	existing, err := s.store.GetDesign(r.Context(), u.ID, id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load design")
		return
	}

	var in designPayload
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	in.normalize()
	if !s.isPro(u) && (in.WarpEnds > maxGridFree || in.WeftPicks > maxGridFree) {
		writeError(w, http.StatusForbidden, "plan_required", "Free plan supports up to 16x16.")
		return
	}

	existing.Name = in.Name
	existing.Description = in.Description
	existing.WarpEnds = in.WarpEnds
	existing.WeftPicks = in.WeftPicks
	existing.WeaveData = in.WeaveData
	existing.CellColors = in.CellColors
	existing.WarpColors = in.WarpColors
	existing.WeftColors = in.WeftColors
	existing.Settings = in.Settings
	existing.Thumbnail = in.Thumbnail

	if err := s.store.UpdateDesign(r.Context(), existing); err != nil {
		s.log.Error("update design", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not save design")
		return
	}
	writeJSON(w, http.StatusOK, existing)
}

func (s *Server) deleteDesign(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := chi.URLParam(r, "id")
	if err := s.store.DeleteDesign(r.Context(), u.ID, id); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not delete design")
		return
	}
	s.audit(r, &u.ID, "design.delete", "design", id, nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) duplicateDesign(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.isPro(u) {
		n, _ := s.store.CountDesigns(r.Context(), u.ID)
		if n >= freeQuota {
			writeError(w, http.StatusForbidden, "quota_reached", "Free plan stores up to 5 designs.")
			return
		}
	}
	d, err := s.store.DuplicateDesign(r.Context(), u.ID, chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not duplicate design")
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) shareDesign(w http.ResponseWriter, r *http.Request) {
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
	raw := randomToken(32)
	expires := time.Now().Add(30 * 24 * time.Hour)
	if _, err := s.store.CreateShareLink(r.Context(), d.ID, u.ID, auth.HashRefresh(raw), expires); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not create share link")
		return
	}
	s.audit(r, &u.ID, "design.share", "design", d.ID, nil)
	writeJSON(w, http.StatusCreated, map[string]any{
		"url":       s.cfg.PublicWebURL + "/share/" + raw,
		"expiresAt": expires,
	})
}

func (s *Server) publicDesign(w http.ResponseWriter, r *http.Request) {
	raw := chi.URLParam(r, "token")
	if len(raw) < 20 || len(raw) > 100 {
		writeError(w, http.StatusNotFound, "not_found", "Link not found")
		return
	}
	hash := auth.HashRefresh(raw)
	designID, revoked, err := s.store.ShareByHash(r.Context(), hash)
	if err != nil || revoked {
		writeError(w, http.StatusNotFound, "not_found", "Link is invalid or expired")
		return
	}
	d, err := s.store.GetDesignByID(r.Context(), designID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Design not found")
		return
	}
	s.store.IncrementShareView(r.Context(), hash)
	writeJSON(w, http.StatusOK, map[string]any{
		"name":        d.Name,
		"description": d.Description,
		"warpEnds":    d.WarpEnds,
		"weftPicks":   d.WeftPicks,
		"weaveData":   d.WeaveData,
		"cellColors":  d.CellColors,
		"warpColors":  d.WarpColors,
		"weftColors":  d.WeftColors,
		"settings":    d.Settings,
		"version":     d.Version,
		"createdAt":   d.CreatedAt,
	})
}
