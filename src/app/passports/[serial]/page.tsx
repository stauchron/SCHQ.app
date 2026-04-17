import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, EmptyState, Section } from "@/components/Card";
import { LinkButton } from "@/components/Button";
import { formatDateTime } from "@/lib/format";
import type { TestSession, TimegrapherMeasurement, WatchPassport } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ serial: string }> | { serial: string };

type SessionWithMeasurements = TestSession & {
  timegrapher_measurements: TimegrapherMeasurement[];
};

export default async function PassportPage({ params }: { params: Params }) {
  const { serial: rawSerial } = await params;
  const serial = decodeURIComponent(rawSerial);
  const supabase = createSupabaseServerClient();

  const { data: passportRow } = await supabase
    .from("watch_passports")
    .select("*")
    .eq("serial_number", serial)
    .maybeSingle();

  if (!passportRow) notFound();
  const passport = passportRow as WatchPassport;

  const { data: sessionsRaw } = await supabase
    .from("test_sessions")
    .select(
      "*, timegrapher_measurements(id, measurement_timestamp, avg_rate, avg_amplitude, avg_beat_error)",
    )
    .eq("watch_passport_id", passport.id)
    .order("started_at", { ascending: false });

  const sessions = (sessionsRaw ?? []) as unknown as SessionWithMeasurements[];

  return (
    <>
      <div className="mb-8">
        <Link
          href="/"
          className="btn-label text-tier transition-colors duration-200 ease-staudt hover:text-navy"
        >
          ← Dashboard
        </Link>

        <div className="mt-5">
          <div className="eyebrow mb-1">Horlogepaspoort · {passport.sku}</div>
          <h1
            className="font-black tracking-tight text-black"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.2 }}
          >
            {passport.serial_number}
          </h1>
          {passport.model_name ? (
            <div className="mt-1 text-base text-body">
              {passport.model_name}
              {passport.movement_type ? ` · ${passport.movement_type}` : ""}
            </div>
          ) : null}
          <div className="mt-2 text-sm text-tier">
            Aangemaakt {formatDateTime(passport.created_at)} · Laatst bijgewerkt {formatDateTime(passport.updated_at)}
          </div>
        </div>
      </div>

      <Section eyebrow="Timeline" title={`Testsessies (${sessions.length})`}>
        {sessions.length === 0 ? (
          <EmptyState
            title="Nog geen sessies"
            description="Dit paspoort heeft nog geen geregistreerde testsessies."
          >
            <LinkButton
              href={`/sessions/new?serial=${encodeURIComponent(passport.serial_number)}`}
            >
              + Eerste sessie starten
            </LinkButton>
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {sessions.map((session) => {
              const count = session.timegrapher_measurements?.length ?? 0;
              const last = session.timegrapher_measurements?.[0];
              return (
                <li key={session.id}>
                  <Card href={`/sessions/${session.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="eyebrow">
                          {formatDateTime(session.started_at)}
                        </div>
                        <div
                          className="mt-1 font-black tracking-tight text-black"
                          style={{ fontSize: "1rem" }}
                        >
                          {session.status === "active" ? "Actief" : "Afgerond"}
                          {session.completed_at
                            ? ` · ${formatDateTime(session.completed_at)}`
                            : ""}
                        </div>
                        <div className="mt-1 text-sm text-body">
                          {count} {count === 1 ? "meting" : "metingen"}
                          {last?.avg_rate !== null && last?.avg_rate !== undefined
                            ? ` · laatste Ø ${last.avg_rate > 0 ? "+" : ""}${last.avg_rate} s/d`
                            : ""}
                        </div>
                      </div>
                      <span className="btn-label text-tier">Open →</span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-6 flex justify-end">
          <Link
            href={`/sessions/new?serial=${encodeURIComponent(passport.serial_number)}`}
            className="btn-label border-b border-taupe pb-1 text-navy transition-colors duration-200 ease-staudt hover:border-navy"
          >
            + Nieuwe sessie voor dit paspoort
          </Link>
        </div>
      </Section>
    </>
  );
}
