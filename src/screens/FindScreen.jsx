import { ArrowUpRight, Building2, ChevronRight, FileText } from "lucide-react";
import { useMemo, useRef } from "react";
import CompanyDirectory from "../components/CompanyDirectory.jsx";
import ResearchSearch, { indexLabel } from "../components/ResearchSearch.jsx";
import ResponsiveAnalysis from "../components/ResponsiveAnalysis.jsx";
import { allDirectors, flattenDirectorYear, formatCompactMoney, formatVintageDate } from "../data/mockRemuneration.js";

const executiveComponents = [
  ["Base salary", "baseSalary"],
  ["Annual bonus", "annualBonus"],
  ["Long-term incentives", "ltip"],
  ["Pension & benefits", "pensionBenefits"]
];

export default function FindScreen({ dataset, directorType, selection, loading, onSelect }) {
  const detail = useRef(null);
  const directors = useMemo(() => allDirectors(dataset).filter((person) => person.type === directorType), [dataset, directorType]);
  const company = dataset.find((item) => item.id === selection.companyId);
  const roster = directors.filter((person) => person.companyId === company?.id)
    .sort((a, b) => {
      const year = (person) => Math.max(...Object.keys(person.years).map(Number));
      const primary = (person) => /chief executive|\bceo\b|^chair(?:man|person)?$/i.test(person.role) ? 1 : 0;
      return year(b) - year(a) || primary(b) - primary(a) || a.name.localeCompare(b.name);
    });
  const person = roster.find((item) => item.id === selection.directorId) || roster[0];
  const year = selection.year && person?.years[selection.year] ? selection.year : null;
  const record = person ? flattenDirectorYear(person, year) : null;
  const examples = ["JPM", "MSFT", "AAPL", "HSBA", "SHEL"].map((ticker) => dataset.find((item) => item.ticker === ticker && item.directors.some((director) => director.type === directorType))).filter(Boolean);

  function choose(item, reveal = true) {
    onSelect(item);
    if (reveal && window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "start" }));
    }
  }

  return (
    <div className="research-find remi-find-layout">
      <aside className="research-find-sidebar">
        <div className="research-find-search">
          <h2>Find a profile</h2>
          <ResearchSearch dataset={dataset} directors={directors} onSelect={choose} />
          <CompanyDirectory dataset={dataset} onSelect={(item) => choose({ companyId: item.id }, false)} className="research-directories" />
        </div>

        {company ? (
          <section className="research-roster">
            <div className="research-roster-head">
              <p className="research-eyebrow">{indexLabel(company.index)}{company.ticker ? ` · ${company.ticker}` : ""}</p>
              <h2>{company.company}</h2>
              <p>{directorType === "executive" ? "Executives" : "Non-executive directors"} <span className="remi-data">{roster.length}</span></p>
            </div>
            <div className="research-roster-list">
              {roster.map((item) => (
                <button type="button" key={item.id} aria-pressed={person?.id === item.id} onClick={() => choose({ companyId: company.id, directorId: item.id })}>
                  <span><strong>{item.name}</strong><small>{item.role}</small></span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="research-suggestions">
            {examples.length ? <p className="research-eyebrow">Company profiles</p> : null}
            {examples.map((item) => <button key={item.id} onClick={() => choose({ companyId: item.id })}>{item.company}<ArrowUpRight size={14} /></button>)}
          </div>
        )}
      </aside>

      <section className="research-profile" ref={detail} aria-label="Compensation profile">
        {record ? (
          <Profile company={company} record={record} onYear={(reportingYear) => choose({ companyId: company.id, directorId: person.id, year: reportingYear }, false)} />
        ) : (
          <div className="research-profile-empty">
            <Building2 size={26} strokeWidth={1.2} />
            <h2>{company?.company || "Company and director profiles"}</h2>
            <p>{company && loading ? "Loading filing coverage…" : company ? "No published compensation records in this view." : "Search by company, ticker or director, or browse either index."}</p>
            {company?.refresh?.outcome === "unavailable" ? <p className="research-profile-note">The latest filing check could not produce a usable record.</p> : null}
          </div>
        )}
      </section>

      <ResponsiveAnalysis currentViewData={record} className="research-profile-analysis" />
    </div>
  );
}

function Profile({ company, record, onYear }) {
  const isNed = record.type === "non-executive";
  const breakdown = isNed
    ? [["Cash fees", "nedFees"], ["Equity awards", "ltip"], ["Option awards", "optionAwards"], ["Other compensation", "pensionBenefits"]].filter(([, field]) => record[field] != null)
    : executiveComponents;
  const filing = record.index === "SP500" ? "SEC proxy statement" : "Annual report";
  const provenance = record.source === "manual"
    ? record.sourceUrl ? "Manually sourced" : "Historical seed · no filing link"
    : record.sourceUrl ? "Filing extraction" : "Source unavailable";
  return (
    <>
      <header className="research-profile-heading">
        <div>
          <p className="research-eyebrow">{[company.company, indexLabel(company.index)].filter(Boolean).join(" · ")}</p>
          <h2>{record.name}</h2>
          <p>{record.role}</p>
        </div>
        <label className="research-year">
          <span className="research-eyebrow">Fiscal year</span>
          <select value={record.reportingYear} onChange={(event) => onYear(Number(event.target.value))}>
            {record.yearsAvailable.map((value) => <option key={value} value={value}>FY{value}</option>)}
          </select>
        </label>
      </header>

      <div className="research-profile-total">
        <p className="research-eyebrow">{isNed ? "Total director compensation" : "Total compensation"}</p>
        <strong className="remi-data">{formatCompactMoney(record.totalCompensation, record.currency)}</strong>
        <span className="remi-data">{record.currency}</span>
      </div>

      <dl className="research-profile-components">
        {breakdown.map(([label, field]) => <div key={field}><dt>{label}</dt><dd className="remi-data">{formatCompactMoney(record[field], record.currency)}</dd></div>)}
      </dl>

      {(!isNed || record.sayOnPayPct != null) ? (
        <dl className="research-profile-context">
          {!isNed ? <div><dt>CEO pay ratio</dt><dd className="remi-data">{record.payRatio != null ? `${record.payRatio}:1` : "n/a"}</dd></div> : null}
          <div><dt>Say-on-pay</dt><dd className={`remi-data ${record.sayOnPayPct == null ? "" : record.sayOnPayPct >= 90 ? "vote-high" : record.sayOnPayPct >= 70 ? "vote-mid" : "vote-low"}`}>{record.sayOnPayPct != null ? `${record.sayOnPayPct}%` : "n/a"}</dd></div>
        </dl>
      ) : null}

      <footer className="research-profile-source">
        <div><span>{provenance}</span>{record.lastUpdated ? <span>Record updated {formatVintageDate(record.lastUpdated)}</span> : null}</div>
        {record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer"><FileText size={15} />{filing}<ArrowUpRight size={13} /></a> : null}
        {company.refresh?.outcome === "unavailable" ? <p>Latest check unavailable · showing the last published record.</p> : null}
      </footer>
    </>
  );
}
