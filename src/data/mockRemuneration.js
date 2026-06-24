import { enrichGovernanceData } from "./governanceData.js";
import { getVerifiedFtseRecord } from "./manualVerifiedFtse.js";
import { ftse100Constituents, sp500Constituents } from "./constituents.generated.js";

const now = "2026-05-24T08:00:00.000Z";

const baseCompanies = [
  {
    id: "bp",
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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
    eagerHydrate: true,
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

function normaliseConstituentId(item) {
  const ftseTickerIds = {
    AZN: "astrazeneca",
    BARC: "barclays",
    BP: "bp",
    BTA: "bt-group",
    GSK: "gsk",
    HSBA: "hsbc",
    LLOY: "lloyds-banking-group",
    MKS: "marks-spencer",
    NG: "national-grid",
    RIO: "rio-tinto",
    RR: "rolls-royce",
    SHEL: "shell",
    TSCO: "tesco",
    ULVR: "unilever",
    VOD: "vodafone"
  };
  const spTickerIds = {
    AAPL: "apple",
    AMZN: "amazon",
    GOOGL: "alphabet",
    GS: "goldman-sachs",
    JNJ: "johnson-johnson",
    JPM: "jpmorgan",
    MSFT: "microsoft",
    TSLA: "tesla",
    XOM: "exxonmobil"
  };
  if (item.index === "FTSE100" && ftseTickerIds[item.ticker]) return ftseTickerIds[item.ticker];
  if (item.index === "SP500" && spTickerIds[item.ticker]) return spTickerIds[item.ticker];
  if (item.ticker === "GOOGL") return "alphabet";
  if (item.ticker === "BRK-B") return "berkshire-hathaway";
  return item.id;
}

function constituentToCompany(item) {
  return {
    id: normaliseConstituentId(item),
    company: item.company,
    ticker: item.ticker,
    cik: item.cik || null,
    index: item.index,
    sector: item.sector || "Unknown",
    marketCap: null,
    currency: item.currency,
    fxRate: "GBP/USD 1.27",
    eagerHydrate: false,
    directors: [],
    scrape: {
      status: "placeholder",
      source: item.source,
      message: "Constituent placeholder; scrape on demand."
    }
  };
}

const constituentCompanies = [...ftse100Constituents, ...sp500Constituents].map(constituentToCompany);
const companiesById = new Map();
for (const company of constituentCompanies) companiesById.set(company.id, company);
for (const company of baseCompanies) companiesById.set(company.id, { ...companiesById.get(company.id), ...company });

export const companies = [...companiesById.values()].map((company) => {
  const verified = getVerifiedFtseRecord(company.id);
  return enrichGovernanceData(verified ? { ...company, ...verified, ticker: company.ticker } : company);
});

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
      dataSource: director.source || company.scrape?.source || company.scrape?.status || "unknown",
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
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}m`;
  return `${symbol}${Math.round(value / 1000).toLocaleString()}k`;
}

export function formatCompactMoney(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "MIXED" ? "£/$" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    const millions = value / 1000000;
    return `${symbol}${millions >= 10 ? millions.toFixed(1) : millions.toFixed(2)}m`;
  }
  if (absolute >= 1000) return `${symbol}${Math.round(value / 1000).toLocaleString()}k`;
  return `${symbol}${value.toLocaleString()}`;
}

export function formatVintageDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCompactMarketCap(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "MIXED" ? "£/$" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}tn`;
  if (absolute >= 1000) return `${symbol}${(value / 1000).toFixed(1)}bn`;
  return `${symbol}${value.toLocaleString()}m`;
}
