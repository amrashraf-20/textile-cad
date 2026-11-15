package model

import "time"

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	FullName      string    `json:"fullName"`
	Role          string    `json:"role"`
	Plan          string    `json:"plan"`
	Locale        string    `json:"locale"`
	EmailVerified bool      `json:"emailVerified"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Settings struct {
	Locale        string         `json:"locale"`
	Theme         string         `json:"theme"`
	Currency      string         `json:"currency"`
	Notifications map[string]any `json:"notifications"`
}

type Design struct {
	ID          string     `json:"id"`
	UserID      string     `json:"-"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	WarpEnds    int        `json:"warpEnds"`
	WeftPicks   int        `json:"weftPicks"`
	WeaveData   [][]int    `json:"weaveData"`
	CellColors  [][]*string `json:"cellColors"`
	WarpColors  []string   `json:"warpColors"`
	WeftColors  []string   `json:"weftColors"`
	Settings    map[string]any `json:"settings"`
	Thumbnail   string     `json:"thumbnail,omitempty"`
	Version     int        `json:"version"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type DesignSummary struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	WarpEnds   int       `json:"warpEnds"`
	WeftPicks  int       `json:"weftPicks"`
	Thumbnail  string    `json:"thumbnail,omitempty"`
	Version    int       `json:"version"`
	UpdatedAt  time.Time `json:"updatedAt"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Yarn struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"-"`
	Name      string    `json:"name"`
	System    string    `json:"system"`
	Count     float64   `json:"count"`
	Material  string    `json:"material"`
	PriceEGP  float64   `json:"priceEgp"`
	IsGlobal  bool      `json:"isGlobal"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Rate struct {
	Key       string    `json:"key"`
	Value     float64   `json:"value"`
	Unit      string    `json:"unit"`
	Source    string    `json:"source"`
	FetchedAt time.Time `json:"fetchedAt"`
}

type Share struct {
	ID        string    `json:"id"`
	DesignID  string    `json:"designId"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
