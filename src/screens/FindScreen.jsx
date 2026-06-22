import { useEffect, useMemo, useState } from "react";
import AnalysisPanel from "../components/AnalysisPanel.jsx";
import { DataValue, Panel, SectionHeader } from "../components/ui.jsx";
import { allDirectors, flattenDirectorYear, formatMoney, formatVintageDate } from "../data/mockRemuneration.js";

function matchesQuery(value, query) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function sourceBadge(status) {
  if (status === "live") return { label: "Live data", tone: "live" };
  if (status === "verified") return { label: "Verified", tone: "verified" };
  return { label: "Mock data", tone: "fallback" };
}

function sayOnPayClass(value) {
  if (value == null) return "text-remi-gold-light";
  if (value >= 90) return "text-remi-positive";
  if (value >= 70) return "text-remi-gold-light";
  return "text-remi-negative";
}

export default function FindScreen({ dataset, setDataset, directorType, initialSelectedId }) {
  const directors = useMemo(() => allDirectors(dataset), [dataset]);
  const visibleDirectors = useMemo(() => directors.filter((director) => director.type === directorType), [directors, directorType]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [year, setYear] = useState(null);
  const [loadingCompanyId, setLoadingCompanyId] = useState(null);

  useEffect(() => {
    if (selectedId && !visibleDirectors.some((director) => director.id === selectedId)) {
      setSelectedId(null);
      setYear(null);
    }
  }, [selectedId, visibleDirectors]);

  useEffect(() => {
    if (initialSelectedId && visibleDirectors.some((director) => director.id === initialSelectedId)) {
      setSelectedId(initialSelectedId);
      setYear(null);
    }
  }, [initialSelectedId, visibleDirectors]);

  const hasActiveSearch = companyQuery.trim().length >= 2 || personQuery.trim().length >= 2;

  const results = useMemo(() => {
    if (!hasActiveSearch && !selectedId) return [];
    return visibleDirectors.filter((director) => {
      const companyMatch = !companyQuery || matchesQuery(director.company, companyQuery);
      const personMatch = !personQuery || matchesQuery(director.name, personQuery);
      return companyMatch && personMatch;
    });
  }, [companyQuery, hasActiveSearch, personQuery, selectedId, visibleDirectors]);

  const companySuggestions = useMemo(() => {
    if (companyQuery.trim().length < 2) return [];
    return dataset.filter((company) => matchesQuery(company.company, companyQuery)).slice(0, 6);
  }, [companyQuery, dataset]);

  const personSuggestions = useMemo(() => {
    if (personQuery.trim().length < 2) return [];
    return visibleDirectors.filter((director) => matchesQuery(director.name, personQuery)).slice(0, 6);
  }, [personQuery, visibleDirectors]);

  const selectedDirector = useMemo(() => {
    return visibleDirectors.find((director) => director.id === selectedId) || null;
  }, [selectedId, visibleDirectors]);

  const selectedYearData = selectedDirector ? flattenDirectorYear(selectedDirector, year) : null;
  const selectedCompany = dataset.find((company) => company.id === selectedDirector?.companyId);
  const badge = sourceBadge(selectedCompany?.scrape?.status);

  const selectDirector = (director) => {
    setSelectedId(director.id);
    setCompanyQuery(director.company);
    setPersonQuery(director.name);
    setYear(null);
  };

  const selectCompany = async (company) => {
    setCompanyQuery(company.company);
    setPersonQuery("");
    setYear(null);

    const director = visibleDirectors.find((item) => item.companyId === company.id);
    if (director) {
      setSelectedId(director.id);
      return;
    }

    setSelectedId(null);
    setLoadingCompanyId(company.id);
    try {
      const response = await fetch(`/api/scrape-company?companyId=${company.id}`);
      if (!response.ok) throw new Error("Scrape route unavailable");
      const hydrated = await response.json();
      setDataset((current) => current.map((item) => (item.id === hydrated.id ? hydrated : item)));
      const hydratedDirector = (hydrated.directors || []).find((item) => item.type === directorType);
      setSelectedId(hydratedDirector?.id || null);
    } catch (error) {
      setDataset((current) =>
        current.map((item) =>
          item.id === company.id
            ? {
                ...item,
                scrape: {
                  ...(item.scrape || {}),
                  status: "fallback",
                  message: error.message || "Scrape unavailable."
                }
              }
            : item,
        ),
      );
    } finally {
      setLoadingCompanyId(null);
    }
  };

  const breakdownRows =
    selectedYearData?.type === "non-executive"
      ? [["NED / Chair Fees", selectedYearData.nedFees]]
      : [
          ["Base Salary", selectedYearData?.baseSalary],
          ["Annual Bonus", selectedYearData?.annualBonus],
          ["LTIP", selectedYearData?.ltip],
          ["Pension & Benefits", selectedYearData?.pensionBenefits],
          ["Total Compensation", selectedYearData?.totalCompensation]
        ];

  return (
    <div className="grid grid-cols-[30%_calc(50%-16px)_20%] gap-4">
      <Panel className="flex h-[690px] flex-col overflow-hidden">
        <div className="border-b border-remi-border p-6">
          <div className="grid gap-3">
            <div className="relative">
              <input
                className="remi-input"
                placeholder="Search company"
                value={companyQuery}
                onChange={(event) => {
                  setCompanyQuery(event.target.value);
                  setSelectedId(null);
                }}
              />
              {!dataset.some((company) => company.company === companyQuery) && companySuggestions.length ? (
                <div className="remi-autocomplete-list">
                  {companySuggestions.map((company) => (
                    <button key={company.id} className="remi-autocomplete-item" onClick={() => selectCompany(company)}>
                      <span>{company.company}</span>
                      <span>{company.index}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <input
                className="remi-input"
                placeholder="Search individual"
                value={personQuery}
                onChange={(event) => {
                  setPersonQuery(event.target.value);
                  setSelectedId(null);
                }}
              />
              {!visibleDirectors.some((director) => director.name === personQuery) && personSuggestions.length ? (
                <div className="remi-autocomplete-list">
                  {personSuggestions.map((director) => (
                    <button key={director.id} className="remi-autocomplete-item" onClick={() => selectDirector(director)}>
                      <span>{director.name}</span>
                      <span>{director.company}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-b border-remi-border px-6 py-4">
          <h3 className="text-sm font-medium text-remi-text">
            Search results: <span className="text-remi-gold-light">{hasActiveSearch ? companyQuery || personQuery : "Start typing"}</span>
          </h3>
          <p className="mt-1 text-xs text-remi-text-secondary">
            {loadingCompanyId ? "Fetching live remuneration data..." : "Select a director to see remuneration data."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SectionHeader className="mb-3">{directorType === "executive" ? "Executive Team" : "Non-Executive Directors"}</SectionHeader>
          <div className="space-y-1">
            {results.map((director, index) => (
              <button
                key={director.id}
                className={`w-full border-l-2 px-3 py-3 text-left transition ${
                  selectedDirector?.id === director.id
                    ? "border-remi-gold bg-remi-surface"
                    : `border-transparent ${index % 2 ? "bg-remi-secondary" : "bg-remi-navy"} hover:border-remi-gold hover:bg-remi-surface`
                }`}
                onClick={() => {
                  selectDirector(director);
                }}
              >
                <div className="text-sm font-medium text-remi-text">{director.name}</div>
                <div className="mt-1 text-xs text-remi-text-secondary">{director.role}</div>
                <div className="mt-1 text-[11px] text-remi-muted">{director.company}</div>
              </button>
            ))}
            {!results.length ? <p className="px-3 py-8 text-center text-sm text-remi-text-secondary">Search for a company or individual to begin.</p> : null}
          </div>
        </div>
      </Panel>

      <Panel className="h-[690px] overflow-hidden p-6">
        {selectedYearData ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-remi-border pb-5">
              <div>
                <h3 className="remi-title text-[30px]">{selectedYearData.name}</h3>
                <p className="mt-2 text-sm text-remi-text-secondary">{selectedYearData.role}</p>
                <p className="mt-1 text-xs text-remi-muted">
                  {selectedYearData.company} · {selectedYearData.index} · {selectedYearData.sector}
                </p>
              </div>
              <select className="remi-select" value={selectedYearData.reportingYear} onChange={(event) => setYear(event.target.value)}>
                {selectedYearData.yearsAvailable.map((availableYear) => (
                  <option key={availableYear} value={availableYear}>
                    {availableYear}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 remi-panel-inner overflow-hidden">
              {breakdownRows.map(([label, value]) => (
                <div className="remi-value-row" key={label}>
                  <span className="text-sm text-remi-text-secondary">{label}</span>
                  <DataValue className={label === "Total Compensation" ? "text-xl text-remi-gold-light" : "text-base text-remi-text"}>
                    {formatMoney(value, selectedYearData.currency)}
                  </DataValue>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[11px] text-remi-muted">
              <span>Data: </span>
              <span className="remi-data">FY{selectedYearData.reportingYear || "n/a"}</span>
              <span> · Last updated </span>
              <span className="remi-data">{formatVintageDate(selectedYearData.lastUpdated)}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="remi-panel-inner p-4">
                <SectionHeader>Pay Ratio</SectionHeader>
                <DataValue className="mt-3 block text-3xl text-remi-text">
                  {selectedYearData.payRatio ? `${selectedYearData.payRatio}:1` : "n/a"}
                </DataValue>
              </div>
              <div className="remi-panel-inner p-4">
                <SectionHeader>Say-on-Pay</SectionHeader>
                <DataValue className={`mt-3 block text-3xl ${sayOnPayClass(selectedYearData.sayOnPayPct)}`}>
                  {selectedYearData.sayOnPayPct ? `${selectedYearData.sayOnPayPct}%` : "n/a"}
                </DataValue>
              </div>
            </div>

            <div className="mt-auto flex items-center gap-1 border-t border-remi-border pt-4 text-[11px] text-remi-muted">
              <span>Source</span>
              <span>·</span>
              {selectedYearData.sourceUrl ? (
                <a href={selectedYearData.sourceUrl} target="_blank" rel="noreferrer">
                  Original filing
                </a>
              ) : (
                <span>Manual source</span>
              )}
              <span>·</span>
              <span className={`remi-source-badge remi-source-badge-${badge.tone}`}>
                <span className="remi-source-dot" />
                {badge.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-remi-text-secondary">
            Search for a company or individual to begin
          </div>
        )}
      </Panel>

      <div className="h-[690px]">
        <AnalysisPanel currentViewData={selectedYearData} />
      </div>
    </div>
  );
}
