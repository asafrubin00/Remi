import { useEffect, useMemo, useState } from "react";
import { Panel, SectionHeader } from "./ui.jsx";

export default function AnalysisPanel({ currentViewData }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const payload = useMemo(() => JSON.stringify(currentViewData ?? {}), [currentViewData]);

  useEffect(() => {
    const controller = new AbortController();
    let receivedText = false;

    async function analyse() {
      if (!currentViewData) {
        setAnalysis("");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentViewData }),
          signal: controller.signal
        });

        if (!response.ok) throw new Error("Analysis request failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Analysis stream unavailable");

        const decoder = new TextDecoder();
        let streamedAnalysis = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          streamedAnalysis += chunk;
          receivedText = true;
          setLoading(false);
          setAnalysis(streamedAnalysis);
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
          streamedAnalysis += finalChunk;
          receivedText = true;
          setAnalysis(streamedAnalysis);
        }

        if (!receivedText) setAnalysis("Analysis unavailable.");
      } catch {
        if (!controller.signal.aborted) setAnalysis("Analysis unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    analyse();
    return () => {
      controller.abort();
    };
  }, [payload]);

  return (
    <Panel className="flex h-full max-h-full flex-col overflow-hidden p-6">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <SectionHeader>Remi Analysis</SectionHeader>
        {loading ? <span className="h-2 w-2 rounded-full bg-remi-gold remi-pulse" aria-label="Generating analysis" /> : null}
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {analysis ? (
          <p className={`text-[13px] italic leading-6 transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"} text-remi-text-secondary`}>
            {analysis}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
