import { useMemo, useState } from "react";
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
import { allDirectors, flattenDirectorYear, formatCompactMarketCap, formatCompactMoney, formatMoney } from "../data/mockRemuneration.js";

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

export default function CompareScreen({ dataset, directorType }) {
  const directors = useMemo(() => allDirectors(dataset).filter((director) => director.type === directorType), [dataset, directorType]);
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState([]);
  const [metric, setMetric] = useState("totalCompensation");
  const [chartType, setChartType] = useState("Bar");
  const [logScale, setLogScale] = useState(false);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || chips.length >= maxChips) return [];

    const selectedIds = new Set(chips.map(chipId));
    const companyMatches = dataset
      .filter((company) => matchesQuery(company.company, trimmed))
      .map((company) => ({ type: "company", id: company.id, label: company.company, company: company.company, index: company.index }))
      .filter((item) => !selectedIds.has(chipId(item)));

    const individualMatches = directors
      .filter((director) => matchesQuery(director.name, trimmed) || matchesQuery(director.company, trimmed))
      .map((director) => ({ type: "individual", id: director.id, label: director.name, company: director.company, companyId: director.companyId, role: director.role }))
      .filter((item) => !selectedIds.has(chipId(item)));

    return [...companyMatches, ...individualMatches].slice(0, 8);
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
    }
    return rows.slice(0, maxChips);
  }, [chips, directors]);

  const canCompare = comparisonRows.length >= 2;

  const trendData = useMemo(() => {
    const years = [...new Set(comparisonRows.flatMap((director) => director.yearsAvailable))].sort();
    return years.map((year) => {
      const point = { year };
      comparisonRows.forEach((director) => {
        point[director.name] = director.years[String(year)]?.[metric] ?? null;
      });
      return point;
    });
  }, [comparisonRows, metric]);

  const orientingText = useMemo(() => {
    if (!comparisonRows.length) return "Add at least two companies or individuals to begin comparing.";
    const names = comparisonRows.map((row) => `${row.name} (${row.company})`).join(" vs ");
    return `Comparing ${metricLabel(metric)} · ${names}`;
  }, [comparisonRows, metric]);

  const analysisData = useMemo(() => (canCompare ? { directorType, metric, chartType, logScale, comparisonRows } : null), [canCompare, chartType, comparisonRows, directorType, logScale, metric]);

  const addChip = (item) => {
    if (chips.length >= maxChips) return;
    const id = chipId(item);
    if (chips.some((chip) => chipId(chip) === id)) return;
    setChips((current) => [...current, item]);
    setQuery("");
  };

  const removeChip = (item) => {
    setChips((current) => current.filter((chip) => chipId(chip) !== chipId(item)));
  };

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader>Add Comparison</SectionHeader>
        <div className="relative mt-3 max-w-[520px]">
          <input
            className="remi-input"
            placeholder="Add a company or individual to compare"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={chips.length >= maxChips}
          />
          {searchResults.length ? (
            <div className="remi-autocomplete-list">
              {searchResults.map((item) => (
                <button key={chipId(item)} className="remi-autocomplete-item" onClick={() => addChip(item)}>
                  <span>{item.label}</span>
                  <span className="remi-result-tag">{item.type === "company" ? "Company" : "Individual"}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {chips.length >= maxChips ? <p className="mt-2 text-xs text-remi-gold-light">Maximum 6 — remove one to add another</p> : null}
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span key={chipId(chip)} className="remi-chip">
            {chip.type === "individual" ? `${chip.label} · ${chip.company}` : chip.label}
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
          <p className="mb-4 text-sm text-remi-text-secondary">{orientingText}</p>

          <div className="h-[440px]">
            {canCompare ? (
              <>
                {chartType === "Bar" ? <BarComparison data={comparisonRows} metric={metric} /> : null}
                {chartType === "Line/Trend" ? <LineComparison data={trendData} rows={comparisonRows} metric={metric} /> : null}
                {chartType === "Bubble" ? <BubbleComparison data={comparisonRows} metric={metric} logScale={logScale} /> : null}
                {chartType === "Table" ? <ComparisonTable data={comparisonRows} metric={metric} /> : null}
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

function ChartTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-remi-border bg-remi-secondary p-3 text-xs text-remi-text">
      <div className="remi-data text-remi-gold-light">{label}</div>
      {payload.map((entry) => {
        const currency = entry.payload?.currency || entry.payload?.[`${entry.dataKey}Currency`];
        const value = entry.dataKey === "marketCap" ? formatCompactMarketCap(entry.value, currency) : formatChartValue(entry.value, currency, metric);
        return (
          <div key={entry.name} className="mt-1">
            {entry.name}: <DataValue>{value}</DataValue>
          </div>
        );
      })}
    </div>
  );
}

function BarComparison({ data, metric }) {
  const chartData = data.map((row, index) => ({
    name: row.name.split(" ").slice(-1)[0],
    value: row[metric] ?? 0,
    currency: row.currency,
    fill: palette[index % palette.length]
  }));
  const axisCurrency = chartCurrency(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="name" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ fill: "rgba(200,150,12,0.08)" }} />
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
  if (value == null || !row) return null;
  return (
    <text x={x + width / 2} y={y - 8} fill="#8CA8C0" fontSize={11} textAnchor="middle" className="remi-data">
      {formatChartValue(value, row.currency, metric)}
    </text>
  );
}

function LineComparison({ data, rows, metric }) {
  const axisCurrency = chartCurrency(rows);
  const lineData = data.map((point) => {
    const nextPoint = { ...point };
    rows.forEach((row) => {
      nextPoint[`${row.name}Currency`] = row.currency;
    });
    return nextPoint;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={lineData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid stroke="rgba(74,98,120,0.16)" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <Tooltip content={<ChartTooltip metric={metric} />} />
        {rows.map((row, index) => (
          <Line key={row.id} type="monotone" dataKey={row.name} stroke={palette[index % palette.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={`${row.name} ${metric}`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BubbleComparison({ data, metric, logScale }) {
  const chartData = data.map((row, index) => ({
    name: row.name,
    currency: row.currency,
    marketCap: row.marketCap,
    pay: Math.max(Number(row[metric] ?? row.totalCompensation ?? 0), 1),
    vote: row.sayOnPayPct ?? 50,
    fill: palette[index % palette.length]
  }));
  const axisCurrency = chartCurrency(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="marketCap" name="Market cap" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactMarketCap(value, axisCurrency)} />
        <YAxis dataKey="pay" name="Pay" scale={logScale ? "log" : "auto"} domain={logScale ? [1, "dataMax"] : [0, "auto"]} tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartValue(value, axisCurrency, metric)} />
        <ZAxis dataKey="vote" range={[120, 900]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip metric={metric} />} />
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
              <td className="px-3 py-3">{row.name}</td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.company}</td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.index}</td>
              <td className="px-3 py-3 text-remi-text-secondary">{row.sector}</td>
              <td className="px-3 py-3">
                <DataValue className="text-remi-gold-light">{metric.includes("Pct") || metric === "payRatio" ? row[metric] ?? "n/a" : formatMoney(row[metric], row.currency)}</DataValue>
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
