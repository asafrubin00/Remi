import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { allDirectors, flattenDirectorYear, formatMoney } from "../data/mockRemuneration.js";

const components = [
  ["totalCompensation", "Total Comp"],
  ["baseSalary", "Salary"],
  ["annualBonus", "Bonus"],
  ["ltip", "LTIP"],
  ["pensionBenefits", "Pension"],
  ["payRatio", "Pay Ratio"],
  ["sayOnPayPct", "Say-on-Pay"]
];

const chartTypes = ["Bar", "Line/Trend", "Bubble", "Table"];
const palette = ["#C8960C", "#3498DB", "#2ECC71", "#E74C3C", "#9B59B6"];

function toggleValue(list, value, max = 4) {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= max) return list;
  return [...list, value];
}

export default function CompareScreen({ dataset, directorType }) {
  const directors = useMemo(() => allDirectors(dataset).filter((director) => director.type === directorType), [dataset, directorType]);
  const [selectedIndices, setSelectedIndices] = useState(["FTSE100", "SP500"]);
  const [selectedCompanies, setSelectedCompanies] = useState(["bp", "microsoft"]);
  const [selectedIndividuals, setSelectedIndividuals] = useState([]);
  const [metric, setMetric] = useState("totalCompensation");
  const [chartType, setChartType] = useState("Bar");

  const comparisonRows = useMemo(() => {
    const scoped = directors.filter((director) => {
      const indexMatch = selectedIndices.length === 0 || selectedIndices.includes(director.index);
      const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(director.companyId);
      const individualMatch = selectedIndividuals.length === 0 || selectedIndividuals.includes(director.id);
      return indexMatch && (companyMatch || individualMatch);
    });
    return scoped.slice(0, 4).map((director) => flattenDirectorYear(director));
  }, [directors, selectedCompanies, selectedIndividuals, selectedIndices]);

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

  const analysisData = useMemo(() => ({ directorType, metric, chartType, comparisonRows }), [chartType, comparisonRows, directorType, metric]);

  return (
    <div className="space-y-4">
      <Panel className="grid grid-cols-3 gap-4 p-5">
        <SelectorPanel title="Index" values={["FTSE100", "FTSE250", "SP500"]} selected={selectedIndices} onToggle={(value) => setSelectedIndices(toggleValue(selectedIndices, value, 3))} />
        <SelectorPanel
          title="Company"
          values={dataset.map((company) => [company.id, company.company])}
          selected={selectedCompanies}
          onToggle={(value) => setSelectedCompanies(toggleValue(selectedCompanies, value))}
        />
        <SelectorPanel
          title="Individual"
          values={directors.map((director) => [director.id, director.name])}
          selected={selectedIndividuals}
          onToggle={(value) => setSelectedIndividuals(toggleValue(selectedIndividuals, value))}
        />
      </Panel>

      <div className="flex items-center gap-2">
        {components.map(([key, label]) => (
          <TabButton key={key} active={metric === key} onClick={() => setMetric(key)}>
            {label}
          </TabButton>
        ))}
      </div>

      <div className="grid grid-cols-[calc(80%-8px)_20%] gap-4">
        <Panel className="h-[560px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <SectionHeader>{components.find(([key]) => key === metric)?.[1]} Comparison</SectionHeader>
            <div className="flex gap-1 rounded-lg border border-remi-border bg-remi-navy p-1">
              {chartTypes.map((type) => (
                <TabButton key={type} active={chartType === type} className="px-3 py-1.5 text-[12px]" onClick={() => setChartType(type)}>
                  {type}
                </TabButton>
              ))}
            </div>
          </div>

          <div className="h-[470px]">
            {comparisonRows.length ? (
              <>
                {chartType === "Bar" ? <BarComparison data={comparisonRows} metric={metric} /> : null}
                {chartType === "Line/Trend" ? <LineComparison data={trendData} rows={comparisonRows} metric={metric} /> : null}
                {chartType === "Bubble" ? <BubbleComparison data={comparisonRows} metric={metric} /> : null}
                {chartType === "Table" ? <ComparisonTable data={comparisonRows} metric={metric} /> : null}
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-remi-border bg-remi-navy text-sm text-remi-text-secondary">
                No comparison records match the current selection.
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

function SelectorPanel({ title, values, selected, onToggle }) {
  return (
    <div className="remi-panel-inner p-4">
      <SectionHeader>{title} ↓</SectionHeader>
      <div className="mt-3 grid max-h-32 gap-2 overflow-y-auto pr-1">
        {values.map((value) => {
          const id = Array.isArray(value) ? value[0] : value;
          const label = Array.isArray(value) ? value[1] : value;
          return (
            <button
              key={id}
              className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                selected.includes(id) ? "border-remi-gold bg-remi-gold text-remi-navy" : "border-remi-border bg-remi-secondary text-remi-text-secondary hover:border-remi-gold"
              }`}
              onClick={() => onToggle(id)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-remi-border bg-remi-secondary p-3 text-xs text-remi-text">
      <div className="remi-data text-remi-gold-light">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1">
          {entry.name}: <DataValue>{Number(entry.value || 0).toLocaleString()}</DataValue>
        </div>
      ))}
    </div>
  );
}

function BarComparison({ data, metric }) {
  const chartData = data.map((row) => ({ name: row.name.split(" ").slice(-1)[0], value: row[metric] ?? 0, currency: row.currency }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="name" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(200,150,12,0.08)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={palette[index % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineComparison({ data, rows, metric }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid stroke="rgba(74,98,120,0.16)" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        {rows.map((row, index) => (
          <Line key={row.id} type="monotone" dataKey={row.name} stroke={palette[index % palette.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={`${row.name} ${metric}`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BubbleComparison({ data, metric }) {
  const chartData = data.map((row) => ({
    name: row.name,
    marketCap: row.marketCap,
    pay: row[metric] ?? row.totalCompensation,
    vote: row.sayOnPayPct ?? 50
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <XAxis dataKey="marketCap" name="Market cap" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis dataKey="pay" name="Pay" tick={{ fill: "#4A6278", fontSize: 12 }} axisLine={false} tickLine={false} />
        <ZAxis dataKey="vote" range={[120, 900]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip />} />
        <Scatter data={chartData} fill="#C8960C" />
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
