import { useEffect, useMemo, useState } from "react";
import { TabButton } from "./components/ui.jsx";
import RotationPrompt from "./components/RotationPrompt.jsx";
import { companies as seededCompanies, formatVintageDate } from "./data/mockRemuneration.js";
import CompareScreen from "./screens/CompareScreen.jsx";
import FindScreen from "./screens/FindScreen.jsx";
import LandingScreen from "./screens/LandingScreen.jsx";
import LeagueScreen from "./screens/LeagueScreen.jsx";

const VIEWS = [
  { id: "landing", label: "Landing", path: "/" },
  { id: "find", label: "Find", path: "/find" },
  { id: "compare", label: "Compare", path: "/compare" },
  { id: "league", label: "League", path: "/league" },
];

function viewFromPath() {
  const match = VIEWS.find((view) => view.path === window.location.pathname);
  return match?.id ?? "landing";
}

export default function App() {
  const [activeView, setActiveView] = useState(viewFromPath);
  const [focusedDirectorId, setFocusedDirectorId] = useState(null);
  const [dataset, setDataset] = useState(seededCompanies);
  const [sp500CronStatus, setSp500CronStatus] = useState(null);
  const [directorType, setDirectorType] = useState(() => {
    return window.localStorage.getItem("remi.directorType") || "executive";
  });

  useEffect(() => {
    window.localStorage.setItem("remi.directorType", directorType);
  }, [directorType]);

  useEffect(() => {
    const onPopState = () => setActiveView(viewFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDataset() {
      const eagerCompanies = seededCompanies.filter((company) => company.eagerHydrate);
      const hydrated = await Promise.all(
        eagerCompanies.map(async (company) => {
          try {
            const response = await fetch(`/api/scrape-company?companyId=${company.id}`);
            if (!response.ok) throw new Error("Scrape route unavailable");
            return await response.json();
          } catch {
            return {
              ...company,
              scrape: company.scrape || { status: "fallback", message: "Using seeded remuneration data." },
              lastUpdated: new Date().toISOString()
            };
          }
        }),
      );
      if (!cancelled) {
        const hydratedById = new Map(hydrated.map((company) => [company.id, company]));
        setDataset(seededCompanies.map((company) => hydratedById.get(company.id) || company));
      }
    }

    hydrateDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    let cancelled = false;

    async function loadCronStatus() {
      try {
        const response = await fetch("/api/cron/sp500-status");
        if (!response.ok) return;
        const status = await response.json();
        if (!cancelled && status?.timestamp) setSp500CronStatus(status);
      } catch {
        // Footer status is informational only.
      }
    }

    loadCronStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const screenTitle = useMemo(() => {
    if (activeView === "landing") return "Remuneration Intelligence";
    return VIEWS.find((view) => view.id === activeView)?.label ?? "Find";
  }, [activeView]);

  const navigate = (viewId) => {
    const view = VIEWS.find((item) => item.id === viewId);
    if (!view) return;
    window.history.pushState({}, "", view.path);
    setActiveView(viewId);
  };

  const openDirector = (directorId) => {
    setFocusedDirectorId(directorId);
    navigate("find");
  };

  return (
    <main className="remi-shell">
      <RotationPrompt />
      <header className="remi-global-header">
        <button className="remi-brand-button text-left" onClick={() => navigate("landing")} aria-label="Go to landing screen">
          <div className="remi-brand-lockup flex items-center gap-3">
            <img src="/icons/remi-mark.svg" alt="" className="remi-brand-mark h-9 w-9" />
            <h1 className="remi-wordmark">remi</h1>
          </div>
          <p className="remi-brand-tagline remi-kicker mt-2">Remuneration Intelligence</p>
        </button>

        <div className="remi-nav-controls flex flex-col items-end gap-3">
          <div className="remi-mode-toggle flex rounded-lg border border-remi-border bg-remi-secondary p-1">
            <TabButton active={directorType === "executive"} onClick={() => setDirectorType("executive")}>
              Executive
            </TabButton>
            <TabButton active={directorType === "non-executive"} onClick={() => setDirectorType("non-executive")}>
              Non-Executive
            </TabButton>
          </div>
          <nav className="remi-primary-nav flex gap-2" aria-label="Primary navigation">
            {VIEWS.filter((view) => view.id !== "landing").map((view) => (
              <TabButton key={view.id} active={activeView === view.id} onClick={() => navigate(view.id)}>
                {view.label}
              </TabButton>
            ))}
          </nav>
        </div>
      </header>

      <section className="flex-1">
        {activeView !== "landing" ? (
          <div className="remi-screen-heading mb-4 flex items-end justify-between">
            <h2 className="remi-title">{screenTitle}</h2>
            <p className="remi-kicker">
              Viewing {directorType === "executive" ? "Executive" : "Non-Executive"} data · {dataset.some((company) => company.scrape?.status === "live-metadata") ? "Live metadata" : "Seeded data"}
            </p>
          </div>
        ) : null}
        {activeView === "landing" ? (
          <LandingScreen dataset={dataset} onEnter={() => navigate("find")} />
        ) : activeView === "find" ? (
          <FindScreen dataset={dataset} setDataset={setDataset} directorType={directorType} initialSelectedId={focusedDirectorId} />
        ) : activeView === "compare" ? (
          <CompareScreen dataset={dataset} directorType={directorType} />
        ) : activeView === "league" ? (
          <LeagueScreen dataset={dataset} directorType={directorType} onOpenDirector={openDirector} />
        ) : (
          <div className="remi-panel p-6">
            <p className="text-sm text-remi-text-secondary">Screen scaffold ready for {screenTitle}.</p>
          </div>
        )}
      </section>

      <footer className="mt-8 flex justify-center gap-3 border-t border-remi-border pt-4 text-center text-[11px] text-remi-muted">
        <span>
          © 2026{" "}
          <a
            href="https://asafrubin00.github.io/asaf-rubin-website/"
            target="_blank"
            rel="noreferrer"
            className="text-remi-muted underline-offset-2 transition hover:text-remi-gold-light hover:underline"
          >
            Asaf Rubin
          </a>
          . All rights reserved.
        </span>
        {sp500CronStatus?.timestamp ? (
          <span>
            S&P 500 data last refreshed: <span className="remi-data">{formatVintageDate(sp500CronStatus.timestamp)}</span>
          </span>
        ) : null}
      </footer>
    </main>
  );
}
