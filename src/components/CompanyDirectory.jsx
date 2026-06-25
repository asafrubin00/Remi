import { useMemo, useState } from "react";
import { ftse100Constituents, sp500Constituents } from "../data/constituents.generated.js";

export default function CompanyDirectory({ dataset, onSelect, className = "" }) {
  const [openDirectory, setOpenDirectory] = useState(null);
  const directories = useMemo(() => buildDirectories(dataset), [dataset]);
  const selectCompany = (company) => {
    setOpenDirectory(null);
    onSelect(company);
  };

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <DirectoryPanel
        index="FTSE100"
        label="FTSE 100"
        companies={directories.FTSE100}
        expanded={openDirectory === "FTSE100"}
        onToggle={() => setOpenDirectory((current) => (current === "FTSE100" ? null : "FTSE100"))}
        onSelect={selectCompany}
      />
      <DirectoryPanel
        index="SP500"
        label="S&P 500"
        companies={directories.SP500}
        expanded={openDirectory === "SP500"}
        onToggle={() => setOpenDirectory((current) => (current === "SP500" ? null : "SP500"))}
        onSelect={selectCompany}
      />
    </div>
  );
}

function DirectoryPanel({ index, label, companies, expanded, onToggle, onSelect }) {
  return (
    <div className={`remi-directory ${expanded ? "remi-directory-expanded" : ""}`}>
      <button className="remi-directory-toggle" type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`directory-${index}`}>
        <span>Browse {label} companies ({companies.length})</span>
        <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
      </button>
      {expanded ? (
        <div className="remi-directory-list" id={`directory-${index}`}>
          {companies.map((company) => (
            <button key={company.id} type="button" onClick={() => onSelect(company)}>
              {company.company}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildDirectories(dataset) {
  const byTicker = new Map(dataset.filter((company) => company.ticker).map((company) => [company.ticker, company]));
  const byId = new Map(dataset.map((company) => [company.id, company]));
  const byName = new Map(dataset.map((company) => [company.company.toLowerCase(), company]));
  const resolve = (constituent) =>
    byTicker.get(constituent.ticker) ||
    byId.get(constituent.id) ||
    byName.get(constituent.company.toLowerCase()) ||
    null;
  const available = (constituents) =>
    constituents
      .map(resolve)
      .filter(Boolean)
      .filter((company, index, list) => list.findIndex((item) => item.id === company.id) === index)
      .sort((a, b) => a.company.localeCompare(b.company));

  return {
    FTSE100: available(ftse100Constituents),
    SP500: available(sp500Constituents)
  };
}
