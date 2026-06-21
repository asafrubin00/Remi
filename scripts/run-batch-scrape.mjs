import fs from "node:fs/promises";
import path from "node:path";
import { companies as appCompanies } from "../src/data/mockRemuneration.js";

const DEFAULT_BASE_URL = process.env.REMI_BASE_URL || "https://remi-ashen.vercel.app";
const ROOT = new URL("../", import.meta.url);
const DATA_DIR = new URL("../data/", import.meta.url);
const RESULTS_DIR = new URL("../data/batch-results/", import.meta.url);

function parseArgs(argv) {
  const args = {
    index: "sp500",
    baseUrl: DEFAULT_BASE_URL,
    concurrency: 10,
    delayMs: 500,
    timeoutMs: 60000,
    limit: null,
    offset: 0,
    fresh: false,
    retryFailures: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--index") args.index = next;
    if (arg === "--base-url") args.baseUrl = next;
    if (arg === "--concurrency") args.concurrency = Number(next);
    if (arg === "--delay-ms") args.delayMs = Number(next);
    if (arg === "--timeout-ms") args.timeoutMs = Number(next);
    if (arg === "--limit") args.limit = Number(next);
    if (arg === "--offset") args.offset = Number(next);
    if (arg === "--fresh") args.fresh = true;
    if (arg === "--retry-failures") args.retryFailures = true;
    if (arg.startsWith("--") && next && !next.startsWith("--")) index += 1;
  }

  if (!["sp500", "ftse100"].includes(args.index)) throw new Error("--index must be sp500 or ftse100");
  return args;
}

async function readJson(fileUrl, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(fileUrl, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(fileUrl, value) {
  await fs.mkdir(new URL("./", fileUrl), { recursive: true });
  await fs.writeFile(fileUrl, `${JSON.stringify(value, null, 2)}\n`);
}

function directorCounts(result) {
  const directors = result?.directors || [];
  return {
    total: directors.length,
    executives: directors.filter((director) => director.type !== "non-executive").length,
    nonExecutives: directors.filter((director) => director.type === "non-executive").length
  };
}

function classifyResult(result) {
  const counts = directorCounts(result);
  if (counts.executives > 0) return "success";
  const message = [result?.error, result?.scrape?.message, ...(result?.scrape?.parseWarnings || [])].filter(Boolean).join(" ");
  if (/403|forbidden|blocked/i.test(message)) return "403 blocked";
  if (/not found|No SEC company match|No FTSE company match|company match/i.test(message)) return "company not found";
  if (/timeout|aborted|network/i.test(message)) return "timeout/network";
  if (/table|parsed|parseable|insufficient text|no executive rows|not parsed/i.test(message)) return "no parseable table";
  if (result?.scrape?.status === "fallback" || result?.scrape?.status === "partial") return "no parseable table";
  return "unknown failure";
}

function summariseResult(item, result, durationMs, httpStatus = 200) {
  const counts = directorCounts(result);
  const failureReason = classifyResult(result);
  return {
    id: item.id,
    company: item.company,
    ticker: item.ticker || null,
    index: item.index,
    httpStatus,
    scrapeStatus: result?.scrape?.status || null,
    success: failureReason === "success",
    failureReason: failureReason === "success" ? null : failureReason,
    directorCounts: counts,
    sampleDirectors: (result?.directors || []).slice(0, 8).map((director) => ({
      name: director.name,
      role: director.role,
      type: director.type
    })),
    message: result?.error || result?.scrape?.message || null,
    parseWarnings: result?.scrape?.parseWarnings || [],
    filingUrl: result?.scrape?.filingUrl || null,
    durationMs,
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeOne(item, args) {
  const started = Date.now();
  const url = new URL("/api/scrape-company", args.baseUrl);
  url.searchParams.set("companyId", item.id);
  if (args.fresh) url.searchParams.set("fresh", "1");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(args.timeoutMs) });
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok) {
      return {
        ...summariseResult(item, result, Date.now() - started, response.status),
        success: false,
        failureReason: response.status === 403 ? "403 blocked" : response.status === 404 ? "company not found" : "http error",
        message: result.error || result.message || `HTTP ${response.status}`
      };
    }
    return summariseResult(item, result, Date.now() - started, response.status);
  } catch (error) {
    return {
      id: item.id,
      company: item.company,
      ticker: item.ticker || null,
      index: item.index,
      httpStatus: null,
      scrapeStatus: null,
      success: false,
      failureReason: /timeout|aborted/i.test(error.message) ? "timeout/network" : "unknown failure",
      directorCounts: { total: 0, executives: 0, nonExecutives: 0 },
      sampleDirectors: [],
      message: error.message,
      parseWarnings: [],
      filingUrl: null,
      durationMs: Date.now() - started,
      scrapedAt: new Date().toISOString()
    };
  }
}

function buildSummary(resultsById) {
  const results = Object.values(resultsById);
  const failures = results.filter((item) => !item.success);
  const groupedFailures = failures.reduce((acc, item) => {
    const key = item.failureReason || "unknown failure";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    attempted: results.length,
    successfulWithExecutive: results.filter((item) => item.directorCounts.executives > 0).length,
    successfulWithNed: results.filter((item) => item.directorCounts.nonExecutives > 0).length,
    failed: failures.length,
    groupedFailures,
    sampleSuccesses: results
      .filter((item) => item.directorCounts.executives > 0)
      .slice(0, 5)
      .map((item) => ({
        company: item.company,
        ticker: item.ticker,
        executives: item.directorCounts.executives,
        nonExecutives: item.directorCounts.nonExecutives,
        sampleDirectors: item.sampleDirectors.slice(0, 3)
      }))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceFile = new URL(args.index === "sp500" ? "sp500-constituents.json" : "ftse100-constituents.json", DATA_DIR);
  const source = await readJson(sourceFile);
  if (!source?.constituents?.length) throw new Error(`No constituents found in ${sourceFile.pathname}`);

  const allItems = source.constituents.slice(args.offset, args.limit == null ? undefined : args.offset + args.limit).map((item) => {
    const appCompany =
      appCompanies.find((company) => company.index === item.index && item.ticker && company.ticker === item.ticker) ||
      appCompanies.find((company) => company.index === item.index && company.company === item.company) ||
      appCompanies.find((company) => company.index === item.index && company.id === item.id);
    return appCompany ? { ...item, id: appCompany.id, company: appCompany.company, ticker: appCompany.ticker || item.ticker } : item;
  });
  const checkpointFile = new URL(`${args.index}-scrape-results.json`, RESULTS_DIR);
  const checkpoint = (await readJson(checkpointFile, null)) || {
    index: args.index,
    source: source.source,
    baseUrl: args.baseUrl,
    startedAt: new Date().toISOString(),
    results: {}
  };

  let cursor = 0;
  let nextStart = Date.now();
  const pending = allItems.filter((item) => {
    const existing = checkpoint.results[item.id];
    if (!existing) return true;
    if (args.retryFailures && !existing.success) return true;
    return false;
  });

  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor];
      cursor += 1;
      const waitMs = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(nextStart, Date.now()) + args.delayMs;
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

      const result = await scrapeOne(item, args);
      checkpoint.results[item.id] = result;
      checkpoint.updatedAt = new Date().toISOString();
      checkpoint.summary = buildSummary(checkpoint.results);
      await writeJson(checkpointFile, checkpoint);
      console.log(`${result.success ? "ok" : "fail"} ${item.index} ${item.ticker || ""} ${item.company} :: ${result.success ? `${result.directorCounts.executives} exec` : result.failureReason}`);
    }
  }

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await Promise.all(Array.from({ length: Math.min(args.concurrency, pending.length) }, () => worker()));
  checkpoint.completedAt = new Date().toISOString();
  checkpoint.summary = buildSummary(checkpoint.results);
  await writeJson(checkpointFile, checkpoint);

  console.log(JSON.stringify(checkpoint.summary, null, 2));
  console.log(`Checkpoint: ${path.relative(ROOT.pathname, checkpointFile.pathname)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
