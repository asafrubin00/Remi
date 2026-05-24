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
    id: "microsoft",
    company: "Microsoft Corporation",
    index: "SP500",
    sector: "Technology",
    marketCap: 3150000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: [
      {
        id: "satya-nadella",
        name: "Satya Nadella",
        role: "Chairman and Chief Executive Officer",
        type: "executive",
        sourceUrl: "https://www.sec.gov/edgar/search/",
        years: {
          2025: { baseSalary: 2500000, annualBonus: 6400000, ltip: 42200000, pensionBenefits: 180000, totalCompensation: 51280000, payRatio: 408, sayOnPayPct: 95 },
          2024: { baseSalary: 2500000, annualBonus: 5200000, ltip: 35600000, pensionBenefits: 165000, totalCompensation: 43465000, payRatio: 356, sayOnPayPct: 96 },
          2023: { baseSalary: 2500000, annualBonus: 4100000, ltip: 33000000, pensionBenefits: 150000, totalCompensation: 39750000, payRatio: 321, sayOnPayPct: 94 }
        }
      },
      {
        id: "amy-hood",
        name: "Amy Hood",
        role: "Chief Financial Officer",
        type: "executive",
        sourceUrl: "https://www.sec.gov/edgar/search/",
        years: {
          2025: { baseSalary: 1150000, annualBonus: 3300000, ltip: 16800000, pensionBenefits: 95000, totalCompensation: 21345000, payRatio: 170, sayOnPayPct: 95 },
          2024: { baseSalary: 1100000, annualBonus: 2800000, ltip: 14100000, pensionBenefits: 87000, totalCompensation: 18087000, payRatio: 148, sayOnPayPct: 96 }
        }
      },
      {
        id: "sandra-peterson",
        name: "Sandra Peterson",
        role: "Lead Independent Director",
        type: "non-executive",
        sourceUrl: "https://www.sec.gov/edgar/search/",
        years: {
          2025: { nedFees: 420000, totalCompensation: 420000, payRatio: null, sayOnPayPct: 95 },
          2024: { nedFees: 405000, totalCompensation: 405000, payRatio: null, sayOnPayPct: 96 }
        }
      }
    ]
  },
  {
    id: "jpmorgan",
    company: "JPMorgan Chase & Co.",
    index: "SP500",
    sector: "Financial Services",
    marketCap: 560000,
    currency: "USD",
    fxRate: "GBP/USD 1.27",
    directors: [
      {
        id: "jamie-dimon",
        name: "Jamie Dimon",
        role: "Chairman and Chief Executive Officer",
        type: "executive",
        sourceUrl: "https://www.sec.gov/edgar/search/",
        years: {
          2025: { baseSalary: 1500000, annualBonus: 5200000, ltip: 29600000, pensionBenefits: 250000, totalCompensation: 36550000, payRatio: 320, sayOnPayPct: 89 },
          2024: { baseSalary: 1500000, annualBonus: 4700000, ltip: 27400000, pensionBenefits: 240000, totalCompensation: 33840000, payRatio: 301, sayOnPayPct: 87 }
        }
      },
      {
        id: "linda-bammann",
        name: "Linda Bammann",
        role: "Lead Independent Director",
        type: "non-executive",
        sourceUrl: "https://www.sec.gov/edgar/search/",
        years: {
          2025: { nedFees: 430000, totalCompensation: 430000, payRatio: null, sayOnPayPct: 89 },
          2024: { nedFees: 410000, totalCompensation: 410000, payRatio: null, sayOnPayPct: 87 }
        }
      }
    ]
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

export function allDirectors() {
  return companies.flatMap((company) =>
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
