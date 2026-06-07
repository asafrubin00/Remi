const now = "2026-05-24T08:00:00.000Z";

export const companies = [
  {
    id: "bp",
    company: "BP plc",
    index: "FTSE100",
    sector: "Energy",
    marketCap: 76000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: [
      {
        id: "murray-auchincloss",
        name: "Murray Auchincloss",
        role: "Chief Executive Officer",
        type: "executive",
        sourceUrl: "https://www.bp.com/en/global/corporate/investors/results-and-reporting/annual-report.html",
        years: {
          2025: { baseSalary: 1500000, annualBonus: 1750000, ltip: 3100000, pensionBenefits: 280000, totalCompensation: 6630000, payRatio: 118, sayOnPayPct: 91 },
          2024: { baseSalary: 1450000, annualBonus: 1200000, ltip: 2600000, pensionBenefits: 260000, totalCompensation: 5510000, payRatio: 103, sayOnPayPct: 88 },
          2023: { baseSalary: 1350000, annualBonus: 950000, ltip: 2100000, pensionBenefits: 235000, totalCompensation: 4635000, payRatio: 91, sayOnPayPct: 93 }
        }
      },
      {
        id: "kate-thomson",
        name: "Kate Thomson",
        role: "Chief Financial Officer",
        type: "executive",
        sourceUrl: "https://www.bp.com/en/global/corporate/investors/results-and-reporting/annual-report.html",
        years: {
          2025: { baseSalary: 980000, annualBonus: 1020000, ltip: 1850000, pensionBenefits: 155000, totalCompensation: 4005000, payRatio: 71, sayOnPayPct: 91 },
          2024: { baseSalary: 940000, annualBonus: 840000, ltip: 1420000, pensionBenefits: 146000, totalCompensation: 3346000, payRatio: 64, sayOnPayPct: 88 }
        }
      },
      {
        id: "helge-lund",
        name: "Helge Lund",
        role: "Chair",
        type: "non-executive",
        sourceUrl: "https://www.bp.com/en/global/corporate/investors/results-and-reporting/annual-report.html",
        years: {
          2025: { nedFees: 790000, totalCompensation: 790000, payRatio: null, sayOnPayPct: 91 },
          2024: { nedFees: 755000, totalCompensation: 755000, payRatio: null, sayOnPayPct: 88 }
        }
      }
    ]
  },
  {
    id: "hsbc",
    company: "HSBC Holdings plc",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 142000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: [
      {
        id: "georges-elhedery",
        name: "Georges Elhedery",
        role: "Group Chief Executive",
        type: "executive",
        sourceUrl: "https://www.hsbc.com/investors/results-and-announcements/annual-report",
        years: {
          2025: { baseSalary: 1600000, annualBonus: 2850000, ltip: 4200000, pensionBenefits: 310000, totalCompensation: 8960000, payRatio: 154, sayOnPayPct: 86 },
          2024: { baseSalary: 1500000, annualBonus: 2100000, ltip: 3300000, pensionBenefits: 290000, totalCompensation: 7190000, payRatio: 132, sayOnPayPct: 84 }
        }
      },
      {
        id: "mark-tucker",
        name: "Mark Tucker",
        role: "Group Chair",
        type: "non-executive",
        sourceUrl: "https://www.hsbc.com/investors/results-and-announcements/annual-report",
        years: {
          2025: { nedFees: 1500000, totalCompensation: 1500000, payRatio: null, sayOnPayPct: 86 },
          2024: { nedFees: 1450000, totalCompensation: 1450000, payRatio: null, sayOnPayPct: 84 }
        }
      }
    ]
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
  },
  {
    id: "tesco",
    company: "Tesco PLC",
    index: "FTSE100",
    sector: "Consumer Staples",
    marketCap: 22000,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: [
      {
        id: "ken-murphy",
        name: "Ken Murphy",
        role: "Group Chief Executive",
        type: "executive",
        sourceUrl: "https://www.tescoplc.com/investors/reports-results-and-presentations/annual-report/",
        years: {
          2025: { baseSalary: 1420000, annualBonus: 2100000, ltip: 2300000, pensionBenefits: 120000, totalCompensation: 5940000, payRatio: 305, sayOnPayPct: 79 },
          2024: { baseSalary: 1360000, annualBonus: 1800000, ltip: 1900000, pensionBenefits: 115000, totalCompensation: 5175000, payRatio: 286, sayOnPayPct: 83 }
        }
      },
      {
        id: "gerry-murphy",
        name: "Gerry Murphy",
        role: "Chair",
        type: "non-executive",
        sourceUrl: "https://www.tescoplc.com/investors/reports-results-and-presentations/annual-report/",
        years: {
          2025: { nedFees: 695000, totalCompensation: 695000, payRatio: null, sayOnPayPct: 79 },
          2024: { nedFees: 670000, totalCompensation: 670000, payRatio: null, sayOnPayPct: 83 }
        }
      }
    ]
  }
];

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
      lastUpdated: now
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
