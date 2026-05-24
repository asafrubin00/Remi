import { useEffect, useMemo, useState } from "react";
import { Panel, SectionHeader } from "./ui.jsx";

export default function AnalysisPanel({ currentViewData }) {
  const [analysis, setAnalysis] = useState("Analysis unavailable.");
  const [loading, setLoading] = useState(false);

  const payload = useMemo(() => JSON.stringify(currentViewData ?? {}), [currentViewData]);

  useEffect(() => {
    let cancelled = false;

    async function analyse() {
      if (!currentViewData) {
        setAnalysis("Analysis unavailable.");
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentViewData })
        });

        if (!response.ok) throw new Error("Analysis request failed");
        const data = await response.json();
        if (!cancelled) setAnalysis(data.analysis || "Analysis unavailable.");
      } catch {
        if (!cancelled) setAnalysis("Analysis unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    analyse();
    return () => {
      cancelled = true;
    };
  }, [currentViewData, payload]);

  return (
    <Panel className="h-full p-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader>Remi Analysis</SectionHeader>
        {loading ? <span className="h-2 w-2 rounded-full bg-remi-gold remi-pulse" aria-label="Generating analysis" /> : null}
      </div>
      <p className={`mt-4 text-[13px] italic leading-6 transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"} text-remi-text-secondary`}>
        {analysis}
      </p>
    </Panel>
  );
}
