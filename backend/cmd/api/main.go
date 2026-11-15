package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"textilecad/backend/internal/api"
	"textilecad/backend/internal/auth"
	"textilecad/backend/internal/config"
	"textilecad/backend/internal/db"
	"textilecad/backend/internal/store"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	level := slog.LevelInfo
	if cfg.Env == "development" {
		level = slog.LevelDebug
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	slog.SetDefault(log)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if cfg.AutoMigrate {
		if err := db.Migrate(ctx, pool); err != nil {
			log.Error("migrate", "err", err)
			os.Exit(1)
		}
	}

	st := store.New(pool)
	tokens := auth.NewTokenService(cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
	srv := api.New(cfg, st, tokens, log)

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Info("api listening", "port", cfg.Port, "env", cfg.Env)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("listen", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown", "err", err)
	}
	log.Info("api stopped")
}
