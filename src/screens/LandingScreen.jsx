import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { Scatter, ScatterChart, ResponsiveContainer, XAxis, YAxis, ZAxis } from "recharts";
import { allDirectors, flattenDirectorYear } from "../data/mockRemuneration.js";

const sectorY = {
  Energy: 1,
  "Financial Services": 2,
  Technology: 3,
  "Consumer Staples": 4
};

export default function LandingScreen({ dataset, onEnter }) {
  const data = useMemo(() => {
    return allDirectors(dataset)
      .filter((director) => director.type === "executive")
      .map((director) => {
        const row = flattenDirectorYear(director);
        return {
          name: row.name,
          sector: row.sector,
          company: row.company,
          marketCap: row.marketCap,
          pay: row.totalCompensation,
          vote: row.sayOnPayPct,
          y: sectorY[row.sector] ?? 2
        };
      });
  }, [dataset]);

  return (
    <button className="group block min-h-[680px] w-full text-left" onClick={onEnter} aria-label="Enter Remi Find screen">
      <div className="grid min-h-[620px] grid-cols-[36%_64%] items-center gap-8">
        <div>
          <h2 className="font-serif text-[92px] font-normal leading-none text-remi-text">remi</h2>
          <p className="remi-kicker mt-4">Remuneration Intelligence</p>
          <p className="mt-8 max-w-[430px] text-[18px] leading-8 text-remi-text-secondary">
            Explore and compare executive and non-executive remuneration data for FTSE 350 and S&P 500 companies.
          </p>
        </div>

        <div className="relative h-[520px] overflow-hidden rounded-lg border border-remi-border bg-remi-secondary">
          <div className="absolute left-6 top-6 z-10">
            <p className="remi-kicker">CEO Pay By Market Cap</p>
            <p className="mt-2 text-xs text-remi-muted">Bubble size indicates say-on-pay approval.</p>
          </div>
          <div className="absolute inset-0 animate-[remi-drift_8s_ease-in-out_infinite] pt-16">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 36, right: 36, bottom: 42, left: 24 }}>
                <XAxis dataKey="marketCap" tick={{ fill: "#4A6278", fontSize: 11 }} axisLine={false} tickLine={false} name="Market cap" />
                <YAxis dataKey="pay" tick={{ fill: "#4A6278", fontSize: 11 }} axisLine={false} tickLine={false} name="Pay" />
                <ZAxis dataKey="vote" range={[280, 1600]} />
                <Scatter data={data} fill="#C8960C" fillOpacity={0.82} stroke="#E8B84B" strokeWidth={1} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-remi-secondary to-transparent" />
        </div>
      </div>

      <div className="flex justify-center pb-5 text-remi-gold-light transition group-hover:translate-y-1 group-hover:text-remi-gold">
        <ChevronDown size={32} strokeWidth={1.5} />
      </div>
    </button>
  );
}
