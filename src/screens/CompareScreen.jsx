import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import AnalysisPanel from "../components/AnalysisPanel.jsx";
import { DataValue, Panel, SectionHeader, TabButton } from "../components/ui.jsx";
import { allDirectors, flattenDirectorYear, formatCompactMoney, formatMoney } from "../data/mockRemuneration.js";

const components = [
  ["totalCompensation", "Total Compensation"],
  ["baseSalary", "Salary"],
  ["annualBonus", "Bonus"],
  ["ltip", "LTIP"],
  ["pensionBenefits", "Pension"],
  ["payRatio", "Pay Ratio"],
  ["sayOnPayPct", "Say-on-Pay"]
];

const chartTypes = ["Bar", "Line/Trend", "Bubble", "Table"];
const palette = ["#C8960C", "#3498DB", "#2ECC71", "#E74C3C", "#9B59B6", "#8CA8C0"];
const maxChips = 6;

function matchesQuery(value, query) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function chartCurrency(rows) {
  const currencies = [...new Set(rows.map((row) => row.currency).filter(Boolean))];
  return currencies.length === 1 ? currencies[0] : "MIXED";
}

function formatChartValue(value, currency, metric) {
  if (value == null) return "n/a";
  if (metric === "payRatio") return `${value}:1`;
  if (metric === "sayOnPayPct") return `${value}%`;
  return formatCompactMoney(value, currency);
}

function chipId(item) {
  return `${item.type}:${item.id}`;
}

function metricLabel(metric) {
  return components.find(([key]) => key === metric)?.[1] || metric;
}

function identityLabel(row) {
  if (row.type === "average") return `${row.company} — Average (${row.averageCount ?? 0} ${row.directorType === "non-executive" ? "NEDs" : "executives"})`;
  return `${row.name} (${row.role}, ${row.company})`;
}

function identityParts(row) {
  if (row.type === "average") {
    return {
      name: `${row.company} — Average`,
      role: `${row.averageCount ?? 0} ${row.directorType === "non-executive" ? "NEDs" : "executives"}`,
      company: row.company
    };
  }
  return { name: row.name, role: row.role, company: row.company };
}

function shortName(row) {
  if (row.type === "average") return `${row.company} avg`;
  return row.name.split(" ").slice(-1)[0];
}

function numericMetricValue(row, metric) {
  if (row[metric] == null) return null;
  const value = Number(row[metric]);
  return Number.isFinite(value) ? value : null;
}

function averageResult(company) {
  return { type: "average", id: company.id, label: `${company.company} — Average`, company: company.company, companyId: company.id, index: company.index };
}

function allIndividualsResult(company, count) {
  return { type: "all", id: company.id, label: `${company.company} — All Individuals`, company: company.company, companyId: company.id, index: company.index, count };
}

function directorChip(director) {
  return { type: "individual", id: director.id, label: director.name, company: director.company, companyId: director.companyId, role: director.role };
}

function buildAverageRow(company, companyDirectors, directorType, metric) {
  const flattened = companyDirectors.map((director) => flattenDirectorYear(director));
  const years = [...new Set(flattened.flatMap((director) => director.yearsAvailable))].sort((a, b) => Number(b) - Number(a));
  const averagedYears = {};
  const averageCounts = {};

  for (const year of years) {
    const yearKey = String(year);
    const record = { payRatio: null, sayOnPayPct: null };
    const counts = {};
    for (const [component] of components) {
      const values = companyDirectors
        .map((director) => director.years?.[yearKey]?.[component])
        .filter((value) => value != null && Number.isFinite(Number(value)))
        .map(Number);
      record[component] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      counts[component] = values.length;
    }
    averageCounts[yearKey] = counts;
    averagedYears[yearKey] = record;
  }

  const selectedYear = years[0] ? String(years[0]) : "2024";
  const selectedRecord = averagedYears[selectedYear] || {};
  return {
    id: `average-${company.id}`,
    name: `${company.company} — Average`,
    role: "Average",
    type: "average",
    directorType,
    companyId: company.id,
    company: company.company,
    index: company.index,
    sector: company.sector,
    currency: company.currency,
    marketCap: company.marketCap,
    fxRate: company.fxRate,
    reportingYear: Number(selectedYear),
    yearsAvailable: years.map(Number),
    years: averagedYears,
    averageCounts,
    averageCount: averageCounts[selectedYear]?.[metric] ?? 0,
    note: (averageCounts[selectedYear]?.[metric] ?? 0) ? null : `No ${directorType === "non-executive" ? "NED" : "executive"} data for ${metricLabel(metric)}.`,
    ...selectedRecord
  };
}

export default function CompareScreen({ dataset, directorType }) {
  const searchRef = useRef(null);
  const directors = useMemo(() => allDirectors(dataset).filter((director) => director.type === directorType), [dataset, directorType]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [chips, setChips] = useState([]);
  const [metric, setMetric] = useState("totalCompensation");
  const [chartType, setChartType] = useState("Bar");
  const [logScale, setLogScale] = useState(false);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || chips.length >= maxChips) return [];

    const selectedIds = new Set(chips.map(chipId));
    const matchingCompanies = dataset.filter((company) => matchesQuery(company.company, trimmed));
    const companyActionMatches = matchingCompanies
      .flatMap((company) => {
        const actions = [];
        const average = averageResult(company);
        if (!selectedIds.has(chipId(average))) actions.push(average);

        const unselectedDirectors = directors.filter((director) => director.companyId === company.id && !selectedIds.has(chipId(directorChip(director))));
        if (unselectedDirectors.length) actions.push(allIndividualsResult(company, unselectedDirectors.length));
        return actions;
      });

    const individualMatches = directors
      .filter((director) => matchesQuery(director.name, trimmed) || matchesQuery(director.company, trimmed))
      .map(directorChip)
      .filter((item) => !selectedIds.has(chipId(item)));

    return [...companyActionMatches, ...individualMatches].slice(0, 8);
  }, [chips, dataset, directors, query]);

  const comparisonRows = useMemo(() => {
    const rows = [];
    for (const chip of chips) {
      if (chip.type === "individual") {
        const director = directors.find((item) => item.id === chip.id);
        if (director) rows.push(flattenDirectorYear(director));
      }
      if (chip.type === "company") {
        const companyDirectors = directors.filter((director) => director.companyId === chip.id).map((director) => flattenDirectorYear(director));
        rows.push(...companyDirectors);
      }
      if (chip.type === "average") {
        const company = dataset.find((item) => item.id === chip.id);
        const companyDirectors = directors.filter((director) => director.companyId === chip.id);
        if (company) rows.push(buildAverageRow(company, companyDirectors, directorType, metric));
      }
    }
    return rows.slice(0, maxChips);
  }, [chips, dataset, directorType, directors, metric]);

  const canCompare = comparisonRows.length >= 2;
  const averageNotes = comparisonRows.filter((row) => row.type === "average" && row.note);

  const trendData = useMemo(() => {
    const years = [...new Set(comparisonRows.flatMap((director) => director.yearsAvailable))].sort();
    return years.map((year) => {
      const point = { year };
      comparisonRows.forEach((director) => {
        point[director.id] = director.years[String(year)]?.[metric] ?? null;
        point[`${director.id}Currency`] = director.currency;
        point[`${director.id}Label`] = director.type === "average" ? `${director.company} — Average (${director.averageCounts?.[String(year)]?.[metric] ?? 0} ${director.directorType === "non-executive" ? "NEDs" : "executives"})` : identityLabel(director);
      });
      return point;
    });
  }, [comparisonRows, metric]);

  const analysisData = useMemo(() => (canCompare ? { directorType, metric, chartType, logScale, comparisonRows } : null), [canCompare, chartType, comparisonRows, directorType, logScale, metric]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const addChip = (item) => {
    if (chips.length >= maxChips) return;
    if (item.type === "all") {
      setChips((current) => {
        const selectedIds = new Set(current.map(chipId));
        const remainingSlots = maxChips - current.length;
        const additions = directors
          .filter((director) => director.companyId === item.id)
          .map(directorChip)
          .filter((director) => !selectedIds.has(chipId(director)))
          .slice(0, remainingSlots);
        return additions.length ? [...current, ...additions] : current;
      });
      return;
    }

    const id = chipId(item);
    if (chips.some((chip) => chipId(chip) === id)) return;
    setChips((current) => [...current, item]);
  };

  const removeChip = (item) => {
    setChips((current) => current.filter((chip) => chipId(chip) !== chipId(item)));
  };

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader>Add Comparison</SectionHeader>
        <div className="mt-3 flex items-center gap-4">
          <div ref={searchRef} className="relative w-full max-w-[520px]">
            <input
              className={`remi-input ${query ? "pr-16" : ""}`}
              placeholder="Add a company or individual to compare"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
              disabled={chips.length >= maxChips}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 z-40 -translate-y-1/2 text-[12px] text-remi-muted transition hover:text-remi-gold-light"
                aria-label="Clear comparison search"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}
            {searchOpen && searchResults.length ? (
              <div className="remi-autocomplete-list">
                {searchResults.map((item) => (
                  <button key={chipId(item)} className="remi-autocomplete-item" onClick={() => addChip(item)} onMouseDown={(event) => event.preventDefault()}>
                    <span>{item.label}</span>
                    <span className="remi-result-tag">{item.type === "average" ? "Average" : item.type === "all" ? "All" : item.type === "company" ? "Company" : "Individual"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className={`text-xs ${chips.length >= maxChips ? "text-remi-gold-light" : "text-remi-text-secondary"}`}>
            {chips.length >= maxChips ? "Maximum reached (6/6) — remove one to add another" : "Maximum 6 comparisons"}
          </p>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span key={chipId(chip)} className={`remi-chip ${chip.type === "average" ? "remi-chip-average" : ""}`}>
            {chip.type === "average" ? `Ø ${chip.label}` : chip.type === "individual" ? `${chip.label} · ${chip.company}` : chip.label}
            <button aria-label={`Remove ${chip.label}`} onClick={() => removeChip(chip)}>
              ×
            </button>
          </span>
        ))}
        {!chips.length ? <span className="text-sm text-remi-text-secondary">No comparison chips selected.</span> : null}
      </div>

      <div className="flex items-center gap-2">
        {components.map(([key, label]) => (
          <TabButton key={key} active={metric === key} onClick={() => setMetric(key)}>
            {label}
          </TabButton>
        ))}
      </div>

      <div className="grid grid-cols-[calc(80%-8px)_20%] gap-4">
        <Panel className="h-[560px] p-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionHeader>{metricLabel(metric)} Comparison</SectionHeader>
            <div className="flex items-center gap-3">
              {chartType === "Bubble" ? <LogScaleToggle checked={logScale} onChange={setLogScale} /> : null}
              <div className="flex gap-1 rounded-lg border border-remi-border bg-remi-navy p-1">
                {chartTypes.map((type) => (
                  <TabButton key={type} active={chartType === type} className="px-3 py-1.5 text-[12px]" onClick={() => setChartType(type)}>
                    {type}
                  </TabButton>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[460px]">
            {canCompare ? (
              <>
                <div className={chartType !== "Table" && averageNotes.length ? "h-[430px]" : "h-full"}>
                  {chartType === "Bar" ? <BarComparison data={comparisonRows} metric={metric} /> : null}
                  {chartType === "Line/Trend" ? <LineComparison data={trendData} rows={comparisonRows} metric={metric} /> : null}
                  {chartType === "Bubble" ? <BubbleComparison data={comparisonRows} metric={metric} logScale={logScale} /> : null}
                  {chartType === "Table" ? <ComparisonTable data={comparisonRows} metric={metric} /> : null}
                </div>
                {chartType !== "Table" && averageNotes.length ? (
                  <div className="mt-2 space-y-1 text-[11px] text-remi-muted">
                    {averageNotes.map((row) => (
                      <p key={`${row.id}-${metric}`}>{row.company} — Average: n/a. {row.note}</p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-remi-border bg-remi-navy text-sm text-remi-text-secondary">
                Add at least 2 comparison chips to render a chart.
              </div>
            )}
          </div>
        </Panel>
        <div className="h-[560px]">
          <AnalysisPanel currentViewData={analysisData} />
        </div>
      </div>
    </div>
  );
}

function LogScaleToggle({ checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-remi-text-secondary">
      <span>Log scale</span>
      <button className={`remi-toggle ${checked ? "remi-toggle-active" : ""}`} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}

function ValueTooltip({ active, payload, metric, mode = "block" }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((entry) => entry.value != null)
    .map((entry) => ({
      label: entry.payload?.fullLabel || entry.payload?.[`${entry.dataKey}Label`] || entry.name,
      name: entry.payload?.personName,
      role: entry.payload?.role,
      company: entry.payload?.company,
      value: Object.prototype.hasOwnProperty.call(entry.payload || {}, "displayValue") ? entry.payload.displayValue : entry.value,
      currency: entry.payload?.currency || entry.payload?.[`${entry.dataKey}Currency`],
      note: entry.payload?.note
    }));
  if (!rows.length) return null;

  return (
    <div className="rounded-md border border-remi-border bg-remi-secondary p-3 text-xs text-remi-text">
      {rows.map((row, index) =>
        mode === "line" ? (
          <div key={`${row.label}-${index}`} className={index ? "mt-1" : ""}>
            {row.label}: <DataValue>{formatChartValue(row.value, row.currency, metric)}</DataValue>
            {row.note ? <div className="mt-1 text-[11px] text-remi-muted">{row.note}</div> : null}
          </div>
        ) : (
          <div key={`${row.label}-${index}`} className={index ? "mt-2" : ""}>
            <TooltipIdentity row={row} />
            <DataValue className="mt-1 block">{formatChartValue(row.value, row.currency, metric)}</DataValue>
            {row.note ? <div className="mt-1 text-[11px] text-remi-muted">{row.note}</div> : null}
          </div>
        ),
      )}
    </div>
  );
}

function BubbleTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-remi-border bg-remi-secondary p-3 text-xs text-remi-text">
      <TooltipIdentity row={row} />
      <DataValue className="mt-1 block">{formatChartValue(row.value, row.currency, metric)}</DataValue>
      {row.note ? <div className="mt-1 text-[11px] text-remi-muted">{row.note}</div> : null}
    </div>
  );
}

function TooltipIdentity({ row }) {
  if (!row.name || !row.role || !row.company) return <div className="remi-data text-remi-gold-light">{row.label || row.fullLabel}</div>;
  return (
    <div className="space-y-0.5">
      <div className="remi-data text-remi-gold-light">{row.name}</div>
      <div className="max-w-[280px] text-remi-text-secondary">{row.role}</div>
      <div className="text-remi-muted">{row.company}</div>
    </div>
  );
}

function BarComparison({ data, metric }) {
  const chartData = data.map((row, index) => {
    const parts = identityParts(row);
    return {
      name: shortName(row),
      fullLabel: identityLabel(row),
      personName: parts.name,
      role: parts.role,
      company: parts.company,
      value: numericMetricValue(row, metric) ?? 0,
      displayValue: numericMetricValue(row, metric),
      currency: row.currency,
      note: row.note,
      fill: palette[index % palette.length]
    };
  });
  const axisCurrency = chartCurrency(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="name" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <Tooltip content={<ValueTooltip metric={metric} />} cursor={{ fill: "rgba(200,150,12,0.08)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} data={chartData} metric={metric} />} />
          {chartData.map((_, index) => (
            <Cell key={index} fill={palette[index % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarValueLabel({ x, y, width, value, index, data, metric }) {
  const row = data[index];
  if (!row) return null;
  return (
    <text x={x + width / 2} y={y - 8} fill="#8CA8C0" fontSize={11} textAnchor="middle" className="remi-data">
      {formatChartValue(row.displayValue, row.currency, metric)}
    </text>
  );
}

function LineComparison({ data, rows, metric }) {
  const axisCurrency = chartCurrency(rows);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid stroke="rgba(74,98,120,0.16)" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <Tooltip content={<ValueTooltip metric={metric} mode="line" />} />
        {rows.map((row, index) => (
          <Line key={row.id} type="monotone" dataKey={row.id} stroke={palette[index % palette.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={identityLabel(row)} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BubbleComparison({ data, metric, logScale }) {
  const chartData = data.map((row, index) => {
    const value = numericMetricValue(row, metric);
    const parts = identityParts(row);
    return {
      name: shortName(row),
      fullLabel: identityLabel(row),
      personName: parts.name,
      role: parts.role,
      company: parts.company,
      currency: row.currency,
      value,
      yValue: Math.max(value ?? 0, 1),
      bubbleSize: Number.isFinite(Number(row.sayOnPayPct)) ? Number(row.sayOnPayPct) : 45,
      note: row.note,
      fill: palette[index % palette.length]
    };
  });
  const axisCurrency = chartCurrency(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="name" type="category" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis dataKey="yValue" name={metricLabel(metric)} scale={logScale ? "log" : "auto"} domain={logScale ? [1, "dataMax"] : [0, "auto"]} tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <ZAxis dataKey="bubbleSize" range={[180, 520]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<BubbleTooltip metric={metric} />} />
        <Scatter data={chartData}>
          {chartData.map((row) => (
            <Cell key={row.name} fill={row.fill} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ComparisonTable({ data, metric }) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="remi-kicker sticky top-0 bg-remi-secondary">
          <tr>
            {["Name", "Company", "Index", "Sector", "Value", "Total Comp"].map((header) => (
              <th key={header} className="border-b border-remi-border px-3 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row.id} className={index % 2 ? "bg-remi-secondary" : "bg-remi-navy"}>
              <td className="px-3 py-3">
                <span className="remi-name-popover-trigger">
                  {row.name}
                  <span className="remi-name-popover">
                    <TooltipIdentity row={{ ...identityParts(row), label: identityLabel(row) }} />
                  </span>
                </span>
              </td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.company}</td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.index}</td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.sector}</td>
              <td className="px-3 py-3">
                <DataValue className="text-remi-gold-light">{metric.includes("Pct") || metric === "payRatio" ? row[metric] ?? "n/a" : formatMoney(row[metric], row.currency)}</DataValue>
                {row.note ? <div className="mt-1 text-[11px] text-remi-muted">{row.note}</div> : null}
              </td>
              <td className="px-3 py-3">
                <DataValue>{formatMoney(row.totalCompensation, row.currency)}</DataValue>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
