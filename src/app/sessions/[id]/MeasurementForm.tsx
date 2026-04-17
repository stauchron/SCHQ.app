"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { POSITION_SHORT, type Position } from "@/lib/types";
import {
  AMPLITUDE_MAX_INPUT,
  amplitudeClass,
  beatClass,
  formatNumber,
  formatRate,
  rateClass,
} from "@/lib/format";

type Triple = { rate: string; amplitude: string; beat_error: string };
const BEAT_PREFIX = "0.";
// Beat-formaat: max 1 cijfer vóór de punt + optionele punt + max 1 decimaal
const BEAT_PATTERN = /^\d?(\.\d?)?$/;
const empty: Triple = { rate: "", amplitude: "", beat_error: BEAT_PREFIX };

const POSITIONS: Position[] = ["ch", "h6", "h9", "h12", "h3", "fh"];

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  // Behandel los "0," / "0." / "." als nog-niet-ingevuld → null (niet 0)
  if (trimmed === "" || trimmed === "0," || trimmed === "0." || trimmed === ".") {
    return null;
  }
  const normalised = trimmed.replace(",", ".");
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

function average(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((s, v) => s + v, 0) / filtered.length;
}

function difference(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return Math.max(...filtered) - Math.min(...filtered);
}

// ─── Conversies van AI-waarden naar form-strings ─────────────────────────
function rateToString(v: number | null): string {
  if (v === null) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function ampToString(v: number | null): string {
  if (v === null) return "";
  return String(Math.round(v));
}
function beatToString(v: number | null): string {
  if (v === null) return BEAT_PREFIX;
  // Clamp tussen 0.0 en 9.9 (BEAT_PATTERN), 1 decimaal
  const clamped = Math.max(0, Math.min(9.9, v));
  return clamped.toFixed(1);
}

// Programmatisch file picker (camera-capable op mobiel)
function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    input.click();
  });
}

type Props = {
  sessionId: string;
};

export function MeasurementForm({ sessionId }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [enabled, setEnabled] = useState<Record<Position, boolean>>({
    ch: true,
    h6: false,
    h9: true,
    h12: false,
    h3: true,
    fh: true,
  });
  const [values, setValues] = useState<Record<Position, Triple>>({
    ch: { ...empty },
    h6: { ...empty },
    h9: { ...empty },
    h12: { ...empty },
    h3: { ...empty },
    fh: { ...empty },
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "photo">("manual");

  // AI-foto-analyse state
  const [aiAnalyzing, setAiAnalyzing] = useState<"all" | Position | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSourcePhotoUrl, setAiSourcePhotoUrl] = useState<string | null>(null);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  async function uploadToStorage(file: File): Promise<string> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("measurement-photos")
      .upload(path, file, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage
      .from("measurement-photos")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  type SinglePositionResult = {
    rate: number | null;
    amplitude: number | null;
    beat_error: number | null;
  };

  function applyMeasurement(p: Position, v: SinglePositionResult) {
    setValues((prev) => ({
      ...prev,
      [p]: {
        rate: rateToString(v.rate),
        amplitude: ampToString(v.amplitude),
        beat_error: beatToString(v.beat_error),
      },
    }));
    setEnabled((prev) => ({ ...prev, [p]: true }));
  }

  async function analyzeAll() {
    setAiError(null);
    const file = await pickImageFile();
    if (!file) return;
    setAiAnalyzing("all");
    try {
      const url = await uploadToStorage(file);
      const res = await fetch("/api/analyze-timegrapher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "all", photo_url: url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analyse mislukt");
      const positions = json.positions as Record<Position, SinglePositionResult | null>;
      let filled = 0;
      for (const p of POSITIONS) {
        const v = positions[p];
        if (v) {
          applyMeasurement(p, v);
          filled++;
        }
      }
      if (filled === 0) {
        throw new Error(
          "Geen posities herkend in de foto — vul handmatig in.",
        );
      }
      setAiSourcePhotoUrl(url);
      setAiAnalyzed(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setAiAnalyzing(null);
    }
  }

  const stats = useMemo(() => {
    const rateValues = POSITIONS.filter((p) => enabled[p]).map((p) =>
      parseDecimal(values[p].rate),
    );
    const ampValues = POSITIONS.filter((p) => enabled[p]).map((p) =>
      parseDecimal(values[p].amplitude),
    );
    const beatValues = POSITIONS.filter((p) => enabled[p]).map((p) =>
      parseDecimal(values[p].beat_error),
    );
    return {
      rate: average(rateValues),
      amp: average(ampValues),
      beat: average(beatValues),
      rateDiff: difference(rateValues),
      ampDiff: difference(ampValues),
    };
  }, [enabled, values]);

  const enabledCount = POSITIONS.filter((p) => enabled[p]).length;

  function setVal(p: Position, key: keyof Triple, v: string) {
    let next = v;

    if (key === "amplitude" && v.trim() !== "") {
      const parsed = parseDecimal(v);
      if (parsed !== null && parsed > AMPLITUDE_MAX_INPUT) return;
    }

    if (key === "beat_error") {
      // Komma → punt
      next = next.replace(",", ".");
      // Reject als het format niet matcht (bv. 2 decimalen, 2 cijfers vóór de punt)
      if (next !== "" && !BEAT_PATTERN.test(next)) return;
    }

    setValues((prev) => ({ ...prev, [p]: { ...prev[p], [key]: next } }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (enabledCount === 0) {
      setError("Selecteer minstens één positie.");
      return;
    }

    setSubmitting(true);

    // De AI-bron-foto fungeert óók als measurement-foto (één upload, één bewaarpunt)
    const payload: Record<string, unknown> = {
      test_session_id: sessionId,
      notes: notes.trim() || null,
      photo_url: aiSourcePhotoUrl,
      ai_analyzed: aiAnalyzed,
      original_photo_url: aiSourcePhotoUrl,
    };
    for (const p of POSITIONS) {
      const isOn = enabled[p];
      payload[`${p}_rate`] = isOn ? parseDecimal(values[p].rate) : null;
      payload[`${p}_amplitude`] = isOn ? parseDecimal(values[p].amplitude) : null;
      payload[`${p}_beat_error`] = isOn ? parseDecimal(values[p].beat_error) : null;
    }

    const { error: insertError } = await supabase
      .from("timegrapher_measurements")
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.refresh();
    setValues({
      ch: { ...empty },
      h6: { ...empty },
      h9: { ...empty },
      h12: { ...empty },
      h3: { ...empty },
      fh: { ...empty },
    });
    setNotes("");
    setAiSourcePhotoUrl(null);
    setAiAnalyzed(false);
    setAiError(null);
    setMode("manual");
    setSubmitting(false);
  }

  // Foto-modus toont nooit de input-tabel; gemiddelden verschijnen na analyse.
  const showTable = mode === "manual";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tabs */}
      <div className="grid grid-cols-2 border border-line">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`btn-label py-3 transition-colors duration-150 ease-staudt ${
            mode === "manual"
              ? "bg-navy text-white"
              : "bg-white text-tier hover:text-navy"
          }`}
        >
          Handmatig
        </button>
        <button
          type="button"
          onClick={() => setMode("photo")}
          className={`btn-label border-l border-line py-3 transition-colors duration-150 ease-staudt ${
            mode === "photo"
              ? "bg-navy text-white"
              : "bg-white text-tier hover:text-navy"
          }`}
        >
          Foto
        </button>
      </div>

      {/* Foto-modus */}
      {mode === "photo" ? (
        <div className="border border-line bg-zand/60 p-4">
          {aiAnalyzed && aiSourcePhotoUrl ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <a
                  href={aiSourcePhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-20 w-20 flex-none overflow-hidden border border-line bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={aiSourcePhotoUrl}
                    alt="bron"
                    className="h-full w-full object-cover"
                  />
                </a>
                <div className="flex-1 text-xs text-body">
                  <div className="eyebrow mb-1">Foto verwerkt</div>
                  Waarden hieronder zijn afgelezen door Claude. Controleer ze
                  in de <button
                    type="button"
                    onClick={() => setMode("manual")}
                    className="underline decoration-taupe underline-offset-2 hover:text-navy"
                  >
                    Handmatig
                  </button>-tab.
                </div>
              </div>
              <button
                type="button"
                onClick={analyzeAll}
                disabled={aiAnalyzing !== null}
                className="btn-label w-full border border-line bg-white px-4 py-2 text-tier transition-colors duration-200 ease-staudt hover:border-navy hover:text-navy disabled:opacity-40"
              >
                {aiAnalyzing === "all" ? "Analyseren…" : "Andere foto"}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-xs leading-relaxed text-body">
                Maak één foto van je timegrapher-display. Claude leest alle
                zichtbare posities af.
              </p>
              <button
                type="button"
                onClick={analyzeAll}
                disabled={aiAnalyzing !== null}
                className="btn-label w-full border border-navy bg-navy px-4 py-3 text-white transition-colors duration-200 ease-staudt hover:bg-tier hover:border-tier disabled:opacity-40"
              >
                {aiAnalyzing === "all" ? "Analyseren…" : "Maak / kies foto"}
              </button>
            </div>
          )}
          {aiError ? (
            <div className="mt-3 border-l-2 border-red-700 bg-white px-3 py-2 text-xs text-red-800">
              {aiError}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Posities + tabel — alleen handmatig of foto-zonder-resultaat */}
      {showTable ? (
        <>
          <div>
            <div className="eyebrow mb-2">Posities</div>
            <div className="grid grid-cols-6 gap-1.5">
              {POSITIONS.map((p) => {
                const active = enabled[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setEnabled((prev) => ({ ...prev, [p]: !prev[p] }))
                    }
                    className={`btn-label border px-1 py-2 transition-colors duration-150 ease-staudt ${
                      active
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-white text-tier hover:border-navy hover:text-navy"
                    }`}
                  >
                    {POSITION_SHORT[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {enabledCount > 0 ? (
            <div className="border border-line">
              <div
                className="grid items-center gap-1 border-b border-line bg-zand px-2 py-2 text-[10px] uppercase tracking-[0.18em] text-tier"
                style={{ gridTemplateColumns: "38px 1fr 1fr 1fr" }}
              >
                <div>Pos</div>
                <div>
                  Rate <span className="text-tier/70">s/d</span>
                </div>
                <div>
                  Amp <span className="text-tier/70">°</span>
                </div>
                <div>
                  Beat <span className="text-tier/70">ms</span>
                </div>
              </div>
              {POSITIONS.map((p, idx) => {
                if (!enabled[p]) return null;
                return (
                  <div
                    key={p}
                    className="grid items-center gap-1 border-b border-line px-2 py-1 last:border-b-0"
                    style={{ gridTemplateColumns: "38px 1fr 1fr 1fr" }}
                  >
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-navy">
                      {POSITION_SHORT[p]}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      tabIndex={1 + idx}
                      value={values[p].rate}
                      onChange={(event) =>
                        setVal(p, "rate", event.target.value)
                      }
                      className={`w-full min-w-0 border border-line bg-white px-2 py-1.5 text-right text-sm font-medium outline-none transition-colors duration-150 focus:border-navy ${rateClass(parseDecimal(values[p].rate)) || "text-black"}`}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      max={AMPLITUDE_MAX_INPUT}
                      tabIndex={11 + idx}
                      value={values[p].amplitude}
                      onChange={(event) =>
                        setVal(p, "amplitude", event.target.value)
                      }
                      className={`w-full min-w-0 border border-line bg-white px-2 py-1.5 text-right text-sm font-medium outline-none transition-colors duration-150 focus:border-navy ${amplitudeClass(parseDecimal(values[p].amplitude)) || "text-black"}`}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      tabIndex={21 + idx}
                      value={values[p].beat_error}
                      onChange={(event) =>
                        setVal(p, "beat_error", event.target.value)
                      }
                      onFocus={(event) => {
                        const el = event.currentTarget;
                        requestAnimationFrame(() => {
                          const len = el.value.length;
                          el.setSelectionRange(len, len);
                        });
                      }}
                      className={`w-full min-w-0 border border-line bg-white px-2 py-1.5 text-right text-sm font-medium outline-none transition-colors duration-150 focus:border-navy ${beatClass(parseDecimal(values[p].beat_error)) || "text-black"}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Compact gemiddelden + differentiatie */}
      {enabledCount > 0 ? (
        <div className="border-l-2 border-navy bg-zand px-3 py-2 text-sm">
          <div className="grid grid-cols-[18px_1fr_1fr_1fr] items-baseline gap-2 tabular-nums">
            <span className="text-[10px] uppercase tracking-[0.2em] text-tier">
              Ø
            </span>
            <span className={`font-medium ${rateClass(stats.rate) || "text-black"}`}>
              {formatRate(stats.rate)}
              <span className="ml-1 text-[10px] font-normal text-tier">s/d</span>
            </span>
            <span className={`font-medium ${amplitudeClass(stats.amp) || "text-black"}`}>
              {formatNumber(stats.amp, 0)}
              <span className="ml-1 text-[10px] font-normal text-tier">°</span>
            </span>
            <span className={`font-medium ${beatClass(stats.beat) || "text-black"}`}>
              {formatNumber(stats.beat, 1)}
              <span className="ml-1 text-[10px] font-normal text-tier">ms</span>
            </span>
          </div>
          {enabledCount > 1 ? (
            <div className="mt-1 grid grid-cols-[18px_1fr_1fr_1fr] items-baseline gap-2 border-t border-line/60 pt-1 tabular-nums">
              <span className="text-[10px] uppercase tracking-[0.2em] text-tier">
                Δ
              </span>
              <span className="font-medium text-body">
                {formatNumber(stats.rateDiff, 1)}
                <span className="ml-1 text-[10px] font-normal text-tier">s/d</span>
              </span>
              <span className="font-medium text-body">
                {formatNumber(stats.ampDiff, 0)}
                <span className="ml-1 text-[10px] font-normal text-tier">°</span>
              </span>
              <span className="text-[10px] text-tier">—</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="group border border-line bg-white">
        <summary className="btn-label flex cursor-pointer items-center justify-between px-4 py-2 text-tier transition-colors duration-150 ease-staudt hover:text-navy">
          <span>
            Notities{notes.trim() ? ` · ${notes.trim().length} tekens` : ""}
          </span>
          <span className="text-base transition-transform duration-150 group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="border-t border-line p-3">
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opmerkingen over deze meting…"
            className="w-full resize-y border border-line bg-white px-3 py-2 text-sm text-black outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy"
          />
        </div>
      </details>

      {error ? (
        <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || enabledCount === 0}>
          {submitting ? "Bezig…" : "Meting opslaan"}
        </Button>
      </div>
    </form>
  );
}
