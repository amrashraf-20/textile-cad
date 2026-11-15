package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"textilecad/backend/internal/ai"
)

const aiSystemPrompt = `You are the built-in assistant of Textile CAD Studio, a professional weaving (spinning & weaving) application used by textile factories and engineers.

You can BOTH answer questions about the application AND execute tasks by returning machine-readable actions.

The application has these areas:
- dashboard: KPIs, recent designs, quick actions.
- designs: saved designs (create, duplicate, delete, share public link, export WIF/CSV).
- studio: the weave editor. Grid of warp ends (columns) x weft picks (rows). Tools: pencil, eraser, line, rectangle, fill, eyedropper, colour. It has a full structure library, draft plan (threading / tie-up / treadling or peg plan), colourways, stripes, repetition, simulation, cross-section, jacquard and mockup views.
- library: yarn catalogue with count (Ne), ply, fibre, colour, stock.
- calculations: fabric density, yarn consumption, ERP order cost, sample GSM, loom/reed setup.
- settings: account, language (Arabic RTL / English LTR), plan.

Structure ids and their options (use exactly these ids):
plain {}; basket {size 2-6}; warpRib {size 2-6}; weftRib {size 2-6};
twill {up 1-6, down 1-6, direction "Z"|"S"}; herringbone {direction}; chevron {direction};
diamond {direction}; brokenTwill {direction}; steepTwill {direction}; recliningTwill {direction};
satin {size 3-16, step 1-15}; sateen {size 3-16, step 1-15};
honeycomb {size 6-16}; waffle {size 6-16}; huckaback {size 6-16}; mockLeno {size 6-16};
crepe {size 4-16}; bedfordCord {size 6-16}; terry {size 6-16}; corduroy {size 6-15};
velvet {size 6-16}; doubleCloth {faceRatio 1-3, stitching 0|1}; tripleCloth {faceRatio 1-3, stitching 0|1}.

Colourway ids: ecru, indigo, oxblood, forest, charcoal, terracotta, navy, mustard.

You MUST answer with a single JSON object and nothing else (no markdown, no code fences):
{"reply":"<answer in the user's language>","actions":[<zero or more actions>]}

Allowed actions:
{"type":"applyStructure","id":"twill","options":{"up":2,"down":2,"direction":"Z"}}
{"type":"colorway","id":"indigo"}
{"type":"setColors","warp":"#16202D","weft":"#F5F2E9"}
{"type":"resize","warpEnds":16,"weftPicks":16}
{"type":"clear"}
{"type":"openDraft"}
{"type":"navigate","to":"dashboard|designs|studio|library|calculations|settings"}

Rules:
- Always answer in the language of the user's last message (Arabic or English). Never mix the two languages in one reply.
- Colours must be 6-digit hex like "#16202D".
- Sizes must respect the plan: free users up to 16x16, pro up to 100x100.
- Only add actions when the user asks you to do something. For questions, return "actions":[].
- Never invent features that are not listed. If unsure, say so and suggest the closest available feature.
- Keep replies short (max 4 sentences) and practical, like a textile engineer.`

const aiVisionPrompt = `You are a textile engineer analysing a photograph of a woven fabric sample.
Identify the weave structure from this exact list:
plain, basket, warpRib, weftRib, twill, herringbone, chevron, diamond, brokenTwill,
steepTwill, recliningTwill, satin, sateen, honeycomb, waffle, huckaback, mockLeno,
crepe, bedfordCord, terry, corduroy, velvet, doubleCloth, tripleCloth.
Estimate the repeat in threads (2-16), the dominant warp and weft colours as 6-digit hex,
and whether the cloth is warp-faced. Answer with JSON only:
{"structureId":"twill","repeat":4,"warpColor":"#1F3A5F","weftColor":"#F5F2E9","warpFacing":true,"confidence":0.8,"notes":"short note in the user's language"}
Never return markdown or extra keys.`

type aiChatRequest struct {
	Messages []ai.Message `json:"messages"`
	APIKey   string       `json:"apiKey,omitempty"`
	Model    string       `json:"model,omitempty"`
	Context  struct {
		Locale    string `json:"locale"`
		WarpEnds  int    `json:"warpEnds"`
		WeftPicks int    `json:"weftPicks"`
	} `json:"context"`
}

func (s *Server) aiStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":       s.ai.Enabled(),
		"provider":      s.cfg.AIProvider,
		"model":         s.cfg.AIModel,
		"visionModel":   s.cfg.AIVisionModel,
		"localAnalysis": true,
	})
}

func (s *Server) aiChat(w http.ResponseWriter, r *http.Request) {
	var req aiChatRequest
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" && !s.ai.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "ai_disabled", "The AI provider is not configured")
		return
	}
	if len(req.Messages) == 0 {
		writeError(w, http.StatusBadRequest, "empty_messages", "A message is required")
		return
	}
	if len(req.Messages) > 10 {
		req.Messages = req.Messages[len(req.Messages)-10:]
	}
	clean := make([]ai.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		if utf8.RuneCountInString(content) > 2000 {
			content = string([]rune(content)[:2000])
		}
		role := m.Role
		if role != "assistant" {
			role = "user"
		}
		clean = append(clean, ai.Message{Role: role, Content: content})
	}
	if len(clean) == 0 {
		writeError(w, http.StatusBadRequest, "empty_messages", "A message is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.AITimeout)
	defer cancel()

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = s.ai.Model()
	}
	raw, err := s.ai.ChatWithKey(ctx, apiKey, model, aiSystemPrompt, clean)
	if err != nil {
		s.log.Warn("ai chat failed", "err", err, "user", currentUser(r).ID)
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "401") || strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "user not found") || strings.Contains(errStr, "invalid api key") {
			writeError(w, http.StatusUnauthorized, "invalid_api_key", "The AI API key is invalid or not found")
			return
		}
		if strings.Contains(errStr, "402") || strings.Contains(errStr, "insufficient") || strings.Contains(errStr, "credit") || strings.Contains(errStr, "quota") {
			writeError(w, http.StatusPaymentRequired, "quota_exceeded", "The AI provider quota has been reached")
			return
		}
		if strings.Contains(errStr, "429") || strings.Contains(errStr, "rate limit") {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "The AI model is currently rate limited, please try again shortly")
			return
		}
		writeError(w, http.StatusBadGateway, "ai_unavailable", "The assistant is temporarily unavailable")
		return
	}
	reply, actions := parseAIEnvelope(raw)
	if reply == "" {
		writeError(w, http.StatusBadGateway, "ai_bad_response", "The assistant returned an unreadable answer")
		return
	}
	if len(reply) > 4000 {
		reply = string([]rune(reply)[:4000])
	}
	if len(actions) == 0 {
		actions = json.RawMessage("[]")
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"reply":   reply,
		"actions": actions,
		"model":   model,
	})
}

type aiAnalyzeRequest struct {
	Image     string `json:"image"`
	WarpEnds  int    `json:"warpEnds"`
	WeftPicks int    `json:"weftPicks"`
	Locale    string `json:"locale"`
	APIKey    string `json:"apiKey,omitempty"`
	Model     string `json:"model,omitempty"`
}

func (s *Server) aiAnalyze(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var req aiAnalyzeRequest
	r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	limit := 16
	if s.isPro(u) {
		limit = 100
	}
	warpEnds := clampInt(req.WarpEnds, 2, limit)
	weftPicks := clampInt(req.WeftPicks, 2, limit)

	img, err := ai.DecodeImage(req.Image)
	if err != nil {
		switch {
		case errors.Is(err, ai.ErrImageTooLarge):
			writeError(w, http.StatusRequestEntityTooLarge, "image_too_large", "Image is larger than 12 MB")
		case errors.Is(err, ai.ErrNoImage):
			writeError(w, http.StatusBadRequest, "missing_image", "An image is required")
		default:
			writeError(w, http.StatusBadRequest, "invalid_image", "Use a PNG, JPEG or GIF image")
		}
		return
	}

	analysis := ai.AnalyzeImage(img, warpEnds, weftPicks)

	notes := ""
	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey != "" || s.ai.Enabled() {
		ctx, cancel := context.WithTimeout(r.Context(), s.cfg.AITimeout)
		defer cancel()
		prompt := "Analyse this fabric sample. " + aiVisionPrompt
		if raw, err := s.ai.AnalyzeWithKey(ctx, apiKey, req.Model, req.Image, aiVisionPrompt, prompt); err == nil {
			notes = refineAnalysis(&analysis, raw)
		} else {
			s.log.Warn("ai vision failed", "err", err, "user", u.ID)
		}
	}

	locale := req.Locale
	if locale != "ar" {
		locale = "en"
	}
	reply := describeAnalysis(analysis, notes, locale)

	writeJSON(w, http.StatusOK, map[string]any{
		"reply":       reply,
		"weave":       analysis.Weave,
		"warpEnds":    analysis.WarpEnds,
		"weftPicks":   analysis.WeftPicks,
		"warpColor":   analysis.WarpColor,
		"weftColor":   analysis.WeftColor,
		"structureId": analysis.StructureID,
		"repeat":      analysis.Repeat,
		"confidence":  analysis.Confidence,
		"contrast":    analysis.Contrast,
	})
}

func parseAIEnvelope(raw string) (string, json.RawMessage) {
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	var env struct {
		Reply   string          `json:"reply"`
		Actions json.RawMessage `json:"actions"`
	}
	if err := json.Unmarshal([]byte(clean), &env); err != nil {
		// Some models wrap the object in prose; take the outermost braces.
		start := strings.IndexByte(clean, '{')
		end := strings.LastIndexByte(clean, '}')
		if start >= 0 && end > start {
			_ = json.Unmarshal([]byte(clean[start:end+1]), &env)
		}
	}
	if env.Reply != "" {
		actions := env.Actions
		if len(actions) == 0 || string(actions) == "null" {
			actions = json.RawMessage("[]")
		}
		return strings.TrimSpace(env.Reply), actions
	}
	// Resilient fallback: If model replied with natural text without JSON envelope, return it directly!
	if clean != "" {
		return clean, json.RawMessage("[]")
	}
	return "", nil
}

type visionResult struct {
	StructureID string  `json:"structureId"`
	Repeat      int     `json:"repeat"`
	WarpColor   string  `json:"warpColor"`
	WeftColor   string  `json:"weftColor"`
	WarpFacing  bool    `json:"warpFacing"`
	Confidence  float64 `json:"confidence"`
	Notes       string  `json:"notes"`
}

func validHex(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, r := range s[1:] {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}

// refineAnalysis merges the vision model's naming/colour judgement into the
// deterministic result. The measured weave stays authoritative unless the
// local match was weak and the model identified a structure we can rebuild.
func refineAnalysis(a *ai.Analysis, raw string) string {
	clean := strings.TrimSpace(raw)
	start := strings.IndexByte(clean, '{')
	end := strings.LastIndexByte(clean, '}')
	if start < 0 || end <= start {
		return ""
	}
	var v visionResult
	if err := json.Unmarshal([]byte(clean[start:end+1]), &v); err != nil {
		return ""
	}
	if validHex(v.WarpColor) {
		a.WarpColor = strings.ToUpper(v.WarpColor)
	}
	if validHex(v.WeftColor) {
		a.WeftColor = strings.ToUpper(v.WeftColor)
	}
	if ai.ValidStructure(v.StructureID) {
		a.StructureID = v.StructureID
		if a.Confidence < 0.7 {
			if weave, ok := ai.CanonicalWeave(v.StructureID, a.WarpEnds, a.WeftPicks); ok {
				a.Weave = weave
			}
		}
	}
	if v.Repeat >= 2 && v.Repeat <= 16 {
		a.Repeat = v.Repeat
	}
	if v.Confidence > 0 && v.Confidence <= 1 && v.Confidence > a.Confidence {
		a.Confidence = v.Confidence
	}
	notes := strings.TrimSpace(v.Notes)
	if utf8.RuneCountInString(notes) > 240 {
		notes = string([]rune(notes)[:240])
	}
	return notes
}

var structureNames = map[string][2]string{
	"plain":          {"Plain weave", "سادة"},
	"basket":         {"Basket weave", "سلة"},
	"warpRib":        {"Warp rib", "تضليع سداء"},
	"weftRib":        {"Weft rib", "تضليع لحمة"},
	"twill":          {"Twill", "مبرد"},
	"herringbone":    {"Herringbone", "عظم السمكة"},
	"chevron":        {"Chevron", "شيفرون"},
	"diamond":        {"Diamond twill", "مبرد معيني"},
	"brokenTwill":    {"Broken twill", "مبرد مكسور"},
	"steepTwill":     {"Steep twill", "مبرد حاد"},
	"recliningTwill": {"Reclining twill", "مبرد منبطح"},
	"satin":          {"Warp satin", "أطلس سداء"},
	"sateen":         {"Sateen", "ساتان"},
	"honeycomb":      {"Honeycomb", "قرص العسل"},
	"waffle":         {"Waffle", "وافل"},
	"huckaback":      {"Huckaback", "هاكاباك"},
	"mockLeno":       {"Mock leno", "شاش كاذب"},
	"crepe":          {"Crepe", "كريب"},
	"bedfordCord":    {"Bedford cord", "كورد بيدفورد"},
	"terry":          {"Terry", "تيري"},
	"corduroy":       {"Corduroy", "كوردوروي"},
	"velvet":         {"Velvet", "قطيفة"},
	"doubleCloth":    {"Double cloth", "نسيج مزدوج"},
	"tripleCloth":    {"Triple cloth", "نسيج ثلاثي"},
}

func describeAnalysis(a ai.Analysis, notes, locale string) string {
	name := [2]string{"custom structure", "تركيب مخصص"}
	if n, ok := structureNames[a.StructureID]; ok {
		name = n
	}
	pct := int(a.Confidence*100 + 0.5)
	if locale == "ar" {
		msg := "حلّلت العينة: التركيب الأقرب «" + name[1] + "» بتكرار " +
			strconv.Itoa(a.Repeat) + "×" + strconv.Itoa(a.Repeat) + " وثقة " + strconv.Itoa(pct) + "%. " +
			"استخرجت لون السداء " + a.WarpColor + " ولون اللحمة " + a.WeftColor +
			" وطبّقت التركيب على الشبكة."
		if notes != "" {
			msg += " ملاحظة: " + notes
		}
		return msg
	}
	msg := "Sample analysed: closest structure is " + name[0] + " with a " +
		strconv.Itoa(a.Repeat) + "×" + strconv.Itoa(a.Repeat) + " repeat (" + strconv.Itoa(pct) + "% confidence). " +
		"Extracted warp " + a.WarpColor + " and weft " + a.WeftColor +
		", and applied the structure to the grid."
	if notes != "" {
		msg += " Note: " + notes
	}
	return msg
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
