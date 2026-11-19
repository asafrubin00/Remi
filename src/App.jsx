import { useEffect, useMemo, useState } from "react";
import { TabButton } from "./components/ui.jsx";
import RotationPrompt from "./components/RotationPrompt.jsx";
import { companies as seededCompanies, formatVintageDate } from "./data/mockRemuneration.js";
import { applyPublishedData, loadPublishedData } from "./data/publishedData.js";
import CompareScreen from "./screens/CompareScreen.jsx";
import FindScreen from "./screens/FindScreen.jsx";
import LandingScreen from "./screens/LandingScreen.jsx";
import LeagueScreen from "./screens/LeagueScreen.jsx";

const views = {
  landing: { path: "/" },
  find: { path: "/find", label: "Find", title: "Compensation profiles" },
  compare: { path: "/compare", label: "Compare", title: "Peer comparisons" },
  league: { path: "/league", label: "Rankings", title: "Pay rankings" }
};

function readLocation() {
  const query = new URLSearchParams(window.location.search);
  return {
    view: Object.keys(views).find((key) => views[key].path === window.location.pathname) || "landing",
    companyId: query.get("company"),
    directorId: query.get("director"),
    year: Number(query.get("year")) || null
  };
}

export default function App() {
  const [location, setLocation] = useState(readLocation);
  const [snapshots, setSnapshots] = useState([]);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [directorType, setDirectorType] = useState(() => window.localStorage.getItem("remi.directorType") || "executive");
  const { view } = location;
  const dataset = useMemo(() => applyPublishedData(seededCompanies, snapshots), [snapshots]);

  useEffect(() => {
    window.localStorage.setItem("remi.directorType", directorType);
  }, [directorType]);

  useEffect(() => {
    const onPopState = () => setLocation(readLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    Promise.allSettled(["ftse100", "sp500"].map(async (index) => {
      const snapshot = await loadPublishedData(index, signal);
      if (!controller.signal.aborted) setSnapshots((current) => [...current, snapshot]);
    })).then(() => {
      if (!controller.signal.aborted) setDatasetLoading(false);
    });
    return () => controller.abort();
  }, []);

  function navigate(next, { companyId, directorId, year } = {}, replace = false) {
    const query = new URLSearchParams();
    if (companyId) query.set("company", companyId);
    if (directorId) query.set("director", directorId);
    if (year) query.set("year", year);
    const path = views[next].path + (query.size ? `?${query}` : "");
    const method = replace ? "replaceState" : "pushState";
    if (path !== window.location.pathname + window.location.search) window.history[method]({}, "", path);
    setLocation(readLocation());
    if (!replace) window.scrollTo(0, 0);
  }

  function navLink(event, next) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(next);
  }

  return (
    <div className={`remi-shell research-shell ${view === "landing" ? "research-shell-home" : ""}`}>
      <RotationPrompt />
      <header className="remi-global-header research-header">
        <a className="remi-brand-button research-brand" href="/" onClick={(event) => navLink(event, "landing")} aria-label="Remi home">
          <span className="remi-wordmark">remi<span>.</span></span>
          <span className="research-brand-line">Remuneration<br />intelligence</span>
        </a>
        <nav className="research-nav" aria-label="Primary navigation">
          {["find", "compare", "league"].map((id) => (
            <a key={id} aria-current={view === id ? "page" : undefined} href={views[id].path} onClick={(event) => navLink(event, id)}>{views[id].label}</a>
          ))}
        </nav>
        <div className="remi-mode-toggle research-mode" role="group" aria-label="Director type">
          <TabButton aria-pressed={directorType === "executive"} active={directorType === "executive"} onClick={() => setDirectorType("executive")}>Executive</TabButton>
          <TabButton aria-pressed={directorType === "non-executive"} active={directorType === "non-executive"} onClick={() => setDirectorType("non-executive")}>Non-Executive</TabButton>
        </div>
      </header>

      <main className="flex-1">
        {view !== "landing" ? (
          <div className="research-page-heading">
            <h1 className="remi-title">{views[view].title}</h1>
          </div>
        ) : null}
        {view === "landing" ? (
          <LandingScreen dataset={dataset} directorType={directorType} snapshots={snapshots} onNavigate={navigate} onSelect={(item) => navigate("find", item)} />
        ) : view === "find" ? (
          <FindScreen dataset={dataset} directorType={directorType} selection={location} loading={datasetLoading} onSelect={(item) => navigate("find", item, true)} />
        ) : view === "compare" ? (
          <CompareScreen dataset={dataset} directorType={directorType} />
        ) : (
          <LeagueScreen dataset={dataset} directorType={directorType} onOpenDirector={(row) => navigate("find", { companyId: row.companyId, directorId: row.id, year: row.reportingYear })} />
        )}
      </main>

      <footer className="research-footer">
        <span>© 2026 <a href="https://asafrubin00.github.io/asaf-rubin-website/" target="_blank" rel="noreferrer">Asaf Rubin</a>. All rights reserved.</span>
        <div>
          {[...snapshots].sort((a, b) => a.index.localeCompare(b.index)).map((snapshot) => snapshot.lastRun?.timestamp ? (
            <span key={snapshot.index}>{snapshot.index === "SP500" ? "S&P 500" : "FTSE 100"} checked {formatVintageDate(snapshot.lastRun.timestamp)}</span>
          ) : null)}
        </div>
      </footer>
    </div>
  );
}
