package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"textilecad/backend/internal/model"
)

const userColumns = `id::text, email::text, full_name, role::text, plan::text, locale,
	email_verified_at IS NOT NULL, created_at`

func scanUser(row pgx.Row) (model.User, error) {
	var u model.User
	err := row.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.Plan, &u.Locale, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) CreateUser(ctx context.Context, email, fullName, passwordHash string) (model.User, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return model.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	u, err := scanUser(tx.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name)
		VALUES ($1, $2, $3)
		RETURNING `+userColumns, email, passwordHash, fullName))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return model.User{}, ErrConflict
		}
		return model.User{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO user_settings (user_id, locale) VALUES ($1, $2)`, u.ID, u.Locale); err != nil {
		return model.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.User{}, err
	}
	return u, nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (model.User, string, error) {
	var u model.User
	var hash string
	err := s.Pool.QueryRow(ctx, `
		SELECT `+userColumns+`, password_hash
		FROM users WHERE email=$1 AND deleted_at IS NULL`, email).
		Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.Plan, &u.Locale, &u.EmailVerified, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, "", ErrNotFound
	}
	return u, hash, err
}

func (s *Store) UserByID(ctx context.Context, id string) (model.User, error) {
	u, err := scanUser(s.Pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id=$1 AND deleted_at IS NULL`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) UpdateProfile(ctx context.Context, id, fullName, locale string) (model.User, error) {
	u, err := scanUser(s.Pool.QueryRow(ctx, `
		UPDATE users SET full_name=$2, locale=$3 WHERE id=$1 AND deleted_at IS NULL
		RETURNING `+userColumns, id, fullName, locale))
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) UpdatePassword(ctx context.Context, id, hash string) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE users SET password_hash=$2 WHERE id=$1`, id, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetPlan(ctx context.Context, id, plan string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET plan=$2 WHERE id=$1`, id, plan)
	return err
}

func (s *Store) SaveRefresh(ctx context.Context, userID string, hash []byte, ua, ip string, expires time.Time) (string, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
		VALUES ($1,$2,$3,NULLIF($4,'')::inet,$5) RETURNING id::text`,
		userID, hash, ua, ip, expires).Scan(&id)
	return id, err
}

type RefreshRecord struct {
	ID         string
	UserID     string
	ExpiresAt  time.Time
	RevokedAt  *time.Time
	ReplacedBy *string
}

func (s *Store) RefreshByHash(ctx context.Context, hash []byte) (RefreshRecord, error) {
	var r RefreshRecord
	err := s.Pool.QueryRow(ctx, `
		SELECT id::text, user_id::text, expires_at, revoked_at, replaced_by::text
		FROM refresh_tokens WHERE token_hash=$1`, hash).
		Scan(&r.ID, &r.UserID, &r.ExpiresAt, &r.RevokedAt, &r.ReplacedBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return RefreshRecord{}, ErrNotFound
	}
	return r, err
}

func (s *Store) RotateRefresh(ctx context.Context, oldID, userID string, hash []byte, ua, ip string, expires time.Time) (string, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var newID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
		VALUES ($1,$2,$3,NULLIF($4,'')::inet,$5) RETURNING id::text`,
		userID, hash, ua, ip, expires).Scan(&newID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `UPDATE refresh_tokens SET revoked_at=now(), replaced_by=$2 WHERE id=$1`, oldID, newID); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newID, nil
}

func (s *Store) RevokeRefresh(ctx context.Context, hash []byte) error {
	_, err := s.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL`, hash)
	return err
}

func (s *Store) RevokeAllRefresh(ctx context.Context, userID string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID)
	return err
}

func (s *Store) GetSettings(ctx context.Context, userID string) (model.Settings, error) {
	var st model.Settings
	err := s.Pool.QueryRow(ctx, `
		SELECT locale, theme, currency, notifications FROM user_settings WHERE user_id=$1`, userID).
		Scan(&st.Locale, &st.Theme, &st.Currency, &st.Notifications)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Settings{Locale: "ar", Theme: "light", Currency: "EGP", Notifications: map[string]any{}}, nil
	}
	return st, err
}

func (s *Store) CreatePasswordReset(ctx context.Context, userID string, hash []byte, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
		userID, hash, expires)
	return err
}

func (s *Store) ConsumePasswordReset(ctx context.Context, hash []byte) (string, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var id, userID string
	err = tx.QueryRow(ctx, `
		SELECT id::text, user_id::text FROM password_reset_tokens
		WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()
		FOR UPDATE`, hash).Scan(&id, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `UPDATE password_reset_tokens SET used_at=now() WHERE id=$1`, id); err != nil {
		return "", err
	}
	return userID, tx.Commit(ctx)
}

func (s *Store) UpdateSettings(ctx context.Context, userID string, st model.Settings) (model.Settings, error) {
	var out model.Settings
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO user_settings (user_id, locale, theme, currency, notifications)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (user_id) DO UPDATE SET locale=EXCLUDED.locale, theme=EXCLUDED.theme,
			currency=EXCLUDED.currency, notifications=EXCLUDED.notifications, updated_at=now()
		RETURNING locale, theme, currency, notifications`,
		userID, st.Locale, st.Theme, st.Currency, st.Notifications).
		Scan(&out.Locale, &out.Theme, &out.Currency, &out.Notifications)
	return out, err
}
