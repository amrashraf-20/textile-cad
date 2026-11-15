// Package ai proxies chat completions to an OpenAI-compatible provider
// (OpenRouter by default) and ships a deterministic image analyser so the
// assistant still works when no API key is configured.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"textilecad/backend/internal/config"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	cfg  *config.Config
	http *http.Client
}

func New(cfg *config.Config) *Client {
	return &Client{cfg: cfg, http: &http.Client{Timeout: cfg.AITimeout}}
}

func (c *Client) Enabled() bool { return c != nil && c.cfg.AIEnabled }

func (c *Client) Model() string      { return c.cfg.AIModel }
func (c *Client) VisionModel() string { return c.cfg.AIVisionModel }

type chatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type chatRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	Temperature    float64       `json:"temperature"`
	MaxTokens      int           `json:"max_tokens"`
	ResponseFormat *respFormat   `json:"response_format,omitempty"`
}

type respFormat struct {
	Type string `json:"type"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) complete(ctx context.Context, apiKey, model string, messages []chatMessage, jsonMode bool) (string, error) {
	key := strings.TrimSpace(apiKey)
	if key == "" {
		key = c.cfg.AIAPIKey
	}
	if key == "" {
		return "", errors.New("ai is not configured")
	}
	m := strings.TrimSpace(model)
	if m == "" {
		m = c.cfg.AIModel
	}
	body := chatRequest{
		Model:       m,
		Messages:    messages,
		Temperature: 0.2,
		MaxTokens:   1200,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.AIBaseURL+"/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("HTTP-Referer", c.cfg.PublicWebURL)
	req.Header.Set("X-Title", c.cfg.AIAppName)

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	payload, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var e chatResponse
		_ = json.Unmarshal(payload, &e)
		if e.Error != nil && e.Error.Message != "" {
			return "", fmt.Errorf("ai provider %d: %s", res.StatusCode, e.Error.Message)
		}
		return "", fmt.Errorf("ai provider returned %d", res.StatusCode)
	}
	var out chatResponse
	if err := json.Unmarshal(payload, &out); err != nil {
		return "", err
	}
	if len(out.Choices) == 0 {
		return "", errors.New("ai provider returned no choices")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}

// Chat asks the text model for a JSON envelope: {"reply": "...", "actions": [...]}.
func (c *Client) Chat(ctx context.Context, system string, history []Message) (string, error) {
	return c.ChatWithKey(ctx, "", "", system, history)
}

func (c *Client) ChatWithKey(ctx context.Context, apiKey, model, system string, history []Message) (string, error) {
	msgs := make([]chatMessage, 0, len(history)+1)
	msgs = append(msgs, chatMessage{Role: "system", Content: system})
	for _, m := range history {
		role := m.Role
		if role != "assistant" {
			role = "user"
		}
		msgs = append(msgs, chatMessage{Role: role, Content: m.Content})
	}
	return c.complete(ctx, apiKey, model, msgs, true)
}

// Analyze asks the vision model about a fabric photo and returns raw JSON.
func (c *Client) Analyze(ctx context.Context, dataURL, system, prompt string) (string, error) {
	return c.AnalyzeWithKey(ctx, "", "", dataURL, system, prompt)
}

func (c *Client) AnalyzeWithKey(ctx context.Context, apiKey, model, dataURL, system, prompt string) (string, error) {
	content := []map[string]any{
		{"type": "text", "text": prompt},
		{"type": "image_url", "image_url": map[string]string{"url": dataURL}},
	}
	msgs := []chatMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: content},
	}
	m := model
	if m == "" {
		m = c.cfg.AIVisionModel
	}
	return c.complete(ctx, apiKey, m, msgs, true)
}

func Timeout(cfg *config.Config) time.Duration { return cfg.AITimeout }
