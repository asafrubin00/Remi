import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import ResponsiveAnalysis from "../components/ResponsiveAnalysis.jsx";
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
  ["reportingYear", "Reporting Year"],
  ["sayOnPayPct", "Say-on-Pay %"]
];

const roleOptions = [
  ["All", "All Roles"],
  ["ceo", "CEO"],
  ["cfo", "CFO"],
  ["other-executive", "Other Executive"],
  ["non-executive-chair", "Non-Executive Chair"],
  ["non-executive-director", "Non-Executive Director"],
  ["other-board-director", "Other Board Director"]
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
  const [roleFilter, setRoleFilter] = useState("All");
  const [metric, setMetric] = useState("totalCompensation");
  const [year, setYear] = useState(2025);
  const [sortDirection, setSortDirection] = useState("desc");
  const [sortKey, setSortKey] = useState("metricValue");
  const [page, setPage] = useState(1);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadMenuRef = useRef(null);

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
        const roleMatch = roleFilter === "All" || classifyRole(director) === roleFilter;
        return indexMatch && sectorMatch && roleMatch;
      })
      .map((director) => ({ ...director, metricValue: director[metric] ?? null }));

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortKey] ?? "";
      const bValue = b[sortKey] ?? "";
      if (typeof aValue === "number" && typeof bValue === "number") return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      return sortDirection === "desc" ? String(bValue).localeCompare(String(aValue)) : String(aValue).localeCompare(String(bValue));
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [directors, indexFilter, metric, roleFilter, sectorFilter, sortDirection, sortKey, year]);

  const pageRows = rows.slice((page - 1) * 50, page * 50);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));

  useEffect(() => {
    setPage(1);
  }, [directorType, indexFilter, metric, roleFilter, sectorFilter, sortDirection, sortKey, year]);

  useEffect(() => {
    const closeDownloadMenu = (event) => {
      if (!downloadMenuRef.current?.contains(event.target)) setDownloadOpen(false);
    };
    document.addEventListener("pointerdown", closeDownloadMenu);
    return () => document.removeEventListener("pointerdown", closeDownloadMenu);
  }, []);

  const updateSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const downloadLeague = async (format) => {
    const exportRows = rows.map((row) => ({
      Rank: row.rank,
      Name: row.name,
      Role: row.role,
      Company: row.company,
      Index: row.index,
      Sector: row.sector,
      "Reporting Year": row.reportingYear,
      "Base Salary": numberOrBlank(row.baseSalary),
      "Annual Bonus": numberOrBlank(row.annualBonus),
      LTIP: numberOrBlank(row.ltip),
      "Pension & Benefits": numberOrBlank(row.pensionBenefits),
      "Total Compensation": numberOrBlank(row.totalCompensation),
      "Pay Ratio": numberOrBlank(row.payRatio),
      "Say-on-Pay %": numberOrBlank(row.sayOnPayPct),
      "Data Source": row.dataSource
    }));
    const filename = leagueFilename({ indexFilter, sectorFilter, roleFilter, metric, year, format });

    if (format === "csv") {
      const csv = toCsv(exportRows);
      downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), filename);
    } else {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet["!autofilter"] = { ref: worksheet["!ref"] };
      worksheet["!cols"] = Object.keys(exportRows[0] || { Rank: "" }).map((header) => ({
        wch: Math.max(header.length + 2, ...exportRows.map((row) => String(row[header] ?? "").length + 2))
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "League");
      XLSX.writeFile(workbook, filename);
    }
    setDownloadOpen(false);
  };

  return (
    <div className="space-y-4">
      <Panel className="remi-league-filters grid grid-cols-6 gap-4 p-5">
        <FilterSelect label="Index" value={indexFilter} onChange={setIndexFilter} options={["All", "FTSE100", "FTSE250", "SP500"]} />
        <FilterSelect label="Sector / Industry" value={sectorFilter} onChange={setSectorFilter} options={["All", ...sectors]} />
        <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} options={roleOptions} />
        <FilterSelect label="Pay component" value={metric} onChange={setMetric} options={metricOptions} />
        <FilterSelect label="Year" value={year} onChange={(value) => setYear(Number(value))} options={years.map(String)} />
        <FilterSelect label="Sort" value={sortDirection} onChange={setSortDirection} options={[["desc", "Highest first"], ["asc", "Lowest first"]]} />
      </Panel>

      <div className="remi-league-layout grid grid-cols-[calc(80%-8px)_20%] gap-4">
        <Panel className="remi-league-panel h-[620px] overflow-hidden p-5">
          <div className="remi-league-toolbar mb-4 flex items-center justify-between">
            <SectionHeader>Ranked Remuneration Data</SectionHeader>
            <div className="flex items-center gap-3">
              <span className="text-xs text-remi-muted">
                {rows.length} rows · Page {page} of {pageCount}
              </span>
              <div className="relative" ref={downloadMenuRef}>
                <button className="remi-download-button" type="button" onClick={() => setDownloadOpen((open) => !open)} aria-expanded={downloadOpen}>
                  <Download size={14} />
                  Download
                  <ChevronDown size={13} />
                </button>
                {downloadOpen ? (
                  <div className="remi-download-menu">
                    <button type="button" onClick={() => downloadLeague("csv")}>CSV</button>
                    <button type="button" onClick={() => downloadLeague("xlsx")}>Excel (.xlsx)</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="remi-league-table-wrap h-[520px] overflow-auto">
            <table className="remi-league-table w-full border-collapse text-left text-[13px]">
              <thead className="remi-kicker sticky top-0 z-10 bg-remi-secondary">
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} className={`${key === "name" ? "remi-league-name" : ""} border-b border-remi-border px-3 py-3`}>
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
                      <td className="remi-league-name px-3 py-3 font-medium text-remi-text">{row.name}</td>
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
                        <DataValue>FY{row.reportingYear || "n/a"}</DataValue>
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
        <ResponsiveAnalysis
          currentViewData={{ directorType, filters: { indexFilter, sectorFilter, roleFilter, metric, year, sortDirection }, rows: rows.slice(0, 20) }}
          className="h-[620px]"
        />
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

export function classifyRole(director) {
  const role = String(director?.role || "");
  if (/\bCEO\b|chief executive/i.test(role)) return "ceo";
  if (/\bCFO\b|chief financial/i.test(role)) return "cfo";
  if (director?.type === "executive") return "other-executive";
  if (director?.type === "non-executive" && /\bchair(?:man|woman|person)?\b/i.test(role)) return "non-executive-chair";
  if (director?.type === "non-executive") return "non-executive-director";
  return "other-board-director";
}

function numberOrBlank(value) {
  return value == null || !Number.isFinite(Number(value)) ? "" : Number(value);
}

function leagueFilename({ indexFilter, sectorFilter, roleFilter, metric, year, format }) {
  const parts = [indexFilter, sectorFilter, roleFilter, metric, year]
    .filter((value) => value !== "All" && value != null)
    .map((value) => slugify(value));
  const date = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\s+/g, "")
    .toLowerCase();
  return `remi-league-${parts.join("-") || "all"}-${date}.${format}`;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const headers = [
    "Rank",
    "Name",
    "Role",
    "Company",
    "Index",
    "Sector",
    "Reporting Year",
    "Base Salary",
    "Annual Bonus",
    "LTIP",
    "Pension & Benefits",
    "Total Compensation",
    "Pay Ratio",
    "Say-on-Pay %",
    "Data Source"
  ];
  const escapeCell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))].map((line) => line.map(escapeCell).join(",")).join("\r\n");
}
