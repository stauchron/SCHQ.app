export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}`;
}

// ─── Validatie-grenzen + kleur-helpers ─────────────────────────────────────
// Rate (s/d): groen tussen -4 en +6 (inclusief), anders rood
// Amplitude (°): groen ≥ 260, anders rood; absoluut max bij invoer = 330
// Beat error (ms): groen ≤ 0.6, anders rood
export const AMPLITUDE_MAX_INPUT = 330;

const OK = "text-emerald-700";
const NOK = "text-red-700";

export function rateClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value >= -4 && value <= 6 ? OK : NOK;
}

export function amplitudeClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value >= 260 ? OK : NOK;
}

export function beatClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value <= 0.6 ? OK : NOK;
}

// ─── COSC-classificatie (per meting + per sessie) ─────────────────────────
// Drempelmarges (COSC + 20% tolerantie):
//   Rate (s/d):      ok [-4, +6]   bijna [-4.8, +7.2]   buiten anders
//   Amp (°):         ok ≥260       bijna ≥208 (260 × 0.8)
//   Beat (ms):       ok ≤0.6       bijna ≤0.72 (0.6 × 1.2)
export type CoscLevel = "ok" | "marginal" | "out" | "none";

function rateLevel(v: number | null | undefined): CoscLevel {
  if (v === null || v === undefined) return "none";
  if (v >= -4 && v <= 6) return "ok";
  if (v >= -4.8 && v <= 7.2) return "marginal";
  return "out";
}
function ampLevel(v: number | null | undefined): CoscLevel {
  if (v === null || v === undefined) return "none";
  if (v >= 260) return "ok";
  if (v >= 208) return "marginal";
  return "out";
}
function beatLevel(v: number | null | undefined): CoscLevel {
  if (v === null || v === undefined) return "none";
  if (v <= 0.6) return "ok";
  if (v <= 0.72) return "marginal";
  return "out";
}
// Δ Rate (Vmax — grootste variatie tussen posities). COSC P ≤ 5 s/d.
function rateDiffLevel(v: number | null | undefined): CoscLevel {
  if (v === null || v === undefined) return "none";
  if (v <= 5) return "ok";
  if (v <= 6) return "marginal";
  return "out";
}
// Δ Amplitude — geen harde COSC-grens; vakgebruik: ≤ 50° tussen posities.
function ampDiffLevel(v: number | null | undefined): CoscLevel {
  if (v === null || v === undefined) return "none";
  if (v <= 50) return "ok";
  if (v <= 60) return "marginal";
  return "out";
}

function worstLevel(levels: CoscLevel[]): CoscLevel {
  const filtered = levels.filter((l) => l !== "none");
  if (filtered.length === 0) return "none";
  if (filtered.includes("out")) return "out";
  if (filtered.includes("marginal")) return "marginal";
  return "ok";
}

type AveragesLike = {
  avg_rate: number | null;
  avg_amplitude: number | null;
  avg_beat_error: number | null;
  rate_difference?: number | null;
  amplitude_difference?: number | null;
};

export function measurementCoscLevel(m: AveragesLike): CoscLevel {
  return worstLevel([
    rateLevel(m.avg_rate),
    ampLevel(m.avg_amplitude),
    beatLevel(m.avg_beat_error),
    rateDiffLevel(m.rate_difference ?? null),
    ampDiffLevel(m.amplitude_difference ?? null),
  ]);
}

export function sessionCoscLevel(measurements: AveragesLike[]): CoscLevel {
  if (measurements.length === 0) return "none";
  return worstLevel(measurements.map(measurementCoscLevel));
}

export const COSC_LABEL: Record<CoscLevel, string> = {
  ok: "COSC",
  marginal: "Bijna COSC",
  out: "Buiten COSC",
  none: "—",
};

// Tailwind classes per niveau — punt-kleur en tekst-kleur
export const COSC_DOT: Record<CoscLevel, string> = {
  ok: "bg-emerald-600",
  marginal: "bg-amber-600",
  out: "bg-red-700",
  none: "bg-taupe",
};

export const COSC_TEXT: Record<CoscLevel, string> = {
  ok: "text-emerald-700",
  marginal: "text-amber-700",
  out: "text-red-700",
  none: "text-tier",
};

// Per-metric breakdown voor de "waarom" uitleg.
// Geeft per metric de slechtst-geobserveerde waarde + het COSC-niveau.
export type CoscBreakdown = {
  rate: { value: number | null; level: CoscLevel };
  amp: { value: number | null; level: CoscLevel };
  beat: { value: number | null; level: CoscLevel };
  rateDiff: { value: number | null; level: CoscLevel };
  ampDiff: { value: number | null; level: CoscLevel };
};

export const COSC_RANGE = {
  rate: "−4 t/m +6 s/d",
  amp: "≥ 260°",
  beat: "≤ 0,6 ms",
  rateDiff: "≤ 5 s/d",
  ampDiff: "≤ 50°",
};

const LEVEL_RANK: Record<CoscLevel, number> = {
  none: 0,
  ok: 1,
  marginal: 2,
  out: 3,
};

function pickWorst<T>(
  items: T[],
  level: (item: T) => CoscLevel,
  value: (item: T) => number | null,
): { value: number | null; level: CoscLevel } {
  let bestLvl: CoscLevel = "none";
  let bestVal: number | null = null;
  for (const item of items) {
    const lvl = level(item);
    if (LEVEL_RANK[lvl] > LEVEL_RANK[bestLvl]) {
      bestLvl = lvl;
      bestVal = value(item);
    }
  }
  return { value: bestVal, level: bestLvl };
}

export function coscBreakdown(measurements: AveragesLike[]): CoscBreakdown {
  return {
    rate: pickWorst(
      measurements,
      (m) => rateLevel(m.avg_rate),
      (m) => m.avg_rate,
    ),
    amp: pickWorst(
      measurements,
      (m) => ampLevel(m.avg_amplitude),
      (m) => m.avg_amplitude,
    ),
    beat: pickWorst(
      measurements,
      (m) => beatLevel(m.avg_beat_error),
      (m) => m.avg_beat_error,
    ),
    rateDiff: pickWorst(
      measurements,
      (m) => rateDiffLevel(m.rate_difference ?? null),
      (m) => m.rate_difference ?? null,
    ),
    ampDiff: pickWorst(
      measurements,
      (m) => ampDiffLevel(m.amplitude_difference ?? null),
      (m) => m.amplitude_difference ?? null,
    ),
  };
}
