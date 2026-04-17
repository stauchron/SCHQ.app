import Image from "next/image";
import { POSITION_SHORT, type Position, type TimegrapherMeasurement } from "@/lib/types";
import {
  amplitudeClass,
  beatClass,
  formatDateTime,
  formatNumber,
  formatRate,
  rateClass,
} from "@/lib/format";
import { EmptyState } from "@/components/Card";

const POSITIONS: Position[] = ["ch", "h6", "h9", "h12", "h3", "fh"];

function getTriple(m: TimegrapherMeasurement, p: Position) {
  return {
    rate: m[`${p}_rate` as const] as number | null,
    amp: m[`${p}_amplitude` as const] as number | null,
    beat: m[`${p}_beat_error` as const] as number | null,
  };
}

type Props = {
  measurements: TimegrapherMeasurement[];
};

export function MeasurementList({ measurements }: Props) {
  if (measurements.length === 0) {
    return (
      <EmptyState
        title="Nog geen metingen"
        description="Vul hierboven een meting in om de eerste rij toe te voegen."
      />
    );
  }

  return (
    <ol className="space-y-1.5">
      {measurements.map((m) => {
        const usedPositions = POSITIONS.filter((p) => {
          const t = getTriple(m, p);
          return t.rate !== null || t.amp !== null || t.beat !== null;
        });
        const hasDetails =
          usedPositions.length > 0 || m.notes || m.photo_url;
        return (
          <li key={m.id}>
            <details className="group border border-line bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 transition-colors duration-150 hover:bg-zand/60">
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-tier">
                  <span>{formatDateTime(m.measurement_timestamp)}</span>
                  <span>{usedPositions.map((p) => POSITION_SHORT[p]).join(" · ") || "—"}</span>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_1fr_1fr_auto] items-baseline gap-2 tabular-nums text-sm">
                  <span className={`font-medium ${rateClass(m.avg_rate) || "text-black"}`}>
                    {formatRate(m.avg_rate)}
                    <span className="ml-1 text-[10px] font-normal text-tier">s/d</span>
                  </span>
                  <span className={`font-medium ${amplitudeClass(m.avg_amplitude) || "text-black"}`}>
                    {formatNumber(m.avg_amplitude, 0)}
                    <span className="ml-1 text-[10px] font-normal text-tier">°</span>
                  </span>
                  <span className={`font-medium ${beatClass(m.avg_beat_error) || "text-black"}`}>
                    {formatNumber(m.avg_beat_error, 1)}
                    <span className="ml-1 text-[10px] font-normal text-tier">ms</span>
                  </span>
                  <span className="text-[10px] text-tier">
                    {usedPositions.length > 1 &&
                    (m.rate_difference !== null || m.amplitude_difference !== null) ? (
                      <>
                        Δ {formatNumber(m.rate_difference, 1)} / {formatNumber(m.amplitude_difference, 0)}
                      </>
                    ) : (
                      <span className="opacity-0 group-open:opacity-100 transition-opacity">▼</span>
                    )}
                  </span>
                </div>
              </summary>
              {hasDetails ? (
                <div className="border-t border-line px-3 py-2 text-sm">
                  {usedPositions.length > 0 ? (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-line text-[10px] uppercase tracking-[0.18em] text-tier">
                          <th className="py-1 pr-2 font-normal">Pos</th>
                          <th className="py-1 pr-2 font-normal">Rate</th>
                          <th className="py-1 pr-2 font-normal">Amp</th>
                          <th className="py-1 font-normal">Beat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usedPositions.map((p) => {
                          const t = getTriple(m, p);
                          return (
                            <tr key={p} className="border-b border-line/60 last:border-0 tabular-nums">
                              <td className="py-1 pr-2 font-medium text-black">
                                {POSITION_SHORT[p]}
                              </td>
                              <td className={`py-1 pr-2 ${rateClass(t.rate) || "text-body"}`}>
                                {formatRate(t.rate)}
                              </td>
                              <td className={`py-1 pr-2 ${amplitudeClass(t.amp) || "text-body"}`}>
                                {formatNumber(t.amp, 0)}
                              </td>
                              <td className={`py-1 ${beatClass(t.beat) || "text-body"}`}>
                                {formatNumber(t.beat, 1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : null}

                  {m.notes ? (
                    <p className="mt-2 border-l-2 border-taupe pl-2 text-xs italic text-body">
                      {m.notes}
                    </p>
                  ) : null}

                  {m.photo_url ? (
                    <a
                      href={m.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative mt-2 block aspect-[4/3] w-full max-w-[180px] overflow-hidden border border-line bg-zand"
                    >
                      <Image
                        src={m.photo_url}
                        alt="Meetfoto"
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
  );
}
