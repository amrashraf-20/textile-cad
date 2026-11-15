package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"textilecad/backend/internal/ai"
	"textilecad/backend/internal/auth"
	"textilecad/backend/internal/config"
	"textilecad/backend/internal/middleware"
	"textilecad/backend/internal/model"
	"textilecad/backend/internal/store"
)

type Server struct {
	cfg    *config.Config
	store  *store.Store
	tokens *auth.TokenService
	ai     *ai.Client
	log    *slog.Logger
}

func New(cfg *config.Config, st *store.Store, tokens *auth.TokenService, log *slog.Logger) *Server {
	return &Server{cfg: cfg, store: st, tokens: tokens, ai: ai.New(cfg), log: log}
}

type ctxKey int

const userKey ctxKey = 1

func currentUser(r *http.Request) *model.User {
	u, _ := r.Context().Value(userKey).(*model.User)
	return u
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(s.requestLogger)
	r.Use(middleware.SecurityHeaders(s.cfg.Env))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"X-Request-Id", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
		defer cancel()
		if err := s.store.Pool.Ping(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "not_ready", "database unavailable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.OriginCheck(s.cfg.CORSOrigins))

		r.Route("/auth", func(r chi.Router) {
			r.With(s.authRateLimit).Post("/register", s.register)
			r.With(s.authRateLimit).Post("/login", s.login)
			r.Post("/refresh", s.refresh)
			r.Post("/logout", s.logout)
			r.With(s.authRateLimit).Post("/forgot-password", s.forgotPassword)
			r.With(s.authRateLimit).Post("/reset-password", s.resetPassword)

			r.Group(func(r chi.Router) {
				r.Use(s.authenticate)
				r.Get("/me", s.me)
				r.Patch("/me", s.updateMe)
				r.Post("/change-password", s.changePassword)
				r.Post("/logout-all", s.logoutAll)
			})
		})

		r.Get("/public/designs/{token}", s.publicDesign)

		r.Group(func(r chi.Router) {
			r.Use(s.authenticate)

			r.Get("/settings", s.getSettings)
			r.Put("/settings", s.putSettings)

			r.Get("/designs", s.listDesigns)
			r.Post("/designs", s.createDesign)
			r.Get("/designs/{id}", s.getDesign)
			r.Put("/designs/{id}", s.updateDesign)
			r.Delete("/designs/{id}", s.deleteDesign)
			r.Post("/designs/{id}/duplicate", s.duplicateDesign)
			r.Post("/designs/{id}/share", s.shareDesign)
			r.Get("/designs/{id}/export/wif", s.exportWIF)
			r.Get("/designs/{id}/export/csv", s.exportCSV)

			r.Get("/yarns", s.listYarns)
			r.Post("/yarns", s.createYarn)
			r.Put("/yarns/{id}", s.updateYarn)
			r.Delete("/yarns/{id}", s.deleteYarn)

			r.Get("/rates", s.listRates)
			r.Post("/rates/refresh", s.refreshRates)

			r.Post("/calc/density", s.calcDensity)
			r.Post("/calc/consumption", s.calcConsumption)
			r.Post("/calc/erp", s.calcERP)
			r.Post("/calc/sample", s.calcSample)
			r.Post("/calc/loom", s.calcLoom)

			r.Get("/dashboard", s.dashboard)

			// AI assistant: chat + sample-photo analysis. Rate limited per user.
			r.Get("/ai/status", s.aiStatus)
			r.With(s.aiRateLimit(30)).Post("/ai/chat", s.aiChat)
			r.With(s.aiRateLimit(8)).Post("/ai/analyze", s.aiAnalyze)
			r.With(s.aiRateLimit(8)).Post("/ai/analyze-sample", s.aiAnalyze)
		})
	})
	return r
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		s.log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", chimw.GetReqID(r.Context()),
			"ip", middleware.ClientIP(r),
		)
	})
}

func (s *Server) authRateLimit(next http.Handler) http.Handler {
	limit := middleware.RateLimit(s.cfg.LoginRatePerMin, time.Minute, func(r *http.Request) string {
		return middleware.ClientIP(r) + "|" + r.URL.Path
	})
	return limit(next)
}

// aiRateLimit throttles assistant calls per authenticated user so a single
// account cannot exhaust the shared provider quota.
func (s *Server) aiRateLimit(perMinute int) func(http.Handler) http.Handler {
	return middleware.RateLimit(perMinute, time.Minute, func(r *http.Request) string {
		if u := currentUser(r); u != nil {
			return "ai|" + u.ID + "|" + r.URL.Path
		}
		return "ai|" + middleware.ClientIP(r) + "|" + r.URL.Path
	})
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Missing access token")
			return
		}
		claims, err := s.tokens.ParseAccess(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired access token")
			return
		}
		u, err := s.store.UserByID(r.Context(), claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Account not available")
			return
		}
		ctx := context.WithValue(r.Context(), userKey, &u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) isPro(u *model.User) bool {
	return u != nil && (u.Plan == "pro" || u.Role == "admin")
}

func (s *Server) requirePro(w http.ResponseWriter, u *model.User) bool {
	if s.isPro(u) {
		return true
	}
	writeError(w, http.StatusForbidden, "plan_required", "This feature requires the Pro plan")
	return false
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "message": message},
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errors.New("invalid JSON body")
	}
	if dec.More() {
		return errors.New("body must contain a single JSON object")
	}
	return nil
}

func (s *Server) audit(r *http.Request, userID *string, action, entity, entityID string, meta any) {
	var raw []byte
	if meta != nil {
		raw, _ = json.Marshal(meta)
	}
	ua := r.UserAgent()
	if len(ua) > 300 {
		ua = ua[:300]
	}
	s.store.InsertAudit(r.Context(), userID, action, entity, entityID, middleware.ClientIP(r), ua, raw)
}
