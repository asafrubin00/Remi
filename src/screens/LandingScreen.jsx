import { ArrowDown, ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, ListOrdered, Search } from "lucide-react";
import { useMemo } from "react";
import ResearchSearch from "../components/ResearchSearch.jsx";
import { allDirectors, formatVintageDate } from "../data/mockRemuneration.js";

const workspaces = [
  { id: "find", title: "Compensation profiles", description: "Director pay, equity awards and board fees, with figures linked to the original filing where available.", Icon: Search },
  { id: "compare", title: "Peer comparisons", description: "Benchmark up to six individuals or company averages side by side.", Icon: ChartNoAxesColumnIncreasing },
  { id: "league", title: "Pay rankings", description: "Rank directors by pay component, role, industry and reporting year.", Icon: ListOrdered }
];

export default function LandingScreen({ dataset, directorType, snapshots, onNavigate, onSelect }) {
  const directors = useMemo(() => allDirectors(dataset).filter((person) => person.type === directorType), [dataset, directorType]);
  const examples = ["JPM", "MSFT", "AAPL", "HSBA", "SHEL"].map((ticker) => dataset.find((company) => company.ticker === ticker && company.directors.some((person) => person.type === directorType))).filter(Boolean);
  const coverage = [
    { key: "SP500", name: "S&P 500", market: "United States", source: "SEC proxy filings" },
    { key: "FTSE100", name: "FTSE 100", market: "United Kingdom", source: "Annual remuneration reports" }
  ];

  return (
    <div className="research-home">
      <section className="research-hero">
        <div className="research-hero-content">
          <p className="research-eyebrow">Remuneration intelligence</p>
          <h1>Executive &amp; board pay</h1>
          <p className="research-hero-description">Research director compensation across the S&amp;P 500 and FTSE 100.</p>
          <ResearchSearch dataset={dataset} directors={directors} onSelect={onSelect} placeholder="Search a company, ticker or director" />
          <div className="research-examples">
            {examples.map((company) => (
              <button type="button" key={company.id} onClick={() => onSelect({ companyId: company.id })}>
                {company.company.replace(/(?: Corporation|,? Inc\.?| plc)$/i, "")}<ArrowUpRight size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <a className="research-scroll" href="#research-workspaces" aria-label="Browse research workspaces"><ArrowDown size={16} /></a>
      </section>
      <section className="research-workspaces" id="research-workspaces" aria-label="Research workspaces">
        {workspaces.map(({ id, title, description, Icon }) => (
          <a href={`/${id}`} key={id} onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate(id);
          }}>
            <span className="research-workspace-overline"><Icon size={17} /><ArrowRight size={17} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
          </a>
        ))}
      </section>
      <section className="research-coverage" aria-label="Data coverage">
        {coverage.map(({ key, name, market, source }) => {
          const members = dataset.filter((company) => company.index === key && !company.archived);
          const available = members.filter((company) => company.directors.some((person) => person.source !== "manual" || person.sourceUrl)).length;
          const run = snapshots.find((snapshot) => snapshot.index === key)?.lastRun;
          return (
            <div key={key}>
              <p className="research-eyebrow">{market}</p>
              <h2>{name}</h2>
              <p>{source}</p>
              <p className="research-coverage-count"><strong>{available}</strong> of <strong>{members.length}</strong> companies with filing records</p>
              {run?.timestamp ? <p className="research-coverage-update">Last checked {formatVintageDate(run.timestamp)} · {run.failed} unavailable in latest check</p> : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
