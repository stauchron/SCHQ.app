"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { PrecisionClock } from "@/components/PrecisionClock";
import { syncClock, syncedNow, type ClockSync } from "@/lib/clock-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  DurationCheckpoint,
  DurationTest,
  TestSessionStatus,
} from "@/lib/types";

type Props = {
  sessionId: string;
  sessionStatus: TestSessionStatus;
  activeTest: DurationTest | null;
  checkpoints: DurationCheckpoint[];
};

export function DurationTestClient({
  sessionId,
  sessionStatus,
  activeTest,
  checkpoints,
}: Props) {
  if (activeTest) {
    return (
      <ActiveTestPanel
        test={activeTest}
        checkpoints={checkpoints}
        sessionStatus={sessionStatus}
      />
    );
  }
  if (sessionStatus !== "active") {
    return (
      <div className="border border-dashed border-taupe bg-zand/40 px-6 py-12 text-center">
        <h3 className="font-black text-black" style={{ fontSize: "1.1rem" }}>
          Sessie is afgerond
        </h3>
        <p className="mt-2 text-sm text-body">
          Open een nieuwe testsessie om een duurtest te starten.
        </p>
      </div>
    );
  }
  return <StartTestPanel sessionId={sessionId} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Setup-fase: date-functie, start-knop
// ──────────────────────────────────────────────────────────────────────────
function StartTestPanel({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hou laatste synced now() bij — wordt gezet door PrecisionClock-tick
  const [latestNow, setLatestNow] = useState<number>(Date.now());

  async function handleStart() {
    setSubmitting(true);
    setError(null);
    // Capture exact moment van klik (synced)
    const referenceMs = latestNow;
    const referenceIso = new Date(referenceMs).toISOString();
    const { error: insertError } = await supabase
      .from("duration_tests")
      .insert({
        test_session_id: sessionId,
        reference_time: referenceIso,
        active: true,
      });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    // Terug naar testsessie-overzicht zodat je in één blik de duurtest ziet lopen
    router.push(`/sessions/${sessionId}`);
  }

  return (
    <div className="space-y-6">
      <PrecisionClock onTick={setLatestNow} />

      <div className="border border-line bg-zand/60 px-4 py-3 text-center text-sm text-body">
        <p className="text-xs text-tier">
          Druk op <strong className="font-medium text-black">START</strong>{" "}
          op het exacte moment dat je referentietijd wilt vastleggen
          (bv. wanneer de seconde-wijzer op 12 staat).
        </p>
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={submitting}
        className="w-full rounded-none border border-navy bg-navy px-6 py-8 text-white transition-colors duration-200 ease-staudt hover:bg-tier hover:border-tier disabled:opacity-50"
      >
        <span
          className="block font-black uppercase tracking-[0.4em]"
          style={{ fontSize: "1.6rem" }}
        >
          {submitting ? "Bezig…" : "START"}
        </span>
        <span className="mt-2 block text-xs uppercase tracking-[0.2em] text-zand/80">
          Tijd vastleggen
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
// Actieve testfase: klok + checkpoints + acties
// ──────────────────────────────────────────────────────────────────────────
function ActiveTestPanel({
  test,
  checkpoints,
  sessionStatus,
}: {
  test: DurationTest;
  checkpoints: DurationCheckpoint[];
  sessionStatus: TestSessionStatus;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [busy, setBusy] = useState<"close" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void syncClock().then((s) => {
      if (!cancelled) setSync(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(syncedNow(sync)), 250);
    return () => clearInterval(interval);
  }, [sync]);

  const referenceMs = new Date(test.reference_time).getTime();
  const elapsedMs = Math.max(0, now - referenceMs);

  // Implied rate: laatste checkpoint offset / elapsed days × 86400 = s/d
  const lastCheckpoint = checkpoints[0];
  const impliedRate = useMemo(() => {
    if (!lastCheckpoint?.offset_seconds) return null;
    const cpMs = new Date(lastCheckpoint.checkpoint_time).getTime();
    const cpElapsedMs = cpMs - referenceMs;
    if (cpElapsedMs <= 0) return null;
    const days = cpElapsedMs / 86_400_000;
    return lastCheckpoint.offset_seconds / days;
  }, [lastCheckpoint, referenceMs]);

  async function closeTest() {
    if (
      !confirm(
        "Duurtest definitief afsluiten? Hierna kun je geen checkpoints meer toevoegen.",
      )
    )
      return;
    setBusy("close");
    setActionError(null);
    const { error: updateError } = await supabase
      .from("duration_tests")
      .update({ active: false, completed_at: new Date().toISOString() })
      .eq("id", test.id);
    if (updateError) {
      setActionError(updateError.message);
      setBusy(null);
      return;
    }
    router.refresh();
  }

  async function cancelTest() {
    if (
      !confirm(
        "Duurtest annuleren en verwijderen? Alle checkpoints van deze test gaan verloren.",
      )
    )
      return;
    setBusy("cancel");
    setActionError(null);
    const { error: deleteError } = await supabase
      .from("duration_tests")
      .delete()
      .eq("id", test.id);
    if (deleteError) {
      setActionError(deleteError.message);
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
            <span className="font-medium text-navy">Duurtest loopt</span>
          </div>
          <span>ref {formatDateTime(test.reference_time)}</span>
        </div>
        <div className="mt-1 grid grid-cols-3 items-baseline gap-2 tabular-nums text-sm">
          <span className="font-medium text-black">
            {formatElapsed(elapsedMs)}
            <span className="ml-1 text-[10px] font-normal text-tier">verstreken</span>
          </span>
          <span className="font-medium text-black">
            {checkpoints.length}
            <span className="ml-1 text-[10px] font-normal text-tier">cp</span>
          </span>
          <span className="font-medium text-black">
            {impliedRate !== null ? (
              <>
                {impliedRate > 0 ? "+" : ""}
                {formatNumber(impliedRate, 1)}
                <span className="ml-1 text-[10px] font-normal text-tier">s/d</span>
              </>
            ) : (
              <span className="text-tier">—</span>
            )}
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
          referenceMs={referenceMs}
          onCancel={() => setShowCheckpointForm(false)}
          onSaved={() => {
            setShowCheckpointForm(false);
            router.refresh();
          }}
        />
      ) : null}

      <CheckpointList checkpoints={checkpoints} referenceMs={referenceMs} />

      {sessionStatus === "active" ? (
        <div className="border-t border-line pt-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelTest}
              disabled={busy !== null}
            >
              {busy === "cancel" ? "Bezig…" : "Duurtest annuleren"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={closeTest}
              disabled={busy !== null}
            >
              {busy === "close" ? "Bezig…" : "Duurtest afsluiten"}
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
  referenceMs,
  onCancel,
  onSaved,
}: {
  testId: string;
  referenceMs: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [offsetStr, setOffsetStr] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void syncClock().then(setSync);
  }, []);

  async function handleSave() {
    setError(null);
    const offset = offsetStr.trim() === "" ? null : Number(offsetStr.replace(",", "."));
    if (offset !== null && !Number.isFinite(offset)) {
      setError("Ongeldige offset (gebruik bv. -3.2 of +12.5).");
      return;
    }
    setSubmitting(true);
    const checkpointMs = syncedNow(sync);
    let photoUrl: string | null = null;
    if (photo) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `duration/${testId}/${Date.now()}.${ext}`;
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
    const { error: insertError } = await supabase
      .from("duration_checkpoints")
      .insert({
        duration_test_id: testId,
        checkpoint_time: new Date(checkpointMs).toISOString(),
        offset_seconds: offset,
        photo_url: photoUrl,
        notes: notes.trim() || null,
      });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  const elapsedNow = syncedNow(sync) - referenceMs;

  return (
    <div className="border border-line bg-white p-4">
      <div className="eyebrow mb-3">Checkpoint</div>
      <div className="mb-4 text-sm text-body">
        Tijd verstreken sinds start:{" "}
        <span className="tabular-nums font-medium text-black">
          {formatElapsed(elapsedNow)}
        </span>
      </div>

      <label className="block">
        <span className="eyebrow mb-2 block">
          Offset in seconden (+ vóór, − achter)
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={offsetStr}
          autoFocus
          onChange={(event) => setOffsetStr(event.target.value)}
          placeholder="bv. +12.5  of  -3.2"
          className="w-full border border-line bg-white px-4 py-3 text-base text-black outline-none transition-colors duration-200 focus:border-navy"
        />
      </label>

      <div className="mt-4">
        <span className="eyebrow mb-2 block">Foto (optioneel)</span>
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
// Checkpoint list (timeline)
// ──────────────────────────────────────────────────────────────────────────
function CheckpointList({
  checkpoints,
  referenceMs,
}: {
  checkpoints: DurationCheckpoint[];
  referenceMs: number;
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
          const elapsedMs =
            new Date(cp.checkpoint_time).getTime() - referenceMs;
          const offset = cp.offset_seconds;
          let offsetClass = "text-black";
          if (offset !== null) {
            offsetClass =
              Math.abs(offset) <= 1
                ? "text-emerald-700"
                : Math.abs(offset) <= 5
                  ? "text-amber-700"
                  : "text-red-700";
          }
          const hasDetails = cp.notes || cp.photo_url;
          return (
            <li key={cp.id}>
              <details className="border border-line bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 transition-colors duration-150 hover:bg-zand/60">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-tier">
                    <span>{formatDateTime(cp.checkpoint_time)}</span>
                    <span>+{formatElapsed(elapsedMs)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2 tabular-nums text-sm">
                    <span className={`font-medium ${offsetClass}`}>
                      {offset !== null ? (
                        <>
                          {offset > 0 ? "+" : ""}
                          {formatNumber(offset, 1)}
                          <span className="ml-1 text-[10px] font-normal text-tier">s</span>
                        </>
                      ) : (
                        <span className="text-tier">—</span>
                      )}
                    </span>
                    <span className="flex gap-1.5 text-[10px] text-tier">
                      {cp.notes ? <span title="Notitie">N</span> : null}
                      {cp.photo_url ? <span title="Foto">F</span> : null}
                    </span>
                  </div>
                </summary>
                {hasDetails ? (
                  <div className="border-t border-line px-3 py-2">
                    {cp.notes ? (
                      <p className="border-l-2 border-taupe pl-2 text-xs italic text-body">
                        {cp.notes}
                      </p>
                    ) : null}
                    {cp.photo_url ? (
                      <a
                        href={cp.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative mt-2 block aspect-[4/3] w-full max-w-[180px] overflow-hidden border border-line bg-zand"
                      >
                        <Image
                          src={cp.photo_url}
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

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}u ${minutes}m`;
  if (hours > 0) return `${hours}u ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
