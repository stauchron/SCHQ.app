import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SearchBox } from "@/components/SearchBox";
import { Card, EmptyState } from "@/components/Card";
import { LinkButton } from "@/components/Button";
import {
  COSC_DOT,
  COSC_LABEL,
  COSC_TEXT,
  formatNumber,
  formatRate,
  formatDateTime,
  sessionCoscLevel,
} from "@/lib/format";
import type { TestSession, WatchPassport } from "@/lib/types";

export const dynamic = "force-dynamic";

type SessionMeasurementSummary = {
  avg_rate: number | null;
  avg_amplitude: number | null;
  avg_beat_error: number | null;
  rate_difference: number | null;
  amplitude_difference: number | null;
};

type SessionDurationTest = {
  id: string;
  active: boolean;
  reference_time: string;
  duration_checkpoints: {
    checkpoint_time: string;
    offset_seconds: number | null;
  }[];
};

type SessionPowerReserveTest = {
  id: string;
  still_running: boolean;
  started_at: string;
};

type SessionWithPassport = TestSession & {
  watch_passports: Pick<WatchPassport, "serial_number" | "sku" | "model_name"> | null;
  timegrapher_measurements: SessionMeasurementSummary[];
  duration_tests: SessionDurationTest[];
  power_reserve_tests: SessionPowerReserveTest[];
};

function avgOf(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((s, v) => s + v, 0) / filtered.length;
}

function summarizeDuration(tests: SessionDurationTest[]): {
  active: boolean;
  impliedRate: number | null;
} | null {
  if (!tests || tests.length === 0) return null;
  // Geef voorkeur aan de actieve test; valt-back naar de meest recente
  const sorted = [...tests].sort(
    (a, b) =>
      new Date(b.reference_time).getTime() -
      new Date(a.reference_time).getTime(),
  );
  const test = sorted.find((t) => t.active) ?? sorted[0];
  const cps = [...(test.duration_checkpoints ?? [])].sort(
    (a, b) =>
      new Date(b.checkpoint_time).getTime() -
      new Date(a.checkpoint_time).getTime(),
  );
  const lastCp = cps[0];
  let impliedRate: number | null = null;
  if (lastCp?.offset_seconds != null) {
    const cpMs = new Date(lastCp.checkpoint_time).getTime();
    const refMs = new Date(test.reference_time).getTime();
    const days = (cpMs - refMs) / 86_400_000;
    if (days > 0) impliedRate = lastCp.offset_seconds / days;
  }
  return { active: test.active, impliedRate };
}

type SearchParams = Promise<{ q?: string }> | { q?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params?.q?.trim();

  const supabase = createSupabaseServerClient();

  const { data: activeRaw, error: activeError } = await supabase
    .from("test_sessions")
    .select(
      "id, watch_passport_id, status, started_at, completed_at, notes, watch_passports(serial_number, sku, model_name), timegrapher_measurements(avg_rate, avg_amplitude, avg_beat_error, rate_difference, amplitude_difference), duration_tests(id, active, reference_time, duration_checkpoints(checkpoint_time, offset_seconds)), power_reserve_tests(id, still_running, started_at)",
    )
    .eq("status", "active")
    .order("started_at", { ascending: false });

  const activeSessions = (activeRaw ?? []) as unknown as SessionWithPassport[];

  let searchResults: WatchPassport[] | null = null;
  if (q) {
    const { data: passports } = await supabase
      .from("watch_passports")
      .select("*")
      .ilike("serial_number", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(20);
    searchResults = (passports ?? []) as WatchPassport[];
  }

  return (
    <>
      <Link
        href="/sessions/new"
        className="mb-1.5 flex items-center justify-center gap-2 border border-dashed border-taupe py-2.5 text-tier transition-colors duration-150 ease-staudt hover:border-navy hover:text-navy"
      >
        <span className="text-base leading-none">+</span>
        <span className="btn-label">Nieuwe testsessie</span>
      </Link>

      {activeError ? (
        <div className="mb-10">
          <EmptyState
            title="Database niet bereikbaar"
            description="Controleer of de Supabase-omgevingsvariabelen in .env.local kloppen en het schema is uitgevoerd."
          />
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="mb-10 border border-line bg-white px-4 py-6 text-center text-sm text-body">
          Geen actieve sessies.
        </div>
      ) : (
        <ul className="mb-10 space-y-1.5">
          {activeSessions.map((session) => {
            const measurements = session.timegrapher_measurements ?? [];
            const level = sessionCoscLevel(measurements);
            const tg = {
              rate: avgOf(measurements.map((m) => m.avg_rate)),
              amp: avgOf(measurements.map((m) => m.avg_amplitude)),
              beat: avgOf(measurements.map((m) => m.avg_beat_error)),
            };
            const dur = summarizeDuration(session.duration_tests ?? []);
            const activePr = (session.power_reserve_tests ?? []).find(
              (t) => t.still_running,
            );
            const hasStats =
              tg.rate !== null ||
              tg.amp !== null ||
              tg.beat !== null ||
              dur?.impliedRate !== null;
            return (
              <li key={session.id}>
                <Link
                  href={`/sessions/${session.id}`}
                  className="block border border-line bg-white transition-colors duration-150 hover:bg-zand/60"
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-tier">
                      <span>{session.watch_passports?.sku ?? "—"}</span>
                      <span className="flex items-center gap-2">
                        {dur?.active ? (
                          <span className="flex items-center gap-1 text-navy">
                            <span className="relative inline-flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navy/60" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-navy" />
                            </span>
                            duurtest
                          </span>
                        ) : null}
                        {activePr ? (
                          <span className="flex items-center gap-1 text-navy">
                            <span className="relative inline-flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navy/60" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-navy" />
                            </span>
                            gangreserve
                          </span>
                        ) : null}
                        <span>{formatDateTime(session.started_at)}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-black tracking-tight text-black">
                        {session.watch_passports?.serial_number ?? "Onbekend"}
                      </span>
                      {level !== "none" ? (
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] ${COSC_TEXT[level]}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${COSC_DOT[level]}`}
                          />
                          {COSC_LABEL[level]}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-tier">
                          geen meting
                        </span>
                      )}
                    </div>
                    {hasStats ? (
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-tier">
                        {tg.rate !== null ? (
                          <span>
                            Ø{" "}
                            <span className="font-medium text-black">
                              {formatRate(tg.rate)} s/d
                            </span>
                          </span>
                        ) : null}
                        {tg.amp !== null ? (
                          <span className="font-medium text-black">
                            {formatNumber(tg.amp, 0)}°
                          </span>
                        ) : null}
                        {tg.beat !== null ? (
                          <span className="font-medium text-black">
                            {formatNumber(tg.beat, 1)} ms
                          </span>
                        ) : null}
                        {dur?.impliedRate !== null && dur?.impliedRate !== undefined ? (
                          <span>
                            dur{" "}
                            <span className="font-medium text-black">
                              {dur.impliedRate > 0 ? "+" : ""}
                              {formatNumber(dur.impliedRate, 1)} s/d
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/archive"
        className="mb-1.5 flex items-center justify-center gap-2 border border-line bg-white py-2.5 text-tier transition-colors duration-150 ease-staudt hover:border-navy hover:text-navy"
      >
        <span className="btn-label">Archief</span>
        <span className="text-base leading-none">→</span>
      </Link>

      <section className="mb-10">
        <SearchBox defaultValue={q ?? ""} />
        {q ? (
          <div className="mt-6">
            {searchResults && searchResults.length > 0 ? (
              <ul className="space-y-3">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <Card href={`/passports/${encodeURIComponent(p.serial_number)}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="eyebrow">{p.sku}</div>
                          <div
                            className="mt-1 font-black tracking-tight text-black"
                            style={{ fontSize: "1.05rem" }}
                          >
                            {p.serial_number}
                          </div>
                          {p.model_name ? (
                            <div className="text-sm text-body">{p.model_name}</div>
                          ) : null}
                        </div>
                        <span className="btn-label text-tier">Open →</span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Geen treffer"
                description={`Geen paspoort gevonden voor "${q}". Start een nieuwe test om er één aan te maken.`}
              >
                <LinkButton href={`/sessions/new?serial=${encodeURIComponent(q)}`}>
                  Nieuwe test starten
                </LinkButton>
              </EmptyState>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
