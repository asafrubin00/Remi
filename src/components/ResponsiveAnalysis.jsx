import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AnalysisPanel from "./AnalysisPanel.jsx";

export default function ResponsiveAnalysis({ currentViewData, className = "" }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [viewed, setViewed] = useState(false);
  const payload = useMemo(() => JSON.stringify(currentViewData ?? null), [currentViewData]);
  const hasActivity = currentViewData && status !== "idle" && status !== "error";

  useEffect(() => {
    setViewed(false);
  }, [payload]);

  const openDrawer = () => {
    setViewed(true);
    setOpen(true);
  };

  return (
    <>
      <div className={`remi-analysis-shell ${open ? "remi-analysis-shell-open" : ""} ${className}`}>
        <button className="remi-analysis-backdrop" type="button" aria-label="Close Remi Analysis" onClick={() => setOpen(false)} />
        <div className="remi-analysis-drawer">
          <button className="remi-analysis-close" type="button" aria-label="Close Remi Analysis" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
          <AnalysisPanel currentViewData={currentViewData} onStatusChange={setStatus} />
        </div>
      </div>
      <button
        className={`remi-analysis-fab ${hasActivity && !viewed && !open ? "remi-analysis-fab-active" : ""}`}
        type="button"
        aria-label="Open Remi Analysis"
        aria-expanded={open}
        onClick={openDrawer}
      >
        <Sparkles size={20} />
        <span>AI</span>
      </button>
    </>
  );
}
