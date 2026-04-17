"use client";

import { useEffect, useRef, useState } from "react";
import { syncClock, syncedNow, type ClockSync } from "@/lib/clock-sync";

type Props = {
  // Optioneel: callback met meest recente synced now() — gebruikt door parent
  // om "Start"-knop te kunnen vasthouden op de exacte timestamp.
  onTick?: (epochMs: number) => void;
  // Toon de countdown-ring naar de volgende minuut
  showCountdown?: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

export function PrecisionClock({ onTick, showCountdown = true }: Props) {
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Initiële + periodieke resync (elke 5 min) om drift te voorkomen
  useEffect(() => {
    let cancelled = false;
    async function doSync() {
      setSyncing(true);
      const s = await syncClock();
      if (cancelled) return;
      setSync(s);
      setSyncing(false);
    }
    void doSync();
    const interval = setInterval(doSync, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // requestAnimationFrame loop voor smooth updates
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      // Throttle naar ~30fps voor display-updates (rAF ~60fps is overkill)
      if (t - last >= 30) {
        const n = syncedNow(sync);
        setNow(n);
        onTickRef.current?.(n);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sync]);

  const d = new Date(now);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const millis = d.getMilliseconds();

  // Wijzerhoeken
  const secondAngle = (seconds + millis / 1000) * 6; // 360/60
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = ((hours % 12) + minutes / 60) * 30;

  // Countdown naar volgende minuut (in milliseconden)
  const msIntoMinute = seconds * 1000 + millis;
  const msToNextMinute = 60_000 - msIntoMinute;
  const secondsLeft = Math.ceil(msToNextMinute / 1000);

  // Kleur countdown
  let countdownColor = "#062035"; // navy
  if (secondsLeft <= 3) countdownColor = "#b91c1c"; // red
  else if (secondsLeft <= 10) countdownColor = "#b45309"; // amber

  // Ring fractie (1 = vol, 0 = leeg). Telt af van 60s.
  const ringFraction = msToNextMinute / 60_000;

  // SVG cirkel-omtrek voor stroke-dasharray
  const ringRadius = 95;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="flex flex-col items-center">
      {/* SVG: analoge klok met countdown-ring */}
      <div className="relative">
        <svg
          width="220"
          height="220"
          viewBox="0 0 220 220"
          className="block"
        >
          {/* Achtergrond-ring */}
          {showCountdown ? (
            <circle
              cx="110"
              cy="110"
              r={ringRadius}
              fill="none"
              stroke="#e8e4e0"
              strokeWidth="6"
            />
          ) : null}
          {/* Countdown-ring (telt af) */}
          {showCountdown ? (
            <circle
              cx="110"
              cy="110"
              r={ringRadius}
              fill="none"
              stroke={countdownColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - ringFraction)}
              transform="rotate(-90 110 110)"
              style={{ transition: "stroke 0.2s ease" }}
            />
          ) : null}

          {/* Klokken-binnenring */}
          <circle
            cx="110"
            cy="110"
            r="78"
            fill="#ffffff"
            stroke="#e8e4e0"
            strokeWidth="1"
          />

          {/* Uur-streepjes */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = i * 30;
            const isMajor = i % 3 === 0;
            const x1 = 110 + Math.sin((angle * Math.PI) / 180) * 70;
            const y1 = 110 - Math.cos((angle * Math.PI) / 180) * 70;
            const x2 = 110 + Math.sin((angle * Math.PI) / 180) * (isMajor ? 60 : 65);
            const y2 = 110 - Math.cos((angle * Math.PI) / 180) * (isMajor ? 60 : 65);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#062035"
                strokeWidth={isMajor ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Uur-wijzer */}
          <line
            x1="110"
            y1="110"
            x2={110 + Math.sin((hourAngle * Math.PI) / 180) * 38}
            y2={110 - Math.cos((hourAngle * Math.PI) / 180) * 38}
            stroke="#062035"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Minuut-wijzer */}
          <line
            x1="110"
            y1="110"
            x2={110 + Math.sin((minuteAngle * Math.PI) / 180) * 56}
            y2={110 - Math.cos((minuteAngle * Math.PI) / 180) * 56}
            stroke="#062035"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Seconde-wijzer */}
          <line
            x1="110"
            y1="110"
            x2={110 + Math.sin((secondAngle * Math.PI) / 180) * 64}
            y2={110 - Math.cos((secondAngle * Math.PI) / 180) * 64}
            stroke={countdownColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ transition: "stroke 0.2s ease" }}
          />
          {/* Centrum */}
          <circle cx="110" cy="110" r="4" fill="#062035" />
        </svg>
      </div>

      {/* Digital display HH:MM:SS.mmm */}
      <div
        className="mt-4 font-medium tabular-nums tracking-wider text-black"
        style={{ fontSize: "1.6rem", lineHeight: 1 }}
      >
        {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        <span className="text-tier text-base">.{pad3(millis)}</span>
      </div>

      {/* Countdown label */}
      {showCountdown ? (
        <div
          className="mt-1 text-xs uppercase tracking-[0.2em]"
          style={{ color: countdownColor, transition: "color 0.2s ease" }}
        >
          {secondsLeft <= 1 ? "GO" : `noteer over ${secondsLeft}s`}
        </div>
      ) : null}

      {/* Sync-status */}
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-tier">
        {syncing && !sync
          ? "syncing klok…"
          : sync
            ? `± ${Math.round(sync.uncertaintyMs)} ms`
            : "geen sync"}
      </div>
    </div>
  );
}
