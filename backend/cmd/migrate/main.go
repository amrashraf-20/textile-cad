package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/joho/godotenv"

	"textilecad/backend/internal/config"
	"textilecad/backend/internal/db"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")
}
