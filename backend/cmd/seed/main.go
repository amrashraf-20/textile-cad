package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"textilecad/backend/internal/auth"
	"textilecad/backend/internal/config"
	"textilecad/backend/internal/db"
	"textilecad/backend/internal/store"
)

// seed creates (or promotes) the admin account from SEED_ADMIN_* env vars.
func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	email := strings.ToLower(strings.TrimSpace(os.Getenv("SEED_ADMIN_EMAIL")))
	password := os.Getenv("SEED_ADMIN_PASSWORD")
	if email == "" || password == "" {
		slog.Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required")
		os.Exit(1)
	}
	if len(password) < 10 {
		slog.Error("SEED_ADMIN_PASSWORD must be at least 10 characters")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	st := store.New(pool)
	hash, err := auth.HashPassword(password)
	if err != nil {
		slog.Error("hash", "err", err)
		os.Exit(1)
	}

	if existing, _, err := st.UserByEmail(ctx, email); err == nil {
		if _, err := pool.Exec(ctx, `UPDATE users SET role='admin', plan='pro', password_hash=$2 WHERE id=$1`, existing.ID, hash); err != nil {
			slog.Error("promote admin", "err", err)
			os.Exit(1)
		}
		slog.Info("admin updated", "email", email)
		return
	}

	u, err := st.CreateUser(ctx, email, "Administrator", hash)
	if err != nil {
		slog.Error("create admin", "err", err)
		os.Exit(1)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET role='admin', plan='pro' WHERE id=$1`, u.ID); err != nil {
		slog.Error("promote admin", "err", err)
		os.Exit(1)
	}
	slog.Info("admin created", "email", email)
}
