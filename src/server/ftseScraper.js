import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { enrichGovernanceData } from "../data/governanceData.js";
import { getVerifiedFtseRecord } from "../data/manualVerifiedFtse.js";

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const USER_AGENT =
  process.env.FTSE_SCRAPER_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Remi remuneration dashboard";

const ftseMetadata = {
  bp: {
    id: "bp",
    company: "BP plc",
    index: "FTSE100",
    sector: "Energy",
    marketCap: 76000,
    companyNumber: "00102498",
    annualReportUrl:
      "https://www.bp.com/content/dam/bp/business-sites/en/global/corporate/pdfs/investors/bp-annual-report-and-form-20f-2024.pdf?dm_i=1PGC%2C8VK6J%2C46ED6U%2C10Z50K%2C1",
    annualReportPageUrl: "https://www.bp.com/en/global/corporate/investors/results-reporting-and-presentations/annual-report.html"
  },
  shell: {
    id: "shell",
    company: "Shell plc",
    index: "FTSE100",
    sector: "Energy",
    marketCap: 172000,
    companyNumber: "04366849",
    annualReportUrl:
      "https://www.shell.com/investors/results-and-reporting/annual-report-archive/_jcr_content/root/main/section_812377294/tabs/tab_copy/text.multi.stream/1752580693041/6c20b8111738b9a590ba145f0d1c4fa0e530dae0/shell-annual-report-2024.pdf",
    annualReportPageUrl: "https://www.shell.com/investors/results-and-reporting/annual-report-archive.html"
  },
  hsbc: {
    id: "hsbc",
    company: "HSBC Holdings plc",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 142000,
    companyNumber: "00617987",
    annualReportUrl: "https://www.hsbc.com/-/files/hsbc/investors/hsbc-results/2024/annual/pdfs/hsbc-holdings-plc/250219-annual-report-and-accounts-2024.pdf"
  },
  barclays: {
    id: "barclays",
    company: "Barclays PLC",
    index: "FTSE100",
    sector: "Financial Services",
    marketCap: 32000,
    companyNumber: "00048839",
    annualReportUrl: "https://home.barclays/content/dam/home-barclays/documents/investor-relations/reports-and-events/annual-reports/2024/Barclays-PLC-Annual-Report-2024.pdf",
    annualReportPageUrl: "https://home.barclays/investor-relations/reports-and-events/annual-reports/"
  },
  "lloyds-banking-group": { id: "lloyds-banking-group", company: "Lloyds Banking Group plc", index: "FTSE100", sector: "Financial Services", marketCap: 41000, companyNumber: "SC095000" },
  tesco: {
    id: "tesco",
    company: "Tesco PLC",
    index: "FTSE100",
    sector: "Consumer Staples",
    marketCap: 22000,
    companyNumber: "00445790",
    annualReportUrl: "https://www.tescoplc.com/media/zgvhd0dn/tescos_ar24.pdf",
    annualReportPageUrl: "https://www.tescoplc.com/investors/reports-results-and-presentations/annual-report-2024"
  },
  unilever: {
    id: "unilever",
    company: "Unilever PLC",
    index: "FTSE100",
    sector: "Consumer Staples",
    marketCap: 118000,
    companyNumber: "00041424",
    annualReportUrl: "https://r.jina.ai/https://www.unilever.com/files/unilever-directors-remuneration-report-2024.pdf",
    annualReportPageUrl: "https://www.unilever.com/investors/annual-report-and-accounts/?navids=tcm%3A244-50544-4%2Ctcm%3A244-51648-4"
  },
  gsk: { id: "gsk", company: "GSK plc", index: "FTSE100", sector: "Healthcare", marketCap: 67000, companyNumber: "03888792" },
  astrazeneca: { id: "astrazeneca", company: "AstraZeneca PLC", index: "FTSE100", sector: "Healthcare", marketCap: 190000, companyNumber: "02723534" },
  "rio-tinto": { id: "rio-tinto", company: "Rio Tinto plc", index: "FTSE100", sector: "Basic Materials", marketCap: 83000, companyNumber: "00719885" },
  "marks-spencer": { id: "marks-spencer", company: "Marks and Spencer Group plc", index: "FTSE100", sector: "Consumer Discretionary", marketCap: 8000, companyNumber: "04256886" },
  vodafone: { id: "vodafone", company: "Vodafone Group Plc", index: "FTSE100", sector: "Telecommunications", marketCap: 19000, companyNumber: "01833679" },
  "bt-group": { id: "bt-group", company: "BT Group plc", index: "FTSE100", sector: "Telecommunications", marketCap: 18000, companyNumber: "04190816" },
  "rolls-royce": { id: "rolls-royce", company: "Rolls-Royce Holdings plc", index: "FTSE100", sector: "Industrials", marketCap: 39000, companyNumber: "04706930" },
  "national-grid": { id: "national-grid", company: "National Grid plc", index: "FTSE100", sector: "Utilities", marketCap: 51000, companyNumber: "04031152" }
};

const companyAliases = {
  "bp plc": "bp",
  bp: "bp",
  shell: "shell",
  "shell plc": "shell",
  hsbc: "hsbc",
  "hsbc holdings": "hsbc",
  barclays: "barclays",
  "lloyds banking group": "lloyds-banking-group",
  lloyds: "lloyds-banking-group",
  tesco: "tesco",
  unilever: "unilever",
  gsk: "gsk",
  glaxosmithkline: "gsk",
  astrazeneca: "astrazeneca",
  "rio tinto": "rio-tinto",
  "marks and spencer": "marks-spencer",
  "marks & spencer": "marks-spencer",
  vodafone: "vodafone",
  "bt group": "bt-group",
  bt: "bt-group",
  "rolls royce": "rolls-royce",
  "rolls-royce": "rolls-royce",
  "national grid": "national-grid"
};

export async function scrapeFtseCompany(input, options = {}) {
  const query = String(input || "").trim();
  if (!query) return errorResult(query, "Missing company query.");

  const verifiedRecord = getVerifiedFtseRecord(query);
  if (verifiedRecord) return enrichGovernanceData(verifiedRecord);

  const cacheKey = `remi:ftse:${slugify(query)}`;
  if (!options.skipCache) {
    const cached = await getCached(cacheKey);
    if (cached) return enrichGovernanceData(cached);
  }

  try {
    const company = await resolveCompany(query);
    if (!company) return errorResult(query, `No FTSE company match found for "${query}".`);

    const filing = await findAnnualReport(company);
    if (!filing?.url) {
      return fallbackResult(company, "Annual report PDF not found through Companies House or configured investor relations fallback.", {
        companiesHouse: filing?.companiesHouse || null
      });
    }

    const text = await extractReportText(filing);
    if (!text || text.length < 1000) {
      return fallbackResult(company, `Annual report text extraction returned insufficient text from ${filing.url}.`, { filing });
    }

    const remuneration = parseDirectorsRemuneration(text, company, filing.url);
    const payRatio = parsePayRatio(text, company);
    const sayOnPayPct = parseSayOnPayPct(text, company);
    const primaryCeoId = findPrimaryCeoId(remuneration.directors);

    const directors = remuneration.directors.map((director) => ({
      ...director,
      payRatio: director.id === primaryCeoId ? payRatio : null,
      sayOnPayPct,
      years: Object.fromEntries(
        Object.entries(director.years).map(([year, record]) => [
          year,
          {
            ...record,
            payRatio: director.id === primaryCeoId ? payRatio : null,
            sayOnPayPct
          }
        ]),
      ),
      sourceUrl: filing.url,
      lastUpdated: new Date().toISOString()
    }));

    const warnings = [
      ...remuneration.warnings,
      ...(payRatio == null ? ["CEO pay ratio not parsed from annual report."] : []),
      ...(sayOnPayPct == null ? ["Say-on-pay vote result not parsed from annual report or AGM text."] : [])
    ];

    const result = enrichGovernanceData({
      id: company.id,
      company: company.company,
      companyNumber: company.companyNumber || filing.companyNumber || null,
      index: company.index || "FTSE350",
      sector: company.sector || "Unknown",
      marketCap: company.marketCap || null,
      currency: "GBP",
      fxRate: "GBP/USD 1.27",
      directors,
      scrape: {
        status: directors.length ? "live" : "fallback",
        jurisdiction: "UK",
        source: filing.source,
        filingDate: filing.filingDate || null,
        filingUrl: filing.url,
        parseWarnings: warnings
      },
      cacheTtlHours: 24,
      lastUpdated: new Date().toISOString()
    });

    await setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[scrape-ftse] Company scrape failed", { query, error });
    return errorResult(query, error.message || "FTSE scrape failed.");
  }
}

export async function scrapeFtseBatch(inputs) {
  const queries = [...new Set((inputs || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const results = new Array(queries.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queries.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index > 0) await sleep(500 * index);
      results[index] = await scrapeFtseCompany(queries[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(10, queries.length) }, () => worker()));
  return results;
}

export async function debugFtseCompany(input) {
  const query = String(input || "").trim();
  if (!query) return { error: "Missing company query." };

  const company = await resolveCompany(query);
  if (!company) return { error: `No FTSE company match found for "${query}".` };

  const filing = await findAnnualReport(company);
  if (!filing?.url) {
    return {
      company: company.company,
      scrape: { status: "fallback", message: "Annual report PDF not found.", filing }
    };
  }

  try {
    const text = await extractReportText(filing);
    const section = remunerationSection(text || "");
    return {
      company: company.company,
      companyNumber: company.companyNumber || null,
      filing,
      textLength: text.length,
      first5000: text.slice(0, 5000),
      remunerationSectionStart: section.slice(0, 5000)
    };
  } catch (error) {
    console.error("[scrape-ftse] Debug extraction failed", { query, company: company.company, filing, error });
    return {
      company: company.company,
      filing,
      error: error.message || "Debug extraction failed."
    };
  }
}

async function resolveCompany(query) {
  const normalized = normalize(query);
  const metadata = ftseMetadata[companyAliases[normalized] || slugify(query)];
  const companiesHouse = await lookupCompaniesHouse(query);
  const selected = metadata || buildMetadataFromCompaniesHouse(companiesHouse, query);
  if (!selected) return null;

  return {
    ...selected,
    companyNumber: companiesHouse?.company_number || selected.companyNumber || null,
    companiesHouse
  };
}

async function lookupCompaniesHouse(companyName) {
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    console.warn("[scrape-ftse] COMPANIES_HOUSE_API_KEY is missing; Companies House lookup and filing history will be skipped.");
    return null;
  }

  const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`;
  const data = await companiesHouseFetch(url);
  const items = data.items || [];
  return (
    items.find((item) => /plc|public limited company/i.test(item.company_type || item.title || "")) ||
    items.find((item) => /plc/i.test(item.title || "")) ||
    items[0] ||
    null
  );
}

function buildMetadataFromCompaniesHouse(hit, query) {
  if (!hit) return null;
  return {
    id: slugify(hit.title || query),
    company: hit.title || query,
    index: "FTSE350",
    sector: "Unknown",
    marketCap: null,
    companyNumber: hit.company_number
  };
}

async function findAnnualReport(company) {
  if (company.annualReportUrl) {
    return {
      source: "Investor relations annual report PDF",
      url: company.annualReportUrl,
      pageUrl: company.annualReportPageUrl || null,
      filingDate: null,
      companyNumber: company.companyNumber || null
    };
  }

  const fromCompaniesHouse = await findCompaniesHouseAnnualReport(company);
  if (fromCompaniesHouse) return fromCompaniesHouse;

  if (company.annualReportPageUrl) {
    const discovered = await discoverPdfFromInvestorPage(company.annualReportPageUrl);
    if (discovered) {
      return {
        source: "Investor relations annual report PDF",
        url: discovered,
        pageUrl: company.annualReportPageUrl,
        filingDate: null,
        companyNumber: company.companyNumber || null
      };
    }
  }

  return { companiesHouse: company.companiesHouse || null };
}

async function findCompaniesHouseAnnualReport(company) {
  if (!process.env.COMPANIES_HOUSE_API_KEY || !company.companyNumber) return null;

  try {
    const history = await companiesHouseFetch(
      `https://api.company-information.service.gov.uk/company/${company.companyNumber}/filing-history?category=accounts&items_per_page=25`,
    );
    const filing = (history.items || []).find((item) => {
      const text = `${item.description || ""} ${item.description_values?.made_up_date || ""}`;
      return /accounts|annual/i.test(text) && item.links?.document_metadata;
    });
    if (!filing?.links?.document_metadata) return null;

    const metadata = await companiesHouseFetch(filing.links.document_metadata);
    const pdfUrl = metadata.links?.document || `${filing.links.document_metadata}/content`;
    return {
      source: "Companies House filing history",
      url: pdfUrl,
      filingDate: filing.date || null,
      companyNumber: company.companyNumber,
      requiresCompaniesHouseAuth: true
    };
  } catch (error) {
    console.error("[scrape-ftse] Companies House filing lookup failed", { company: company.company, companyNumber: company.companyNumber, error });
    return null;
  }
}

async function discoverPdfFromInvestorPage(pageUrl) {
  try {
    const res = await fetch(pageUrl, { headers: webHeaders("text/html,*/*") });
    if (!res.ok) throw new Error(`Investor page request failed ${res.status}`);
    const html = await res.text();
    const pdfs = [...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)].map((match) => new URL(match[1], pageUrl).toString());
    return pdfs.find((url) => /annual|report|remuneration/i.test(url)) || pdfs[0] || null;
  } catch (error) {
    console.error("[scrape-ftse] Investor page PDF discovery failed", { pageUrl, error });
    return null;
  }
}

async function extractReportText(filing) {
  const headers = filing.url.includes("sec.gov")
    ? secHeaders("text/html,application/xhtml+xml,*/*")
    : filing.requiresCompaniesHouseAuth
      ? companiesHouseHeaders("application/pdf,*/*")
      : webHeaders("application/pdf,text/html,*/*", filing.pageUrl);
  const res = await fetch(filing.url, {
    headers
  });
  if (!res.ok) throw new Error(`Annual report request failed ${res.status} for ${filing.url}`);

  const contentType = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (contentType.includes("pdf") || (filing.url.toLowerCase().includes(".pdf") && !filing.url.includes("r.jina.ai/"))) return extractPdfText(buffer);

  return cleanHtmlText(buffer.toString("utf8"));
}

async function extractPdfText(buffer) {
  const result = await pdfParse(buffer);
  return cleanText(result.text || "");
}

function parseDirectorsRemuneration(text, company, sourceUrl) {
  const warnings = [];
  const section = remunerationSection(text);
  const table = parseSingleFigureTable(section, company, sourceUrl);
  if (table.directors.length) {
    console.error("[scrape-ftse] Remuneration parser matched", { company: company.company, strategy: table.strategy, directors: table.directors.length, diagnostics: table.diagnostics });
    return { ...table, warnings };
  }

  warnings.push(table.warning || `Single figure executive remuneration table not parsed for ${company.company}.`);
  console.error("[scrape-ftse] " + warnings[0], { company: company.company, diagnostics: table.diagnostics, sample: section.slice(0, 1500) });
  return { directors: [], warnings };
}

function remunerationSection(text) {
  const patterns = [
    /single total figure(?:\s+for\s+\d{4}\s+remuneration|\s+of\s+remuneration)?/gi,
    /single figure(?:\s+of\s+total|\s+of)?\s+remuneration/gi,
    /single figure table\s*[-–]\s*executive directors/gi,
    /total remuneration outcomes/gi,
    /annual report on directors['’] remuneration/gi,
    /annual report on remuneration/gi,
    /directors['’] remuneration report/gi
  ];

  let best = null;
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const start = Math.max(0, match.index - 800);
      const section = text.slice(start, start + 90000);
      const score = scoreRemunerationSection(section, match.index);
      if (!best || score > best.score) best = { section, score, pattern: pattern.source, index: match.index };
    }
  }
  if (best?.score > 0) return best.section;
  return text.slice(Math.floor(text.length * 0.45), Math.floor(text.length * 0.85));
}

function scoreRemunerationSection(section, index) {
  let score = 0;
  if (/single total figure|single figure/i.test(section.slice(0, 2500))) score += 8;
  if (/executive directors?/i.test(section.slice(0, 3000))) score += 5;
  if (/salary|fixed pay|base salary/i.test(section.slice(0, 5000))) score += 4;
  if (/base salary\s*\d|salaries\s*(?:\[[A-Z]\])?\s*\d|fixed pay\s*(?:\||\n|\s)*\d/i.test(section.slice(0, 5000))) score += 10;
  if (/the following table shows/i.test(section.slice(0, 5000))) score += 4;
  if (/C\.S\.\s*Venkatakrishnan\s*20\d{2}|Wael Sawan|Sir Noel Quinn|Hein Schumacher|Ken Murphy/i.test(section.slice(0, 5000))) score += 6;
  if (/annual bonus|annual incentive/i.test(section.slice(0, 5000))) score += 4;
  if (/LTIP|PSP|long-term incentive|performance shares/i.test(section.slice(0, 5000))) score += 4;
  if (/total remuneration|total fixed and variable|total fixed pay/i.test(section.slice(0, 5000))) score += 4;
  if (/summary remuneration outcomes|at a glance/i.test(section.slice(0, 1200))) score -= 5;
  if (/contents|financial statements|supplementary information/i.test(section.slice(0, 1000))) score -= 6;
  if (index < 20000) score -= 4;
  return score;
}

function parseSingleFigureTable(section, company, sourceUrl) {
  const strategies = [
    ["barclays-compact-single-figure", parseBarclaysCompactSingleFigure],
    ["unilever-compact-single-figure", parseUnileverCompactSingleFigure],
    ["named-row-single-figure", parseNamedRowSingleFigure],
    ["column-single-figure", parseColumnSingleFigure]
  ];
  const diagnostics = [];

  for (const [strategy, parser] of strategies) {
    const result = parser(section, company, sourceUrl);
    diagnostics.push({ strategy, directors: result.directors.length, warning: result.warning || null });
    if (result.directors.length) return { ...result, strategy, diagnostics };
  }

  return { directors: [], warning: "No single figure parser strategy matched.", diagnostics };
}

function parseColumnSingleFigure(section, company, sourceUrl) {
  const salaryMatch = section.match(/\b(Salary|Salaries|Base salary|Fixed pay|Total fixed pay)\b/i);
  if (!salaryMatch) return { directors: [], warning: "Salary/fixed-pay row not found in remuneration section." };

  const headerText = section.slice(0, salaryMatch.index);
  const headerLines = headerText.split(/\n+/).map(cleanCell).filter(Boolean);
  const columns = parseExecutiveColumns(headerLines, headerText);
  if (!columns.length) return { directors: [], warning: "Executive columns not parsed before salary/fixed-pay row." };

  const rowsText = section.slice(salaryMatch.index, salaryMatch.index + 4000);
  const salary = extractMoneyRow(rowsText, "Salary|Salaries|Base salary|Total fixed pay|Fixed Pay", columns.length);
  const fixedPay = extractMoneyRow(rowsText, "Total fixed pay|Fixed pay & benefits subtotal", columns.length);
  const benefits = extractMoneyRow(rowsText, "Benefits|Taxable benefits|Other benefits", columns.length);
  const pension = extractMoneyRow(rowsText, "Cash allowance in lieu of pension|Pension|Pension allowance", columns.length);
  const bonus = extractMoneyRow(rowsText, "Annual bonus|Bonus|Annual incentive", columns.length);
  const ltip = extractMoneyRow(rowsText, "Performance shares|LTIP|PSP|Long-term incentive|Long-term incentive", columns.length);
  const total = extractMoneyRow(rowsText, "Total remuneration|Total Remuneration|Total fixed and variable pay|Total fixed and variable", columns.length);

  const directorsById = new Map();
  columns.forEach((column, index) => {
    const id = slugify(column.name);
    const existing = directorsById.get(id) || {
      id,
      name: column.name,
      role: inferRole(section, column.name, index),
      type: "executive",
      sourceUrl,
      years: {}
    };
    existing.years[column.year] = {
      baseSalary: valueAt(salary, index) ?? valueAt(fixedPay, index),
      annualBonus: valueAt(bonus, index),
      ltip: valueAt(ltip, index),
      pensionBenefits: sumNullable(valueAt(benefits, index), valueAt(pension, index)),
      totalCompensation: valueAt(total, index),
      payRatio: null,
      sayOnPayPct: null
    };
    directorsById.set(id, existing);
  });

  return { directors: [...directorsById.values()] };
}

function parseNamedRowSingleFigure(section, company, sourceUrl) {
  const rowPattern = /((?:C\.S\.\s*)?[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})(20\d{2})([0-9,£\s—_]+?)(?=(?:[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4}20\d{2})|Note:|Additional information|Strategic\s+report|$)/g;
  const directorsById = new Map();

  for (const match of section.matchAll(rowPattern)) {
    const name = normalizePersonName(match[1]);
    if (!isLikelyExecutiveName(name)) continue;
    const values = extractLooseNumbers(match[3], 10);
    if (values.length < 4) continue;

    const id = slugify(name);
    const existing = directorsById.get(id) || {
      id,
      name,
      role: inferRole(section, name, directorsById.size),
      type: "executive",
      sourceUrl,
      years: {}
    };
    const ltip = sumNullable(values[5], values[6], values[7]);
    existing.years[Number(match[2])] = {
      baseSalary: values[0] ?? null,
      annualBonus: values[4] ?? null,
      ltip,
      pensionBenefits: sumNullable(values[1], values[2]),
      totalCompensation: values[9] ?? values[values.length - 1] ?? null,
      payRatio: null,
      sayOnPayPct: null
    };
    directorsById.set(id, existing);
  }

  return { directors: [...directorsById.values()] };
}

function parseBarclaysCompactSingleFigure(section, company, sourceUrl) {
  if (!/Barclays/i.test(company.company) && !/single total figure for 2024 remuneration/i.test(section)) return { directors: [], warning: "Not a Barclays-style compact single-figure section." };
  const rows = [
    {
      name: "C.S. Venkatakrishnan",
      role: "Group Chief Executive",
      pattern: /C\.S\.\s*Venkatakrishnan2024(\d,\d{3})(\d{3})(\d{2})(\d,\d{3})(\d,\d{3})(\d,\d{3})(\d,\d{3})(\d,\d{3})(\d,\d{3})\s+(\d{2},\d{3})/
    },
    {
      name: "Anna Cross",
      role: "Group Finance Director",
      pattern: /Anna Cross2024(\d,\d{3})(\d{2})(\d{2})(\d,\d{3})(\d,\d{3})_+(\d,\d{3})(\d,\d{3})/
    }
  ];

  const directors = [];
  for (const row of rows) {
    const match = section.match(row.pattern);
    if (!match) continue;
    const values = match.slice(1).map((item) => parseMoney(item));
    const isCeo = row.name.startsWith("C.S.");
    const record = isCeo
      ? {
          baseSalary: values[0],
          annualBonus: values[4],
          ltip: values[7],
          pensionBenefits: sumNullable(values[1], values[2]),
          totalCompensation: values[9]
        }
      : {
          baseSalary: values[0],
          annualBonus: values[4],
          ltip: null,
          pensionBenefits: sumNullable(values[1], values[2]),
          totalCompensation: values[6]
        };
    directors.push({
      id: slugify(row.name),
      name: row.name,
      role: row.role,
      type: "executive",
      sourceUrl,
      years: {
        2024: {
          ...record,
          payRatio: null,
          sayOnPayPct: null
        }
      }
    });
  }

  return { directors };
}

function parseUnileverCompactSingleFigure(section, company, sourceUrl) {
  if (!/Unilever/i.test(company.company) || !/Hein Schumacher CEO/i.test(section) || !/Fernando Fernandez CFO/i.test(section)) {
    return { directors: [], warning: "Not a Unilever-style compact single-figure section." };
  }

  const tableText = section.slice(section.indexOf("Hein Schumacher CEO"), section.indexOf("Total Remuneration") + 160);
  const fixedPay = unileverMoneyRow(tableText, "\\(A\\) Total fixed pay");
  const benefits = unileverMoneyRow(tableText, "\\(B\\) Other benefits");
  const bonus = unileverMoneyRow(tableText, "\\(C\\) Annual bonus");
  const psp = unileverMoneyRow(tableText, "\\(D\\) PSP");
  const total = unileverMoneyRow(tableText, "Total Remuneration \\(A\\+B\\+C\\+D\\)");

  if (!fixedPay.length || !bonus.length || !total.length) {
    return { directors: [], warning: "Unilever compact rows not parsed." };
  }

  const columns = [
    { name: "Hein Schumacher", role: "Chief Executive Officer", index: 0 },
    { name: "Fernando Fernandez", role: "Chief Financial Officer", index: 2 }
  ];

  return {
    directors: columns.map((column) => ({
      id: slugify(column.name),
      name: column.name,
      role: column.role,
      type: "executive",
      sourceUrl,
      years: {
        2024: {
          baseSalary: valueAt(fixedPay, column.index),
          annualBonus: valueAt(bonus, column.index),
          ltip: valueAt(psp, column.index),
          pensionBenefits: valueAt(benefits, column.index),
          totalCompensation: valueAt(total, column.index),
          payRatio: null,
          sayOnPayPct: null
        }
      }
    }))
  };
}

function unileverMoneyRow(text, labelPattern) {
  const label = new RegExp(labelPattern, "i").exec(text);
  if (!label) return [];

  const remainder = text.slice(label.index + label[0].length);
  const next = /\n\s*(?:\([A-Z]\)\s+(?![a-e]\))|Fixed pay & benefits|Variable Remuneration|Total Remuneration|\(a\)\s+Hein)/i.exec(remainder);
  const rowText = remainder
    .slice(0, next?.index ?? 260)
    .replace(/\([a-e]\)/gi, " ")
    .replace(/\d+\.\d%/g, " ");
  const looseValues = extractLooseNumbers(rowText, 3);
  if (looseValues.length >= 3) return looseValues;

  const compactValue = rowText.match(/([0-9,]{3,})/)?.[1] || "";

  if (/^00\d,\d{3}$/.test(compactValue)) return [0, 0, parseMoney(compactValue.slice(2))];
  if (/^\d,\d{3}\d,\d{3}\d,\d{3}$/.test(compactValue)) {
    return [compactValue.slice(0, 5), compactValue.slice(5, 10), compactValue.slice(10)].map(parseMoney);
  }
  if (/^\d{3}\d{3}\d{3}$/.test(compactValue)) {
    return [compactValue.slice(0, 3), compactValue.slice(3, 6), compactValue.slice(6)].map(parseMoney);
  }
  return looseValues;
}

function parseExecutiveColumns(lines, headerText = "") {
  const inlineColumns = parseInlineExecutiveColumns(headerText);
  if (inlineColumns.length) return inlineColumns;

  const columns = [];
  let pendingName = [];

  for (const rawLine of lines) {
    const line = cleanCell(rawLine);
    if (!line || /single figure|audited|executive directors/i.test(line)) continue;

    const inlineNames = extractInlineNames(line);
    if (inlineNames.length >= 2) {
      pendingName = inlineNames;
      continue;
    }

    const year = parseYear(line);
    if (year && pendingName.length) {
      const years = extractYears(line);
      const usableYears = years.length ? years : [year];
      const names = pendingName.map(normalizePersonName).filter(isLikelyExecutiveName);
      if (names.length > 1 && usableYears.length >= names.length) {
        const yearsPerName = Math.max(1, Math.floor(usableYears.length / names.length));
        names.forEach((name, nameIndex) => {
          usableYears.slice(nameIndex * yearsPerName, (nameIndex + 1) * yearsPerName).forEach((columnYear) => {
            columns.push({ name, year: columnYear, unit: "thousand" });
          });
        });
      } else {
        columns.push({ name: normalizePersonName(pendingName.join(" ")), year, unit: "thousand" });
      }
      pendingName = [];
      continue;
    }

    if (/^(£|\\$|€)?\s*(thousand|000|'000)|audited$/i.test(line)) continue;
    if (/^(salary|benefits|bonus|pension|total)/i.test(line)) break;
    if (/^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,4}[a-z]?$/.test(line)) pendingName.push(line);
  }

  return columns.filter((column) => column.name.split(" ").length >= 2);
}

function parseInlineExecutiveColumns(headerText) {
  const lines = headerText.split(/\n+/).map(cleanCell).filter(Boolean);
  let names = [];
  let nameLineIndex = -1;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const inlineNames = extractInlineNames(lines[index]);
    if (inlineNames.length >= 2) {
      names = inlineNames;
      nameLineIndex = index;
      break;
    }
  }
  if (!names.length) return [];

  const afterNames = lines.slice(nameLineIndex + 1).join(" ");
  const years = extractYears(afterNames);
  if (!years.length) return [];

  const yearsPerName = Math.max(1, Math.floor(years.length / names.length));
  const columns = [];
  names.forEach((name, nameIndex) => {
    const nameYears = years.slice(nameIndex * yearsPerName, (nameIndex + 1) * yearsPerName);
    const usableYears = nameYears.length ? nameYears : [years[Math.min(nameIndex, years.length - 1)]];
    usableYears.forEach((year) => columns.push({ name, year, unit: "thousand" }));
  });
  return columns;
}

function extractMoneyRow(text, labelPattern, expectedCount) {
  const pattern = new RegExp(`(?:${labelPattern})\\b`, "i");
  const match = pattern.exec(text);
  if (!match) return [];
  const nextPattern = /\b(Salary|Benefits|Cash allowance in lieu of pension|Pension|Annual bonus|Bonus|Performance shares|LTIP|PSP|Long-term incentive|Total remuneration|Total fixed remuneration|Total variable remuneration)\b/gi;
  nextPattern.lastIndex = match.index + match[0].length;
  const next = nextPattern.exec(text);
  const rowText = text.slice(match.index + match[0].length, next?.index || match.index + 600);
  return extractLooseNumbers(rowText, expectedCount);
}

function extractLooseNumbers(value, expectedCount) {
  const text = String(value || "")
    .replace(/[_—–-]+/g, " 0 ")
    .replace(/(\d{1,3},\d{3})(?=\d)/g, "$1 ");
  const tokens = [];
  for (const match of text.matchAll(/£?\(?\d[\d,.]*\)?/g)) {
    const raw = match[0];
    if (tokens.length >= expectedCount) break;
    if (/^\d{5,}$/.test(raw.replace(/[£,()]/g, ""))) {
      const remaining = expectedCount - tokens.length;
      tokens.push(...splitCompactNumberRun(raw.replace(/[£,()]/g, ""), remaining).map((item) => parseMoney(item)));
    } else {
      tokens.push(parseMoney(raw));
    }
  }
  return tokens.slice(0, expectedCount);
}

function splitCompactNumberRun(value, expectedCount) {
  if (expectedCount <= 1) return [value];
  const groups = [];
  function backtrack(index, remaining, path) {
    if (remaining === 0 && index === value.length) {
      groups.push(path);
      return;
    }
    if (remaining <= 0) return false;
    const lengths = [3, 4, 2, 1].sort((a, b) => Math.abs(a - value.length / remaining) - Math.abs(b - value.length / remaining));
    for (const length of lengths) {
      if (index + length > value.length) continue;
      if (value.length - (index + length) < remaining - 1) continue;
      if (value.length - (index + length) > (remaining - 1) * 4) continue;
      const part = value.slice(index, index + length);
      if (part.length > 1 && part.startsWith("0")) continue;
      backtrack(index + length, remaining - 1, [...path, part]);
    }
  }
  backtrack(0, expectedCount, []);
  return groups.sort((a, b) => scoreNumberSplit(a) - scoreNumberSplit(b))[0] || [value];
}

function scoreNumberSplit(parts) {
  const lengths = parts.map((part) => part.length);
  const average = lengths.reduce((sum, item) => sum + item, 0) / lengths.length;
  const variance = lengths.reduce((sum, item) => sum + Math.abs(item - average), 0);
  const shortLastPenalty = lengths.at(-1) < 3 ? 3 : 0;
  return variance + shortLastPenalty;
}

function extractInlineNames(line) {
  const cleaned = line
    .replace(/\[[A-Z]\]/g, " ")
    .replace(/\([^)]*000[^)]*\)/gi, " ")
    .replace(/\b(CEO|CFO|Group Chief Executive|Group Finance Director|Chief Executive Officer|Chief Financial Officer)\b/g, " ")
    .replace(/\)(?=[A-Z])/g, ")|")
    .replace(/([a-z])([A-Z])/g, "$1|$2");
  const names = cleaned
    .split("|")
    .map(normalizePersonName)
    .filter(isLikelyExecutiveName);
  if (names.length === 1) {
    const words = names[0].split(/\s+/);
    if (words.length >= 4 && words.length % 2 === 0) {
      return Array.from({ length: words.length / 2 }, (_, index) => words.slice(index * 2, index * 2 + 2).join(" ")).filter(isLikelyExecutiveName);
    }
  }
  return names;
}

function extractYears(line) {
  const compact = String(line || "");
  const years = [...compact.matchAll(/20\d{2}/g)].map((match) => Number(match[0]));
  return years.length ? years : [];
}

function isLikelyExecutiveName(name) {
  if (!name || name.split(/\s+/).length < 2) return false;
  if (/Directors?|Executive|Report|Corporate|Governance|Financial|Strategic|Annual|Committee|Total|Shareholder|Fixed|Variable|Remuneration|Policy|Current|Proposed/i.test(name)) return false;
  return /^[A-Z]/.test(name);
}

function parsePayRatio(text, company) {
  const tableRows = [...text.matchAll(/\b(20\d{2})(?:\s*[a-z])?\s+Option\s+[A-Z]\s+(\d{1,4})\s*:\s*1\s*(\d{1,4})\s*:\s*1\s*(\d{1,4})\s*:\s*1/gi)];
  const latestTableRow = tableRows.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  if (latestTableRow) return Number(latestTableRow[3]);

  const matches = [...text.matchAll(/pay ratio/gi)];
  for (const match of matches.reverse()) {
    const section = text.slice(match.index, match.index + 3000);
    const medianMatch = section.match(/50th percentile[\s\S]{0,800}?(\d{1,4})\s*:\s*1/i);
    if (medianMatch) return Number(medianMatch[1]);
  }

  console.error("[scrape-ftse] CEO pay ratio parse failed", { company: company.company });
  return null;
}

function parseSayOnPayPct(text, company) {
  const sectionIndex = text.search(/remuneration report|directors'? remuneration|agm results|annual general meeting/i);
  const section = sectionIndex >= 0 ? text.slice(sectionIndex, sectionIndex + 120000) : text;
  const pctMatch = section.match(/(?:remuneration report|directors'? remuneration)[\s\S]{0,1500}?(\d{1,3}(?:\.\d+)?)%\s+(?:for|in favour)/i);
  if (pctMatch) return Number(Number(pctMatch[1]).toFixed(2));

  const votes = section.match(/for\s+against\s+(?:withheld|abstain|abstentions)?\s*([\d,]+)\s+([\d,]+)/i);
  if (votes) {
    const forVotes = parseNumber(votes[1]);
    const againstVotes = parseNumber(votes[2]);
    if (forVotes != null && againstVotes != null && forVotes + againstVotes > 0) {
      return Number(((forVotes / (forVotes + againstVotes)) * 100).toFixed(2));
    }
  }

  console.error("[scrape-ftse] Say-on-pay result not found", { company: company.company });
  return null;
}

function inferRole(section, name, index) {
  const escapedName = escapeRegExp(name).replace(/\s+/g, "\\s+");
  const nameRole = section.match(new RegExp(`${escapedName}\\s+((?:Group\\s+)?Chief\\s+(?:Executive|Financial)\\s+Officer|Chief\\s+Executive|Chief\\s+Financial\\s+Officer|CEO|CFO)`, "i"));
  if (nameRole) return cleanCell(nameRole[1]);
  if (index === 0) return "Chief Executive Officer";
  if (index === 1) return "Chief Financial Officer";
  return "Executive Director";
}

function findPrimaryCeoId(directors) {
  const chiefExecutive = directors.find((director) => /chief executive|group chief executive|\bCEO\b/i.test(director.role));
  return chiefExecutive?.id || directors[0]?.id || null;
}

async function companiesHouseFetch(url) {
  const res = await fetch(url, { headers: companiesHouseHeaders("application/json") });
  if (!res.ok) throw new Error(`Companies House request failed ${res.status} for ${url}`);
  return res.json();
}

function companiesHouseHeaders(accept) {
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    console.warn("[scrape-ftse] COMPANIES_HOUSE_API_KEY is missing; authenticated Companies House request cannot be made.");
  }
  const token = Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY || ""}:`).toString("base64");
  return { Authorization: `Basic ${token}`, Accept: accept, "User-Agent": USER_AGENT };
}

function secHeaders(accept) {
  return {
    "User-Agent": process.env.SEC_USER_AGENT || USER_AGENT,
    Accept: accept,
    "Accept-Language": "en-US,en;q=0.9"
  };
}

function webHeaders(accept, referer = null) {
  return {
    "User-Agent": USER_AGENT,
    Accept: accept,
    "Accept-Language": "en-GB,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": accept.includes("pdf") ? "document" : "empty",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Upgrade-Insecure-Requests": "1",
    ...(referer ? { Referer: referer } : {})
  };
}

async function getCached(key) {
  const client = await kvClient();
  if (!client) return null;
  try {
    return client.get(key);
  } catch (error) {
    console.error("[scrape-ftse] KV get failed", { key, error });
    return null;
  }
}

async function setCached(key, value) {
  const client = await kvClient();
  if (!client) return;
  try {
    await client.set(key, value, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error("[scrape-ftse] KV set failed", { key, error });
  }
}

async function kvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

function fallbackResult(company, message, extra = {}) {
  console.error("[scrape-ftse] " + message, { company: company.company, ...extra });
  return enrichGovernanceData({
    id: company.id,
    company: company.company,
    companyNumber: company.companyNumber || null,
    index: company.index || "FTSE350",
    sector: company.sector || "Unknown",
    marketCap: company.marketCap || null,
    currency: "GBP",
    fxRate: "GBP/USD 1.27",
    directors: [],
    scrape: {
      status: "fallback",
      jurisdiction: "UK",
      message,
      ...extra
    },
    cacheTtlHours: 24,
    lastUpdated: new Date().toISOString()
  });
}

function errorResult(query, message) {
  console.error("[scrape-ftse] " + message, { query });
  return {
    company: query || null,
    index: "FTSE350",
    currency: "GBP",
    directors: [],
    error: message,
    scrape: {
      status: "fallback",
      jurisdiction: "UK",
      message
    },
    lastUpdated: new Date().toISOString()
  };
}

function parseMoney(value) {
  if (!value || /—|-|n\/a/i.test(value)) return null;
  const negative = /^\(.*\)$/.test(String(value).trim());
  const parsed = Number(String(value).replace(/[£$,()\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const amount = parsed < 100000 ? parsed * 1000 : parsed;
  return negative ? -amount : amount;
}

function parseNumber(value) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[,()\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value) {
  const match = String(value || "").match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function valueAt(values, index) {
  return values[index] ?? null;
}

function sumNullable(...values) {
  const present = values.filter((value) => value != null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function normalizePersonName(value) {
  return cleanCell(value)
    .replace(/\bthousand\b/gi, "")
    .replace(/\b(20\d{2})\b/g, "")
    .split(" ")
    .map((token) => token.replace(/^([A-Z][A-Za-z'.-]{5,})([bcdfghjklpqvwxz])$/, "$1"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCell(value) {
  return String(value || "")
    .replace(/[\u200b\u200c\u200d]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u200b\u200c\u200d]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[’]/g, "'")
    .trim();
}

function cleanHtmlText(value) {
  return cleanText(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(?:div|p|tr|li|h[1-6]|table|section)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&pound;/gi, "£")
      .replace(/&euro;/gi, "€")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
  );
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
