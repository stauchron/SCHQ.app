"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  sessionId: string;
};

export function CompleteSessionButton({ sessionId }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<"complete" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    if (
      !confirm(
        "Sessie definitief afsluiten? Hierna zijn er geen nieuwe metingen meer mogelijk.",
      )
    ) {
      return;
    }
    setBusy("complete");
    setError(null);
    const { error: updateError } = await supabase
      .from("test_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (updateError) {
      setError(updateError.message);
      setBusy(null);
      return;
    }
    router.refresh();
  }

  async function cancel() {
    if (
      !confirm(
        "Sessie annuleren en verwijderen? Alle metingen, duurtests en checkpoints van deze sessie gaan verloren.",
      )
    ) {
      return;
    }
    setBusy("cancel");
    setError(null);
    const { error: deleteError } = await supabase
      .from("test_sessions")
      .delete()
      .eq("id", sessionId);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(null);
      return;
    }
    router.push("/");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          variant="ghost"
          onClick={cancel}
          disabled={busy !== null}
        >
          {busy === "cancel" ? "Bezig…" : "Sessie annuleren"}
        </Button>
        <Button
          variant="danger"
          onClick={complete}
          disabled={busy !== null}
        >
          {busy === "complete" ? "Bezig…" : "Sessie afsluiten"}
        </Button>
      </div>
      {error ? (
        <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}
