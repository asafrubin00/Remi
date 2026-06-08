import { enrichGovernanceData } from "./governanceData.js";
import { getVerifiedFtseRecord } from "./manualVerifiedFtse.js";

const now = "2026-05-24T08:00:00.000Z";

const baseCompanies = [
  {
    id: "bp",
    company: "BP plc",
    index: "FTSE100",
    sector: "Energy",
    marketCap: 76000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "shell",
    company: "Shell plc",
    index: "FTSE100",
    sector: "Energy",
    marketCap: 172000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "hsbc",
    company: "HSBC Holdings plc",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 142000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "barclays",
    company: "Barclays PLC",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 32000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "lloyds-banking-group",
    company: "Lloyds Banking Group plc",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 41000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "tesco",
    company: "Tesco PLC",
    index: "FTSE100",
    sector: "Consumer Staples",
    marketCap: 22000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "unilever",
    company: "Unilever PLC",
    index: "FTSE100",
    sector: "Consumer Staples",
    marketCap: 118000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "gsk",
    company: "GSK plc",
    index: "FTSE100",
    sector: "Healthcare",
    marketCap: 67000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "astrazeneca",
    company: "AstraZeneca PLC",
    index: "FTSE100",
    sector: "Healthcare",
    marketCap: 190000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "rio-tinto",
    company: "Rio Tinto plc",
    index: "FTSE100",
    sector: "Basic Materials",
    marketCap: 83000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "marks-spencer",
    company: "Marks and Spencer Group plc",
    index: "FTSE100",
    sector: "Consumer Discretionary",
    marketCap: 8000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "vodafone",
    company: "Vodafone Group Plc",
    index: "FTSE100",
    sector: "Telecommunications",
    marketCap: 19000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "bt-group",
    company: "BT Group plc",
    index: "FTSE100",
    sector: "Telecommunications",
    marketCap: 18000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "rolls-royce",
    company: "Rolls-Royce Holdings plc",
    index: "FTSE100",
    sector: "Industrials",
    marketCap: 39000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "national-grid",
    company: "National Grid plc",
    index: "FTSE100",
    sector: "Utilities",
    marketCap: 51000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "apple",
    company: "Apple Inc.",
    ticker: "AAPL",
    index: "SP500",
    sector: "Technology",
    marketCap: 2900000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "microsoft",
    company: "Microsoft Corporation",
    ticker: "MSFT",
    index: "SP500",
    sector: "Technology",
    marketCap: 3150000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "jpmorgan",
    company: "JPMorgan Chase & Co.",
    ticker: "JPM",
    index: "SP500",
    sector: "Financial Services",
    marketCap: 560000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "goldman-sachs",
    company: "Goldman Sachs Group, Inc.",
    ticker: "GS",
    index: "SP500",
    sector: "Financial Services",
    marketCap: 160000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "exxonmobil",
    company: "Exxon Mobil Corporation",
    ticker: "XOM",
    index: "SP500",
    sector: "Energy",
    marketCap: 470000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "johnson-johnson",
    company: "Johnson & Johnson",
    ticker: "JNJ",
    index: "SP500",
    sector: "Healthcare",
    marketCap: 390000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "amazon",
    company: "Amazon.com, Inc.",
    ticker: "AMZN",
    index: "SP500",
    sector: "Consumer Discretionary",
    marketCap: 1900000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "tesla",
    company: "Tesla, Inc.",
    ticker: "TSLA",
    index: "SP500",
    sector: "Consumer Discretionary",
    marketCap: 800000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  },
  {
    id: "alphabet",
    company: "Alphabet Inc.",
    ticker: "GOOGL",
    index: "SP500",
    sector: "Communication Services",
    marketCap: 2100000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: []
  }
];

export const companies = baseCompanies.map((company) => enrichGovernanceData(getVerifiedFtseRecord(company.id) || company));

export function allDirectors(dataset = companies) {
  return dataset.flatMap((company) =>
    company.directors.map((director) => ({
      ...director,
      companyId: company.id,
      company: company.company,
      index: company.index,
      sector: company.sector,
      currency: company.currency,
      marketCap: company.marketCap,
      fxRate: company.fxRate,
      lastUpdated: director.lastUpdated || company.lastUpdated || now
    })),
  );
}

export function flattenDirectorYear(director, year = null) {
  const years = Object.keys(director.years).sort((a, b) => Number(b) - Number(a));
  const selectedYear = String(year || years[0]);
  return {
    ...director,
    reportingYear: Number(selectedYear),
    yearsAvailable: years.map(Number),
    ...director.years[selectedYear]
  };
}

export function formatMoney(value, currency) {
  if (value == null) return "n/a";
  const symbol = currency === "USD" ? "$" : "£";
  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}m`;
  return `${symbol}${Math.round(value / 1000).toLocaleString()}k`;
}

export function formatCompactMoney(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "MIXED" ? "£/$" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    const millions = value / 1000000;
    return `${symbol}${millions >= 10 ? millions.toFixed(1) : millions.toFixed(2)}m`;
  }
  if (absolute >= 1000) return `${symbol}${Math.round(value / 1000).toLocaleString()}k`;
  return `${symbol}${value.toLocaleString()}`;
}

export function formatCompactMarketCap(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "MIXED" ? "£/$" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}tn`;
  if (absolute >= 1000) return `${symbol}${(value / 1000).toFixed(1)}bn`;
  return `${symbol}${value.toLocaleString()}m`;
}
