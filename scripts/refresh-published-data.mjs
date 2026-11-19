import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { normaliseConstituentId } from "../src/data/mockRemuneration.js";
import { mergeCompanyRecords } from "../src/data/publishedData.js";
import { isDirectorName } from "../src/server/ukReportTables.js";

const dataDir = new URL("../data/", import.meta.url);
const baseUrl = process.env.REMI_BASE_URL || "https://remi-ashen.vercel.app";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(new URL(name, dataDir), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback) return fallback;
    throw error;
  }
}

export function constituentCompanies(items) {
  const unique = new Map();
  for (const item of items) {
    const key = item.cik && Number(item.cik) ? item.cik : item.ticker;
    if (!unique.has(key) || item.ticker === "GOOGL" || item.ticker === "BRK-B") {
      unique.set(key, { ...item, id: normaliseConstituentId(item) });
    }
  }
  return [...unique.values()];
}

export function validatePublishedResult(item, result, now = new Date()) {
  if (result.error || result.scrape?.status !== "live" || !result.scrape?.filingUrl) {
    throw new Error(result.error || result.scrape?.message || "No parseable filing");
  }
  if (item.index === "SP500" && Number(result.cik) !== Number(item.cik)) throw new Error("SEC registrant mismatch");
  if (result.scrape.latestFiscalYear > result.scrape.fiscalYear) throw new Error(`Latest annual report (FY${result.scrape.latestFiscalYear}) could not be parsed`);
  const latestPossibleYear = now.getUTCFullYear();
  const isUk = item.index === "FTSE100";
  const directors = (result.directors || []).flatMap((person) => {
    const name = cleanName(person.name);
    if (person.source === "manual" || !isDirectorName(name.replace(/\s*\([\p{L}. -]+\)/gu, "").replace(/, /g, " "))) return [];
    if (isUk && person.type === "non-executive" && result.scrape.tableMethod !== "reconciled") return [];
    const years = Object.fromEntries(Object.entries(person.years || {}).filter(([year, row]) => {
      const total = row.totalCompensation;
      const components = [row.baseSalary, row.annualBonus, row.ltip, row.pensionBenefits, row.nedFees].filter(Number.isFinite);
      const sum = components.reduce((value, component) => value + component, 0);
      if (!(Number(year) >= 2022 && Number(year) <= latestPossibleYear) || !Number.isFinite(total) || total < 0) return false;
      if (result.scrape.fiscalYear && Number(year) > result.scrape.fiscalYear) return false;
      if (isUk && (total < 1000 || (person.type === "non-executive" && total > 3_000_000))) return false;
      if (isUk && result.scrape.tableMethod !== "reconciled" &&
        (!Number.isFinite(row.baseSalary) || components.length < 3 || Math.abs(total - sum) > Math.max(2000, total * .025))) return false;
      if (person.type === "executive" && total + Math.max(100, total * .04) < sum) return false;
      return true;
    }));
    const id = person.id.startsWith(`${item.id}:`) ? person.id : `${item.id}:${person.id}`;
    return Object.keys(years).length ? [{ ...person, name, id, years }] : [];
  });
  if (!directors.length) throw new Error("No compensation rows passed validation");
  if (isUk && result.scrape.fiscalYear && !directors.some((person) => person.years[result.scrape.fiscalYear])) {
    throw new Error(`No valid rows for FY${result.scrape.fiscalYear}`);
  }
  return { ...result, id: item.id, ticker: item.ticker, index: item.index, directors };
}

function cleanName(value = "") {
  return value.replace(/\((?:\d+|[a-z])\)|\*+/g, "")
    .replace(/\s*(?:[:;,]|\.{2,}|\d+)+\s*$/g, "")
    .replace(/\s*Former$/i, "").replace(/\bLeon Musk\b/, "Elon Musk").trim();
}

async function checkCompany(item, previous) {
  const path = item.index === "SP500" ? "/api/scrape-sp500" : "/api/scrape-ftse";
  const url = new URL(path, baseUrl);
  url.searchParams.set(item.index === "SP500" ? "ticker" : "company", item.index === "SP500" ? item.ticker : item.company);
  url.searchParams.set("fresh", "1");
  if (previous?.scrape?.revision) url.searchParams.set("revision", previous.scrape.revision);
  const response = await fetch(url, { signal: AbortSignal.timeout(70000) });
  const result = await response.json().catch(() => { throw new Error(`HTTP ${response.status}: invalid response`); });
  if (result.unchanged && previous) return null;
  return validatePublishedResult(item, result);
}

async function refresh(index) {
  const { constituents: items } = await readJson(`${index}-constituents.json`);
  const constituents = constituentCompanies(items);
  const filename = `published-${index}.json`;
  const previous = await readJson(filename, { checks: {}, records: {} });
  const snapshot = {
    version: 1,
    index: index === "sp500" ? "SP500" : "FTSE100",
    constituents,
    records: Object.fromEntries(constituents.flatMap((item) => {
      const record = previous.records[item.id];
      if (!record) return [];
      try {
        return [[item.id, validatePublishedResult(item, record)]];
      } catch (error) {
        console.warn(`[${index}] Removed invalid stored record: ${item.company}: ${error.message}`);
        return [];
      }
    })),
    checks: { ...previous.checks }
  };
  const selected = process.env.REMI_TICKERS
    ? constituents.filter((item) => process.env.REMI_TICKERS.split(",").includes(item.ticker))
    : constituents;
  let cursor = 0;
  let nextStart = Date.now();
  let succeeded = 0;
  let updated = 0;
  async function worker() {
    while (cursor < selected.length) {
      const item = selected[cursor++];
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Date.now() + wait + 500;
      if (wait) await pause(wait);
      try {
        const result = await checkCompany(item, snapshot.records[item.id]);
        if (result) {
          snapshot.records[item.id] = mergeCompanyRecords(snapshot.records[item.id], result);
          updated++;
        }
        snapshot.checks[item.id] = { checkedAt: new Date().toISOString(), outcome: result ? "updated" : "unchanged" };
        succeeded++;
      } catch (error) {
        snapshot.checks[item.id] = { checkedAt: new Date().toISOString(), outcome: "unavailable", reason: error.message.slice(0, 240) };
        console.warn(`[${index}] ${item.ticker} ${item.company}: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: index === "sp500" ? 8 : 4 }, worker));
  const run = { timestamp: new Date().toISOString(), attempted: selected.length, succeeded, failed: selected.length - succeeded, updated };
  snapshot.lastRun = selected.length === constituents.length ? run : previous.lastRun || null;
  await writeFile(new URL(`${filename}.tmp`, dataDir), JSON.stringify(snapshot) + "\n");
  await rename(new URL(`${filename}.tmp`, dataDir), new URL(filename, dataDir));
  console.log(index, JSON.stringify({ ...run, published: Object.keys(snapshot.records).length }));
  return run;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const indices = process.argv.slice(2);
  if (indices.some((index) => !["sp500", "ftse100"].includes(index))) throw new Error("Expected sp500 or ftse100");
  const runs = await Promise.all((indices.length ? indices : ["sp500", "ftse100"]).map(refresh));
  if (runs.some((run) => run.attempted && !run.succeeded)) process.exitCode = 2;
}
