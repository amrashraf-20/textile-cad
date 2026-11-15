package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"textilecad/backend/internal/model"
)

func (s *Store) ListYarns(ctx context.Context, userID string) ([]model.Yarn, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id::text, user_id::text, name, system, count::float8, material, price_egp::float8,
		       is_global, created_at, updated_at
		FROM yarns WHERE user_id=$1 OR is_global
		ORDER BY is_global DESC, lower(name)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Yarn, 0)
	for rows.Next() {
		var y model.Yarn
		if err := rows.Scan(&y.ID, &y.UserID, &y.Name, &y.System, &y.Count, &y.Material, &y.PriceEGP,
			&y.IsGlobal, &y.CreatedAt, &y.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, y)
	}
	return out, rows.Err()
}

func (s *Store) CreateYarn(ctx context.Context, y *model.Yarn) error {
	return s.Pool.QueryRow(ctx, `
		INSERT INTO yarns (user_id, name, system, count, material, price_egp)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id::text, created_at, updated_at`,
		y.UserID, y.Name, y.System, y.Count, y.Material, y.PriceEGP).
		Scan(&y.ID, &y.CreatedAt, &y.UpdatedAt)
}

func (s *Store) UpdateYarn(ctx context.Context, userID string, y *model.Yarn) error {
	tag, err := s.Pool.Exec(ctx, `
		UPDATE yarns SET name=$3, system=$4, count=$5, material=$6, price_egp=$7
		WHERE id=$1 AND user_id=$2 AND is_global=false`,
		y.ID, userID, y.Name, y.System, y.Count, y.Material, y.PriceEGP)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteYarn(ctx context.Context, userID, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM yarns WHERE id=$1 AND user_id=$2 AND is_global=false`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListRates(ctx context.Context) ([]model.Rate, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT key, value::float8, unit, source, fetched_at FROM price_rates ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.Rate, 0)
	for rows.Next() {
		var r model.Rate
		if err := rows.Scan(&r.Key, &r.Value, &r.Unit, &r.Source, &r.FetchedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) UpsertRate(ctx context.Context, r model.Rate) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO price_rates (key, value, unit, source, fetched_at)
		VALUES ($1,$2,$3,$4,now())
		ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, unit=EXCLUDED.unit,
			source=EXCLUDED.source, fetched_at=now()`, r.Key, r.Value, r.Unit, r.Source)
	return err
}

func (s *Store) CreateQuote(ctx context.Context, userID, designID, kind string, input, result []byte) error {
	var dID *string
	if designID != "" {
		dID = &designID
	}
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO quotes (user_id, design_id, kind, input, result)
		VALUES ($1,$2,$3,$4,$5)`, userID, dID, kind, input, result)
	return err
}

func (s *Store) CreateShareLink(ctx context.Context, designID, userID string, tokenHash []byte, expires time.Time) (string, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO share_links (design_id, created_by, token_hash, expires_at)
		VALUES ($1,$2,$3,$4) RETURNING id::text`,
		designID, userID, tokenHash, expires).Scan(&id)
	return id, err
}

func (s *Store) ShareByHash(ctx context.Context, hash []byte) (designID string, revoked bool, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT design_id::text, revoked_at IS NOT NULL
		FROM share_links
		WHERE token_hash=$1 AND expires_at > now()`, hash).Scan(&designID, &revoked)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, ErrNotFound
	}
	return designID, revoked, err
}

func (s *Store) IncrementShareView(ctx context.Context, hash []byte) {
	_, _ = s.Pool.Exec(ctx, `UPDATE share_links SET view_count=view_count+1 WHERE token_hash=$1`, hash)
}

func (s *Store) InsertAudit(ctx context.Context, userID *string, action, entity, entityID, ip, ua string, meta []byte) {
	if len(meta) == 0 {
		meta = []byte(`{}`)
	}
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO audit_logs (user_id, action, entity, entity_id, ip, user_agent, meta)
		VALUES ($1,$2,$3,$4,NULLIF($5,'')::inet,$6,$7)`, userID, action, entity, entityID, ip, ua, meta)
}

func (s *Store) CountYarns(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM yarns WHERE user_id=$1`, userID).Scan(&n)
	return n, err
}

func (s *Store) CountQuotes(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM quotes WHERE user_id=$1`, userID).Scan(&n)
	return n, err
}

type ActivityPoint struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

func (s *Store) DesignActivity(ctx context.Context, userID string, days int) ([]ActivityPoint, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT to_char(d.day,'YYYY-MM-DD'), COALESCE(count(ds.id),0)
		FROM generate_series(current_date - ($2::int - 1), current_date, '1 day') AS d(day)
		LEFT JOIN designs ds ON ds.user_id=$1 AND ds.created_at::date = d.day
		GROUP BY d.day ORDER BY d.day`, userID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ActivityPoint, 0, days)
	for rows.Next() {
		var p ActivityPoint
		if err := rows.Scan(&p.Day, &p.Count); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
