import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/Card";
import { LinkButton } from "@/components/Button";
import {
  COSC_DOT,
  COSC_LABEL,
  COSC_RANGE,
  COSC_TEXT,
  coscBreakdown,
  formatDateTime,
  formatNumber,
  formatRate,
  sessionCoscLevel,
} from "@/lib/format";
import type {
  DurationCheckpoint,
  DurationTest,
  PowerReserveCheckpoint,
  PowerReserveTest,
  TestSession,
  TimegrapherMeasurement,
  WatchPassport,
} from "@/lib/types";
import { MeasurementForm } from "./MeasurementForm";
import { MeasurementList } from "./MeasurementList";
import { CompleteSessionButton } from "./CompleteSessionButton";
import { DurationElapsed } from "./DurationElapsed";
import { EditPassportButton } from "./EditPassportButton";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }> | { id: string };

type SessionWithPassport = TestSession & {
  watch_passports: WatchPassport | null;
};

export default async function SessionDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();

  const { data: sessionRow } = await supabase
    .from("test_sessions")
    .select("*, watch_passports(*)")
    .eq("id", id)
    .maybeSingle();

  if (!sessionRow) notFound();
  const session = sessionRow as unknown as SessionWithPassport;
  const passport = session.watch_passports;

  const { data: measurementsRaw } = await supabase
    .from("timegrapher_measurements")
    .select("*")
    .eq("test_session_id", id)
    .order("measurement_timestamp", { ascending: false });

  const measurements = (measurementsRaw ?? []) as TimegrapherMeasurement[];

  // Actieve duurtest (max 1 per sessie) + laatste checkpoint
  const { data: activeDtRow } = await supabase
    .from("duration_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("active", true)
    .maybeSingle();
  const activeDurationTest = (activeDtRow as DurationTest | null) ?? null;

  let lastCheckpoint: DurationCheckpoint | null = null;
  let checkpointCount = 0;
  if (activeDurationTest) {
    const { data: cpRaw, count } = await supabase
      .from("duration_checkpoints")
      .select("*", { count: "exact" })
      .eq("duration_test_id", activeDurationTest.id)
      .order("checkpoint_time", { ascending: false })
      .limit(1);
    checkpointCount = count ?? 0;
    lastCheckpoint = (cpRaw?.[0] as DurationCheckpoint | undefined) ?? null;
  }

  // Actieve gangreserve-test (max 1 per sessie) + laatste checkpoint
  const { data: activePrRow } = await supabase
    .from("power_reserve_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("still_running", true)
    .maybeSingle();
  const activePowerReserveTest = (activePrRow as PowerReserveTest | null) ?? null;

  let lastPrCheckpoint: PowerReserveCheckpoint | null = null;
  let prCheckpointCount = 0;
  if (activePowerReserveTest) {
    const { data: prCpRaw, count: prCount } = await supabase
      .from("power_reserve_checkpoints")
      .select("*", { count: "exact" })
      .eq("power_reserve_test_id", activePowerReserveTest.id)
      .order("checkpoint_time", { ascending: false })
      .limit(1);
    prCheckpointCount = prCount ?? 0;
    lastPrCheckpoint = (prCpRaw?.[0] as PowerReserveCheckpoint | undefined) ?? null;
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="btn-label text-tier transition-colors duration-200 ease-staudt hover:text-navy"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {(() => {
              const level = sessionCoscLevel(measurements);
              if (level === "none") return null;
              const bd = coscBreakdown(measurements);
              return (
                <details className="group relative">
                  <summary
                    className={`btn-label inline-flex cursor-pointer list-none items-center gap-2 border border-line bg-white px-3 py-1 ${COSC_TEXT[level]} hover:border-navy`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[level]}`}
                    />
                    {COSC_LABEL[level]}
                    <span className="text-[10px] transition-transform duration-150 group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 border border-line bg-white p-3 text-sm shadow-lg">
                    <div className="eyebrow mb-2">Waarom {COSC_LABEL[level].toLowerCase()}?</div>
                    <ul className="space-y-2">
                      <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 tabular-nums">
                        <span>
                          <span className="font-medium text-black">Rate</span>
                          <br />
                          <span className="text-[10px] text-tier">
                            COSC {COSC_RANGE.rate}
                          </span>
                        </span>
                        <span className={`font-medium ${COSC_TEXT[bd.rate.level]}`}>
                          {bd.rate.value !== null
                            ? `${formatRate(bd.rate.value)} s/d`
                            : "—"}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[bd.rate.level]}`}
                        />
                      </li>
                      <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 tabular-nums">
                        <span>
                          <span className="font-medium text-black">Amplitude</span>
                          <br />
                          <span className="text-[10px] text-tier">
                            COSC {COSC_RANGE.amp}
                          </span>
                        </span>
                        <span className={`font-medium ${COSC_TEXT[bd.amp.level]}`}>
                          {bd.amp.value !== null
                            ? `${formatNumber(bd.amp.value, 0)}°`
                            : "—"}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[bd.amp.level]}`}
                        />
                      </li>
                      <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 tabular-nums">
                        <span>
                          <span className="font-medium text-black">Beat error</span>
                          <br />
                          <span className="text-[10px] text-tier">
                            COSC {COSC_RANGE.beat}
                          </span>
                        </span>
                        <span className={`font-medium ${COSC_TEXT[bd.beat.level]}`}>
                          {bd.beat.value !== null
                            ? `${formatNumber(bd.beat.value, 1)} ms`
                            : "—"}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[bd.beat.level]}`}
                        />
                      </li>
                      <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-line pt-2 tabular-nums">
                        <span>
                          <span className="font-medium text-black">Δ Rate</span>
                          <br />
                          <span className="text-[10px] text-tier">
                            COSC P {COSC_RANGE.rateDiff}
                          </span>
                        </span>
                        <span
                          className={`font-medium ${COSC_TEXT[bd.rateDiff.level]}`}
                        >
                          {bd.rateDiff.value !== null
                            ? `${formatNumber(bd.rateDiff.value, 1)} s/d`
                            : "—"}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[bd.rateDiff.level]}`}
                        />
                      </li>
                      <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 tabular-nums">
                        <span>
                          <span className="font-medium text-black">Δ Amplitude</span>
                          <br />
                          <span className="text-[10px] text-tier">
                            richtlijn {COSC_RANGE.ampDiff}
                          </span>
                        </span>
                        <span
                          className={`font-medium ${COSC_TEXT[bd.ampDiff.level]}`}
                        >
                          {bd.ampDiff.value !== null
                            ? `${formatNumber(bd.ampDiff.value, 0)}°`
                            : "—"}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${COSC_DOT[bd.ampDiff.level]}`}
                        />
                      </li>
                    </ul>
                    <div className="mt-3 border-t border-line pt-2 text-[10px] leading-relaxed text-tier">
                      Toont slechtst gemeten waarde per metric in deze sessie.
                      <br />
                      Binnen <strong>20%</strong> buiten COSC = oranje, daarbuiten = rood.
                    </div>
                  </div>
                </details>
              );
            })()}
            <span
              className={`btn-label rounded-none border px-3 py-1 ${
                session.status === "active"
                  ? "border-navy text-navy"
                  : "border-taupe text-tier"
              }`}
            >
              {session.status === "active" ? "Actief" : "Afgerond"}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <div className="eyebrow mb-1">{passport?.sku ?? "—"}</div>
          <div className="flex items-baseline gap-2">
            {passport ? (
              <Link
                href={`/passports/${encodeURIComponent(passport.serial_number)}`}
                className="font-black tracking-tight text-black transition-colors duration-200 ease-staudt hover:text-tier"
                style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.2 }}
                title="Volledige historie"
              >
                {passport.serial_number}
              </Link>
            ) : (
              <h1
                className="font-black tracking-tight text-black"
                style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.2 }}
              >
                Onbekend
              </h1>
            )}
            {passport ? <EditPassportButton passport={passport} /> : null}
          </div>
          {passport?.model_name ? (
            <div className="mt-1 text-base text-body">
              {passport.model_name}
              {passport.movement_type ? ` · ${passport.movement_type}` : ""}
            </div>
          ) : null}
          <div className="mt-2 text-sm text-tier">
            Gestart {formatDateTime(session.started_at)}
            {session.completed_at
              ? ` · Afgerond ${formatDateTime(session.completed_at)}`
              : ""}
          </div>
        </div>

      </div>

      {/* Lopende duur- en gangreserve-tests komen bovenaan zodat-ie meteen opvalt */}
      {activeDurationTest ? (
        <DurationTestStatus
          sessionId={id}
          sessionStatus={session.status}
          active={activeDurationTest}
          lastCheckpoint={lastCheckpoint}
          checkpointCount={checkpointCount}
        />
      ) : null}

      {activePowerReserveTest ? (
        <PowerReserveStatus
          sessionId={id}
          sessionStatus={session.status}
          active={activePowerReserveTest}
          lastCheckpoint={lastPrCheckpoint}
          checkpointCount={prCheckpointCount}
        />
      ) : null}

      {session.status === "active" ? (
        measurements.length === 0 ? (
          <Section eyebrow="Nieuwe meting" title="Timegrapher-meting">
            <MeasurementForm sessionId={session.id} />
          </Section>
        ) : (
          <details className="group mb-1.5 border border-dashed border-taupe">
            <summary className="flex cursor-pointer items-center justify-center gap-2 py-2.5 text-tier transition-colors duration-150 ease-staudt hover:border-navy hover:text-navy group-open:border-b group-open:border-dashed group-open:border-taupe">
              <span className="text-base leading-none transition-transform duration-150 group-open:rotate-45">
                +
              </span>
              <span className="btn-label">Nieuwe meting</span>
            </summary>
            <div className="bg-white p-5">
              <MeasurementForm sessionId={session.id} />
            </div>
          </details>
        )
      ) : null}

      {/* Empty states onder de timegrapher */}
      {!activeDurationTest ? (
        <DurationTestStatus
          sessionId={id}
          sessionStatus={session.status}
          active={null}
          lastCheckpoint={null}
          checkpointCount={0}
        />
      ) : null}
      {!activePowerReserveTest ? (
        <PowerReserveStatus
          sessionId={id}
          sessionStatus={session.status}
          active={null}
          lastCheckpoint={null}
          checkpointCount={0}
        />
      ) : null}

      <Section eyebrow="Historie">
        <MeasurementList measurements={measurements} />
      </Section>

      {session.status === "active" ? (
        <div className="mt-10">
          <CompleteSessionButton sessionId={session.id} />
        </div>
      ) : (
        <div className="mt-10">
          <LinkButton href="/" variant="ghost">
            Terug naar dashboard
          </LinkButton>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Duurtest-overzicht: verschijnt bovenaan de sessie-pagina
// ──────────────────────────────────────────────────────────────────────────
function DurationTestStatus({
  sessionId,
  sessionStatus,
  active,
  lastCheckpoint,
  checkpointCount,
}: {
  sessionId: string;
  sessionStatus: TestSession["status"];
  active: DurationTest | null;
  lastCheckpoint: DurationCheckpoint | null;
  checkpointCount: number;
}) {
  // Geen actieve duurtest → tonen we alleen een start-link op actieve sessies
  if (!active) {
    if (sessionStatus !== "active") return null;
    return (
      <Link
        href={`/sessions/${sessionId}/duration-test`}
        className="mb-1.5 flex items-center justify-center gap-2 border border-dashed border-taupe py-2.5 text-tier transition-colors duration-150 ease-staudt hover:border-navy hover:text-navy"
      >
        <span className="text-base leading-none">+</span>
        <span className="btn-label">Nieuwe duurtest</span>
      </Link>
    );
  }

  const referenceMs = new Date(active.reference_time).getTime();

  let impliedRate: number | null = null;
  if (lastCheckpoint?.offset_seconds != null) {
    const cpMs = new Date(lastCheckpoint.checkpoint_time).getTime();
    const cpElapsedMs = cpMs - referenceMs;
    if (cpElapsedMs > 0) {
      const days = cpElapsedMs / 86_400_000;
      impliedRate = lastCheckpoint.offset_seconds / days;
    }
  }

  return (
    <Link
      href={`/sessions/${sessionId}/duration-test`}
      className="mb-8 block border border-navy bg-navy text-white transition-colors duration-150 hover:bg-tier hover:border-tier"
    >
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-zand/70">
          <span className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="font-medium text-white">Duurtest loopt</span>
          </span>
          <span>ref {formatDateTime(active.reference_time)}</span>
        </div>
        <div className="mt-1 grid grid-cols-3 items-baseline gap-2 tabular-nums text-sm">
          <span className="font-medium text-white">
            <DurationElapsed referenceTimeIso={active.reference_time} />
            <span className="ml-1 text-[10px] font-normal text-zand/70">verstreken</span>
          </span>
          <span className="font-medium text-white">
            {checkpointCount}
            <span className="ml-1 text-[10px] font-normal text-zand/70">cp</span>
          </span>
          <span className="font-medium text-white">
            {impliedRate !== null ? (
              <>
                {impliedRate > 0 ? "+" : ""}
                {formatNumber(impliedRate, 1)}
                <span className="ml-1 text-[10px] font-normal text-zand/70">s/d</span>
              </>
            ) : (
              <span className="text-zand/70">—</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Gangreserve-status (zelfde compact patroon als duurtest)
// ──────────────────────────────────────────────────────────────────────────
function PowerReserveStatus({
  sessionId,
  sessionStatus,
  active,
  lastCheckpoint,
  checkpointCount,
}: {
  sessionId: string;
  sessionStatus: TestSession["status"];
  active: PowerReserveTest | null;
  lastCheckpoint: PowerReserveCheckpoint | null;
  checkpointCount: number;
}) {
  if (!active) {
    if (sessionStatus !== "active") return null;
    return (
      <Link
        href={`/sessions/${sessionId}/power-reserve`}
        className="mb-1.5 flex items-center justify-center gap-2 border border-dashed border-taupe py-2.5 text-tier transition-colors duration-150 ease-staudt hover:border-navy hover:text-navy"
      >
        <span className="text-base leading-none">+</span>
        <span className="btn-label">Nieuwe gangreserve</span>
      </Link>
    );
  }

  const startMs = new Date(active.started_at).getTime();
  const elapsedMs = Date.now() - startMs;

  const lastCpMs = lastCheckpoint
    ? new Date(lastCheckpoint.checkpoint_time).getTime()
    : startMs;
  const nextReminderMs = lastCpMs + active.reminder_interval_hours * 3_600_000;
  const overdueMs = Date.now() - nextReminderMs;
  const overdue = overdueMs > 0;

  return (
    <Link
      href={`/sessions/${sessionId}/power-reserve`}
      className="mb-8 block border border-navy bg-navy text-white transition-colors duration-150 hover:bg-tier hover:border-tier"
    >
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-zand/70">
          <span className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="font-medium text-white">Gangreserve loopt</span>
          </span>
          <span>start {formatDateTime(active.started_at)}</span>
        </div>
        <div className="mt-1 grid grid-cols-3 items-baseline gap-2 tabular-nums text-sm">
          <span className="font-medium text-white">
            {formatElapsedShortLabel(elapsedMs)}
            <span className="ml-1 text-[10px] font-normal text-zand/70">verstreken</span>
          </span>
          <span className="font-medium text-white">
            {checkpointCount}
            <span className="ml-1 text-[10px] font-normal text-zand/70">cp</span>
          </span>
          <span
            className={`font-medium ${overdue ? "text-amber-300" : "text-white"}`}
          >
            {overdue
              ? `${formatElapsedShortLabel(overdueMs)} te laat`
              : `over ${formatElapsedShortLabel(-overdueMs)}`}
            <span className="ml-1 text-[10px] font-normal text-zand/70">volgende</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatElapsedShortLabel(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}u`;
  if (hours > 0) return `${hours}u ${minutes}m`;
  return `${minutes}m`;
}
