// Package calc contains the textile engineering math ported from the
// original prototype. All functions are pure and unit-tested.
package calc

import (
	"math"
	"sort"
	"strconv"
	"strings"
)

const (
	NeToTex = 590.5
	// 11 is the empirical diameter factor used by the original studio.
	diameterFactor = 11.0
)

type DensityInput struct {
	System    string  `json:"system"` // ne | tex
	WarpCount float64 `json:"warpCount"`
	WeftCount float64 `json:"weftCount"`
	WarpEnds  int     `json:"warpEnds"`
	WeftPicks int     `json:"weftPicks"`
	Weave     [][]int `json:"weave"`
}

type DensityResult struct {
	WarpDensity float64 `json:"warpDensity"`
	WeftDensity float64 `json:"weftDensity"`
	WarpCrimp   float64 `json:"warpCrimp"`
	WeftCrimp   float64 `json:"weftCrimp"`
	WarpNe      float64 `json:"warpNe"`
	WeftNe      float64 `json:"weftNe"`
	WarpTex     float64 `json:"warpTex"`
	WeftTex     float64 `json:"weftTex"`
}

func toNe(count float64, system string) float64 {
	if count <= 0 {
		return 0
	}
	if strings.EqualFold(system, "tex") {
		return NeToTex / count
	}
	return count
}

func toTex(count float64, system string) float64 {
	if count <= 0 {
		return 0
	}
	if strings.EqualFold(system, "tex") {
		return count
	}
	return NeToTex / count
}

func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

// Density estimates ends/picks per cm and crimp from the weave diagram.
func Density(in DensityInput) DensityResult {
	warpEnds := clampInt(in.WarpEnds, 2, 100)
	weftPicks := clampInt(in.WeftPicks, 2, 100)
	weave := in.Weave
	if len(weave) < weftPicks {
		weave = make([][]int, weftPicks)
		for r := range weave {
			weave[r] = make([]int, warpEnds)
		}
	}
	for r := range weave {
		if len(weave[r]) < warpEnds {
			row := make([]int, warpEnds)
			copy(row, weave[r])
			weave[r] = row
		}
	}

	totalWarpInt, totalWeftInt := 0, 0
	for c := 0; c < warpEnds; c++ {
		for r := 1; r < weftPicks; r++ {
			if weave[r][c] != weave[r-1][c] {
				totalWarpInt++
			}
		}
		if weave[weftPicks-1][c] != weave[0][c] {
			totalWarpInt++
		}
	}
	for r := 0; r < weftPicks; r++ {
		for c := 1; c < warpEnds; c++ {
			if weave[r][c] != weave[r][c-1] {
				totalWeftInt++
			}
		}
		if weave[r][warpEnds-1] != weave[r][0] {
			totalWeftInt++
		}
	}

	avgWarpInt := float64(totalWarpInt) / float64(warpEnds)
	avgWeftInt := float64(totalWeftInt) / float64(weftPicks)

	neWarp := toNe(in.WarpCount, in.System)
	neWeft := toNe(in.WeftCount, in.System)
	if neWeft == 0 {
		neWeft = neWarp
	}
	if neWarp == 0 {
		neWarp = 1
	}
	if neWeft == 0 {
		neWeft = 1
	}

	warpDensity := diameterFactor * math.Sqrt(neWarp) * (float64(weftPicks) / (float64(weftPicks) + avgWarpInt))
	weftDensity := diameterFactor * math.Sqrt(neWeft) * (float64(warpEnds) / (float64(warpEnds) + avgWeftInt))

	maxInt := float64(warpEnds * weftPicks)
	warpCrimp := 2.0
	weftCrimp := 2.0
	if maxInt > 0 {
		warpCrimp = 2.0 + (float64(totalWarpInt)/maxInt)*10.0
		weftCrimp = 2.0 + (float64(totalWeftInt)/maxInt)*10.0
	}

	return DensityResult{
		WarpDensity: round(warpDensity, 1),
		WeftDensity: round(weftDensity, 1),
		WarpCrimp:   round(warpCrimp, 1),
		WeftCrimp:   round(weftCrimp, 1),
		WarpNe:      round(neWarp, 2),
		WeftNe:      round(neWeft, 2),
		WarpTex:     round(toTex(in.WarpCount, in.System), 2),
		WeftTex:     round(toTex(in.WeftCount, in.System), 2),
	}
}

type ConsumptionInput struct {
	System         string  `json:"system"`
	WarpCount      float64 `json:"warpCount"`
	WeftCount      float64 `json:"weftCount"`
	WarpDensity    float64 `json:"warpDensity"`
	WeftDensity    float64 `json:"weftDensity"`
	WarpCrimp      float64 `json:"warpCrimp"`
	WeftCrimp      float64 `json:"weftCrimp"`
	WarpPrice      float64 `json:"warpPrice"`
	WeftPrice      float64 `json:"weftPrice"`
	FabricWidthCm  float64 `json:"fabricWidthCm"`
	SelvedgeEnds   int     `json:"selvedgeEnds"`
	WeavingCost    float64 `json:"weavingCost"`
	FinishingCost  float64 `json:"finishingCost"`
	ProfitMargin   float64 `json:"profitMargin"`
}

type ConsumptionResult struct {
	TotalWarpEnds     int     `json:"totalWarpEnds"`
	CoverFactor       float64 `json:"coverFactor"`
	CoverPercent      int     `json:"coverPercent"`
	CoverStatus       string  `json:"coverStatus"` // balanced | light | dense
	WarpWeightSqM     float64 `json:"warpWeightSqM"`
	WeftWeightSqM     float64 `json:"weftWeightSqM"`
	TotalWeightSqM    float64 `json:"totalWeightSqM"`
	WarpWeightLinearM float64 `json:"warpWeightLinearM"`
	WeftWeightLinearM float64 `json:"weftWeightLinearM"`
	TotalWeightLinear float64 `json:"totalWeightLinearM"`
	WarpCost          float64 `json:"warpCost"`
	WeftCost          float64 `json:"weftCost"`
	YarnCost          float64 `json:"yarnCost"`
	ManufacturingCost float64 `json:"manufacturingCost"`
	ProfitValue       float64 `json:"profitValue"`
	SellingPrice      float64 `json:"sellingPrice"`
}

func Consumption(in ConsumptionInput) ConsumptionResult {
	width := in.FabricWidthCm
	if width <= 0 {
		width = 150
	}
	warpDensity := math.Max(0, in.WarpDensity)
	weftDensity := math.Max(0, in.WeftDensity)
	neWarp := toNe(in.WarpCount, in.System)
	neWeft := toNe(in.WeftCount, in.System)
	texWarp := toTex(in.WarpCount, in.System)
	texWeft := toTex(in.WeftCount, in.System)
	if neWarp <= 0 {
		neWarp = 1
	}
	if neWeft <= 0 {
		neWeft = 1
	}

	totalWarpEnds := int(math.Round(warpDensity*width)) + in.SelvedgeEnds
	kWarp := (warpDensity * 2.54) / math.Sqrt(neWarp)
	kWeft := (weftDensity * 2.54) / math.Sqrt(neWeft)
	totalCover := kWarp + kWeft - (kWarp*kWeft)/28
	coverPercent := int(math.Min(100, math.Round((totalCover/28)*100)))
	coverStatus := "balanced"
	if coverPercent < 45 {
		coverStatus = "light"
	} else if coverPercent > 82 {
		coverStatus = "dense"
	}

	warpSqM := (warpDensity * 100 * (1 + in.WarpCrimp/100) * texWarp) / 1000
	weftSqM := (weftDensity * 100 * (1 + in.WeftCrimp/100) * texWeft) / 1000

	warpLinear := (float64(totalWarpEnds) * (1 + in.WarpCrimp/100) * texWarp) / 1000
	weftLinear := weftSqM * (width / 100)

	warpCost := (warpLinear / 1000) * in.WarpPrice
	weftCost := (weftLinear / 1000) * in.WeftPrice
	yarnCost := warpCost + weftCost
	mfg := yarnCost + in.WeavingCost + in.FinishingCost
	profit := mfg * (in.ProfitMargin / 100)

	return ConsumptionResult{
		TotalWarpEnds:     totalWarpEnds,
		CoverFactor:       round(totalCover, 2),
		CoverPercent:      coverPercent,
		CoverStatus:       coverStatus,
		WarpWeightSqM:     round(warpSqM, 1),
		WeftWeightSqM:     round(weftSqM, 1),
		TotalWeightSqM:    round(warpSqM+weftSqM, 1),
		WarpWeightLinearM: round(warpLinear, 1),
		WeftWeightLinearM: round(weftLinear, 1),
		TotalWeightLinear: round(warpLinear+weftLinear, 1),
		WarpCost:          round(warpCost, 2),
		WeftCost:          round(weftCost, 2),
		YarnCost:          round(yarnCost, 2),
		ManufacturingCost: round(mfg, 2),
		ProfitValue:       round(profit, 2),
		SellingPrice:      round(mfg+profit, 2),
	}
}

type ERPInput struct {
	System        string   `json:"system"`
	WarpCount     float64  `json:"warpCount"`
	WeftCount     float64  `json:"weftCount"`
	WarpDensity   float64  `json:"warpDensity"`
	WeftDensity   float64  `json:"weftDensity"`
	WarpCrimp     float64  `json:"warpCrimp"`
	WeftCrimp     float64  `json:"weftCrimp"`
	WarpPrice     float64  `json:"warpPrice"`
	WeftPrice     float64  `json:"weftPrice"`
	FabricWidthCm float64  `json:"fabricWidthCm"`
	SelvedgeEnds  int      `json:"selvedgeEnds"`
	WeavingCost   float64  `json:"weavingCost"`
	FinishingCost float64  `json:"finishingCost"`
	ProfitMargin  float64  `json:"profitMargin"`
	OrderMeters   float64  `json:"orderMeters"`
	WastePercent  float64  `json:"wastePercent"`
	LoomRPM       float64  `json:"loomRpm"`
	LoomEff       float64  `json:"loomEff"`
	WarpColors    []string `json:"warpColors"`
	WeftColors    []string `json:"weftColors"`
}

type ColorShare struct {
	Code       string  `json:"code"`
	Hex        string  `json:"hex"`
	Threads    int     `json:"threads"`
	Percentage float64 `json:"percentage"`
	KG         float64 `json:"kg"`
}

type ERPResult struct {
	TotalWarpEnds    int          `json:"totalWarpEnds"`
	TotalWarpKG      float64      `json:"totalWarpKg"`
	TotalWeftKG      float64      `json:"totalWeftKg"`
	TotalYarnKG      float64      `json:"totalYarnKg"`
	WarpBreakdown    []ColorShare `json:"warpBreakdown"`
	WeftBreakdown    []ColorShare `json:"weftBreakdown"`
	TotalPicks       float64      `json:"totalPicks"`
	TotalHours       float64      `json:"totalHours"`
	Days             int          `json:"days"`
	RemainingHours   int          `json:"remainingHours"`
	MetersPerHour    float64      `json:"metersPerHour"`
	YarnCost         float64      `json:"yarnCost"`
	OperatingCost    float64      `json:"operatingCost"`
	GrandTotalCost   float64      `json:"grandTotalCost"`
	NetProfit        float64      `json:"netProfit"`
	FinalOrderValue  float64      `json:"finalOrderValue"`
}

func ERP(in ERPInput) ERPResult {
	width := in.FabricWidthCm
	if width <= 0 {
		width = 150
	}
	orderMeters := in.OrderMeters
	if orderMeters <= 0 {
		orderMeters = 1000
	}
	rpm := in.LoomRPM
	if rpm <= 0 {
		rpm = 450
	}
	eff := in.LoomEff
	if eff <= 0 {
		eff = 85
	}

	texWarp := toTex(in.WarpCount, in.System)
	texWeft := toTex(in.WeftCount, in.System)

	totalWarpEnds := int(math.Round(in.WarpDensity*width)) + in.SelvedgeEnds
	warpGramPerM := (float64(totalWarpEnds) * (1 + in.WarpCrimp/100) * texWarp) / 1000
	weftGramPerM := (in.WeftDensity * width * (1 + in.WeftCrimp/100) * texWeft) / 1000

	wasteFactor := 1 + in.WastePercent/100
	totalWarpKg := (warpGramPerM * orderMeters / 1000) * wasteFactor
	totalWeftKg := (weftGramPerM * orderMeters / 1000) * wasteFactor

	share := func(colors []string, totalKg float64) []ColorShare {
		if len(colors) == 0 {
			return []ColorShare{}
		}
		counts := map[string]int{}
		order := make([]string, 0)
		for _, c := range colors {
			key := strings.ToUpper(strings.TrimSpace(c))
			if key == "" {
				key = "#FFFFFF"
			}
			if _, ok := counts[key]; !ok {
				order = append(order, key)
			}
			counts[key]++
		}
		sort.SliceStable(order, func(i, j int) bool { return counts[order[i]] > counts[order[j]] })
		out := make([]ColorShare, 0, len(order))
		for i, hex := range order {
			ratio := float64(counts[hex]) / float64(len(colors))
			out = append(out, ColorShare{
				Code:       string(rune('A' + i)),
				Hex:        hex,
				Threads:    counts[hex],
				Percentage: round(ratio*100, 1),
				KG:         round(totalKg*ratio, 2),
			})
		}
		return out
	}

	totalPicks := orderMeters * 100 * in.WeftDensity
	effectivePPM := rpm * (eff / 100)
	hours := 0.0
	if effectivePPM > 0 {
		hours = totalPicks / effectivePPM / 60
	}
	metersPerHour := 0.0
	if hours > 0 {
		metersPerHour = orderMeters / hours
	}

	yarnCost := totalWarpKg*in.WarpPrice + totalWeftKg*in.WeftPrice
	operating := (in.WeavingCost + in.FinishingCost) * orderMeters
	grand := yarnCost + operating
	profit := grand * (in.ProfitMargin / 100)

	return ERPResult{
		TotalWarpEnds:   totalWarpEnds,
		TotalWarpKG:     round(totalWarpKg, 2),
		TotalWeftKG:     round(totalWeftKg, 2),
		TotalYarnKG:     round(totalWarpKg+totalWeftKg, 2),
		WarpBreakdown:   share(in.WarpColors, totalWarpKg),
		WeftBreakdown:   share(in.WeftColors, totalWeftKg),
		TotalPicks:      round(totalPicks, 0),
		TotalHours:      round(hours, 1),
		Days:            int(hours / 24),
		RemainingHours:  int(math.Round(math.Mod(hours, 24))),
		MetersPerHour:   round(metersPerHour, 2),
		YarnCost:        round(yarnCost, 0),
		OperatingCost:   round(operating, 0),
		GrandTotalCost:  round(grand, 0),
		NetProfit:       round(profit, 0),
		FinalOrderValue: round(grand+profit, 0),
	}
}

type SampleInput struct {
	LengthCm     float64 `json:"lengthCm"`
	WidthCm      float64 `json:"widthCm"`
	WeightGram   float64 `json:"weightGram"`
	WarpDensity  float64 `json:"warpDensity"`
	WeftDensity  float64 `json:"weftDensity"`
	CrimpPercent float64 `json:"crimpPercent"`
	KnownWarpNe  float64 `json:"knownWarpNe"`
}

type SampleResult struct {
	GSM            float64 `json:"gsm"`
	WeightPerMeter float64 `json:"weightPerMeter150"`
	WarpNe         float64 `json:"warpNe"`
	WeftNe         float64 `json:"weftNe"`
	WarpTex        float64 `json:"warpTex"`
	WeftTex        float64 `json:"weftTex"`
	WarpDenier     float64 `json:"warpDenier"`
	WeftDenier     float64 `json:"weftDenier"`
	WarpClosest    string  `json:"warpClosest"`
	WeftClosest    string  `json:"weftClosest"`
}

var commercialCounts = []float64{6, 8, 10, 12, 14, 16, 20, 24, 30, 36, 40, 50, 60, 80, 100}

func closestCount(ne float64) string {
	best := commercialCounts[0]
	diff := math.Abs(ne - best)
	for _, c := range commercialCounts {
		if d := math.Abs(ne - c); d < diff {
			best, diff = c, d
		}
	}
	return strconv.FormatFloat(best, 'f', -1, 64) + "/1 Ne"
}

func Sample(in SampleInput) SampleResult {
	length := in.LengthCm
	if length <= 0 {
		length = 10
	}
	width := in.WidthCm
	if width <= 0 {
		width = 10
	}
	weight := in.WeightGram
	if weight <= 0 {
		weight = 1
	}
	warpDensity := in.WarpDensity
	if warpDensity <= 0 {
		warpDensity = 20
	}
	weftDensity := in.WeftDensity
	if weftDensity <= 0 {
		weftDensity = 20
	}
	crimp := in.CrimpPercent
	if crimp < 0 {
		crimp = 0
	}

	area := length * width
	gsm := (weight * 10000) / area
	crimpFactor := 1 + crimp/100
	warpLen := warpDensity * 100 * crimpFactor
	weftLen := weftDensity * 100 * crimpFactor
	totalLen := warpLen + weftLen

	var warpTex, weftTex, warpNe, weftNe float64
	if in.KnownWarpNe > 0 {
		warpNe = in.KnownWarpNe
		warpTex = NeToTex / warpNe
		warpWeight := (warpLen * warpTex) / 1000
		remaining := math.Max(5, gsm-warpWeight)
		weftTex = (remaining * 1000) / weftLen
		weftNe = NeToTex / weftTex
	} else {
		avgTex := (gsm * 1000) / totalLen
		avgNe := NeToTex / avgTex
		warpTex, weftTex = avgTex, avgTex
		warpNe, weftNe = avgNe, avgNe
	}

	return SampleResult{
		GSM:            round(gsm, 1),
		WeightPerMeter: round(gsm*1.5, 1),
		WarpNe:         round(warpNe, 1),
		WeftNe:         round(weftNe, 1),
		WarpTex:        round(warpTex, 1),
		WeftTex:        round(weftTex, 1),
		WarpDenier:     round(warpTex*9, 0),
		WeftDenier:     round(weftTex*9, 0),
		WarpClosest:    closestCount(warpNe),
		WeftClosest:    closestCount(weftNe),
	}
}

type LoomInput struct {
	WarpDensity   float64  `json:"warpDensity"`
	EndsPerDent   int      `json:"endsPerDent"`
	FabricWidthCm float64  `json:"fabricWidthCm"`
	WidthCrimp    float64  `json:"widthCrimp"`
	SelvedgeEnds  int      `json:"selvedgeEnds"`
	WarpEnds      int      `json:"warpEnds"`
	WeftPicks     int      `json:"weftPicks"`
	Weave         [][]int  `json:"weave"`
}

type Shaft struct {
	Index   int `json:"index"`
	Heddles int `json:"heddles"`
	InRepeat int `json:"inRepeat"`
}

type LoomResult struct {
	ReedWidthCm    float64 `json:"reedWidthCm"`
	DentsPerCm     float64 `json:"dentsPerCm"`
	MetricReed     float64 `json:"metricReed"`
	EnglishReed    int     `json:"englishReed"`
	TotalGroundEnds int    `json:"totalGroundEnds"`
	SelvedgeEnds   int     `json:"selvedgeEnds"`
	TotalEnds      int     `json:"totalEnds"`
	TotalDents     int     `json:"totalDents"`
	Shafts         []Shaft `json:"shafts"`
	ShaftCount     int     `json:"shaftCount"`
}

func Loom(in LoomInput) LoomResult {
	warpDensity := in.WarpDensity
	if warpDensity <= 0 {
		warpDensity = 24
	}
	endsPerDent := in.EndsPerDent
	if endsPerDent <= 0 {
		endsPerDent = 2
	}
	width := in.FabricWidthCm
	if width <= 0 {
		width = 150
	}
	warpEnds := clampInt(in.WarpEnds, 2, 100)
	weftPicks := clampInt(in.WeftPicks, 2, 100)

	reedWidth := width * (1 + in.WidthCrimp/100)
	dentsPerCm := warpDensity / float64(endsPerDent)
	// The warp density is measured in the reed, not on the finished cloth, so
	// the end count must use the crimped (loom) width. Using the finished width
	// here made the end count disagree with reed width × dents per cm.
	totalGroundEnds := int(math.Round(warpDensity * reedWidth))
	// Selvedge (edge) ends are extra ends in addition to the ground warp. They
	// are threaded in the reed as well, so the dent count must cover them.
	selvedgeEnds := clampInt(in.SelvedgeEnds, 0, 4000)
	totalEnds := totalGroundEnds + selvedgeEnds
	totalDents := int(math.Ceil(float64(totalEnds) / float64(endsPerDent)))

	// Draft: columns with identical weave signatures share a shaft.
	seen := map[string]int{}
	signatures := make([]int, 0, warpEnds)
	for c := 0; c < warpEnds; c++ {
		parts := make([]string, 0, weftPicks)
		for r := 0; r < weftPicks; r++ {
			v := 0
			if r < len(in.Weave) && c < len(in.Weave[r]) {
				v = in.Weave[r][c]
			}
			if v == 1 {
				parts = append(parts, "1")
			} else {
				parts = append(parts, "0")
			}
		}
		key := strings.Join(parts, "")
		idx, ok := seen[key]
		if !ok {
			idx = len(seen)
			seen[key] = idx
		}
		signatures = append(signatures, idx)
	}

	inRepeat := make([]int, len(seen))
	for _, s := range signatures {
		inRepeat[s]++
	}
	repeats := 1.0
	if warpEnds > 0 {
		repeats = float64(totalGroundEnds) / float64(warpEnds)
	}
	shafts := make([]Shaft, 0, len(inRepeat))
	for i, n := range inRepeat {
		shafts = append(shafts, Shaft{Index: i + 1, InRepeat: n, Heddles: int(math.Round(float64(n) * repeats))})
	}

	return LoomResult{
		ReedWidthCm:     round(reedWidth, 1),
		DentsPerCm:      round(dentsPerCm, 2),
		MetricReed:      round(dentsPerCm*10, 1),
		EnglishReed:     int(math.Round(dentsPerCm * 2.54 * 2)),
		TotalGroundEnds: totalGroundEnds,
		SelvedgeEnds:    selvedgeEnds,
		TotalEnds:       totalEnds,
		TotalDents:      totalDents,
		Shafts:          shafts,
		ShaftCount:      len(shafts),
	}
}

func round(v float64, places int) float64 {
	p := math.Pow(10, float64(places))
	return math.Round(v*p) / p
}
