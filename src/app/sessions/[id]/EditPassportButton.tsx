"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { WatchPassport } from "@/lib/types";

type Props = {
  passport: WatchPassport;
};

export function EditPassportButton({ passport }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [serial, setSerial] = useState(passport.serial_number);
  const [sku, setSku] = useState(passport.sku);
  const [modelName, setModelName] = useState(passport.model_name ?? "");
  const [movementType, setMovementType] = useState(passport.movement_type ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSerial(passport.serial_number);
    setSku(passport.sku);
    setModelName(passport.model_name ?? "");
    setMovementType(passport.movement_type ?? "");
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  async function save() {
    setError(null);
    const trimmedSerial = serial.trim();
    const trimmedSku = sku.trim();
    if (!trimmedSerial || !trimmedSku) {
      setError("Serienummer en SKU zijn verplicht.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase
      .from("watch_passports")
      .update({
        serial_number: trimmedSerial,
        sku: trimmedSku,
        model_name: modelName.trim() || null,
        movement_type: movementType.trim() || null,
      })
      .eq("id", passport.id);
    if (updateError) {
      setError(
        updateError.code === "23505"
          ? `Serienummer "${trimmedSerial}" bestaat al voor een ander horloge.`
          : updateError.message,
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Paspoort bewerken"
        aria-label="Paspoort bewerken"
        className="inline-flex h-6 w-6 items-center justify-center text-tier transition-colors duration-150 ease-staudt hover:text-navy"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
          <path d="M10 3l3 3" />
        </svg>
      </button>
    );
  }

  return (
    <div className="mt-4 border border-line bg-white p-4">
      <div className="eyebrow mb-3">Paspoort bewerken</div>
      <div className="space-y-3">
        <TextField
          label="Serienummer"
          required
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
        />
        <TextField
          label="SKU"
          required
          value={sku}
          onChange={(event) => setSku(event.target.value)}
        />
        <TextField
          label="Modelnaam (optioneel)"
          value={modelName}
          onChange={(event) => setModelName(event.target.value)}
        />
        <TextField
          label="Uurwerktype (optioneel)"
          value={movementType}
          onChange={(event) => setMovementType(event.target.value)}
        />
      </div>
      {error ? (
        <div className="mt-3 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={close} disabled={submitting}>
          Annuleren
        </Button>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Bezig…" : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}
