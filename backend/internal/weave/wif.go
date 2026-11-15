package weave

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// WIF renders a WIF 1.1 file for a dobby loom.
//
// The export is not a naive lift plan: the matrix is reduced to the smallest
// valid draft. Warp ends that always move together share a shaft, and picks
// with identical lift patterns share a treadle. A 16×16 2/2 twill therefore
// exports as 4 shafts / 4 treadles instead of 16 shafts, which is what a real
// loom can actually thread.
func WIF(name string, warp, weft int, data [][]int, warpColors, weftColors []string) string {
	if warp < 0 {
		warp = 0
	}
	if weft < 0 {
		weft = 0
	}

	up := func(pick, end int) bool {
		if pick < len(data) && end < len(data[pick]) {
			return data[pick][end] != 0
		}
		return false
	}

	// Distinct warp columns become shafts, distinct weft rows become treadles.
	shaftOf := make([]int, warp) // 0-based shaft per end
	shaftIndex := map[string]int{}
	for end := 0; end < warp; end++ {
		var key strings.Builder
		for pick := 0; pick < weft; pick++ {
			if up(pick, end) {
				key.WriteByte('1')
			} else {
				key.WriteByte('0')
			}
		}
		k := key.String()
		idx, ok := shaftIndex[k]
		if !ok {
			idx = len(shaftIndex)
			shaftIndex[k] = idx
		}
		shaftOf[end] = idx
	}
	shafts := len(shaftIndex)

	treadleOf := make([]int, weft) // 0-based treadle per pick
	treadleIndex := map[string]int{}
	for pick := 0; pick < weft; pick++ {
		var key strings.Builder
		for end := 0; end < warp; end++ {
			if up(pick, end) {
				key.WriteByte('1')
			} else {
				key.WriteByte('0')
			}
		}
		k := key.String()
		idx, ok := treadleIndex[k]
		if !ok {
			idx = len(treadleIndex)
			treadleIndex[k] = idx
		}
		treadleOf[pick] = idx
	}
	treadles := len(treadleIndex)

	// Tie-up: for each treadle, the shafts raised on the picks it represents.
	tieUp := make([][]bool, treadles)
	for t := range tieUp {
		tieUp[t] = make([]bool, shafts)
	}
	for pick := 0; pick < weft; pick++ {
		t := treadleOf[pick]
		for end := 0; end < warp; end++ {
			if up(pick, end) {
				tieUp[t][shaftOf[end]] = true
			}
		}
	}

	var b strings.Builder
	b.WriteString("[WIF]\nVersion=1.1\n")
	b.WriteString("Date=" + time.Now().Format("2006-01-02") + "\n")
	b.WriteString("Developers=Textile CAD Studio\n")
	b.WriteString("Source Program=Textile CAD Studio\n")
	b.WriteString("Source Version=1.0\n")
	b.WriteString("[CONTENTS]\n")
	b.WriteString("WEAVING=1\n")
	b.WriteString("WARP COLORS=" + strconv.Itoa(warp) + "\n")
	b.WriteString("WEFT COLORS=" + strconv.Itoa(weft) + "\n")
	b.WriteString("THREADING=" + strconv.Itoa(warp) + "\n")
	b.WriteString("TIEUP=" + strconv.Itoa(treadles) + "\n")
	b.WriteString("TREADLING=" + strconv.Itoa(weft) + "\n")
	b.WriteString("[WEAVING]\n")
	b.WriteString("Wefts=" + strconv.Itoa(weft) + "\n")
	b.WriteString("Warps=" + strconv.Itoa(warp) + "\n")
	b.WriteString("Rising Shed=true\n")
	b.WriteString("Start Picking=1\n")
	b.WriteString("Start Weaving=1\n")

	b.WriteString("[WARP COLORS]\n")
	for i := 0; i < warp; i++ {
		c := "#FFFFFF"
		if i < len(warpColors) {
			c = warpColors[i]
		}
		b.WriteString(fmt.Sprintf("%d=%s\n", i+1, hexToRGB(c)))
	}
	b.WriteString("[WEFT COLORS]\n")
	for i := 0; i < weft; i++ {
		c := "#FFFFFF"
		if i < len(weftColors) {
			c = weftColors[i]
		}
		b.WriteString(fmt.Sprintf("%d=%s\n", i+1, hexToRGB(c)))
	}

	b.WriteString("[THREADING]\n")
	for end := 0; end < warp; end++ {
		b.WriteString(fmt.Sprintf("%d=%d\n", end+1, shaftOf[end]+1))
	}

	b.WriteString("[TIEUP]\n")
	for t := 0; t < treadles; t++ {
		raised := make([]string, 0, shafts)
		for s := 0; s < shafts; s++ {
			if tieUp[t][s] {
				raised = append(raised, strconv.Itoa(s+1))
			}
		}
		b.WriteString(fmt.Sprintf("%d=%s\n", t+1, strings.Join(raised, ",")))
	}

	b.WriteString("[TREADLING]\n")
	for pick := 0; pick < weft; pick++ {
		b.WriteString(fmt.Sprintf("%d=%d\n", pick+1, treadleOf[pick]+1))
	}
	return b.String()
}

// CSV renders the weave matrix as 1/0 rows.
func CSV(data [][]int) string {
	var b strings.Builder
	for _, row := range data {
		for i, v := range row {
			if i > 0 {
				b.WriteByte(',')
			}
			if v == 1 {
				b.WriteByte('1')
			} else {
				b.WriteByte('0')
			}
		}
		b.WriteByte('\n')
	}
	return b.String()
}

func hexToRGB(hex string) string {
	hex = strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if len(hex) == 3 {
		hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
	}
	if len(hex) != 6 {
		return "255,255,255"
	}
	v, err := strconv.ParseUint(hex, 16, 32)
	if err != nil {
		return "255,255,255"
	}
	return fmt.Sprintf("%d,%d,%d", (v>>16)&0xff, (v>>8)&0xff, v&0xff)
}
