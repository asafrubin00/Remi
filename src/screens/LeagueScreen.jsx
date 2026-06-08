import { useEffect, useMemo, useState } from "react";
import AnalysisPanel from "../components/AnalysisPanel.jsx";
import { DataValue, Panel, SectionHeader } from "../components/ui.jsx";
import { allDirectors, flattenDirectorYear, formatMoney } from "../data/mockRemuneration.js";

const metricOptions = [
  ["totalCompensation", "Total Comp"],
  ["baseSalary", "Salary"],
  ["annualBonus", "Bonus"],
  ["ltip", "LTIP"],
  ["payRatio", "Pay Ratio"],
  ["sayOnPayPct", "Say-on-Pay"]
];

const columns = [
  ["rank", "Rank"],
  ["name", "Name"],
  ["role", "Role"],
  ["company", "Company"],
  ["index", "Index"],
  ["sector", "Sector"],
  ["metricValue", "Selected Component Value"],
  ["totalCompensation", "Total Comp"],
  ["sayOnPayPct", "Say-on-Pay %"]
];

function sayOnPayClass(value) {
  if (value == null) return "text-remi-gold-light";
  if (value >= 90) return "text-remi-positive";
  if (value >= 70) return "text-remi-gold-light";
  return "text-remi-negative";
}

export default function LeagueScreen({ dataset, directorType, onOpenDirector }) {
  const directors = useMemo(() => allDirectors(dataset).filter((director) => director.type === directorType).map((director) => flattenDirectorYear(director)), [dataset, directorType]);
  const [indexFilter, setIndexFilter] = useState("All");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [metric, setMetric] = useState("totalCompensation");
  const [year, setYear] = useState(2025);
  const [sortDirection, setSortDirection] = useState("desc");
  const [sortKey, setSortKey] = useState("metricValue");
  const [page, setPage] = useState(1);

  const sectors = [...new Set(directors.map((director) => director.sector))].sort();
  const years = [...new Set(directors.flatMap((director) => director.yearsAvailable))].sort((a, b) => b - a);

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0]);
  }, [year, years]);

  const rows = useMemo(() => {
    const filtered = directors
      .map((director) => flattenDirectorYear(director, year))
      .filter((director) => {
        const indexMatch = indexFilter === "All" || director.index === indexFilter;
        const sectorMatch = sectorFilter === "All" || director.sector === sectorFilter;
        return indexMatch && sectorMatch;
      })
      .map((director) => ({ ...director, metricValue: director[metric] ?? null }));

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortKey] ?? "";
      const bValue = b[sortKey] ?? "";
      if (typeof aValue === "number" && typeof bValue === "number") return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      return sortDirection === "desc" ? String(bValue).localeCompare(String(aValue)) : String(aValue).localeCompare(String(bValue));
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [directors, indexFilter, metric, sectorFilter, sortDirection, sortKey, year]);

  const pageRows = rows.slice((page - 1) * 50, page * 50);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));

  useEffect(() => {
    setPage(1);
  }, [directorType, indexFilter, metric, sectorFilter, sortDirection, sortKey, year]);

  const updateSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="grid grid-cols-5 gap-4 p-5">
        <FilterSelect label="Index" value={indexFilter} onChange={setIndexFilter} options={["All", "FTSE100", "FTSE250", "SP500"]} />
        <FilterSelect label="Sector / Industry" value={sectorFilter} onChange={setSectorFilter} options={["All", ...sectors]} />
        <FilterSelect label="Pay component" value={metric} onChange={setMetric} options={metricOptions} />
        <FilterSelect label="Year" value={year} onChange={(value) => setYear(Number(value))} options={years.map(String)} />
        <FilterSelect label="Sort" value={sortDirection} onChange={setSortDirection} options={[["desc", "Highest first"], ["asc", "Lowest first"]]} />
      </Panel>

      <div className="grid grid-cols-[calc(80%-8px)_20%] gap-4">
        <Panel className="h-[620px] overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <SectionHeader>Ranked Remuneration Data</SectionHeader>
            <span className="text-xs text-remi-muted">
              {rows.length} rows · Page {page} of {pageCount}
            </span>
          </div>
          <div className="h-[520px] overflow-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="remi-kicker sticky top-0 z-10 bg-remi-secondary">
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} className="border-b border-remi-border px-3 py-3">
                      <button className="text-left hover:text-remi-gold-light" onClick={() => updateSort(key)}>
                        {label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length ? (
                  pageRows.map((row, index) => (
                    <tr
                      key={`${row.id}-${row.reportingYear}`}
                      className={`${index % 2 ? "bg-remi-secondary" : "bg-remi-navy"} cursor-pointer hover:bg-remi-surface`}
                      onClick={() => onOpenDirector(row.id)}
                    >
                      <td className="px-3 py-3">
                        <DataValue className="text-remi-gold-light">{row.rank}</DataValue>
                      </td>
                      <td className="px-3 py-3 font-medium text-remi-text">{row.name}</td>
                      <td className="px-3 py-3 text-remi-text-secondary">{row.role}</td>
                      <td className="px-3 py-3 text-remi-text-secondary">{row.company}</td>
                      <td className="px-3 py-3 text-remi-text-secondary">{row.index}</td>
                      <td className="px-3 py-3 text-remi-text-secondary">{row.sector}</td>
                      <td className="px-3 py-3">
                        <DataValue className="text-remi-gold-light">{formatMetric(row.metricValue, metric, row.currency)}</DataValue>
                      </td>
                      <td className="px-3 py-3">
                        <DataValue>{formatMoney(row.totalCompensation, row.currency)}</DataValue>
                      </td>
                      <td className="px-3 py-3">
                        <DataValue className={sayOnPayClass(row.sayOnPayPct)}>{row.sayOnPayPct ? `${row.sayOnPayPct}%` : "n/a"}</DataValue>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-12 text-center text-sm text-remi-text-secondary" colSpan={columns.length}>
                      No league records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="remi-tab" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <button className="remi-tab" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              Next
            </button>
          </div>
        </Panel>
        <div className="h-[620px]">
          <AnalysisPanel currentViewData={{ directorType, filters: { indexFilter, sectorFilter, metric, year, sortDirection }, rows: rows.slice(0, 20) }} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="grid gap-2">
      <SectionHeader>{label}</SectionHeader>
      <select className="remi-select w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const id = Array.isArray(option) ? option[0] : option;
          const text = Array.isArray(option) ? option[1] : option;
          return (
            <option key={id} value={id}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function formatMetric(value, metric, currency) {
  if (value == null) return "n/a";
  if (metric === "payRatio") return `${value}:1`;
  if (metric === "sayOnPayPct") return `${value}%`;
  return formatMoney(value, currency);
}
