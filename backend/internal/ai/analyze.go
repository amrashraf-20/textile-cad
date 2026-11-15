package ai

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"strings"
)

// Analysis is the deterministic result of reading a fabric photograph.
type Analysis struct {
	Weave       [][]int `json:"weave"`
	WarpEnds    int     `json:"warpEnds"`
	WeftPicks   int     `json:"weftPicks"`
	WarpColor   string  `json:"warpColor"`
	WeftColor   string  `json:"weftColor"`
	StructureID string  `json:"structureId"`
	Repeat      int     `json:"repeat"`
	Confidence  float64 `json:"confidence"`
	// Contrast is the Otsu separation between the two yarn systems (0…1).
	Contrast float64 `json:"contrast"`
}

var (
	ErrNoImage       = errors.New("missing image data")
	ErrBadImage      = errors.New("unsupported image data")
	ErrImageTooLarge = errors.New("image is larger than 12 MB")
)

const analysisSize = 160

// DecodeImage accepts a data URL (data:image/png;base64,…) or raw base64.
func DecodeImage(dataURL string) (image.Image, error) {
	s := strings.TrimSpace(dataURL)
	if s == "" {
		return nil, ErrNoImage
	}
	if strings.HasPrefix(strings.ToLower(s), "data:") {
		comma := strings.IndexByte(s, ',')
		if comma < 0 {
			return nil, ErrBadImage
		}
		meta := strings.ToLower(s[:comma])
		if !strings.Contains(meta, ";base64") {
			return nil, ErrBadImage
		}
		s = s[comma+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(s)
	}
	if err != nil {
		return nil, ErrBadImage
	}
	if len(raw) > 12<<20 {
		return nil, ErrImageTooLarge
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, ErrBadImage
	}
	if img.Bounds().Dx() < 8 || img.Bounds().Dy() < 8 {
		return nil, ErrBadImage
	}
	return img, nil
}

type sample struct {
	r, g, b float64
	lum     float64
}

type photo struct {
	w, h int
	px   []sample
}

func (p *photo) at(x, y int) sample { return p.px[y*p.w+x] }

// sampleImage crops the central 86% (removing backgrounds and shadows at the
// edges) and box-averages it down to size×size.
func sampleImage(img image.Image, size int) *photo {
	b := img.Bounds()
	side := b.Dx()
	if b.Dy() < side {
		side = b.Dy()
	}
	crop := int(float64(side) * 0.86)
	if crop < 8 {
		crop = side
	}
	ox := b.Min.X + (b.Dx()-crop)/2
	oy := b.Min.Y + (b.Dy()-crop)/2

	p := &photo{w: size, h: size, px: make([]sample, size*size)}
	for y := 0; y < size; y++ {
		y0 := oy + y*crop/size
		y1 := oy + (y+1)*crop/size
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for x := 0; x < size; x++ {
			x0 := ox + x*crop/size
			x1 := ox + (x+1)*crop/size
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var sr, sg, sb, n float64
			for yy := y0; yy < y1; yy++ {
				for xx := x0; xx < x1; xx++ {
					cr, cg, cb, _ := img.At(xx, yy).RGBA()
					sr += float64(cr >> 8)
					sg += float64(cg >> 8)
					sb += float64(cb >> 8)
					n++
				}
			}
			if n == 0 {
				n = 1
			}
			r, g, bl := sr/n, sg/n, sb/n
			p.px[y*size+x] = sample{r: r, g: g, b: bl, lum: 0.299*r + 0.587*g + 0.114*bl}
		}
	}
	return p
}

func otsu(values []float64) float64 {
	if len(values) == 0 {
		return 128
	}
	hist := make([]int, 256)
	for _, v := range values {
		idx := int(math.Round(v))
		if idx < 0 {
			idx = 0
		}
		if idx > 255 {
			idx = 255
		}
		hist[idx]++
	}
	total := float64(len(values))
	var sum float64
	for i := 0; i < 256; i++ {
		sum += float64(i) * float64(hist[i])
	}
	var sumB, wB float64
	best, bestVar := 0, -1.0
	for i := 0; i < 256; i++ {
		wB += float64(hist[i])
		if wB == 0 {
			continue
		}
		wF := total - wB
		if wF == 0 {
			break
		}
		sumB += float64(i) * float64(hist[i])
		meanB := sumB / wB
		meanF := (sum - sumB) / wF
		between := wB * wF * (meanB - meanF) * (meanB - meanF)
		if between > bestVar {
			bestVar = between
			best = i
		}
	}
	return float64(best)
}

// bestPitch finds the dominant short period of a 1-D profile (thread pitch).
// It returns the smallest strong local maximum, which is the fundamental
// thread pitch rather than one of its harmonics.
func bestPitch(profile []float64, minLag, maxLag int) (int, float64) {
	n := len(profile)
	if n < minLag*3 || maxLag < minLag {
		return minLag, 0
	}
	var mean float64
	for _, v := range profile {
		mean += v
	}
	mean /= float64(n)
	var den float64
	for _, v := range profile {
		den += (v - mean) * (v - mean)
	}
	if den == 0 {
		return minLag, 0
	}
	if maxLag > n/3 {
		maxLag = n / 3
	}
	scores := make([]float64, maxLag+2)
	best, bestScore := minLag, -1.0
	for lag := minLag; lag <= maxLag; lag++ {
		var num float64
		for i := lag; i < n; i++ {
			num += (profile[i] - mean) * (profile[i-lag] - mean)
		}
		score := num / float64(n-lag) / (den / float64(n))
		scores[lag] = score
		if score > bestScore {
			bestScore = score
			best = lag
		}
	}
	for lag := minLag; lag <= maxLag; lag++ {
		left := scores[lag-1]
		if lag == minLag {
			left = -1
		}
		right := scores[lag+1]
		if lag == maxLag {
			right = -1
		}
		if scores[lag] >= left && scores[lag] >= right && scores[lag] >= 0.45*bestScore {
			return lag, scores[lag]
		}
	}
	return best, bestScore
}

// correctedLuma removes slow illumination changes (window light, vignetting)
// with a box high-pass, which makes the Otsu split reliable on real photos.
func correctedLuma(p *photo) []float64 {
	w, h := p.w, p.h
	gray := make([]float64, w*h)
	for i, px := range p.px {
		gray[i] = px.lum
	}
	// Integral image for O(1) window means.
	ii := make([]float64, (w+1)*(h+1))
	for y := 0; y < h; y++ {
		var rowSum float64
		for x := 0; x < w; x++ {
			rowSum += gray[y*w+x]
			ii[(y+1)*(w+1)+x+1] = ii[y*(w+1)+x+1] + rowSum
		}
	}
	rect := func(x0, y0, x1, y1 int) float64 {
		return ii[y1*(w+1)+x1] - ii[y0*(w+1)+x1] - ii[y1*(w+1)+x0] + ii[y0*(w+1)+x0]
	}
	out := make([]float64, w*h)
	const win = 31
	var global float64
	for _, v := range gray {
		global += v
	}
	global /= float64(len(gray))
	for y := 0; y < h; y++ {
		y0 := y - win/2
		if y0 < 0 {
			y0 = 0
		}
		y1 := y + win/2 + 1
		if y1 > h {
			y1 = h
		}
		for x := 0; x < w; x++ {
			x0 := x - win/2
			if x0 < 0 {
				x0 = 0
			}
			x1 := x + win/2 + 1
			if x1 > w {
				x1 = w
			}
			area := float64((x1 - x0) * (y1 - y0))
			local := rect(x0, y0, x1, y1) / area
			out[y*w+x] = gray[y*w+x] - local + global
		}
	}
	return out
}

func binaryFrom(luma []float64, w, h int) [][]bool {
	thr := otsu(luma)
	out := make([][]bool, h)
	for y := 0; y < h; y++ {
		out[y] = make([]bool, w)
		for x := 0; x < w; x++ {
			out[y][x] = luma[y*w+x] > thr
		}
	}
	return out
}

func gradientProfiles(luma []float64, w, h int) ([]float64, []float64) {
	col := make([]float64, w)
	row := make([]float64, h)
	for y := 0; y < h; y++ {
		for x := 1; x < w; x++ {
			d := luma[y*w+x] - luma[y*w+x-1]
			if d < 0 {
				d = -d
			}
			col[x] += d
		}
	}
	for x := 0; x < w; x++ {
		for y := 1; y < h; y++ {
			d := luma[y*w+x] - luma[(y-1)*w+x]
			if d < 0 {
				d = -d
			}
			row[y] += d
		}
	}
	return col, row
}

// detectPixelPeriod finds the smallest shift (in pixels) after which the
// binarised cloth repeats — one full weave repeat, not a single thread.
func detectPixelPeriod(b [][]bool, horizontal bool, minP, maxP int) (int, float64) {
	h, w := len(b), len(b[0])
	limit := w
	if !horizontal {
		limit = h
	}
	if maxP > limit/3 {
		maxP = limit / 3
	}
	if maxP < minP {
		return minP, 1
	}
	mismatch := func(period int) float64 {
		var bad, total int
		// Compare only a few repeats: accumulated sub-pixel drift makes long
		// comparisons unreliable on real photographs.
		span := period * 4
		if horizontal {
			if span > w {
				span = w
			}
			for r := 0; r < h; r++ {
				for c := period; c < span; c++ {
					if b[r][c] != b[r][c-period] {
						bad++
					}
					total++
				}
			}
		} else {
			if span > h {
				span = h
			}
			for r := period; r < span; r++ {
				for c := 0; c < w; c++ {
					if b[r][c] != b[r-period][c] {
						bad++
					}
					total++
				}
			}
		}
		if total == 0 {
			return 1
		}
		return float64(bad) / float64(total)
	}
	best, bestScore := minP, 1.0
	for p := minP; p <= maxP; p++ {
		s := mismatch(p)
		if s < bestScore {
			bestScore = s
			best = p
		}
		if s <= 0.03 {
			return p, s
		}
	}
	return best, bestScore
}

// unitToMatrix resamples one pixel repeat down to its thread count by reading
// the centre of each thread. Reading centres avoids the blended pixels at
// thread boundaries that otherwise corrupt the pattern.
func unitToMatrix(b [][]bool, pw, ph, qw, qh int) [][]int {
	if pw < 1 {
		pw = 1
	}
	if ph < 1 {
		ph = 1
	}
	h, w := len(b), len(b[0])
	out := make([][]int, qh)
	for r := 0; r < qh; r++ {
		out[r] = make([]int, qw)
		cy := (r*ph + ph/2) / qh
		for c := 0; c < qw; c++ {
			cx := (c*pw + pw/2) / qw
			if cx >= w {
				cx = w - 1
			}
			if cy >= h {
				cy = h - 1
			}
			on, total := 0, 0
			for y := cy - 1; y <= cy+1; y++ {
				if y < 0 || y >= h {
					continue
				}
				for x := cx - 1; x <= cx+1; x++ {
					if x < 0 || x >= w {
						continue
					}
					if b[y][x] {
						on++
					}
					total++
				}
			}
			if total > 0 && on*2 >= total {
				out[r][c] = 1
			}
		}
	}
	return out
}

func smallestPeriod(unit [][]int, horizontal bool) int {
	h, w := len(unit), len(unit[0])
	limit := w
	if !horizontal {
		limit = h
	}
	maxP := 16
	if maxP > limit-1 {
		maxP = limit - 1
	}
	if maxP < 2 {
		return limit
	}
	for p := 2; p <= maxP; p++ {
		bad, total := 0, 0
		if horizontal {
			for r := 0; r < h; r++ {
				for c := p; c < w; c++ {
					if unit[r][c] != unit[r][c-p] {
						bad++
					}
					total++
				}
			}
		} else {
			for r := p; r < h; r++ {
				for c := 0; c < w; c++ {
					if unit[r][c] != unit[r-p][c] {
						bad++
					}
					total++
				}
			}
		}
		if total == 0 {
			continue
		}
		if float64(bad)/float64(total) <= 0.02 {
			return p
		}
	}
	return limit
}

// reduceUnit trims the unit to its true pattern repeat.
func reduceUnit(unit [][]int) [][]int {
	h, w := len(unit), len(unit[0])
	ph := smallestPeriod(unit, false)
	pw := smallestPeriod(unit, true)
	if ph < 2 {
		ph = h
	}
	if pw < 2 {
		pw = w
	}
	out := make([][]int, ph)
	for r := 0; r < ph; r++ {
		out[r] = make([]int, pw)
		copy(out[r], unit[r][:pw])
	}
	return out
}

// analyseUnit returns the thread-level weave unit, its dimensions, and how
// faithfully the photo repeats.
func analyseUnit(p *photo) ([][]int, int, int, float64) {
	luma := correctedLuma(p)
	b := binaryFrom(luma, p.w, p.h)
	colProfile, rowProfile := gradientProfiles(luma, p.w, p.h)
	pitchX, _ := bestPitch(colProfile, 2, 24)
	pitchY, _ := bestPitch(rowProfile, 2, 24)
	if pitchX < 2 {
		pitchX = 3
	}
	if pitchY < 2 {
		pitchY = 3
	}

	px, pxScore := detectPixelPeriod(b, true, 3, 72)
	py, pyScore := detectPixelPeriod(b, false, 3, 72)

	qw := clampInt(int(math.Round(float64(px)/float64(pitchX))), 2, 16)
	qh := clampInt(int(math.Round(float64(py)/float64(pitchY))), 2, 16)

	unit := unitToMatrix(b, px, py, qw, qh)
	unit = reduceUnit(unit)
	return unit, len(unit[0]), len(unit), 1 - (pxScore+pyScore)/2
}

func tile(unit [][]int, w, h int) [][]int {
	uh := len(unit)
	uw := len(unit[0])
	out := make([][]int, h)
	for r := 0; r < h; r++ {
		out[r] = make([]int, w)
		for c := 0; c < w; c++ {
			out[r][c] = unit[r%uh][c%uw]
		}
	}
	return out
}

// ScaleWeave tiles an arbitrary unit up to the requested design size.
func ScaleWeave(src [][]int, w, h int) [][]int {
	if len(src) == 0 || len(src[0]) == 0 {
		out := make([][]int, h)
		for r := range out {
			out[r] = make([]int, w)
		}
		return out
	}
	return tile(src, w, h)
}

const hexDigits = "0123456789ABCDEF"

func toHex(r, g, b float64) string {
	cl := func(v float64) int {
		n := int(math.Round(v))
		if n < 0 {
			n = 0
		}
		if n > 255 {
			n = 255
		}
		return n
	}
	ri, gi, bi := cl(r), cl(g), cl(b)
	return string([]byte{
		'#',
		hexDigits[ri>>4], hexDigits[ri&0x0f],
		hexDigits[gi>>4], hexDigits[gi&0x0f],
		hexDigits[bi>>4], hexDigits[bi&0x0f],
	})
}

// yarnColours splits the photo into two yarn systems with a 2-means pass and
// then re-estimates each centroid from its core pixels only, so anti-aliased
// thread edges do not wash the colours out.
func yarnColours(p *photo) (dark, light string, darkLum float64, lightLum float64) {
	var minL, maxL float64 = 255, 0
	for _, s := range p.px {
		if s.lum < minL {
			minL = s.lum
		}
		if s.lum > maxL {
			maxL = s.lum
		}
	}
	c0, c1 := minL, maxL
	for iter := 0; iter < 6; iter++ {
		var r0, g0, b0, n0 float64
		var r1, g1, b1, n1 float64
		for _, s := range p.px {
			if math.Abs(s.lum-c0) <= math.Abs(s.lum-c1) {
				r0 += s.r
				g0 += s.g
				b0 += s.b
				n0++
			} else {
				r1 += s.r
				g1 += s.g
				b1 += s.b
				n1++
			}
		}
		if n0 > 0 {
			r0, g0, b0 = r0/n0, g0/n0, b0/n0
			c0 = 0.299*r0 + 0.587*g0 + 0.114*b0
		}
		if n1 > 0 {
			r1, g1, b1 = r1/n1, g1/n1, b1/n1
			c1 = 0.299*r1 + 0.587*g1 + 0.114*b1
		}
	}

	if c0 > c1 {
		c0, c1 = c1, c0
	}
	span := c1 - c0
	if span < 1 {
		span = 1
	}
	// Core pixels: comfortably inside one cluster, away from the boundary.
	var dr, dg, db, dn float64
	var lr, lg, lb, ln float64
	for _, s := range p.px {
		if s.lum <= c0+0.18*span {
			dr += s.r
			dg += s.g
			db += s.b
			dn++
		} else if s.lum >= c1-0.18*span {
			lr += s.r
			lg += s.g
			lb += s.b
			ln++
		}
	}
	if dn == 0 || ln == 0 {
		return toHex(c0, c0, c0), toHex(c1, c1, c1), c0, c1
	}
	dr, dg, db = dr/dn, dg/dn, db/dn
	lr, lg, lb = lr/ln, lg/ln, lb/ln
	darkLum = 0.299*dr + 0.587*dg + 0.114*db
	lightLum = 0.299*lr + 0.587*lg + 0.114*lb
	return toHex(dr, dg, db), toHex(lr, lg, lb), darkLum, lightLum
}

/* -------------------------------------------------------------- structures */

var matchCandidates = []string{
	"plain", "basket", "warpRib", "weftRib", "twill", "herringbone",
	"chevron", "diamond", "brokenTwill", "steepTwill", "recliningTwill",
	"satin", "sateen", "honeycomb", "waffle", "huckaback", "mockLeno",
	"crepe", "bedfordCord", "terry", "corduroy", "velvet",
}

var structureIDs = func() map[string]bool {
	m := map[string]bool{
		"doubleCloth": true, "tripleCloth": true,
	}
	for _, id := range matchCandidates {
		m[id] = true
	}
	return m
}()

// ValidStructure reports whether a structure id exists in the frontend catalog.
func ValidStructure(id string) bool { return structureIDs[id] }

func mod(n, m int) int {
	if m == 0 {
		return 0
	}
	r := n % m
	if r < 0 {
		r += m
	}
	return r
}

func b2i(v bool) int {
	if v {
		return 1
	}
	return 0
}

func tri(i, n int) int {
	m := mod(i, n*2)
	if m >= n {
		m = n*2 - 1 - m
	}
	return m
}

// crepeCells is a fixed 8×8 granular unit, computed once at start-up.
var crepeCells = func() [8][8]int {
	var out [8][8]int
	seed := int64(8) * 2654435761
	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			seed = (seed*1103515245 + 12345) & 0x7fffffff
			v := 0
			if float64(seed)/float64(0x7fffffff) > 0.5 {
				v = 1
			}
			if c >= 2 && out[r][c-1] == v && out[r][c-2] == v {
				v = 1 - v
			}
			if r >= 2 && out[r-1][c] == v && out[r-2][c] == v {
				v = 1 - v
			}
			out[r][c] = v
		}
	}
	return out
}()

func canonicalCell(id string, r, c int) int {
	switch id {
	case "plain":
		return b2i(mod(r+c, 2) == 0)
	case "basket":
		return b2i(mod(r/2+c/2, 2) == 0)
	case "warpRib":
		return b2i(mod(r/2, 2) == 0)
	case "weftRib":
		return b2i(mod(c/2, 2) == 0)
	case "twill":
		return b2i(mod(c-r, 4) < 2)
	case "steepTwill":
		return b2i(mod(c-r, 4) < 3)
	case "recliningTwill":
		return b2i(mod(c-r, 4) < 1)
	case "brokenTwill":
		if mod(r, 4) < 2 {
			return b2i(mod(c-r, 4) < 2)
		}
		return b2i(mod(c+r, 4) < 2)
	case "herringbone":
		d := c - r
		if mod(c, 8) >= 4 {
			d = c + r
		}
		return b2i(mod(d, 4) < 2)
	case "chevron":
		shaft := tri(c, 4)
		return b2i(mod(shaft-r, 4) < 2)
	case "diamond":
		return b2i(mod(tri(c, 4)-tri(r, 4), 4) < 2)
	case "satin":
		return b2i(mod(r*2, 5) != mod(c, 5))
	case "sateen":
		return b2i(mod(r*2, 5) == mod(c, 5))
	case "honeycomb":
		x := (float64(mod(c, 8)) + 0.5) / 8 - 0.5
		y := (float64(mod(r, 8)) + 0.5) / 8 - 0.5
		d := math.Abs(x) + math.Abs(y)
		return b2i(d >= 0.28 && d <= 0.44)
	case "waffle":
		rr := mod(r, 8)
		cc := mod(c, 8)
		if rr >= 4 {
			rr = 7 - rr
		}
		if cc >= 4 {
			cc = 7 - cc
		}
		return b2i(cc+rr >= 3)
	case "huckaback":
		rr := mod(r, 8)
		cc := mod(c, 8)
		inBlock := cc < 4 && rr < 4
		border := cc == 3 || rr == 3
		if inBlock {
			return b2i(!border)
		}
		return b2i((cc+rr)%2 == 0)
	case "mockLeno":
		rr := mod(r, 8)
		cc := mod(c, 8)
		main := (rr < 4 && cc < 4) || (rr >= 4 && cc >= 4)
		lr, lc := mod(rr, 4), mod(cc, 4)
		if main {
			edge := lr
			if lc < edge {
				edge = lc
			}
			if 3-lr < edge {
				edge = 3 - lr
			}
			if 3-lc < edge {
				edge = 3 - lc
			}
			if edge == 0 {
				return 1
			}
			if edge == 1 {
				return 0
			}
			return 1
		}
		return b2i((lr+lc)%2 != 0)
	case "crepe":
		return crepeCells[mod(r, 8)][mod(c, 8)]
	case "bedfordCord":
		if mod(c, 4) < 3 {
			if mod(r, 8) == 7 {
				return 0
			}
			return 1
		}
		return b2i((r+c)%2 == 0)
	case "terry":
		if mod(r, 3) == 2 {
			return 1
		}
		return b2i((r+c)%2 == 0)
	case "corduroy":
		if mod(c, 3) == 0 {
			return b2i(mod(r, 2) == 0)
		}
		return 1
	case "velvet":
		if mod(r, 4) == 3 {
			return b2i(mod(c, 2) == 0)
		}
		return 1
	}
	return -1
}

// CanonicalWeave regenerates a clean draft of a known structure at any size.
func CanonicalWeave(id string, w, h int) ([][]int, bool) {
	for _, c := range matchCandidates {
		if c == id {
			return canonicalUnit(id, w, h), true
		}
	}
	return nil, false
}

func canonicalUnit(id string, w, h int) [][]int {
	out := make([][]int, h)
	for r := 0; r < h; r++ {
		out[r] = make([]int, w)
		for c := 0; c < w; c++ {
			out[r][c] = canonicalCell(id, r, c)
		}
	}
	return out
}

func mismatchRatio(a, b [][]int, invert bool) float64 {
	n := len(a)
	m := len(a[0])
	// Phase shifts are bounded: the caller already folded the repeat, so the
	// only unknown is where the photo started.
	maxShift := 6
	if n < maxShift {
		maxShift = n
	}
	if m < maxShift {
		maxShift = m
	}
	best := 1.0
	cells := float64(n * m)
	for sr := 0; sr < maxShift; sr++ {
		for sc := 0; sc < maxShift; sc++ {
			var bad float64
			for r := 0; r < n; r++ {
				ar := a[(r+sr)%n]
				br := b[r]
				for c := 0; c < m; c++ {
					v := ar[(c+sc)%m]
					if invert {
						v ^= 1
					}
					if v != br[c] {
						bad++
					}
				}
			}
			if d := bad / cells; d < best {
				best = d
			}
		}
	}
	return best
}

func matchStructure(unit [][]int, w, h int) (string, float64) {
	a := tile(unit, 16, 16)
	bestID := ""
	best := 1.0
	for _, id := range matchCandidates {
		b := canonicalUnit(id, 16, 16)
		d := mismatchRatio(a, b, false)
		if d > mismatchRatio(a, b, true) {
			d = mismatchRatio(a, b, true)
		}
		if d < best {
			best = d
			bestID = id
		}
	}
	return bestID, best
}

// AnalyzeImage reads a photo and returns a weave, its repeat, yarn colours and
// the closest known structure. It is completely deterministic and offline.
func AnalyzeImage(img image.Image, warpEnds, weftPicks int) Analysis {
	if warpEnds < 2 {
		warpEnds = 2
	}
	if weftPicks < 2 {
		weftPicks = 2
	}
	if warpEnds > 200 {
		warpEnds = 200
	}
	if weftPicks > 200 {
		weftPicks = 200
	}

	p := sampleImage(img, analysisSize)
	unit, pw, ph, periodScore := analyseUnit(p)

	structureID, err := matchStructure(unit, pw, ph)
	accepted := err <= 0.16 && structureID != ""
	confidence := 0.45 + 0.30*periodScore
	if accepted {
		confidence = 0.62 + 0.34*(1-err)
	}
	if confidence > 0.98 {
		confidence = 0.98
	}

	matrix := unit
	if accepted {
		matrix = canonicalUnit(structureID, pw, ph)
	}

	darkHex, lightHex, darkLum, lightLum := yarnColours(p)

	// Which yarn system is on top? The photo only shows relative value, so we
	// use coverage: if one colour clearly dominates the surface it is the face
	// yarn. A balanced weave (2/2 twill, plain) is genuinely ambiguous; we use
	// the professional convention of a dark warp and a light weft.
	brightFraction := 0.0
	for _, px := range p.px {
		if px.lum >= (darkLum+lightLum)/2 {
			brightFraction++
		}
	}
	if len(p.px) > 0 {
		brightFraction /= float64(len(p.px))
	}
	// A balanced weave (2/2 twill, plain) sits at ~50/50 and is genuinely
	// ambiguous. Require a clear majority before calling the bright yarn the
	// warp; otherwise keep the professional dark-warp/light-weft convention.
	brightIsWarp := brightFraction > 0.54
	if !brightIsWarp {
		for r := range matrix {
			for c := range matrix[r] {
				matrix[r][c] ^= 1
			}
		}
	}

	warpColor, weftColor := lightHex, darkHex
	if !brightIsWarp {
		warpColor, weftColor = darkHex, lightHex
	}

	repeat := pw
	if ph > repeat {
		repeat = ph
	}
	if repeat > 16 {
		repeat = 16
	}

	contrast := (lightLum - darkLum) / 255
	if contrast < 0 {
		contrast = 0
	}

	return Analysis{
		Weave:       tile(matrix, warpEnds, weftPicks),
		WarpEnds:    warpEnds,
		WeftPicks:   weftPicks,
		WarpColor:   warpColor,
		WeftColor:   weftColor,
		StructureID: structureID,
		Repeat:      repeat,
		Confidence:  math.Round(confidence*100) / 100,
		Contrast:    math.Round(contrast*100) / 100,
	}
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
