package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

func SecurityHeaders(env string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
			if env == "production" {
				h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// OriginCheck rejects state-changing requests whose Origin is not allowed.
func OriginCheck(allowed []string) func(http.Handler) http.Handler {
	set := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		set[strings.TrimRight(o, "/")] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := set[strings.TrimRight(origin, "/")]; !ok {
					http.Error(w, `{"error":{"code":"origin_not_allowed","message":"Origin not allowed"}}`, http.StatusForbidden)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

type bucket struct {
	count int
	reset time.Time
}

// RateLimit is a per-key fixed-window limiter. For multi-instance deployments
// replace it with a Redis-backed limiter.
func RateLimit(limit int, window time.Duration, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	if limit <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}

	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for now := range t.C {
			mu.Lock()
			for k, b := range buckets {
				if now.After(b.reset) {
					delete(buckets, k)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			now := time.Now()
			mu.Lock()
			b, ok := buckets[key]
			if !ok || now.After(b.reset) {
				b = &bucket{reset: now.Add(window)}
				buckets[key] = b
			}
			b.count++
			blocked := b.count > limit
			mu.Unlock()
			if blocked {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":{"code":"rate_limited","message":"Too many requests, try again later"}}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func ClientIP(r *http.Request) string {
	if r.RemoteAddr == "" {
		return ""
	}
	if i := strings.LastIndex(r.RemoteAddr, ":"); i > 0 {
		return strings.Trim(r.RemoteAddr[:i], "[]")
	}
	return r.RemoteAddr
}
