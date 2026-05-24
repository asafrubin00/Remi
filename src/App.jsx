import { useEffect, useMemo, useState } from "react";
import { TabButton } from "./components/ui.jsx";
import { companies as seededCompanies } from "./data/mockRemuneration.js";
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
      const hydrated = await Promise.all(
        seededCompanies.map(async (company) => {
          try {
            const response = await fetch(`/api/scrape-company?companyId=${company.id}`);
            if (!response.ok) throw new Error("Scrape route unavailable");
            return await response.json();
          } catch {
            return {
              ...company,
              scrape: { status: "fallback", message: "Using seeded remuneration data." },
              lastUpdated: new Date().toISOString()
            };
          }
        }),
      );
      if (!cancelled) setDataset(hydrated);
    }

    hydrateDataset();
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
      <header className="mb-8 flex items-start justify-between border-b border-remi-border pb-6">
        <button className="text-left" onClick={() => navigate("landing")} aria-label="Go to landing screen">
          <h1 className="remi-wordmark">remi</h1>
          <p className="remi-kicker mt-2">Remuneration Intelligence</p>
        </button>

        <div className="flex flex-col items-end gap-3">
          <div className="flex rounded-lg border border-remi-border bg-remi-secondary p-1">
            <TabButton active={directorType === "executive"} onClick={() => setDirectorType("executive")}>
              Executive
            </TabButton>
            <TabButton active={directorType === "non-executive"} onClick={() => setDirectorType("non-executive")}>
              Non-Executive
            </TabButton>
          </div>
          <nav className="flex gap-2" aria-label="Primary navigation">
            {VIEWS.filter((view) => view.id !== "landing").map((view) => (
              <TabButton key={view.id} active={activeView === view.id} onClick={() => navigate(view.id)}>
                {view.label}
              </TabButton>
            ))}
          </nav>
        </div>
      </header>

      <section className="flex-1">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="remi-title">{screenTitle}</h2>
          {activeView !== "landing" ? (
            <p className="remi-kicker">Viewing {directorType === "executive" ? "Executive" : "Non-Executive"} data</p>
          ) : null}
        </div>
        {activeView === "landing" ? (
          <LandingScreen dataset={dataset} onEnter={() => navigate("find")} />
        ) : activeView === "find" ? (
          <FindScreen dataset={dataset} directorType={directorType} initialSelectedId={focusedDirectorId} />
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

      <footer className="mt-8 border-t border-remi-border pt-4 text-center text-[11px] text-remi-muted">
        © 2026 Asaf Rubin. All rights reserved.
      </footer>
    </main>
  );
}
