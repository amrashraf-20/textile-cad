package api

import (
	"encoding/json"
	"net/http"

	"textilecad/backend/internal/calc"
)

func (s *Server) calcDensity(w http.ResponseWriter, r *http.Request) {
	var in calc.DensityInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	res := calc.Density(in)
	s.saveQuote(r, "density", in, res)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) calcConsumption(w http.ResponseWriter, r *http.Request) {
	var in calc.ConsumptionInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	res := calc.Consumption(in)
	s.saveQuote(r, "consumption", in, res)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) calcERP(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.requirePro(w, u) {
		return
	}
	var in calc.ERPInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	res := calc.ERP(in)
	s.saveQuote(r, "erp", in, res)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) calcSample(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.requirePro(w, u) {
		return
	}
	var in calc.SampleInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	res := calc.Sample(in)
	s.saveQuote(r, "sample", in, res)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) calcLoom(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.requirePro(w, u) {
		return
	}
	var in calc.LoomInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	res := calc.Loom(in)
	s.saveQuote(r, "loom", in, res)
	writeJSON(w, http.StatusOK, res)
}

// saveQuote stores a calculation for the history panel. Failures never block
// the response: the calculation itself is the user-facing result.
func (s *Server) saveQuote(r *http.Request, kind string, in, res any) {
	u := currentUser(r)
	if u == nil {
		return
	}
	rawIn, err := json.Marshal(in)
	if err != nil {
		return
	}
	rawRes, err := json.Marshal(res)
	if err != nil {
		return
	}
	_ = s.store.CreateQuote(r.Context(), u.ID, "", kind, rawIn, rawRes)
}
