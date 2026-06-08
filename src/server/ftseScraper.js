import pdfParse from "pdf-parse/lib/pdf-parse.js";

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
  shell: { id: "shell", company: "Shell plc", index: "FTSE100", sector: "Energy", marketCap: 172000, companyNumber: "04366849" },
  hsbc: { id: "hsbc", company: "HSBC Holdings plc", index: "FTSE100", sector: "Financial Services", marketCap: 142000, companyNumber: "00617987" },
  barclays: { id: "barclays", company: "Barclays PLC", index: "FTSE100", sector: "Financial Services", marketCap: 32000, companyNumber: "00048839" },
  "lloyds-banking-group": { id: "lloyds-banking-group", company: "Lloyds Banking Group plc", index: "FTSE100", sector: "Financial Services", marketCap: 41000, companyNumber: "SC095000" },
  tesco: { id: "tesco", company: "Tesco PLC", index: "FTSE100", sector: "Consumer Staples", marketCap: 22000, companyNumber: "00445790" },
  unilever: { id: "unilever", company: "Unilever PLC", index: "FTSE100", sector: "Consumer Staples", marketCap: 118000, companyNumber: "00041424" },
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

  const cacheKey = `remi:ftse:${slugify(query)}`;
  if (!options.skipCache) {
    const cached = await getCached(cacheKey);
    if (cached) return cached;
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

    const result = {
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
    };

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
  const res = await fetch(filing.url, {
    headers: filing.requiresCompaniesHouseAuth ? companiesHouseHeaders("application/pdf,*/*") : webHeaders("application/pdf,text/html,*/*", filing.pageUrl)
  });
  if (!res.ok) throw new Error(`Annual report request failed ${res.status} for ${filing.url}`);

  const contentType = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (contentType.includes("pdf") || filing.url.toLowerCase().includes(".pdf")) return extractPdfText(buffer);

  return cleanText(buffer.toString("utf8"));
}

async function extractPdfText(buffer) {
  const result = await pdfParse(buffer);
  return cleanText(result.text || "");
}

function parseDirectorsRemuneration(text, company, sourceUrl) {
  const warnings = [];
  const section = remunerationSection(text);
  const table = parseSingleFigureTable(section, company, sourceUrl);
  if (table.directors.length) return { ...table, warnings };

  warnings.push(table.warning || `Single figure executive remuneration table not parsed for ${company.company}.`);
  console.error("[scrape-ftse] " + warnings[0], { company: company.company, sample: section.slice(0, 1500) });
  return { directors: [], warnings };
}

function remunerationSection(text) {
  const starts = [
    /single figure table\s*[-–]\s*executive directors/i,
    /single total figure.*executive directors/i,
    /directors['’] remuneration report/i,
    /remuneration report/i
  ];
  for (const pattern of starts) {
    const match = text.match(pattern);
    if (match?.index != null) return text.slice(match.index, match.index + 80000);
  }
  return text.slice(Math.floor(text.length * 0.45), Math.floor(text.length * 0.85));
}

function parseSingleFigureTable(section, company, sourceUrl) {
  const salaryMatch = section.match(/\bSalary\b/i);
  if (!salaryMatch) return { directors: [], warning: "Salary row not found in remuneration section." };

  const headerLines = section
    .slice(0, salaryMatch.index)
    .split(/\n+/)
    .map(cleanCell)
    .filter(Boolean);
  const columns = parseExecutiveColumns(headerLines);
  if (!columns.length) return { directors: [], warning: "Executive columns not parsed before salary row." };

  const rowsText = section.slice(salaryMatch.index, salaryMatch.index + 4000);
  const salary = extractMoneyRow(rowsText, "Salary", columns.length);
  const benefits = extractMoneyRow(rowsText, "Benefits", columns.length);
  const pension = extractMoneyRow(rowsText, "Cash allowance in lieu of pension|Pension|Pension allowance", columns.length);
  const bonus = extractMoneyRow(rowsText, "Annual bonus|Bonus", columns.length);
  const ltip = extractMoneyRow(rowsText, "Performance shares|LTIP|PSP|Long-term incentive", columns.length);
  const total = extractMoneyRow(rowsText, "Total remuneration|Total single figure|Total", columns.length);

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
      baseSalary: valueAt(salary, index),
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

function parseExecutiveColumns(lines) {
  const columns = [];
  let pendingName = [];

  for (const rawLine of lines) {
    const line = cleanCell(rawLine);
    if (!line || /single figure|audited|executive directors/i.test(line)) continue;

    const year = parseYear(line);
    if (year && pendingName.length) {
      columns.push({ name: normalizePersonName(pendingName.join(" ")), year, unit: /thousand/i.test(pendingName.join(" ")) ? "thousand" : "thousand" });
      pendingName = [];
      continue;
    }

    if (/^(£|\\$)?\s*thousand|000|audited$/i.test(line)) continue;
    if (/^(salary|benefits|bonus|pension|total)/i.test(line)) break;
    if (/^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,4}[a-z]?$/.test(line)) pendingName.push(line);
  }

  return columns.filter((column) => column.name.split(" ").length >= 2);
}

function extractMoneyRow(text, labelPattern, expectedCount) {
  const pattern = new RegExp(`(?:${labelPattern})\\b`, "i");
  const match = pattern.exec(text);
  if (!match) return [];
  const nextPattern = /\b(Salary|Benefits|Cash allowance in lieu of pension|Pension|Annual bonus|Bonus|Performance shares|LTIP|PSP|Long-term incentive|Total remuneration|Total fixed remuneration|Total variable remuneration)\b/gi;
  nextPattern.lastIndex = match.index + match[0].length;
  const next = nextPattern.exec(text);
  const rowText = text.slice(match.index + match[0].length, next?.index || match.index + 600);
  return [...rowText.matchAll(/£?\(?\d[\d,.]*\)?/g)].slice(0, expectedCount).map((item) => parseMoney(item[0]));
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

function webHeaders(accept, referer = null) {
  return {
    "User-Agent": USER_AGENT,
    Accept: accept,
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
  return {
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
  };
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
  const amount = parsed < 10000 ? parsed * 1000 : parsed;
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
