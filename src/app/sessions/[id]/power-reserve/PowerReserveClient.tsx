"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDateTime } from "@/lib/format";
import type {
  PowerReserveCheckpoint,
  PowerReserveTest,
  TestSessionStatus,
} from "@/lib/types";

type Props = {
  sessionId: string;
  sessionStatus: TestSessionStatus;
  activeTest: PowerReserveTest | null;
  checkpoints: PowerReserveCheckpoint[];
};

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}u`;
  if (hours > 0) return `${hours}u ${minutes}m`;
  return `${minutes}m`;
}

export function PowerReserveClient({
  sessionId,
  sessionStatus,
  activeTest,
  checkpoints,
}: Props) {
  if (activeTest) {
    return (
      <ActivePanel
        test={activeTest}
        checkpoints={checkpoints}
        sessionStatus={sessionStatus}
      />
    );
  }
  if (sessionStatus !== "active") {
    return (
      <div className="border border-dashed border-taupe bg-zand/40 px-4 py-6 text-center text-sm text-body">
        Sessie is afgerond — geen nieuwe gangreserve-test mogelijk.
      </div>
    );
  }
  return <StartPanel sessionId={sessionId} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Start-fase
// ──────────────────────────────────────────────────────────────────────────
function StartPanel({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [hasDate, setHasDate] = useState(false);
  const [intervalHours, setIntervalHours] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("power_reserve_tests")
      .insert({
        test_session_id: sessionId,
        has_date_function: hasDate,
        reminder_interval_hours: intervalHours,
        still_running: true,
      });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    router.push(`/sessions/${sessionId}`);
  }

  return (
    <div className="space-y-4">
      <div className="border border-line bg-zand/60 px-4 py-3">
        <p className="text-xs leading-relaxed text-body">
          Wind het horloge volledig op. Druk op <strong>START</strong> om de
          gangreserve-test te beginnen. Maak vervolgens om de zoveel uur een
          checkpoint met een foto van het horloge.
        </p>
      </div>

      <label className="flex items-start gap-3 border border-line bg-white px-4 py-3 text-sm text-body">
        <input
          type="checkbox"
          checked={hasDate}
          onChange={(event) => setHasDate(event.target.checked)}
          className="mt-1 h-4 w-4 accent-navy"
        />
        <span>
          <strong className="font-medium text-black">
            Horloge heeft een datumfunctie
          </strong>
          <br />
          <span className="text-xs text-tier">
            Per checkpoint kun je dan ook de getoonde datum noteren.
          </span>
        </span>
      </label>

      <label className="flex items-center justify-between gap-3 border border-line bg-white px-4 py-3 text-sm text-body">
        <span>
          <strong className="font-medium text-black">Reminder-interval</strong>
          <br />
          <span className="text-xs text-tier">
            Hoe vaak je een checkpoint wilt vastleggen.
          </span>
        </span>
        <span className="flex items-center gap-2 tabular-nums">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={48}
            value={intervalHours}
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) setIntervalHours(Math.max(1, Math.min(48, Math.round(v))));
            }}
            className="w-16 border border-line bg-white px-2 py-1 text-right text-sm text-black outline-none focus:border-navy"
          />
          <span className="text-xs text-tier">uur</span>
        </span>
      </label>

      <button
        type="button"
        onClick={handleStart}
        disabled={submitting}
        className="w-full rounded-none border border-navy bg-navy px-6 py-6 text-white transition-colors duration-200 ease-staudt hover:bg-tier hover:border-tier disabled:opacity-50"
      >
        <span
          className="block font-black uppercase tracking-[0.4em]"
          style={{ fontSize: "1.3rem" }}
        >
          {submitting ? "Bezig…" : "START"}
        </span>
        <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-zand/80">
          Volledig opgewonden
        </span>
      </button>

      {error ? (
        <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Actieve testfase
// ──────────────────────────────────────────────────────────────────────────
function ActivePanel({
  test,
  checkpoints,
  sessionStatus,
}: {
  test: PowerReserveTest;
  checkpoints: PowerReserveCheckpoint[];
  sessionStatus: TestSessionStatus;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [now, setNow] = useState<number>(() => Date.now());
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [busy, setBusy] = useState<"close" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const startMs = new Date(test.started_at).getTime();
  const elapsedMs = Math.max(0, now - startMs);

  const lastCheckpoint = checkpoints[0];
  const lastCheckpointMs = lastCheckpoint
    ? new Date(lastCheckpoint.checkpoint_time).getTime()
    : startMs;
  const nextReminderMs =
    lastCheckpointMs + test.reminder_interval_hours * 3_600_000;
  const overdueMs = now - nextReminderMs;
  const overdue = overdueMs > 0;

  const totalElapsed = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  async function closeTest() {
    if (
      !confirm(
        "Gangreserve-test afsluiten? Je kunt daarna geen checkpoints meer toevoegen.",
      )
    )
      return;
    setBusy("close");
    setActionError(null);
    const { error } = await supabase
      .from("power_reserve_tests")
      .update({
        still_running: false,
        ended_at: new Date().toISOString(),
      })
      .eq("id", test.id);
    if (error) {
      setActionError(error.message);
      setBusy(null);
      return;
    }
    router.refresh();
  }

  async function cancelTest() {
    if (
      !confirm(
        "Gangreserve-test annuleren en verwijderen? Alle checkpoints gaan verloren.",
      )
    )
      return;
    setBusy("cancel");
    setActionError(null);
    const { error } = await supabase
      .from("power_reserve_tests")
      .delete()
      .eq("id", test.id);
    if (error) {
      setActionError(error.message);
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-navy bg-zand px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-tier">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navy/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-navy" />
            </span>
            <span className="font-medium text-navy">Gangreserve loopt</span>
          </div>
          <span>start {formatDateTime(test.started_at)}</span>
        </div>
        <div className="mt-1 grid grid-cols-3 items-baseline gap-2 tabular-nums text-sm">
          <span className="font-medium text-black">
            {totalElapsed}
            <span className="ml-1 text-[10px] font-normal text-tier">verstreken</span>
          </span>
          <span className="font-medium text-black">
            {checkpoints.length}
            <span className="ml-1 text-[10px] font-normal text-tier">cp</span>
          </span>
          <span
            className={`font-medium ${overdue ? "text-red-700" : "text-black"}`}
          >
            {overdue
              ? `${formatElapsed(overdueMs)} te laat`
              : `over ${formatElapsed(-overdueMs)}`}
            <span className="ml-1 text-[10px] font-normal text-tier">
              volgende
            </span>
          </span>
        </div>
      </div>

      {sessionStatus === "active" && !showCheckpointForm ? (
        <Button
          type="button"
          fullWidth
          onClick={() => setShowCheckpointForm(true)}
        >
          + Checkpoint
        </Button>
      ) : null}

      {showCheckpointForm ? (
        <CheckpointForm
          testId={test.id}
          hasDate={test.has_date_function}
          onCancel={() => setShowCheckpointForm(false)}
          onSaved={() => {
            setShowCheckpointForm(false);
            router.refresh();
          }}
        />
      ) : null}

      <CheckpointList checkpoints={checkpoints} startMs={startMs} hasDate={test.has_date_function} />

      {sessionStatus === "active" ? (
        <div className="border-t border-line pt-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelTest}
              disabled={busy !== null}
            >
              {busy === "cancel" ? "Bezig…" : "Annuleren"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={closeTest}
              disabled={busy !== null}
            >
              {busy === "close" ? "Bezig…" : "Test afsluiten"}
            </Button>
          </div>
          {actionError ? (
            <div className="mt-3 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
              {actionError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Checkpoint form
// ──────────────────────────────────────────────────────────────────────────
function CheckpointForm({
  testId,
  hasDate,
  onCancel,
  onSaved,
}: {
  testId: string;
  hasDate: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [running, setRunning] = useState(true);
  const [dateDisplay, setDateDisplay] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    const checkpointMs = Date.now();

    let photoUrl: string | null = null;
    if (photo) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `power-reserve/${testId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("measurement-photos")
        .upload(path, photo, { upsert: false });
      if (uploadError) {
        setError(`Foto-upload mislukt: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      const { data } = supabase.storage
        .from("measurement-photos")
        .getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    const checkpointIso = new Date(checkpointMs).toISOString();

    const { error: insertError } = await supabase
      .from("power_reserve_checkpoints")
      .insert({
        power_reserve_test_id: testId,
        checkpoint_time: checkpointIso,
        watch_running: running,
        watch_time_photo_url: photoUrl,
        watch_date_display: dateDisplay.trim() || null,
        manual_notes: notes.trim() || null,
      });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Auto-stop wanneer horloge gestopt is
    if (!running) {
      await supabase
        .from("power_reserve_tests")
        .update({ still_running: false, ended_at: checkpointIso })
        .eq("id", testId);
    }

    onSaved();
  }

  return (
    <div className="border border-line bg-white p-4">
      <div className="eyebrow mb-3">Checkpoint</div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setRunning(true)}
          className={`btn-label border py-3 transition-colors duration-150 ease-staudt ${
            running
              ? "border-navy bg-navy text-white"
              : "border-line bg-white text-tier hover:border-navy hover:text-navy"
          }`}
        >
          Loopt nog
        </button>
        <button
          type="button"
          onClick={() => setRunning(false)}
          className={`btn-label border py-3 transition-colors duration-150 ease-staudt ${
            !running
              ? "border-red-700 bg-red-700 text-white"
              : "border-line bg-white text-tier hover:border-red-700 hover:text-red-700"
          }`}
        >
          Gestopt
        </button>
      </div>

      {!running ? (
        <div className="mt-3 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
          Bij opslaan wordt de gangreserve-test direct afgesloten met deze
          tijd als eindtijd.
        </div>
      ) : null}

      {hasDate ? (
        <label className="mt-4 block">
          <span className="eyebrow mb-2 block">Datumweergave</span>
          <input
            type="text"
            value={dateDisplay}
            onChange={(event) => setDateDisplay(event.target.value)}
            placeholder="bv. 16  of  MA 16"
            className="w-full border border-line bg-white px-3 py-2 text-sm text-black outline-none focus:border-navy"
          />
        </label>
      ) : null}

      <div className="mt-4">
        <span className="eyebrow mb-2 block">Foto van horloge (optioneel)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-body file:mr-4 file:cursor-pointer file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-navy hover:file:border-navy"
        />
      </div>

      <details className="group mt-4 border border-line bg-white">
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
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full resize-y border border-line bg-white px-3 py-2 text-sm text-black outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy"
          />
        </div>
      </details>

      {error ? (
        <div className="mt-3 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="button" onClick={handleSave} disabled={submitting}>
          {submitting ? "Bezig…" : "Checkpoint opslaan"}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Checkpoint timeline
// ──────────────────────────────────────────────────────────────────────────
function CheckpointList({
  checkpoints,
  startMs,
  hasDate,
}: {
  checkpoints: PowerReserveCheckpoint[];
  startMs: number;
  hasDate: boolean;
}) {
  if (checkpoints.length === 0) {
    return (
      <div className="border border-dashed border-taupe bg-zand/40 px-4 py-4 text-center text-xs text-body">
        Nog geen checkpoints.
      </div>
    );
  }
  return (
    <div>
      <div className="eyebrow mb-2">Checkpoints ({checkpoints.length})</div>
      <ol className="space-y-1.5">
        {checkpoints.map((cp) => {
          const elapsedMs = new Date(cp.checkpoint_time).getTime() - startMs;
          const hasDetails =
            cp.manual_notes ||
            cp.watch_time_photo_url ||
            (hasDate && cp.watch_date_display);
          return (
            <li key={cp.id}>
              <details className="border border-line bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 transition-colors duration-150 hover:bg-zand/60">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-tier">
                    <span>{formatDateTime(cp.checkpoint_time)}</span>
                    <span>+{formatElapsed(elapsedMs)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                    <span
                      className={`font-medium ${cp.watch_running ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {cp.watch_running ? "loopt" : "gestopt"}
                      {hasDate && cp.watch_date_display ? (
                        <span className="ml-2 text-[10px] font-normal text-tier">
                          datum {cp.watch_date_display}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-1.5 text-[10px] text-tier">
                      {cp.manual_notes ? <span title="Notitie">N</span> : null}
                      {cp.watch_time_photo_url ? <span title="Foto">F</span> : null}
                    </span>
                  </div>
                </summary>
                {hasDetails ? (
                  <div className="border-t border-line px-3 py-2">
                    {cp.manual_notes ? (
                      <p className="border-l-2 border-taupe pl-2 text-xs italic text-body">
                        {cp.manual_notes}
                      </p>
                    ) : null}
                    {cp.watch_time_photo_url ? (
                      <a
                        href={cp.watch_time_photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative mt-2 block aspect-[4/3] w-full max-w-[180px] overflow-hidden border border-line bg-zand"
                      >
                        <Image
                          src={cp.watch_time_photo_url}
                          alt="Checkpoint"
                          fill
                          className="object-cover"
                          sizes="180px"
                          unoptimized
                        />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
