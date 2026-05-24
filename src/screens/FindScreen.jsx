import { useEffect, useMemo, useState } from "react";
import { DataValue, Panel, SectionHeader } from "../components/ui.jsx";
import { allDirectors, companies, flattenDirectorYear, formatMoney } from "../data/mockRemuneration.js";

function matchesQuery(value, query) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export default function FindScreen({ directorType }) {
  const directors = useMemo(() => allDirectors(), []);
  const visibleDirectors = useMemo(() => directors.filter((director) => director.type === directorType), [directors, directorType]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [selectedId, setSelectedId] = useState(visibleDirectors[0]?.id);
  const [year, setYear] = useState(null);

  useEffect(() => {
    const nextVisible = visibleDirectors.find((director) => director.id === selectedId) || visibleDirectors[0];
    setSelectedId(nextVisible?.id);
    setYear(null);
  }, [directorType, selectedId, visibleDirectors]);

  const results = useMemo(() => {
    return visibleDirectors.filter((director) => {
      const companyMatch = !companyQuery || matchesQuery(director.company, companyQuery);
      const personMatch = !personQuery || matchesQuery(director.name, personQuery);
      return companyMatch && personMatch;
    });
  }, [companyQuery, personQuery, visibleDirectors]);

  const selectedDirector = useMemo(() => {
    return visibleDirectors.find((director) => director.id === selectedId) || results[0] || visibleDirectors[0];
  }, [results, selectedId, visibleDirectors]);

  const selectedYearData = selectedDirector ? flattenDirectorYear(selectedDirector, year) : null;
  const selectedCompany = companies.find((company) => company.id === selectedDirector?.companyId);

  useEffect(() => {
    if (results.length && !results.some((director) => director.id === selectedId)) {
      setSelectedId(results[0].id);
      setYear(null);
    }
  }, [results, selectedId]);

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
            <input
              className="remi-input"
              list="company-options"
              placeholder="Search company"
              value={companyQuery}
              onChange={(event) => setCompanyQuery(event.target.value)}
            />
            <datalist id="company-options">
              {companies.map((company) => (
                <option key={company.id} value={company.company} />
              ))}
            </datalist>
            <input
              className="remi-input"
              list="director-options"
              placeholder="Search individual"
              value={personQuery}
              onChange={(event) => setPersonQuery(event.target.value)}
            />
            <datalist id="director-options">
              {visibleDirectors.map((director) => (
                <option key={director.id} value={director.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="border-b border-remi-border px-6 py-4">
          <h3 className="text-sm font-medium text-remi-text">
            Search results: <span className="text-remi-gold-light">{companyQuery || selectedCompany?.company}</span>
          </h3>
          <p className="mt-1 text-xs text-remi-text-secondary">Select a director to see remuneration data.</p>
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
                  setSelectedId(director.id);
                  setYear(null);
                }}
              >
                <div className="text-sm font-medium text-remi-text">{director.name}</div>
                <div className="mt-1 text-xs text-remi-text-secondary">{director.role}</div>
                <div className="mt-1 text-[11px] text-remi-muted">{director.company}</div>
              </button>
            ))}
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

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="remi-panel-inner p-4">
                <SectionHeader>Pay Ratio</SectionHeader>
                <DataValue className="mt-3 block text-3xl text-remi-text">
                  {selectedYearData.payRatio ? `${selectedYearData.payRatio}:1` : "n/a"}
                </DataValue>
              </div>
              <div className="remi-panel-inner p-4">
                <SectionHeader>Say-on-Pay</SectionHeader>
                <DataValue className={`mt-3 block text-3xl ${selectedYearData.sayOnPayPct >= 90 ? "text-remi-positive" : "text-remi-gold-light"}`}>
                  {selectedYearData.sayOnPayPct ? `${selectedYearData.sayOnPayPct}%` : "n/a"}
                </DataValue>
              </div>
            </div>

            <div className="mt-auto border-t border-remi-border pt-4 text-[11px] text-remi-muted">
              Last updated <span className="remi-data">{new Date(selectedYearData.lastUpdated).toLocaleDateString("en-GB")}</span> ·{" "}
              <a href={selectedYearData.sourceUrl} target="_blank" rel="noreferrer">
                Original filing
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-remi-text-secondary">No matching director records.</p>
        )}
      </Panel>

      <Panel className="h-[690px] p-6">
        <SectionHeader>Remi Analysis</SectionHeader>
        <p className="mt-4 text-[13px] italic leading-6 text-remi-text-secondary">
          Analysis panel is queued for the next build step and will read the selected remuneration record.
        </p>
      </Panel>
    </div>
  );
}
