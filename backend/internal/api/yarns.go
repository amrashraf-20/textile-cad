package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"textilecad/backend/internal/model"
	"textilecad/backend/internal/store"
)

const freeYarnQuota = 20

type yarnPayload struct {
	Name     string  `json:"name"`
	System   string  `json:"system"`
	Count    float64 `json:"count"`
	Material string  `json:"material"`
	PriceEGP float64 `json:"priceEgp"`
}

func (p *yarnPayload) validate() string {
	p.Name = strings.TrimSpace(p.Name)
	p.System = strings.ToLower(strings.TrimSpace(p.System))
	p.Material = strings.TrimSpace(p.Material)
	if len([]rune(p.Name)) < 1 || len([]rune(p.Name)) > 80 {
		return "Name must be 1-80 characters"
	}
	if p.System != "ne" && p.System != "tex" && p.System != "denier" {
		return "System must be ne, tex or denier"
	}
	if p.Count <= 0 || p.Count > 100000 {
		return "Count must be greater than zero"
	}
	if p.PriceEGP < 0 || p.PriceEGP > 1_000_000 {
		return "Price is out of range"
	}
	if len([]rune(p.Material)) > 80 {
		return "Material must be at most 80 characters"
	}
	return ""
}

func (s *Server) listYarns(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	items, err := s.store.ListYarns(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load yarns")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) createYarn(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in yarnPayload
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if msg := in.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, "invalid_yarn", msg)
		return
	}
	if !s.isPro(u) {
		n, _ := s.store.CountYarns(r.Context(), u.ID)
		if n >= freeYarnQuota {
			writeError(w, http.StatusForbidden, "quota_reached", "Free plan stores up to 20 yarns.")
			return
		}
	}
	y := &model.Yarn{
		UserID: &u.ID, Name: in.Name, System: in.System, Count: in.Count,
		Material: in.Material, PriceEGP: in.PriceEGP,
	}
	if err := s.store.CreateYarn(r.Context(), y); err != nil {
		writeError(w, http.StatusConflict, "yarn_exists", "A yarn with this name already exists")
		return
	}
	writeJSON(w, http.StatusCreated, y)
}

func (s *Server) updateYarn(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in yarnPayload
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if msg := in.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, "invalid_yarn", msg)
		return
	}
	y := &model.Yarn{
		ID: chi.URLParam(r, "id"), Name: in.Name, System: in.System,
		Count: in.Count, Material: in.Material, PriceEGP: in.PriceEGP,
	}
	if err := s.store.UpdateYarn(r.Context(), u.ID, y); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Yarn not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not update yarn")
		return
	}
	writeJSON(w, http.StatusOK, y)
}

func (s *Server) deleteYarn(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if err := s.store.DeleteYarn(r.Context(), u.ID, chi.URLParam(r, "id")); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Yarn not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not delete yarn")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
