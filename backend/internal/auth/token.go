package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	issuer          = "textile-cad"
	audience        = "textile-cad-web"
)

type Claims struct {
	Role string `json:"role"`
	Plan string `json:"plan"`
	jwt.RegisteredClaims
}

type TokenService struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewTokenService(secret string, accessTTL, refreshTTL time.Duration) *TokenService {
	return &TokenService{secret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL}
}

func (t *TokenService) AccessTTL() time.Duration  { return t.accessTTL }
func (t *TokenService) RefreshTTL() time.Duration { return t.refreshTTL }

func (t *TokenService) NewAccess(userID, role, plan string) (string, error) {
	now := time.Now()
	claims := Claims{
		Role: role,
		Plan: plan,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-5 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(now.Add(t.accessTTL)),
			ID:        randomToken(16),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
}

func (t *TokenService) ParseAccess(raw string) (*Claims, error) {
	tok, err := jwt.ParseWithClaims(raw, &Claims{}, func(tok *jwt.Token) (any, error) {
		if tok.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, ErrInvalidToken
		}
		return t.secret, nil
	}, jwt.WithIssuer(issuer), jwt.WithAudience(audience), jwt.WithExpirationRequired())
	if err != nil || !tok.Valid {
		return nil, ErrInvalidToken
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (t *TokenService) NewRefresh() (raw string, hash []byte) {
	raw = randomToken(32)
	return raw, HashRefresh(raw)
}

func HashRefresh(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
