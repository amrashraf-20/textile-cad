package calc

import "testing"

func plainWeave(w, h int) [][]int {
	out := make([][]int, h)
	for r := 0; r < h; r++ {
		out[r] = make([]int, w)
		for c := 0; c < w; c++ {
			if (r+c)%2 == 0 {
				out[r][c] = 1
			}
		}
	}
	return out
}

func TestDensityPlainWeave(t *testing.T) {
	res := Density(DensityInput{
		System: "ne", WarpCount: 20, WeftCount: 20,
		WarpEnds: 16, WeftPicks: 16, Weave: plainWeave(16, 16),
	})
	if res.WarpDensity <= 0 || res.WeftDensity <= 0 {
		t.Fatalf("expected positive densities, got %+v", res)
	}
	if res.WarpCrimp < 2 || res.WarpCrimp > 12 {
		t.Fatalf("crimp out of range: %v", res.WarpCrimp)
	}
	if res.WarpTex <= 0 || res.WarpNe != 20 {
		t.Fatalf("unexpected count conversion: %+v", res)
	}
}

func TestDensityTexInput(t *testing.T) {
	res := Density(DensityInput{
		System: "tex", WarpCount: 29.5, WeftCount: 29.5,
		WarpEnds: 8, WeftPicks: 8, Weave: plainWeave(8, 8),
	})
	if res.WarpNe < 19 || res.WarpNe > 21 {
		t.Fatalf("expected ~20 Ne, got %v", res.WarpNe)
	}
}

func TestConsumption(t *testing.T) {
	res := Consumption(ConsumptionInput{
		System: "ne", WarpCount: 20, WeftCount: 20,
		WarpDensity: 24, WeftDensity: 20, WarpCrimp: 5, WeftCrimp: 8,
		WarpPrice: 120, WeftPrice: 110,
		FabricWidthCm: 150, SelvedgeEnds: 48,
		WeavingCost: 4, FinishingCost: 2, ProfitMargin: 20,
	})
	if res.TotalWarpEnds != 3648 {
		t.Fatalf("expected 3648 ends, got %d", res.TotalWarpEnds)
	}
	if res.TotalWeightSqM <= 0 || res.SellingPrice <= 0 {
		t.Fatalf("unexpected result %+v", res)
	}
	if res.CoverPercent < 1 || res.CoverPercent > 100 {
		t.Fatalf("cover percent out of range: %d", res.CoverPercent)
	}
}

func TestERP(t *testing.T) {
	res := ERP(ERPInput{
		System: "ne", WarpCount: 20, WeftCount: 20,
		WarpDensity: 24, WeftDensity: 20, WarpCrimp: 5, WeftCrimp: 8,
		WarpPrice: 120, WeftPrice: 110, FabricWidthCm: 150, SelvedgeEnds: 48,
		WeavingCost: 4, FinishingCost: 2, ProfitMargin: 20,
		OrderMeters: 1000, WastePercent: 4, LoomRPM: 450, LoomEff: 85,
		WarpColors: []string{"#111111", "#111111", "#FFFFFF", "#FFFFFF"},
		WeftColors: []string{"#FFFFFF", "#FFFFFF"},
	})
	if res.TotalWarpKG <= 0 || res.TotalWeftKG <= 0 {
		t.Fatalf("expected positive weights: %+v", res)
	}
	if res.TotalYarnKG < res.TotalWarpKG {
		t.Fatalf("total yarn must include warp")
	}
	if len(res.WarpBreakdown) != 2 {
		t.Fatalf("expected 2 warp colours, got %d", len(res.WarpBreakdown))
	}
	if res.FinalOrderValue <= res.GrandTotalCost {
		t.Fatalf("profit not applied: %+v", res)
	}
	if res.TotalHours <= 0 || res.MetersPerHour <= 0 {
		t.Fatalf("expected loom time: %+v", res)
	}
}

func TestSample(t *testing.T) {
	res := Sample(SampleInput{
		LengthCm: 10, WidthCm: 10, WeightGram: 2.2,
		WarpDensity: 28, WeftDensity: 22, CrimpPercent: 6,
	})
	if res.GSM != 220 {
		t.Fatalf("expected 220 GSM, got %v", res.GSM)
	}
	if res.WarpNe <= 0 || res.WeftNe <= 0 {
		t.Fatalf("expected deduced counts: %+v", res)
	}
	if res.WarpClosest == "" {
		t.Fatalf("expected closest commercial count")
	}
}

func TestSampleKnownWarp(t *testing.T) {
	res := Sample(SampleInput{
		LengthCm: 10, WidthCm: 10, WeightGram: 2.2,
		WarpDensity: 28, WeftDensity: 22, CrimpPercent: 6, KnownWarpNe: 30,
	})
	if res.WarpNe != 30 {
		t.Fatalf("known warp count not respected: %v", res.WarpNe)
	}
	if res.WeftNe <= 0 {
		t.Fatalf("weft count not deduced")
	}
}

func TestLoom(t *testing.T) {
	res := Loom(LoomInput{
		WarpDensity: 24, EndsPerDent: 2, FabricWidthCm: 150,
		WidthCrimp: 6, SelvedgeEnds: 48, WarpEnds: 8, WeftPicks: 8,
		Weave: plainWeave(8, 8),
	})
	if res.TotalGroundEnds != 3816 {
		t.Fatalf("expected 3816 ground ends, got %d", res.TotalGroundEnds)
	}
	if res.SelvedgeEnds != 48 {
		t.Fatalf("expected 48 selvedge ends, got %d", res.SelvedgeEnds)
	}
	if res.TotalEnds != 3864 {
		t.Fatalf("expected 3864 total ends, got %d", res.TotalEnds)
	}
	if res.MetricReed != 120 {
		t.Fatalf("expected metric reed 120, got %v", res.MetricReed)
	}
	if res.TotalDents != 1932 {
		t.Fatalf("expected 1932 dents, got %d", res.TotalDents)
	}
	if len(res.Shafts) == 0 {
		t.Fatalf("expected shafts")
	}
}

func TestLoomDraft(t *testing.T) {
	// 2/2 twill: four distinct column signatures.
	weave := [][]int{
		{1, 1, 0, 0},
		{0, 1, 1, 0},
		{0, 0, 1, 1},
		{1, 0, 0, 1},
	}
	res := Loom(LoomInput{
		WarpDensity: 20, EndsPerDent: 2, FabricWidthCm: 100,
		WarpEnds: 4, WeftPicks: 4, Weave: weave,
	})
	if res.ShaftCount != 4 {
		t.Fatalf("expected 4 shafts, got %d", res.ShaftCount)
	}
}
