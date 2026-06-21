import * as cheerio from "cheerio";
import { enrichGovernanceData } from "../data/governanceData.js";

const SEC_USER_AGENT = process.env.SEC_USER_AGENT || "Remi remuneration dashboard contact@remi.local";
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const DATE_START = "2024-01-01";
const DATE_END = "2025-12-31";

const metadataByTicker = {
  AAPL: { id: "apple", company: "Apple Inc.", sector: "Technology", marketCap: 2900000 },
  MSFT: { id: "microsoft", company: "Microsoft Corporation", sector: "Technology", marketCap: 3150000 },
  JPM: { id: "jpmorgan", company: "JPMorgan Chase & Co.", sector: "Financial Services", marketCap: 560000 },
  GS: { id: "goldman-sachs", company: "Goldman Sachs Group, Inc.", sector: "Financial Services", marketCap: 160000 },
  XOM: { id: "exxonmobil", company: "Exxon Mobil Corporation", sector: "Energy", marketCap: 470000 },
  JNJ: { id: "johnson-johnson", company: "Johnson & Johnson", sector: "Healthcare", marketCap: 390000 },
  AMZN: { id: "amazon", company: "Amazon.com, Inc.", sector: "Consumer Discretionary", marketCap: 1900000 },
  TSLA: { id: "tesla", company: "Tesla, Inc.", sector: "Consumer Discretionary", marketCap: 800000 },
  GOOGL: { id: "alphabet", company: "Alphabet Inc.", sector: "Communication Services", marketCap: 2100000 },
  GOOG: { id: "alphabet", company: "Alphabet Inc.", sector: "Communication Services", marketCap: 2100000 }
};

const aliases = {
  exxonmobil: "XOM",
  "exxon mobil": "XOM",
  alphabet: "GOOGL",
  google: "GOOGL",
  jpmorgan: "JPM",
  "jpmorgan chase": "JPM",
  "goldman sachs": "GS",
  "johnson johnson": "JNJ"
};

export async function scrapeSp500Company(input, options = {}) {
  const query = String(input || "").trim();
  if (!query) return errorResult(query, "Missing company or ticker query.");

  const cacheKey = `remi:sp500:${query.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
  if (!options.skipCache) {
    const cached = await getCached(cacheKey);
    if (cached) return enrichGovernanceData(cached);
  }

  try {
    const company = await lookupCompany(query);
    if (!company) return errorResult(query, `No SEC company match found for "${query}".`);

    const submissions = await fetchSubmissions(company.cikPadded);
    const proxy = findLatestDef14a(submissions);
    if (!proxy) return errorResult(query, `No DEF 14A filing found for ${company.name} between ${DATE_START} and ${DATE_END}.`, company);

    const proxyHtml = await fetchSecDocument(company.cik, proxy);
    const compensation = parseSummaryCompensationTable(proxyHtml, company);
    const payRatio = parsePayRatio(proxyHtml, company);
    const sayOnPayPct = await parseLatestSayOnPayPct(submissions, company);
    const primaryCeoId = findPrimaryCeoId(compensation.directors);

    const directors = compensation.directors.map((director) => ({
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
      sourceUrl: proxy.url,
      lastUpdated: new Date().toISOString()
    }));

    const result = enrichGovernanceData({
      id: company.id,
      company: company.name,
      ticker: company.ticker,
      cik: company.cikPadded,
      index: "SP500",
      sector: company.sector,
      marketCap: company.marketCap,
      currency: "USD",
      fxRate: "GBP/USD 1.27",
      directors,
      scrape: {
        status: directors.length ? "live" : "partial",
        jurisdiction: "US",
        source: "SEC EDGAR",
        filingDate: proxy.filingDate,
        accessionNumber: proxy.accessionNumber,
        filingUrl: proxy.url,
        parseWarnings: [...compensation.warnings, ...(payRatio == null ? ["CEO pay ratio not parsed from DEF 14A."] : []), ...(sayOnPayPct == null ? ["Say-on-pay vote result not parsed from latest 8-K/DEF 14A."] : [])]
      },
      cacheTtlHours: 24,
      lastUpdated: new Date().toISOString()
    });

    await setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[scrape-sp500] Company scrape failed", { query, error });
    return errorResult(query, error.message || "S&P 500 scrape failed.");
  }
}

export async function scrapeSp500Batch(inputs) {
  const queries = [...new Set((inputs || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const results = new Array(queries.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queries.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index > 0) await sleep(500 * index);
      results[index] = await scrapeSp500Company(queries[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(10, queries.length) }, () => worker()));
  return results;
}

async function lookupCompany(query) {
  const tickers = await fetchCompanyTickers();
  const upper = query.toUpperCase();
  const normalizedQuery = normalize(query);
  const aliasTicker = aliases[normalizedQuery];

  const exactTicker = tickers.find((item) => item.ticker === upper || item.ticker === aliasTicker);
  const exactName = tickers.find((item) => normalize(item.name) === normalizedQuery);
  const fuzzyName = tickers.find((item) => normalize(item.name).includes(normalizedQuery) || normalizedQuery.includes(normalize(item.name)));
  const match = exactTicker || exactName || fuzzyName;
  if (!match) return null;

  const metadata = metadataByTicker[match.ticker] || {};
  return {
    id: metadata.id || slugify(match.name),
    name: metadata.company || match.name,
    ticker: match.ticker,
    cik: String(match.cik),
    cikPadded: String(match.cik).padStart(10, "0"),
    sector: metadata.sector || "Unknown",
    marketCap: metadata.marketCap || null
  };
}

async function fetchCompanyTickers() {
  const res = await secFetch("https://www.sec.gov/files/company_tickers_exchange.json");
  const data = await res.json();
  const columns = data.fields || [];
  return (data.data || []).map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

async function fetchSubmissions(cikPadded) {
  const res = await secFetch(`https://data.sec.gov/submissions/CIK${cikPadded}.json`);
  return res.json();
}

function findLatestDef14a(submissions) {
  const recent = submissions?.filings?.recent || {};
  const forms = recent.form || [];
  let latestOutsideWindow = null;
  for (let index = 0; index < forms.length; index += 1) {
    if (forms[index] !== "DEF 14A") continue;
    const filingDate = recent.filingDate?.[index];
    if (!latestOutsideWindow) latestOutsideWindow = buildFiling(submissions.cik, recent, index);
    if (filingDate < DATE_START || filingDate > DATE_END) continue;
    return buildFiling(submissions.cik, recent, index);
  }
  return latestOutsideWindow;
}

async function fetchSecDocument(cik, filing) {
  const res = await secFetch(filing.url);
  return res.text();
}

function buildFiling(cik, recent, index) {
  const accessionNumber = recent.accessionNumber[index];
  const accessionNoDashes = accessionNumber.replaceAll("-", "");
  const primaryDocument = recent.primaryDocument[index];
  const cikNoLeading = String(cik).replace(/^0+/, "");
  return {
    form: recent.form[index],
    filingDate: recent.filingDate[index],
    accessionNumber,
    primaryDocument,
    items: recent.items?.[index] || "",
    url: `https://www.sec.gov/Archives/edgar/data/${cikNoLeading}/${accessionNoDashes}/${primaryDocument}`
  };
}

function parseSummaryCompensationTable(html, company) {
  const $ = cheerio.load(html);
  const warnings = [];
  const candidate = findSummaryCompensationTable($);
  if (!candidate) {
    const warning = `Summary Compensation Table not found for ${company.name}.`;
    console.error("[scrape-sp500] " + warning);
    return { directors: [], warnings: [warning] };
  }

  const rows = candidate.rows;
  const headerIndex = rows.findIndex((row) => row.some((cell) => /salary/i.test(cell)) && row.some((cell) => /total/i.test(cell)) && row.some((cell) => /year/i.test(cell)));
  if (headerIndex < 0) {
    const warning = `Summary Compensation Table header not parsed for ${company.name}.`;
    console.error("[scrape-sp500] " + warning, { rows: rows.slice(0, 5) });
    return { directors: [], warnings: [warning] };
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const headerMap = {
    year: findHeader(headers, ["year"]),
    salary: findHeader(headers, ["salary"]),
    bonus: findHeader(headers, ["bonus"]),
    stockAwards: findHeader(headers, ["stock awards", "stock award", "stockawards"]),
    optionAwards: findHeader(headers, ["option awards", "option award", "optionawards"]),
    nonEquity: findHeader(headers, ["non-equity incentive", "non equity incentive", "non-equityincentive", "nonequityincentive", "incentive plan", "incentiveplan"]),
    allOther: findHeader(headers, ["all other", "all othercompensation", "allothercompensation"]),
    total: findHeader(headers, ["total"])
  };

  const directors = new Map();
  let currentPerson = null;

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.length) continue;
    const firstYear = parseYear(row[0]);
    const startsWithPerson = firstYear == null && row.some((cell) => parseYear(cell) != null);
    if (startsWithPerson) currentPerson = splitNameAndRole(row[0]);

    const shift = firstYear != null ? 1 : 0;
    const year = firstYear || parseYear(row[headerMap.year] || row[0]);
    if (!year || !currentPerson) continue;

    const record = {
      baseSalary: getMoney(row, headerMap.salary, shift),
      annualBonus: sumNullable(getMoney(row, headerMap.bonus, shift), getMoney(row, headerMap.nonEquity, shift)),
      ltip: sumNullable(getMoney(row, headerMap.stockAwards, shift), getMoney(row, headerMap.optionAwards, shift)),
      pensionBenefits: getMoney(row, headerMap.allOther, shift),
      totalCompensation: getMoney(row, headerMap.total, shift),
      payRatio: null,
      sayOnPayPct: null
    };
    normalizeCompensationScale(record, company, row);

    const id = slugify(currentPerson.name);
    const existing = directors.get(id) || {
      id,
      name: currentPerson.name,
      role: currentPerson.role,
      type: "executive",
      sourceUrl: null,
      years: {}
    };
    existing.years[year] = record;
    directors.set(id, existing);
  }

  if (!directors.size) {
    const warning = `No executive rows parsed from Summary Compensation Table for ${company.name}.`;
    console.error("[scrape-sp500] " + warning, { tableText: candidate.text.slice(0, 1000) });
    warnings.push(warning);
  }

  return { directors: [...directors.values()], warnings };
}

function normalizeCompensationScale(record, company, row) {
  const fields = ["baseSalary", "annualBonus", "ltip", "pensionBenefits", "totalCompensation"];
  for (const field of fields) {
    const value = record[field];
    if (value == null) continue;
    if (value > 1000000000 && value % 1000000 === 0) {
      record[field] = Math.round(value / 1000000);
      console.error("[scrape-sp500] Corrected million-scale compensation parse", { company: company.name, field, original: value, corrected: record[field], row });
    } else if (value > 1000000000) {
      record[field] = null;
      console.error("[scrape-sp500] Removed implausible compensation parse", { company: company.name, field, original: value, row });
    }
  }
}

function findSummaryCompensationTable($) {
  let best = null;
  $("table").each((index, element) => {
    const rows = tableRows($, element);
    const text = rows.flat().join(" ");
    const hasCompHeader = rows.some((row) => row.some((cell) => /salary/i.test(cell)) && row.some((cell) => /total/i.test(cell)) && row.some((cell) => /year/i.test(cell)));
    const hasNameHeader = rows.some((row) => row.some((cell) => /name|principal position|named executive/i.test(cell)) && row.some((cell) => /salary/i.test(cell)) && row.some((cell) => /year/i.test(cell)));
    let score = 0;
    if (/summary compensation table/i.test(text)) score += 3;
    if (hasCompHeader) score += 5;
    if (hasNameHeader) score += 6;
    if (hasCompHeader && !hasNameHeader) score -= 5;
    if (/salary/i.test(text)) score += 2;
    if (/stock\s*awards?/i.test(text)) score += 2;
    if (/total/i.test(text)) score += 1;
    if (/named executive|principal position/i.test(text)) score += 1;
    if (rows.length < 3) score -= 2;
    if (!best || score > best.score) best = { index, rows, text, score };
  });
  return best?.score >= 5 ? best : null;
}

function tableRows($, table) {
  const rows = [];
  $(table)
    .find("tr")
    .each((_, row) => {
      const cells = $(row)
        .find("td,th")
        .map((__, cell) => cleanText($(cell).text()))
        .get()
        .filter((cell) => cell && cell !== "$" && !isFootnoteOnlyCell(cell));
      if (cells.length) rows.push(cells);
    });
  return rows;
}

function isFootnoteOnlyCell(value) {
  return /^(?:\(\d+\)|\*+)+$/.test(cleanText(value));
}

function parsePayRatio(html, company) {
  const text = bodyText(html);
  const matches = [...text.matchAll(/CEO Pay Ratio|Pay Ratio Disclosure|pay ratio/gi)];
  for (const match of matches.reverse()) {
    const section = text.slice(Math.max(0, match.index), match.index + 2500);
    if (!/median employee|median compensated employee|median annual/i.test(section)) continue;

    const reversedRatio = section.match(/\b1\s*(?:-|to)\s*(?:to)?[-\s]*(\d{1,4})\b/i);
    if (reversedRatio) return Number(reversedRatio[1]);

    const ratioMatch = section.match(/(?:was|ratio of|ratio is|ratio)\s+(\d{1,4})\s*(?:to|:|-)\s*1/i) || section.match(/(\d{1,4})\s*(?:to|:|-)\s*1/i);
    if (ratioMatch) return Number(ratioMatch[1]);
  }

  console.error("[scrape-sp500] CEO pay ratio parse failed", { company: company.name });
  return null;
}

async function parseLatestSayOnPayPct(submissions, company) {
  const recent = submissions?.filings?.recent || {};
  const forms = recent.form || [];
  const candidates = [];

  for (let index = 0; index < forms.length; index += 1) {
    const form = forms[index];
    const filingDate = recent.filingDate?.[index];
    const items = recent.items?.[index] || "";
    if (filingDate < DATE_START || filingDate > "2026-12-31") continue;
    if (form === "8-K" && items.includes("5.07")) candidates.push(buildFiling(submissions.cik, recent, index));
  }

  for (const filing of candidates) {
    try {
      const html = await fetchSecDocument(company.cik, filing);
      const pct = parseSayOnPayFromVotingResults(html);
      if (pct != null) return pct;
    } catch (error) {
      console.error("[scrape-sp500] Say-on-pay filing parse failed", { company: company.name, filing: filing.url, error });
    }
  }

  console.error("[scrape-sp500] Say-on-pay result not found", { company: company.name, candidates: candidates.map((item) => item.url) });
  return null;
}

function parseSayOnPayFromVotingResults(html) {
  if (!html) return null;
  const $ = cheerio.load(html);
  const tables = [];
  $("table").each((index, element) => {
    const rows = tableRows($, element);
    const text = rows.flat().join(" ");
    const context = previousText($, element, 8);
    if (/vote result|votes for|% votes for|for\s+against\s+abstain/i.test(text)) tables.push({ index, rows, text, context });
  });

  for (const table of tables.filter((item) => /advisory vote to approve named executive officer compensation|say-on-pay/i.test(item.context))) {
    const pct = parseVoteTablePct(table);
    if (pct != null) return pct;
  }

  for (const table of tables.filter((item) => /executive compensation|say-on-pay/i.test(item.text))) {
    const pct = parseVoteTablePct(table);
    if (pct != null) return pct;
  }

  const text = $("body").text().replace(/\s+/g, " ");
  const proposalIndex = text.search(/advisory vote to approve named executive officer compensation|say-on-pay/i);
  const section = proposalIndex >= 0 ? text.slice(proposalIndex, proposalIndex + 1500) : text;
  const votes = section.match(/For\s+Against\s+Abstain(?:\s+Broker Non-Votes)?\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i);
  if (votes) {
    const forVotes = parseNumber(votes[1]);
    const againstVotes = parseNumber(votes[2]);
    if (forVotes != null && againstVotes != null && forVotes + againstVotes > 0) {
      return Number(((forVotes / (forVotes + againstVotes)) * 100).toFixed(2));
    }
  }

  return null;
}

function parseVoteTablePct(table) {
  for (const row of table.rows) {
    if (!row.some((cell) => /approved|not approved/i.test(cell))) continue;
    const pct = Number(row.find((cell) => /^\d{1,3}(?:\.\d+)?$/.test(cell)));
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) return Number(pct.toFixed(2));
  }

  return null;
}

function previousText($, element, limit) {
  const parts = [];
  let node = $(element).prev();
  for (let index = 0; index < limit && node.length; index += 1) {
    parts.unshift(cleanText(node.text()));
    node = node.prev();
  }
  return parts.join(" ");
}

function normalizeHeader(value) {
  return cleanText(value).toLowerCase().replace(/[0-9*]/g, "");
}

function findHeader(headers, needles) {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function getMoney(row, headerIndex, shift) {
  if (headerIndex < 0) return null;
  return parseMoney(row[headerIndex - shift]);
}

function parseMoney(value) {
  if (!value || /—|-|n\/a/i.test(value)) return null;
  const negative = /^\(.*\)$/.test(value.trim());
  const withoutFootnotes = value.replace(/\(\d+\)/g, "");
  if (!/\d/.test(withoutFootnotes)) return null;
  const parsed = Number(withoutFootnotes.replace(/[$,()\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
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

function sumNullable(...values) {
  const present = values.filter((value) => value != null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function splitNameAndRole(value) {
  const text = cleanText(value);
  const match = text.match(/(Chairman|EVP|SVP|CEO|CFO|Chief|Executive|Vice|President|Senior|Interim|General Counsel)\b/i);
  if (!match || match.index < 2) return { name: text, role: "Named Executive Officer" };
  return {
    name: cleanText(text.slice(0, match.index)),
    role: cleanText(text.slice(match.index))
  };
}

function findPrimaryCeoId(directors) {
  const chiefExecutive = directors.find((director) => /\bchief executive officer\b/i.test(director.role));
  if (chiefExecutive) return chiefExecutive.id;

  const ceoTitle = directors.find((director) => /\bCEO\b/i.test(director.role));
  return ceoTitle?.id || directors[0]?.id || null;
}

async function secFetch(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      Accept: "application/json,text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`SEC request failed ${res.status} for ${url}`);
  return res;
}

async function getCached(key) {
  const client = await kvClient();
  if (!client) return null;
  try {
    return client.get(key);
  } catch (error) {
    console.error("[scrape-sp500] KV get failed", { key, error });
    return null;
  }
}

async function setCached(key, value) {
  const client = await kvClient();
  if (!client) return;
  try {
    await client.set(key, value, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error("[scrape-sp500] KV set failed", { key, error });
  }
}

async function kvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

function errorResult(query, message, company = null) {
  console.error("[scrape-sp500] " + message, { query, company });
  return {
    company: company?.name || query || null,
    ticker: company?.ticker || null,
    cik: company?.cikPadded || null,
    index: "SP500",
    currency: "USD",
    directors: [],
    error: message,
    scrape: {
      status: "error",
      message
    },
    lastUpdated: new Date().toISOString()
  };
}

function bodyText(html) {
  return cheerio.load(html)("body").text().replace(/\s+/g, " ");
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u200b\u200c\u200d]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
