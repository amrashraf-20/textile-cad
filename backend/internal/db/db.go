package db

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	// Serverless hosts spin up many short-lived instances, so the pool has to be
	// tunable; the defaults match a long-running single process.
	cfg.MaxConns = int32(getInt("DB_MAX_CONNS", 20))
	cfg.MinConns = int32(getInt("DB_MIN_CONNS", 2))
	cfg.MaxConnLifetime = getDuration("DB_MAX_CONN_LIFETIME", time.Hour)
	cfg.MaxConnIdleTime = getDuration("DB_MAX_CONN_IDLE_TIME", 15*time.Minute)
	if period := getDuration("DB_HEALTHCHECK_PERIOD", 30*time.Second); period > 0 {
		cfg.HealthCheckPeriod = period
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Retry so the API can start alongside a fresh database container.
	deadline := time.Now().Add(45 * time.Second)
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		err = pool.Ping(pingCtx)
		cancel()
		if err == nil {
			return pool, nil
		}
		if time.Now().After(deadline) {
			pool.Close()
			return nil, fmt.Errorf("database unreachable: %w", err)
		}
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}
}

func getInt(k string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil && v >= 0 {
		return v
	}
	return def
}

func getDuration(k string, def time.Duration) time.Duration {
	if v, err := time.ParseDuration(os.Getenv(k)); err == nil && v >= 0 {
		return v
	}
	return def
}
