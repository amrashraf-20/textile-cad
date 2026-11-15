package weave

import (
	"strconv"
	"strings"
	"testing"
)

// parseWIF is a minimal reader used to prove the exported file is valid and
// that the reduced draft reproduces the exact weave matrix.
func parseWIF(t *testing.T, body string) (warps, wefts int, threading, treadling []int, tieUp map[int][]int) {
	t.Helper()
	section := ""
	tieUp = map[int][]int{}
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section = strings.Trim(line, "[]")
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			t.Fatalf("bad line in %s: %q", section, line)
		}
		key, val := parts[0], parts[1]
		switch section {
		case "WEAVING":
			switch key {
			case "Warps":
				warps, _ = strconv.Atoi(val)
			case "Wefts":
				wefts, _ = strconv.Atoi(val)
			case "Rising Shed":
				if val != "true" {
					t.Fatalf("Rising Shed = %q, want true", val)
				}
			}
		case "THREADING":
			n, _ := strconv.Atoi(key)
			s, _ := strconv.Atoi(val)
			if n != len(threading)+1 {
				t.Fatalf("threading keys out of order: %d after %d", n, len(threading))
			}
			threading = append(threading, s)
		case "TREADLING":
			n, _ := strconv.Atoi(key)
			s, _ := strconv.Atoi(val)
			if n != len(treadling)+1 {
				t.Fatalf("treadling keys out of order: %d after %d", n, len(treadling))
			}
			treadling = append(treadling, s)
		case "TIEUP":
			n, _ := strconv.Atoi(key)
			if val == "" {
				tieUp[n] = nil
				continue
			}
			for _, raw := range strings.Split(val, ",") {
				s, err := strconv.Atoi(raw)
				if err != nil {
					t.Fatalf("bad shaft %q", raw)
				}
				tieUp[n] = append(tieUp[n], s)
			}
		}
	}
	return
}

func drawdown(warps, wefts int, threading, treadling []int, tieUp map[int][]int) [][]int {
	raised := make(map[int]bool)
	out := make([][]int, wefts)
	for pick := 0; pick < wefts; pick++ {
		clear(raised)
		for _, s := range tieUp[treadling[pick]] {
			raised[s] = true
		}
		row := make([]int, warps)
		for end := 0; end < warps; end++ {
			if raised[threading[end]] {
				row[end] = 1
			}
		}
		out[pick] = row
	}
	return out
}

func countShafts(threading []int) int {
	max := 0
	for _, s := range threading {
		if s > max {
			max = s
		}
	}
	return max
}

func twill22(warp, weft int) [][]int {
	out := make([][]int, weft)
	for r := 0; r < weft; r++ {
		out[r] = make([]int, warp)
		for c := 0; c < warp; c++ {
			if mod(c-r, 4) < 2 {
				out[r][c] = 1
			}
		}
	}
	return out
}

func mod(a, b int) int {
	v := a % b
	if v < 0 {
		v += b
	}
	return v
}

func TestWIFReducesTwillToFourShafts(t *testing.T) {
	data := twill22(8, 8)
	body := WIF("Twill", 8, 8, data, nil, nil)
	warps, wefts, threading, treadling, tieUp := parseWIF(t, body)

	if warps != 8 || wefts != 8 {
		t.Fatalf("size = %d×%d, want 8×8", warps, wefts)
	}
	if got := countShafts(threading); got != 4 {
		t.Fatalf("shafts = %d, want 4", got)
	}
	if len(treadling) != 8 {
		t.Fatalf("treadling entries = %d, want 8", len(treadling))
	}
	unique := map[int]bool{}
	for _, tr := range treadling {
		unique[tr] = true
	}
	if len(unique) != 4 {
		t.Fatalf("treadles = %d, want 4", len(unique))
	}
	if strings.Contains(body, "[LIFTPLAN]") {
		t.Fatal("reduced draft must not also contain a liftplan")
	}
	if got := drawdown(warps, wefts, threading, treadling, tieUp); !sameMatrix(got, data) {
		t.Fatalf("drawdown mismatch\ngot  %v\nwant %v", got, data)
	}
}

func TestWIFPlainTwoShafts(t *testing.T) {
	data := [][]int{
		{1, 0, 1, 0},
		{0, 1, 0, 1},
		{1, 0, 1, 0},
		{0, 1, 0, 1},
	}
	body := WIF("Plain", 4, 4, data, nil, nil)
	warps, wefts, threading, treadling, tieUp := parseWIF(t, body)
	if got := countShafts(threading); got != 2 {
		t.Fatalf("shafts = %d, want 2", got)
	}
	unique := map[int]bool{}
	for _, tr := range treadling {
		unique[tr] = true
	}
	if len(unique) != 2 {
		t.Fatalf("treadles = %d, want 2", len(unique))
	}
	if got := drawdown(warps, wefts, threading, treadling, tieUp); !sameMatrix(got, data) {
		t.Fatal("plain drawdown mismatch")
	}
}

func TestWIFRoundTripsArbitraryMatrix(t *testing.T) {
	data := [][]int{
		{1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1},
		{0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0},
		{1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1},
		{0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0},
		{1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0},
		{0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0},
		{1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1},
		{0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1},
		{1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0},
	}
	body := WIF("Mixed", 12, 9, data, nil, nil)
	warps, wefts, threading, treadling, tieUp := parseWIF(t, body)
	if got := drawdown(warps, wefts, threading, treadling, tieUp); !sameMatrix(got, data) {
		t.Fatalf("drawdown mismatch\ngot  %v\nwant %v", got, data)
	}
	if strings.Count(body, "=") < len(data)*2 {
		t.Fatal("file looks truncated")
	}
}

func TestWIFColoursAndFilename(t *testing.T) {
	data := [][]int{{1}}
	body := WIF("Test", 1, 1, data, []string{"#102030"}, []string{"#F0E8D8"})
	if !strings.Contains(body, "[WARP COLORS]\n1=16,32,48") {
		t.Fatalf("warp colour missing:\n%s", body)
	}
	if !strings.Contains(body, "[WEFT COLORS]\n1=240,232,216") {
		t.Fatalf("weft colour missing:\n%s", body)
	}
}

func sameMatrix(a, b [][]int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if len(a[i]) != len(b[i]) {
			return false
		}
		for j := range a[i] {
			if (a[i][j] != 0) != (b[i][j] != 0) {
				return false
			}
		}
	}
	return true
}
