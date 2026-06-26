import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Scatter, ScatterChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { DataValue } from "../components/ui.jsx";
import { allDirectors, flattenDirectorYear, formatCompactMarketCap, formatCompactMoney } from "../data/mockRemuneration.js";

const sectorY = {
  Energy: 1,
  "Financial Services": 2,
  Technology: 3,
  "Consumer Staples": 4
};

export default function LandingScreen({ dataset, onEnter }) {
  const touchStartY = useRef(null);
  const hasEntered = useRef(false);
  const data = useMemo(() => {
    return allDirectors(dataset)
      .filter((director) => director.type === "executive")
      .map((director) => {
        const row = flattenDirectorYear(director);
        return {
          name: row.name,
          sector: row.sector,
          company: row.company,
          currency: row.currency,
          marketCap: row.marketCap,
          pay: row.totalCompensation,
          vote: row.sayOnPayPct,
          y: sectorY[row.sector] ?? 2
        };
      });
  }, [dataset]);

  const enterOnce = () => {
    if (hasEntered.current) return;
    hasEntered.current = true;
    onEnter();
  };

  const handleWheel = (event) => {
    if (event.deltaY <= 32) return;
    event.preventDefault();
    enterOnce();
  };

  const handleTouchStart = (event) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartY.current == null) return;
    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
    if (touchStartY.current - endY > 40) enterOnce();
    touchStartY.current = null;
  };

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  });

  return (
    <section
      className="remi-landing group min-h-[680px] w-full"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Remi landing screen"
    >
      <div className="remi-landing-grid grid min-h-[620px] grid-cols-[36%_64%] items-center gap-8">
        <div className="remi-landing-copy">
          <h2 className="remi-landing-wordmark font-serif text-[92px] font-normal leading-none text-remi-text">remi</h2>
          <p className="remi-kicker mt-4">Remuneration Intelligence</p>
          <p className="mt-8 max-w-[430px] text-[18px] leading-8 text-remi-text-secondary">
            Explore and compare executive and non-executive remuneration data for FTSE 350 and S&P 500 companies.
          </p>
          <button type="button" className="remi-landing-cta mt-8 text-remi-gold-light" onClick={enterOnce}>
            Explore remuneration data →
          </button>
        </div>

        <div className="remi-landing-chart relative h-[520px] overflow-hidden rounded-lg border border-remi-border bg-remi-secondary">
          <div className="absolute left-6 top-6 z-10">
            <p className="remi-kicker">CEO Pay By Market Cap</p>
            <p className="mt-2 text-xs text-remi-muted">Bubble size indicates say-on-pay approval.</p>
          </div>
          <div className="absolute inset-0 animate-[remi-drift_8s_ease-in-out_infinite] pt-16">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 36, right: 36, bottom: 42, left: 24 }}>
                <XAxis dataKey="marketCap" tick={{ fill: "#4A6278", fontSize: 11 }} axisLine={false} tickLine={false} name="Market cap" tickFormatter={(value) => formatCompactMarketCap(value, "MIXED")} />
                <YAxis dataKey="pay" tick={{ fill: "#4A6278", fontSize: 11 }} axisLine={false} tickLine={false} name="Pay" tickFormatter={(value) => formatCompactMoney(value, "MIXED")} />
                <ZAxis dataKey="vote" range={[280, 1600]} />
                <Tooltip content={<LandingTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={data} fill="#C8960C" fillOpacity={0.82} stroke="#E8B84B" strokeWidth={1} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-remi-secondary to-transparent" />
        </div>
      </div>

      <button
        type="button"
        className="remi-landing-chevron flex w-full justify-center pb-5 text-remi-gold-light transition hover:text-remi-gold"
        onClick={enterOnce}
        aria-label="Continue to Find screen"
      >
        <ChevronDown size={32} strokeWidth={1.5} />
      </button>
    </section>
  );
}

function LandingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-remi-border bg-remi-secondary p-3 text-xs text-remi-text">
      <div className="remi-data text-remi-gold-light">{row.name}</div>
      <div className="mt-1 text-remi-text-secondary">{row.company}</div>
      <div className="mt-2">
        Pay: <DataValue>{formatCompactMoney(row.pay, row.currency)}</DataValue>
      </div>
      <div className="mt-1">
        Market cap: <DataValue>{formatCompactMarketCap(row.marketCap, row.currency)}</DataValue>
      </div>
    </div>
  );
}
