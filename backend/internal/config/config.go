package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env             string
	Port            string
	DatabaseURL     string
	JWTSecret       string
	AccessTTL       time.Duration
	RefreshTTL      time.Duration
	CORSOrigins     []string
	CookieSecure    bool
	CookieDomain    string
	PublicWebURL    string
	AutoMigrate     bool
	LoginRatePerMin int

	// AI assistant (OpenAI-compatible providers; OpenRouter by default).
	AIEnabled     bool
	AIProvider    string
	AIBaseURL     string
	AIAPIKey      string
	AIAppName     string
	AIModel       string
	AIVisionModel string
	AITimeout     time.Duration
}

func Load() (*Config, error) {
	c := &Config{
		Env:             get("APP_ENV", "development"),
		Port:            get("PORT", "8080"),
		DatabaseURL:     get("DATABASE_URL", "postgres://textile:textile@localhost:5432/textile?sslmode=disable"),
		JWTSecret:       get("JWT_SECRET", ""),
		CookieDomain:    get("COOKIE_DOMAIN", ""),
		PublicWebURL:    strings.TrimRight(get("PUBLIC_WEB_URL", "http://localhost:5173"), "/"),
		LoginRatePerMin: getInt("LOGIN_RATE_PER_MIN", 8),

		AIProvider:    get("AI_PROVIDER", "openrouter"),
		AIBaseURL:     strings.TrimRight(get("AI_BASE_URL", "https://openrouter.ai/api/v1"), "/"),
		AIAPIKey:      get("AI_API_KEY", get("OPENROUTER_API_KEY", "")),
		AIAppName:     get("AI_APP_NAME", "Textile CAD Studio"),
		AIModel:       get("AI_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
		AIVisionModel: get("AI_VISION_MODEL", "google/gemini-2.0-flash-exp:free"),
	}

	var err error
	if c.AccessTTL, err = time.ParseDuration(get("ACCESS_TTL", "15m")); err != nil {
		return nil, fmt.Errorf("ACCESS_TTL: %w", err)
	}
	if c.RefreshTTL, err = time.ParseDuration(get("REFRESH_TTL", "720h")); err != nil {
		return nil, fmt.Errorf("REFRESH_TTL: %w", err)
	}
	if c.CookieSecure, err = strconv.ParseBool(get("COOKIE_SECURE", "false")); err != nil {
		return nil, fmt.Errorf("COOKIE_SECURE: %w", err)
	}
	if c.AutoMigrate, err = strconv.ParseBool(get("AUTO_MIGRATE", "true")); err != nil {
		return nil, fmt.Errorf("AUTO_MIGRATE: %w", err)
	}
	if c.AITimeout, err = time.ParseDuration(get("AI_TIMEOUT", "45s")); err != nil {
		return nil, fmt.Errorf("AI_TIMEOUT: %w", err)
	}
	c.AIEnabled = c.AIAPIKey != "" && get("AI_ENABLED", "true") != "false"

	for _, o := range strings.Split(get("CORS_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSOrigins = append(c.CORSOrigins, o)
		}
	}

	if c.JWTSecret == "" {
		if c.Env == "production" {
			return nil, fmt.Errorf("JWT_SECRET is required in production")
		}
		c.JWTSecret = "dev-only-insecure-secret-change-me-32-bytes-min"
	}
	if c.Env == "production" && len(c.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 bytes in production")
	}
	if c.Env == "production" && !c.CookieSecure {
		return nil, fmt.Errorf("COOKIE_SECURE must be true in production")
	}
	return c, nil
}

func get(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

func getInt(k string, def int) int {
	if v, ok := os.LookupEnv(k); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
