package api

import (
	"net/http"

	"textilecad/backend/internal/model"
)

func (s *Server) dashboard(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	ctx := r.Context()

	designs, err := s.store.CountDesigns(ctx, u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load dashboard")
		return
	}
	yarns, _ := s.store.CountYarns(ctx, u.ID)
	quotes, _ := s.store.CountQuotes(ctx, u.ID)
	recent, _ := s.store.RecentDesigns(ctx, u.ID, 6)
	activity, _ := s.store.DesignActivity(ctx, u.ID, 7)

	gridLimit := maxGridFree
	designLimit := freeQuota
	if s.isPro(u) {
		gridLimit = maxGrid
		designLimit = 0
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"counts": map[string]int{
			"designs": designs,
			"yarns":   yarns,
			"quotes":  quotes,
		},
		"recent":   recent,
		"activity": activity,
		"plan": map[string]any{
			"tier":        u.Plan,
			"pro":         s.isPro(u),
			"gridLimit":   gridLimit,
			"designLimit": designLimit,
		},
	})
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	st, err := s.store.GetSettings(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load settings")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in model.Settings
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if in.Locale != "ar" && in.Locale != "en" {
		writeError(w, http.StatusBadRequest, "invalid_locale", "Locale must be ar or en")
		return
	}
	if in.Theme != "light" && in.Theme != "dark" {
		writeError(w, http.StatusBadRequest, "invalid_theme", "Theme must be light or dark")
		return
	}
	if in.Currency != "EGP" && in.Currency != "USD" {
		writeError(w, http.StatusBadRequest, "invalid_currency", "Currency must be EGP or USD")
		return
	}
	if in.Notifications == nil {
		in.Notifications = map[string]any{}
	}
	st, err := s.store.UpdateSettings(r.Context(), u.ID, in)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not save settings")
		return
	}
	if in.Locale != u.Locale {
		_, _ = s.store.UpdateProfile(r.Context(), u.ID, u.FullName, in.Locale)
	}
	writeJSON(w, http.StatusOK, st)
}
