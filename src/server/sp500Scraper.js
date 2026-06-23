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
    const directorCompensation = extractDirectorCompensationTable(proxyHtml, company, proxy.filingDate);
    const payRatio = parsePayRatio(proxyHtml, company);
    const sayOnPayPct = await parseLatestSayOnPayPct(submissions, company);
    const primaryCeoId = findPrimaryCeoId(compensation.directors);

    const executiveDirectors = compensation.directors.map((director) => ({
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

    const nonExecutiveDirectors = directorCompensation.directors.map((director) => ({
      ...director,
      sourceUrl: proxy.url,
      lastUpdated: new Date().toISOString(),
      years: Object.fromEntries(
        Object.entries(director.years).map(([year, record]) => [
          year,
          {
            ...record,
            payRatio: null,
            sayOnPayPct: null,
            source: "SEC EDGAR",
            sourceUrl: proxy.url,
            lastUpdated: new Date().toISOString()
          }
        ]),
      )
    }));

    const directors = [...executiveDirectors, ...nonExecutiveDirectors];

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
        parseWarnings: [
          ...compensation.warnings,
          ...directorCompensation.warnings,
          ...(payRatio == null ? ["CEO pay ratio not parsed from DEF 14A."] : []),
          ...(sayOnPayPct == null ? ["Say-on-pay vote result not parsed from latest 8-K/DEF 14A."] : [])
        ]
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

export async function scrapeSp500Batch(inputs, options = {}) {
  const queries = [...new Set((inputs || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const results = new Array(queries.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queries.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index > 0) await sleep(500 * index);
      results[index] = await scrapeSp500Company(queries[index], options);
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
    const fallback = parseTextSummaryCompensationTable(html, company);
    if (fallback.directors.length) return fallback;
    const warning = `Summary Compensation Table not found for ${company.name}.`;
    console.error("[scrape-sp500] " + warning);
    return { directors: [], warnings: [warning] };
  }

  const rows = candidate.rows;
  const headerIndex = rows.findIndex((row) => row.some((cell) => /salary/i.test(cell)) && row.some((cell) => /total/i.test(cell)) && row.some((cell) => /year/i.test(cell)));
  if (headerIndex < 0) {
    const fallback = parseTextSummaryCompensationTable(html, company);
    if (fallback.directors.length) return fallback;
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
  let currentMaxYear = null;
  const pendingRowsForNextPerson = [];
  const diagnostics = {
    detected: [],
    parsed: [],
    dropped: []
  };

  const dataRows = rows.slice(headerIndex + 1);
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    if (!row.length) continue;
    const firstYear = parseYear(row[0]);
    const nextRow = dataRows[index + 1] || [];
    const nextStartsWithPerson = !/^20\d{2}$/.test(cleanText(nextRow[0])) && nextRow.some((cell) => parseYear(cell) != null) && isLikelySecPersonName(nextRow[0]);
    if (firstYear != null && nextStartsWithPerson && (!currentPerson || currentMaxYear == null || firstYear >= currentMaxYear)) {
      pendingRowsForNextPerson.push(row);
      continue;
    }

    const startsWithPerson = !/^20\d{2}$/.test(cleanText(row[0])) && row.some((cell) => parseYear(cell) != null) && isLikelySecPersonName(row[0]);
    if (startsWithPerson) {
      currentPerson = splitNameAndRole(row[0]);
      currentMaxYear = null;
      diagnostics.detected.push({ name: currentPerson.name, role: currentPerson.role, row });
      while (pendingRowsForNextPerson.length) {
        parseStructuredCompensationRow(pendingRowsForNextPerson.shift(), currentPerson);
      }
    }

    parseStructuredCompensationRow(row, currentPerson);
  }

  function parseStructuredCompensationRow(row, person) {
    const year = detectRowYear(row, headerMap.year);
    if (!year || !person) {
      diagnostics.dropped.push({ row, reason: !year ? "No reporting year found." : "No current NEO name attached to row." });
      return;
    }

    const record = parseStructuredCompensationValues(row, headerMap, year, company);
    normalizeCompensationScale(record, company, row);
    if (Object.values(record).every((value) => value == null)) {
      diagnostics.dropped.push({ name: person.name, year, row, reason: "Matched name/year but no compensation values parsed." });
    } else {
      diagnostics.parsed.push({ name: person.name, year, row });
    }

    const id = slugify(person.name);
    const existing = directors.get(id) || {
      id,
      name: person.name,
      role: person.role,
      type: "executive",
      sourceUrl: null,
      years: {}
    };
    existing.years[year] = record;
    directors.set(id, existing);
    currentMaxYear = currentMaxYear == null ? year : Math.max(currentMaxYear, year);
  }

  if (!directors.size) {
    const warning = `No executive rows parsed from Summary Compensation Table for ${company.name}.`;
    console.error("[scrape-sp500] " + warning, { tableText: candidate.text.slice(0, 1000) });
    warnings.push(warning);
  }
  logDirectorExtractionDiagnostics("scrape-sp500", company.name, diagnostics, directors.size);

  return { directors: [...directors.values()], warnings };
}

function parseTextSummaryCompensationTable(html, company) {
  const warnings = [];
  const text = bodyText(html);
  const start =
    text.search(/SUMMARY COMPENSATION TABLE FOR\s+20\d{2}/i) >= 0
      ? text.search(/SUMMARY COMPENSATION TABLE FOR\s+20\d{2}/i)
      : text.search(/Summary Compensation Table/i);
  if (start < 0) return { directors: [], warnings };

  const section = text.slice(start, start + 18000);
  if (/Compensation Actually Paid|Pay Versus Performance/i.test(section.slice(0, 1200))) return { directors: [], warnings };
  const end = section.search(/COMPENSATION ADJUSTED FOR|TOTAL DIRECT COMPENSATION|GRANTS OF PLAN-BASED AWARDS|Outstanding Equity/i);
  const tableText = end > 0 ? section.slice(0, end) : section;
  const namePattern = /\b((?:[A-Z]\.\s*){1,3}[A-Z][A-Za-z]+(?:,\s*Jr\.)?)\b/g;
  const nameMatches = [...tableText.matchAll(namePattern)].filter((match) => /20\d{2}/.test(tableText.slice(match.index, match.index + 700)));
  const directors = new Map();
  const diagnostics = { detected: [], parsed: [], dropped: [] };

  for (let index = 0; index < nameMatches.length; index += 1) {
    const match = nameMatches[index];
    const name = cleanText(match[1]);
    const blockEnd = nameMatches[index + 1]?.index ?? tableText.length;
    const block = tableText.slice(match.index, blockEnd);
    diagnostics.detected.push({ name, role: "Named Executive Officer", row: [block.slice(0, 500)] });
    const rows = [...block.matchAll(/\b(20\d{2})\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)\s+([\d,]+|0|—)/g)];
    if (!rows.length) {
      diagnostics.dropped.push({ name, reason: "Matched name but no text compensation rows found.", row: [block.slice(0, 500)] });
      continue;
    }

    const roleText = block.slice(rows[0].index + rows[0][0].length, rows[1]?.index ?? rows[0].index + rows[0][0].length + 120);
    const role = cleanText(roleText.replace(/\b20\d{2}[\s\S]*$/g, "")) || "Named Executive Officer";
    const id = slugify(name);
    const director = directors.get(id) || { id, name, role, type: "executive", sourceUrl: null, years: {} };
    for (const row of rows) {
      const year = Number(row[1]);
      const record = {
        baseSalary: parseMoney(row[2]),
        annualBonus: sumNullable(parseMoney(row[3]), parseMoney(row[6])),
        ltip: sumNullable(parseMoney(row[4]), parseMoney(row[5])),
        pensionBenefits: parseMoney(row[7]),
        totalCompensation: parseMoney(row[9]),
        payRatio: null,
        sayOnPayPct: null
      };
      normalizeCompensationScale(record, company, row.slice(0, 10));
      director.years[year] = record;
      diagnostics.parsed.push({ name, year, row: row.slice(0, 10) });
    }
    directors.set(id, director);
  }

  logDirectorExtractionDiagnostics("scrape-sp500", company.name, diagnostics, directors.size);
  return { directors: [...directors.values()], warnings };
}

function extractDirectorCompensationTable(html, company, filingDate = null) {
  const $ = cheerio.load(html);
  const warnings = [];
  const candidate = findDirectorCompensationTable($);
  const diagnostics = { detected: [], parsed: [], dropped: [] };

  if (!candidate) {
    const warning = `Director Compensation Table not found for ${company.name}.`;
    console.error("[scrape-sp500] " + warning);
    warnings.push(warning);
    return { directors: [], warnings };
  }

  const headerIndex = candidate.rows.findIndex((row) => isDirectorCompHeader(row));
  if (headerIndex < 0) {
    const warning = `Director Compensation Table header not parsed for ${company.name}.`;
    console.error("[scrape-sp500] " + warning, { rows: candidate.rows.slice(0, 6), context: candidate.context });
    warnings.push(warning);
    return { directors: [], warnings };
  }

  const headers = candidate.rows[headerIndex].map(normalizeHeader);
  const headerMap = {
    name: findHeader(headers, ["name", "director"]),
    year: findHeader(headers, ["year"]),
    fees: findHeader(headers, ["fees earned", "paid in cash", "cash", "fees"]),
    stockAwards: findHeader(headers, ["stock awards", "stock award", "stockawards"]),
    optionAwards: findHeader(headers, ["option awards", "option award", "optionawards"]),
    allOther: findHeader(headers, ["all other", "all othercompensation", "allothercompensation"]),
    total: findHeader(headers, ["total"])
  };

  const inferredYear = inferDirectorCompensationYear(candidate, filingDate);
  const directors = new Map();

  for (const row of candidate.rows.slice(headerIndex + 1)) {
    if (!row.length || isDirectorCompHeader(row)) continue;
    const rowText = row.join(" ");
    if (/^total\b|aggregate|retainer|committee|chair fee|annual fee|stock ownership/i.test(rowText)) continue;

    const nameIndex = headerMap.name >= 0 ? headerMap.name : 0;
    const name = cleanDirectorName(row[nameIndex]);
    if (!isLikelySecPersonName(name)) {
      if (row.some((cell) => parseMoney(cell) != null)) diagnostics.dropped.push({ row, reason: "Compensation row did not start with a director name." });
      continue;
    }
    diagnostics.detected.push({ name, role: "Non-Employee Director", row });

    const rowYear = detectRowYear(row, headerMap.year) || inferredYear;
    if (!rowYear) {
      diagnostics.dropped.push({ name, row, reason: "No reporting year found or inferred." });
      continue;
    }

    const record = parseDirectorCompensationValues(row, headerMap, rowYear);
    normalizeCompensationScale(record, company, row);
    if (record.totalCompensation == null && record.nedFees == null && record.ltip == null && record.optionAwards == null) {
      diagnostics.dropped.push({ name, row, reason: "Matched director name but no director compensation values parsed." });
      continue;
    }

    const id = `${company.id}-${slugify(name)}`;
    const existing = directors.get(id) || {
      id,
      name,
      role: "Non-Employee Director",
      type: "non-executive",
      source: "SEC EDGAR",
      sourceUrl: null,
      payRatio: null,
      sayOnPayPct: null,
      years: {}
    };

    const currentYears = Object.keys(existing.years).map(Number);
    if (!currentYears.length || rowYear >= Math.max(...currentYears)) {
      existing.years = { [rowYear]: record };
    }
    directors.set(id, existing);
    diagnostics.parsed.push({ name, year: rowYear, row });
  }

  if (!directors.size) {
    const warning = `No non-executive director rows parsed from Director Compensation Table for ${company.name}.`;
    console.error("[scrape-sp500] " + warning, { tableText: candidate.text.slice(0, 1000), context: candidate.context });
    warnings.push(warning);
  }

  logDirectorExtractionDiagnostics("scrape-sp500:ned", company.name, diagnostics, directors.size);
  return { directors: [...directors.values()], warnings };
}

function logDirectorExtractionDiagnostics(scope, companyName, diagnostics, structuredCount) {
  const detectedNames = [...new Set(diagnostics.detected.map((item) => item.name).filter(Boolean))];
  const parsedNames = [...new Set(diagnostics.parsed.map((item) => item.name).filter(Boolean))];
  const dropped = diagnostics.dropped.filter((item) => item.name || item.reason).slice(0, 12);
  console.error(`[${scope}] Director extraction diagnostics`, {
    company: companyName,
    detectedNamePatterns: detectedNames.length,
    structuredRecords: structuredCount,
    detectedNames,
    parsedNames,
    dropped
  });
  if (structuredCount <= 1 && detectedNames.length > 1) {
    console.error(`[${scope}] Likely incomplete director extraction`, {
      company: companyName,
      detectedNamePatterns: detectedNames.length,
      structuredRecords: structuredCount
    });
  }
}

function normalizeCompensationScale(record, company, row) {
  const fields = ["baseSalary", "annualBonus", "ltip", "pensionBenefits", "totalCompensation", "nedFees", "optionAwards"];
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

function findDirectorCompensationTable($) {
  let best = null;
  $("table").each((index, element) => {
    const rows = tableRows($, element);
    const text = rows.flat().join(" ");
    const context = previousText($, element, 10);
    const combined = `${context} ${text}`;
    const hasDirectorContext = /(?:non-employee|nonemployee|outside|independent)?\s*director compensation|director compensation table|fiscal year director compensation/i.test(combined);
    const hasDirectorHeader = rows.some((row) => isDirectorCompHeader(row));
    const likelyNames = rows.filter((row) => isLikelySecPersonName(cleanDirectorName(row[0])) && row.some((cell) => parseMoney(cell) != null)).length;
    let score = 0;

    if (hasDirectorContext) score += 6;
    if (hasDirectorHeader) score += 7;
    if (/fees earned|paid in cash|cash fees/i.test(text)) score += 3;
    if (/stock\s*awards?/i.test(text)) score += 2;
    if (/option\s*awards?/i.test(text)) score += 1;
    if (/\btotal\b/i.test(text)) score += 1;
    score += Math.min(likelyNames, 8);
    if (/summary compensation table|named executive|principal position|salary|non-equity incentive|pay versus performance|compensation actually paid/i.test(combined)) score -= 10;
    if (/security ownership|beneficial ownership|audit fees|equity compensation plan/i.test(combined)) score -= 8;
    if (rows.length < 3) score -= 2;
    if (!best || score > best.score) best = { index, rows, text, context, score };
  });
  return best?.score >= 9 ? best : null;
}

function isDirectorCompHeader(row) {
  const text = row.map(normalizeHeader).join(" ");
  const hasFees = /fees\s*earned|feesearned|paid in cash|cash fees|\bfees\b|\bcash\b/i.test(text);
  const hasAward = /stock awards?|option awards?|all other/i.test(text);
  const hasTotal = /\btotal\b/i.test(text);
  const hasName = /\bname\b|director/i.test(text);
  return hasTotal && hasFees && (hasAward || hasName);
}

function inferDirectorCompensationYear(candidate, filingDate) {
  const text = `${candidate.context || ""} ${candidate.text || ""}`;
  const fiscalMatches = [...text.matchAll(/(?:fiscal|year ended|for the year|during)\D{0,30}(20\d{2})/gi)].map((match) => Number(match[1]));
  if (fiscalMatches.length) return Math.max(...fiscalMatches);

  const titleMatches = [...text.slice(0, 1200).matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (titleMatches.length) return Math.max(...titleMatches.filter((year) => year <= new Date().getFullYear() + 1));

  const filingYear = parseYear(filingDate);
  return filingYear ? filingYear - 1 : null;
}

function parseDirectorCompensationValues(row, headerMap, year) {
  const yearIndex = row.findIndex((cell) => cleanText(cell) === String(year));
  const offset = yearIndex >= 0 && headerMap.year >= 0 ? yearIndex - headerMap.year : 0;
  const nameOffset = headerMap.name < 0 && isLikelySecPersonName(cleanDirectorName(row[0])) ? 1 : 0;
  const moneyAtHeader = (headerIndex) => (headerIndex < 0 ? null : parseMoney(row[headerIndex + offset + nameOffset]));
  let nedFees = moneyAtHeader(headerMap.fees);
  let stockAwards = moneyAtHeader(headerMap.stockAwards);
  let optionAwards = moneyAtHeader(headerMap.optionAwards);
  let allOther = moneyAtHeader(headerMap.allOther);
  let totalCompensation = moneyAtHeader(headerMap.total);

  const moneyCells = row
    .map((cell, index) => ({ value: parseMoney(cell), index }))
    .filter((cell) => cell.value != null && indexIsNotNameOrYear(cell.index, headerMap, row));

  if (headerMap.name < 0 && isLikelySecPersonName(cleanDirectorName(row[0])) && row.length >= 5) {
    nedFees = parseMoney(row[1]);
    stockAwards = parseMoney(row.at(-3));
    optionAwards = null;
    allOther = parseMoney(row.at(-2));
    totalCompensation = parseMoney(row.at(-1));
  } else if (moneyCells.length >= 2) {
    const values = moneyCells.map((cell) => cell.value);
    const rightmostTotal = values.at(-1);
    const shouldUseSequence =
      headerMap.name < 0 ||
      totalCompensation == null ||
      totalCompensation !== rightmostTotal ||
      totalCompensation < Math.max(...values);

    if (shouldUseSequence) {
      nedFees = values[0] ?? null;
      totalCompensation = rightmostTotal ?? null;
      stockAwards = values.length >= 5 ? values.at(-3) : values[1] ?? stockAwards;
      optionAwards = values.length >= 6 ? values[2] ?? null : optionAwards;
      allOther = values.length >= 4 ? values.at(-2) : allOther;
    }
  }

  if (totalCompensation == null) totalCompensation = sumNullable(nedFees, stockAwards, optionAwards, allOther);

  return {
    baseSalary: null,
    annualBonus: null,
    nedFees,
    ltip: stockAwards,
    optionAwards,
    pensionBenefits: allOther,
    totalCompensation,
    payRatio: null,
    sayOnPayPct: null,
    source: "SEC EDGAR"
  };
}

function indexIsNotNameOrYear(index, headerMap, row) {
  if (index === headerMap.name || index === headerMap.year) return false;
  if (/^20\d{2}$/.test(cleanText(row[index]))) return false;
  return true;
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
    if (/compensation actually paid|pay versus performance|\bPEO\b|\bCAP\b/i.test(text)) score -= 20;
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

function detectRowYear(row, headerYearIndex) {
  const exactIndex = row.findIndex((cell) => /^20\d{2}$/.test(cleanText(cell)));
  if (exactIndex >= 0) return Number(cleanText(row[exactIndex]));
  return parseYear(row[headerYearIndex]) || row.map(parseYear).find((year) => year != null) || null;
}

function parseStructuredCompensationValues(row, headerMap, year, company) {
  const yearIndex = row.findIndex((cell) => cleanText(cell) === String(year));
  const valueCells = row.slice(yearIndex >= 0 ? yearIndex + 1 : 0);
  const moneyCells = valueCells.map(parseMoney).filter((value) => value != null);
  const expectedMoneyColumns = [
    headerMap.salary,
    headerMap.bonus,
    headerMap.stockAwards,
    headerMap.optionAwards,
    headerMap.nonEquity,
    headerMap.allOther,
    headerMap.total
  ].filter((index) => index >= 0).length;

  if (moneyCells.length >= 5 && moneyCells.length > expectedMoneyColumns) {
    const hasNonEquity = headerMap.nonEquity >= 0;
    const hasOptions = headerMap.optionAwards >= 0;
    const totalCompensation = moneyCells.at(-1) ?? null;
    const pensionBenefits = moneyCells.length >= 2 ? moneyCells.at(-2) : null;
    const nonEquity = hasNonEquity && moneyCells.length >= 4 ? moneyCells.at(-3) : null;
    let ltip = moneyCells[2] ?? null;

    if (!hasNonEquity && !hasOptions && moneyCells.length >= 8) {
      ltip = moneyCells[4] ?? moneyCells[2] ?? null;
    } else if (hasOptions && moneyCells.length >= 4) {
      ltip = sumNullable(moneyCells[2], moneyCells[3]);
    }

    return {
      baseSalary: moneyCells[0] ?? null,
      annualBonus: sumNullable(moneyCells[1] ?? null, nonEquity),
      ltip,
      pensionBenefits,
      totalCompensation,
      payRatio: null,
      sayOnPayPct: null
    };
  }

  const offset = yearIndex >= 0 && headerMap.year >= 0 ? yearIndex - headerMap.year : parseYear(row[0]) != null ? -1 : 0;
  const moneyAtHeader = (headerIndex) => (headerIndex < 0 ? null : parseMoney(row[headerIndex + offset]));
  return {
    baseSalary: moneyAtHeader(headerMap.salary),
    annualBonus: sumNullable(moneyAtHeader(headerMap.bonus), moneyAtHeader(headerMap.nonEquity)),
    ltip: sumNullable(moneyAtHeader(headerMap.stockAwards), moneyAtHeader(headerMap.optionAwards)),
    pensionBenefits: moneyAtHeader(headerMap.allOther),
    totalCompensation: moneyAtHeader(headerMap.total),
    payRatio: null,
    sayOnPayPct: null
  };
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

function cleanDirectorName(value) {
  return cleanText(value)
    .replace(/\(\d+\)/g, "")
    .replace(/\*+/g, "")
    .replace(/\d+$/g, "")
    .replace(/\b(?:Former|Director|Chair|Independent)\b$/i, "")
    .trim();
}

function isLikelySecPersonName(value) {
  const text = cleanText(value);
  if (!text || !/^[A-Z]/.test(text)) return false;
  if ((text.match(/\b[A-Z][A-Za-z'.-]+\b/g) || []).length < 2 && !/^(?:[A-Z]\.\s*){1,3}[A-Z][A-Za-z]+/.test(text)) return false;
  if (
    /^(?:Chairman|President|CFO|CEO|CLO|Chief|Executive|Senior|Vice|General Counsel|Named Executive Officer|Former|Total|Year|Salary|Bonus|Stock|Option|All Other|Change in Pension)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/\b(?:and|of|to)$/i.test(text)) return false;
  return true;
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
