package api

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"textilecad/backend/internal/auth"
	"textilecad/backend/internal/middleware"
	"textilecad/backend/internal/model"
	"textilecad/backend/internal/store"
)

const refreshCookie = "tc_refresh"

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
	Locale   string `json:"locale"`
}

type authResponse struct {
	User        model.User `json:"user"`
	AccessToken string     `json:"accessToken"`
	ExpiresIn   int        `json:"expiresIn"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var in registerRequest
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.FullName = strings.TrimSpace(in.FullName)
	in.Locale = strings.ToLower(strings.TrimSpace(in.Locale))
	if in.Locale == "" {
		in.Locale = "ar"
	}
	if !validEmail(in.Email) {
		writeError(w, http.StatusBadRequest, "invalid_email", "Enter a valid email address")
		return
	}
	if !validPassword(in.Password) {
		writeError(w, http.StatusBadRequest, "weak_password", "Password must be 10-128 characters and include a letter and a number")
		return
	}
	if len([]rune(in.FullName)) < 2 || len([]rune(in.FullName)) > 80 {
		writeError(w, http.StatusBadRequest, "invalid_name", "Full name must be 2-80 characters")
		return
	}
	if in.Locale != "ar" && in.Locale != "en" {
		in.Locale = "ar"
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		s.log.Error("hash password", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not create account")
		return
	}
	u, err := s.store.CreateUser(r.Context(), in.Email, in.FullName, hash)
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, "email_taken", "An account with this email already exists")
		return
	}
	if err != nil {
		s.log.Error("create user", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not create account")
		return
	}
	if in.Locale != u.Locale {
		if _, err := s.store.UpdateProfile(r.Context(), u.ID, u.FullName, in.Locale); err == nil {
			u.Locale = in.Locale
		}
	}
	_, _ = s.store.UpdateSettings(r.Context(), u.ID, model.Settings{
		Locale: u.Locale, Theme: "light", Currency: "EGP",
		Notifications: map[string]any{"product": true, "security": true},
	})

	access, err := s.startSession(w, r, &u)
	if err != nil {
		s.log.Error("start session", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Account created, please sign in")
		return
	}
	s.audit(r, &u.ID, "auth.register", "user", u.ID, nil)
	writeJSON(w, http.StatusCreated, authResponse{User: u, AccessToken: access, ExpiresIn: int(s.cfg.AccessTTL.Seconds())})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))

	u, hash, err := s.store.UserByEmail(r.Context(), in.Email)
	if err != nil {
		_ = auth.VerifyPassword(in.Password, auth.DummyHash)
		s.audit(r, nil, "auth.login_failed", "user", "", map[string]string{"email": in.Email})
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email or password is incorrect")
		return
	}
	if !auth.VerifyPassword(in.Password, hash) {
		s.audit(r, &u.ID, "auth.login_failed", "user", u.ID, nil)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email or password is incorrect")
		return
	}
	access, err := s.startSession(w, r, &u)
	if err != nil {
		s.log.Error("start session", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not start session")
		return
	}
	s.audit(r, &u.ID, "auth.login", "user", u.ID, nil)
	writeJSON(w, http.StatusOK, authResponse{User: u, AccessToken: access, ExpiresIn: int(s.cfg.AccessTTL.Seconds())})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(refreshCookie)
	if err != nil || c.Value == "" {
		writeError(w, http.StatusUnauthorized, "no_session", "No active session")
		return
	}
	hash := auth.HashRefresh(c.Value)
	rec, err := s.store.RefreshByHash(r.Context(), hash)
	if err != nil {
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "invalid_session", "Session expired")
		return
	}
	if rec.RevokedAt != nil {
		// Token reuse: assume theft and revoke every session for the user.
		_ = s.store.RevokeAllRefresh(r.Context(), rec.UserID)
		s.audit(r, &rec.UserID, "auth.refresh_reuse", "user", rec.UserID, nil)
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "session_reused", "Session is no longer valid")
		return
	}
	if time.Now().After(rec.ExpiresAt) {
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "expired_session", "Session expired")
		return
	}
	u, err := s.store.UserByID(r.Context(), rec.UserID)
	if err != nil {
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "account_unavailable", "Account not available")
		return
	}

	raw, newHash := s.tokens.NewRefresh()
	expires := time.Now().Add(s.cfg.RefreshTTL)
	if _, err := s.store.RotateRefresh(r.Context(), rec.ID, rec.UserID, newHash, r.UserAgent(), middleware.ClientIP(r), expires); err != nil {
		s.log.Error("rotate refresh", "err", err)
		writeError(w, http.StatusInternalServerError, "internal", "Could not refresh session")
		return
	}
	s.setRefreshCookie(w, raw)
	access, err := s.tokens.NewAccess(u.ID, u.Role, u.Plan)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not create token")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{User: u, AccessToken: access, ExpiresIn: int(s.cfg.AccessTTL.Seconds())})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookie); err == nil && c.Value != "" {
		_ = s.store.RevokeRefresh(r.Context(), auth.HashRefresh(c.Value))
	}
	s.clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// logoutAll revokes every refresh token for the account, which ends all
// active sessions on every device.
func (s *Server) logoutAll(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if err := s.store.RevokeAllRefresh(r.Context(), u.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not end sessions")
		return
	}
	s.clearRefreshCookie(w)
	s.audit(r, &u.ID, "auth.logout_all", "user", u.ID, nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	settings, err := s.store.GetSettings(r.Context(), u.ID)
	if err != nil {
		settings = model.Settings{Locale: u.Locale, Theme: "light", Currency: "EGP", Notifications: map[string]any{}}
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": u, "settings": settings})
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		FullName *string `json:"fullName"`
		Locale   *string `json:"locale"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	name := u.FullName
	locale := u.Locale
	if in.FullName != nil {
		name = strings.TrimSpace(*in.FullName)
		if len([]rune(name)) < 2 || len([]rune(name)) > 80 {
			writeError(w, http.StatusBadRequest, "invalid_name", "Full name must be 2-80 characters")
			return
		}
	}
	if in.Locale != nil {
		locale = strings.ToLower(strings.TrimSpace(*in.Locale))
		if locale != "ar" && locale != "en" {
			writeError(w, http.StatusBadRequest, "invalid_locale", "Locale must be ar or en")
			return
		}
	}
	updated, err := s.store.UpdateProfile(r.Context(), u.ID, name, locale)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not update profile")
		return
	}
	if in.Locale != nil {
		settings, _ := s.store.GetSettings(r.Context(), u.ID)
		settings.Locale = locale
		_, _ = s.store.UpdateSettings(r.Context(), u.ID, settings)
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	_, hash, err := s.store.UserByEmail(r.Context(), u.Email)
	if err != nil || !auth.VerifyPassword(in.CurrentPassword, hash) {
		writeError(w, http.StatusBadRequest, "invalid_password", "Current password is incorrect")
		return
	}
	if !validPassword(in.NewPassword) {
		writeError(w, http.StatusBadRequest, "weak_password", "Password must be 10-128 characters and include a letter and a number")
		return
	}
	newHash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not update password")
		return
	}
	if err := s.store.UpdatePassword(r.Context(), u.ID, newHash); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not update password")
		return
	}
	_ = s.store.RevokeAllRefresh(r.Context(), u.ID)
	s.clearRefreshCookie(w)
	s.audit(r, &u.ID, "auth.password_changed", "user", u.ID, nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	u, _, err := s.store.UserByEmail(r.Context(), email)
	if err == nil {
		raw := randomToken(32)
		_ = s.store.CreatePasswordReset(r.Context(), u.ID, auth.HashRefresh(raw), time.Now().Add(30*time.Minute))
		link := s.cfg.PublicWebURL + "/reset-password?token=" + raw
		// No SMTP in this phase: log the link server-side only.
		s.log.Info("password reset requested", "user_id", u.ID, "reset_link", link)
		s.audit(r, &u.ID, "auth.reset_requested", "user", u.ID, nil)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if !validPassword(in.Password) {
		writeError(w, http.StatusBadRequest, "weak_password", "Password must be 10-128 characters and include a letter and a number")
		return
	}
	userID, err := s.store.ConsumePasswordReset(r.Context(), auth.HashRefresh(in.Token))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_token", "Reset link is invalid or expired")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not reset password")
		return
	}
	if err := s.store.UpdatePassword(r.Context(), userID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not reset password")
		return
	}
	_ = s.store.RevokeAllRefresh(r.Context(), userID)
	s.audit(r, &userID, "auth.password_reset", "user", userID, nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, u *model.User) (string, error) {
	access, err := s.tokens.NewAccess(u.ID, u.Role, u.Plan)
	if err != nil {
		return "", err
	}
	raw, hash := s.tokens.NewRefresh()
	expires := time.Now().Add(s.cfg.RefreshTTL)
	if _, err := s.store.SaveRefresh(r.Context(), u.ID, hash, r.UserAgent(), middleware.ClientIP(r), expires); err != nil {
		return "", err
	}
	s.setRefreshCookie(w, raw)
	return access, nil
}

func (s *Server) setRefreshCookie(w http.ResponseWriter, raw string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    raw,
		Path:     "/api/v1/auth",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(s.cfg.RefreshTTL.Seconds()),
	})
}

func (s *Server) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    "",
		Path:     "/api/v1/auth",
		Domain:   s.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func validEmail(s string) bool {
	if len(s) == 0 || len(s) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(s)
	return err == nil && strings.EqualFold(addr.Address, s)
}

func validPassword(s string) bool {
	if len(s) < 10 || len(s) > 128 {
		return false
	}
	var letter, digit bool
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			digit = true
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'):
			letter = true
		}
	}
	return letter && digit
}

func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
