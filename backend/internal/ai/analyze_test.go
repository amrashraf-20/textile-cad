package ai

import (
	"image"
	"image/color"
	"testing"
)

func drawFabric(w, h, pitch int, cell func(r, c int) bool, warp, weft color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w*pitch, h*pitch))
	for r := 0; r < h; r++ {
		for c := 0; c < w; c++ {
			col := weft
			if cell(r, c) {
				col = warp
			}
			for y := r * pitch; y < (r+1)*pitch; y++ {
				for x := c * pitch; x < (c+1)*pitch; x++ {
					img.SetRGBA(x, y, col)
				}
			}
		}
	}
	return img
}

func TestAnalyzeTwill31(t *testing.T) {
	warp := color.RGBA{0x1F, 0x3A, 0x5F, 0xFF}
	weft := color.RGBA{0xF5, 0xF2, 0xE9, 0xFF}
	img := drawFabric(32, 32, 10, func(r, c int) bool {
		return mod(c-r, 4) < 3 // 3/1 warp-faced twill
	}, warp, weft)

	a := AnalyzeImage(img, 16, 16)
	if a.StructureID != "steepTwill" {
		t.Fatalf("structure = %q, want steepTwill (confidence %.2f, repeat %d)", a.StructureID, a.Confidence, a.Repeat)
	}
	if a.Repeat != 4 {
		t.Fatalf("repeat = %d, want 4", a.Repeat)
	}
	if len(a.Weave) != 16 || len(a.Weave[0]) != 16 {
		t.Fatalf("weave is %dx%d, want 16x16", len(a.Weave[0]), len(a.Weave))
	}
	if a.WarpColor != "#1F3A5F" {
		t.Fatalf("warp colour = %s, want #1F3A5F", a.WarpColor)
	}
	if a.WeftColor != "#F5F2E9" {
		t.Fatalf("weft colour = %s, want #F5F2E9", a.WeftColor)
	}
}

func TestAnalyzeTwill22UsesDarkWarp(t *testing.T) {
	warp := color.RGBA{0x1F, 0x3A, 0x5F, 0xFF}
	weft := color.RGBA{0xF5, 0xF2, 0xE9, 0xFF}
	img := drawFabric(32, 32, 10, func(r, c int) bool {
		return mod(c-r, 4) < 2 // balanced 2/2 twill
	}, warp, weft)

	a := AnalyzeImage(img, 16, 16)
	if a.WarpColor != "#1F3A5F" || a.WeftColor != "#F5F2E9" {
		t.Fatalf("colours = %s / %s, want #1F3A5F / #F5F2E9", a.WarpColor, a.WeftColor)
	}
}

func TestAnalyzePlain(t *testing.T) {
	warp := color.RGBA{0x23, 0x36, 0x4C, 0xFF}
	weft := color.RGBA{0xF5, 0xF1, 0xE8, 0xFF}
	img := drawFabric(24, 24, 8, func(r, c int) bool {
		return mod(r+c, 2) == 0
	}, warp, weft)

	a := AnalyzeImage(img, 16, 16)
	if a.StructureID != "plain" {
		t.Fatalf("structure = %q, want plain (confidence %.2f)", a.StructureID, a.Confidence)
	}
	if a.Repeat != 2 {
		t.Fatalf("repeat = %d, want 2", a.Repeat)
	}
	if a.Confidence < 0.7 {
		t.Fatalf("confidence = %.2f, want >= 0.70", a.Confidence)
	}
}

func TestAnalyzeHoneycomb(t *testing.T) {
	warp := color.RGBA{0x8A, 0x5A, 0x2B, 0xFF}
	weft := color.RGBA{0xF5, 0xEE, 0xDF, 0xFF}
	img := drawFabric(48, 48, 9, func(r, c int) bool {
		return canonicalCell("honeycomb", r, c) == 1
	}, warp, weft)

	a := AnalyzeImage(img, 24, 24)
	if a.StructureID != "honeycomb" {
		t.Fatalf("structure = %q, want honeycomb (confidence %.2f, repeat %d)", a.StructureID, a.Confidence, a.Repeat)
	}
	if a.Repeat != 8 {
		t.Fatalf("repeat = %d, want 8", a.Repeat)
	}
	if len(a.Weave) != 24 || len(a.Weave[0]) != 24 {
		t.Fatalf("weave is %dx%d, want 24x24", len(a.Weave[0]), len(a.Weave))
	}
}

func TestScaleWeaveTiles(t *testing.T) {
	src := [][]int{{1, 0}, {0, 1}}
	out := ScaleWeave(src, 5, 3)
	if len(out) != 3 || len(out[0]) != 5 {
		t.Fatalf("size = %dx%d, want 5x3", len(out[0]), len(out))
	}
	if out[0][0] != 1 || out[0][1] != 0 || out[2][4] != 1 {
		t.Fatalf("unexpected tiling: %v", out)
	}
}

func TestDecodeRejectsGarbage(t *testing.T) {
	if _, err := DecodeImage("data:image/png;base64,bm90LWFuLWltYWdl"); err == nil {
		t.Fatal("expected an error for non-image bytes")
	}
	if _, err := DecodeImage(""); err == nil {
		t.Fatal("expected an error for an empty image")
	}
}
