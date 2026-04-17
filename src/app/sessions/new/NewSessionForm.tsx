"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/Button";
import { TextField } from "@/components/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { WatchPassport } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Props = {
  initialSerial: string;
};

export function NewSessionForm({ initialSerial }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [serial, setSerial] = useState(initialSerial);
  const [sku, setSku] = useState("");
  const [modelName, setModelName] = useState("");
  const [movementType, setMovementType] = useState("");
  const [knownPassport, setKnownPassport] = useState<WatchPassport | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Look up paspoort op serial (debounced)
  useEffect(() => {
    const trimmed = serial.trim();
    if (!trimmed) {
      setKnownPassport(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("watch_passports")
        .select("*")
        .eq("serial_number", trimmed)
        .maybeSingle();
      if (cancelled) return;
      const passport = (data as WatchPassport | null) ?? null;
      setKnownPassport(passport);
      if (passport) {
        setSku((current) => current || passport.sku);
        setModelName((current) => current || passport.model_name || "");
        setMovementType(
          (current) => current || passport.movement_type || "",
        );
      }
      setChecking(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [serial, supabase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedSerial = serial.trim();
    const trimmedSku = sku.trim();
    if (!trimmedSerial || !trimmedSku) {
      setError("Serienummer en SKU zijn verplicht.");
      setSubmitting(false);
      return;
    }

    let passportId = knownPassport?.id ?? null;

    if (!passportId) {
      const { data: created, error: insertError } = await supabase
        .from("watch_passports")
        .insert({
          serial_number: trimmedSerial,
          sku: trimmedSku,
          model_name: modelName.trim() || null,
          movement_type: movementType.trim() || null,
        })
        .select()
        .single();

      if (insertError || !created) {
        setError(insertError?.message ?? "Kon paspoort niet aanmaken.");
        setSubmitting(false);
        return;
      }
      passportId = (created as WatchPassport).id;
    } else {
      // Sync metadata-velden als ze nu zijn ingevuld
      const updates: Partial<WatchPassport> = {};
      if (trimmedSku && trimmedSku !== knownPassport?.sku) updates.sku = trimmedSku;
      if (modelName.trim() && modelName.trim() !== (knownPassport?.model_name ?? ""))
        updates.model_name = modelName.trim();
      if (
        movementType.trim() &&
        movementType.trim() !== (knownPassport?.movement_type ?? "")
      )
        updates.movement_type = movementType.trim();
      if (Object.keys(updates).length > 0) {
        await supabase.from("watch_passports").update(updates).eq("id", passportId);
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({ watch_passport_id: passportId })
      .select()
      .single();

    if (sessionError || !session) {
      setError(sessionError?.message ?? "Kon testsessie niet starten.");
      setSubmitting(false);
      return;
    }

    router.push(`/sessions/${(session as { id: string }).id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField
        label="Serienummer"
        autoFocus
        required
        value={serial}
        onChange={(event) => setSerial(event.target.value)}
        placeholder="bijv. 240117-018"
        autoComplete="off"
      />

      {checking ? (
        <div className="text-xs text-tier">Bezig met controleren…</div>
      ) : knownPassport ? (
        <div className="border-l-2 border-navy bg-zand px-4 py-3 text-sm text-body">
          <div className="eyebrow mb-1">Paspoort gevonden</div>
          <div className="text-black">
            <strong className="font-black">{knownPassport.serial_number}</strong>
            {knownPassport.model_name ? ` — ${knownPassport.model_name}` : ""}
          </div>
          <div className="text-xs text-tier">
            Aangemaakt {formatDate(knownPassport.created_at)} · SKU {knownPassport.sku}
          </div>
        </div>
      ) : serial.trim() ? (
        <div className="border-l-2 border-taupe bg-zand/60 px-4 py-3 text-sm text-body">
          Nieuw serienummer — er wordt een paspoort aangemaakt.
        </div>
      ) : null}

      <TextField
        label="SKU / referentienummer"
        required
        value={sku}
        onChange={(event) => setSku(event.target.value)}
        placeholder="bijv. P30-V2-NAVY"
        autoComplete="off"
      />

      <TextField
        label="Modelnaam (optioneel)"
        value={modelName}
        onChange={(event) => setModelName(event.target.value)}
        placeholder="bijv. P30 V2"
        autoComplete="off"
      />

      <TextField
        label="Uurwerktype (optioneel)"
        value={movementType}
        onChange={(event) => setMovementType(event.target.value)}
        placeholder="bijv. ETA 2824-2"
        autoComplete="off"
      />

      {error ? (
        <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <LinkButton href="/" variant="ghost">
          Annuleren
        </LinkButton>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Bezig…" : "Sessie starten"}
        </Button>
      </div>
    </form>
  );
}
