package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"textilecad/backend/internal/model"
)

func (s *Store) ListDesigns(ctx context.Context, userID string) ([]model.DesignSummary, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id::text, name, warp_ends, weft_picks, COALESCE(thumbnail,''), version, updated_at, created_at
		FROM designs WHERE user_id=$1 ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.DesignSummary, 0)
	for rows.Next() {
		var d model.DesignSummary
		if err := rows.Scan(&d.ID, &d.Name, &d.WarpEnds, &d.WeftPicks, &d.Thumbnail, &d.Version, &d.UpdatedAt, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) GetDesign(ctx context.Context, userID, id string) (*model.Design, error) {
	return s.designBy(ctx, `WHERE d.id=$1 AND d.user_id=$2`, id, userID)
}

func (s *Store) GetDesignByID(ctx context.Context, id string) (*model.Design, error) {
	return s.designBy(ctx, `WHERE d.id=$1`, id)
}

func (s *Store) designBy(ctx context.Context, where string, args ...any) (*model.Design, error) {
	var d model.Design
	var weaveRaw, cellRaw, warpRaw, weftRaw, settingsRaw []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT d.id::text, d.user_id::text, d.name, d.description, d.warp_ends, d.weft_picks,
		       d.weave_data, d.cell_colors, d.warp_colors, d.weft_colors, d.settings,
		       COALESCE(d.thumbnail,''), d.version, d.created_at, d.updated_at
		FROM designs d `+where, args...).
		Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.WarpEnds, &d.WeftPicks,
			&weaveRaw, &cellRaw, &warpRaw, &weftRaw, &settingsRaw,
			&d.Thumbnail, &d.Version, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(weaveRaw, &d.WeaveData)
	_ = json.Unmarshal(cellRaw, &d.CellColors)
	_ = json.Unmarshal(warpRaw, &d.WarpColors)
	_ = json.Unmarshal(weftRaw, &d.WeftColors)
	_ = json.Unmarshal(settingsRaw, &d.Settings)
	if d.Settings == nil {
		d.Settings = map[string]any{}
	}
	return &d, nil
}

func (s *Store) CreateDesign(ctx context.Context, d *model.Design) error {
	weave, _ := json.Marshal(d.WeaveData)
	cell, _ := json.Marshal(d.CellColors)
	warp, _ := json.Marshal(d.WarpColors)
	weft, _ := json.Marshal(d.WeftColors)
	settings, _ := json.Marshal(d.Settings)

	return s.Pool.QueryRow(ctx, `
		INSERT INTO designs (user_id, name, description, warp_ends, weft_picks, weave_data, cell_colors,
			warp_colors, weft_colors, settings, thumbnail)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULLIF($11,''))
		RETURNING id::text, version, created_at, updated_at`,
		d.UserID, d.Name, d.Description, d.WarpEnds, d.WeftPicks, weave, cell, warp, weft, settings, d.Thumbnail).
		Scan(&d.ID, &d.Version, &d.CreatedAt, &d.UpdatedAt)
}

func (s *Store) UpdateDesign(ctx context.Context, d *model.Design) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	err = tx.QueryRow(ctx, `SELECT version FROM designs WHERE id=$1 AND user_id=$2 FOR UPDATE`, d.ID, d.UserID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	weave, _ := json.Marshal(d.WeaveData)
	cell, _ := json.Marshal(d.CellColors)
	warp, _ := json.Marshal(d.WarpColors)
	weft, _ := json.Marshal(d.WeftColors)
	settings, _ := json.Marshal(d.Settings)

	d.Version = current + 1
	if err := tx.QueryRow(ctx, `
		UPDATE designs SET name=$3, description=$4, warp_ends=$5, weft_picks=$6,
			weave_data=$7, cell_colors=$8, warp_colors=$9, weft_colors=$10,
			settings=$11, thumbnail=NULLIF($12,''), version=$13
		WHERE id=$1 AND user_id=$2
		RETURNING updated_at`,
		d.ID, d.UserID, d.Name, d.Description, d.WarpEnds, d.WeftPicks,
		weave, cell, warp, weft, settings, d.Thumbnail, d.Version).Scan(&d.UpdatedAt); err != nil {
		return err
	}

	snapshot, _ := json.Marshal(d)
	if _, err := tx.Exec(ctx, `
		INSERT INTO design_versions (design_id, version, snapshot, created_by)
		VALUES ($1,$2,$3,$4)`, d.ID, d.Version, snapshot, d.UserID); err != nil {
		return err
	}
	// Keep the last 20 versions per design.
	if _, err := tx.Exec(ctx, `
		DELETE FROM design_versions WHERE design_id=$1 AND version <= $2`, d.ID, d.Version-20); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteDesign(ctx context.Context, userID, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM designs WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) CountDesigns(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM designs WHERE user_id=$1`, userID).Scan(&n)
	return n, err
}

func (s *Store) DuplicateDesign(ctx context.Context, userID, id string) (*model.Design, error) {
	src, err := s.GetDesign(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	d := *src
	d.ID = ""
	d.Name = src.Name + " (copy)"
	d.Version = 0
	d.CreatedAt = time.Time{}
	d.UpdatedAt = time.Time{}
	if err := s.CreateDesign(ctx, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *Store) RecentDesigns(ctx context.Context, userID string, limit int) ([]model.DesignSummary, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id::text, name, warp_ends, weft_picks, COALESCE(thumbnail,''), version, updated_at, created_at
		FROM designs WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.DesignSummary, 0, limit)
	for rows.Next() {
		var d model.DesignSummary
		if err := rows.Scan(&d.ID, &d.Name, &d.WarpEnds, &d.WeftPicks, &d.Thumbnail, &d.Version, &d.UpdatedAt, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
