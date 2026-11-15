package api

import (
	"encoding/json"
	"net/http"
	"time"

	"textilecad/backend/internal/model"
)

func (s *Server) listRates(w http.ResponseWriter, r *http.Request) {
	rates, err := s.store.ListRates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not load rates")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": rates})
}

// refreshRates pulls USD/EGP from a single allow-listed host. No user input
// reaches the URL, which closes the SSRF surface.
func (s *Server) refreshRates(w http.ResponseWriter, r *http.Request) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://open.er-api.com/v6/latest/USD")
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "Could not reach the exchange rate service")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "upstream_error", "Exchange rate service returned an error")
		return
	}
	var body struct {
		Result string             `json:"result"`
		Rates  map[string]float64 `json:"rates"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, resp.Body, 512<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "Invalid response from rate service")
		return
	}
	egp, ok := body.Rates["EGP"]
	if body.Result != "success" || !ok || egp <= 0 || egp > 1000 {
		writeError(w, http.StatusBadGateway, "upstream_error", "Invalid exchange rate")
		return
	}
	if err := s.store.UpsertRate(r.Context(), model.Rate{Key: "usd_egp", Value: egp, Unit: "EGP per USD", Source: "open.er-api.com"}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not save rate")
		return
	}
	rates, _ := s.store.ListRates(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"items": rates})
}
