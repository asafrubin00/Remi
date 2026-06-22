import { readFile } from "node:fs/promises";
import path from "node:path";

export const config = {
  maxDuration: 300
};

const SUMMARY_KEY = "cron:sp500:last-run";
const BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 500;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  let summary = {
    timestamp: new Date().toISOString(),
    attempted: 0,
    succeeded: 0,
    failed: 0,
    failedCompanies: []
  };

  try {
    const constituents = await loadConstituents();
    const limit = readPositiveInteger(request.query.limit || request.query.max);
    const offset = readPositiveInteger(request.query.offset) || 0;
    const selected = constituents.slice(offset, limit ? offset + limit : undefined);
    const baseUrl = getBaseUrl(request);
    const results = [];

    for (let start = 0; start < selected.length; start += BATCH_SIZE) {
      const batch = selected.slice(start, start + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((company, index) =>
          delay(index * REQUEST_DELAY_MS).then(() => refreshCompany(baseUrl, company)),
        ),
      );
      results.push(...batchResults);
      if (start + BATCH_SIZE < selected.length) await delay(REQUEST_DELAY_MS);
    }

    const failedCompanies = results.filter((result) => !result.ok).map(({ company, ticker, error, status }) => ({ company, ticker, status, error }));
    summary = {
      timestamp: new Date().toISOString(),
      attempted: selected.length,
      succeeded: results.length - failedCompanies.length,
      failed: failedCompanies.length,
      failedCompanies
    };

    const kvWritten = await writeSummary(summary);
    console.log("[cron:sp500] Refresh complete", { ...summary, kvWritten });
    response.status(200).json({ ok: true, trigger: request.query.trigger || "cron", offset, limit: limit || null, kvWritten, ...summary });
  } catch (error) {
    console.error("[cron:sp500] Refresh failed", error);
    summary = {
      ...summary,
      timestamp: new Date().toISOString(),
      failed: summary.attempted || 1,
      error: error?.message || "Unknown cron refresh failure."
    };
    const kvWritten = await writeSummary(summary);
    response.status(200).json({ ok: false, kvWritten, ...summary });
  }
}

async function loadConstituents() {
  const file = await readFile(path.join(process.cwd(), "data", "sp500-constituents.json"), "utf8");
  const data = JSON.parse(file);
  if (!Array.isArray(data.constituents)) throw new Error("S&P 500 constituent list is missing a constituents array.");
  return data.constituents;
}

async function refreshCompany(baseUrl, company) {
  const startedAt = Date.now();
  const query = company.ticker || company.company;
  try {
    const url = new URL("/api/scrape-sp500", baseUrl);
    url.searchParams.set(company.ticker ? "ticker" : "company", query);
    url.searchParams.set("fresh", "1");
    const response = await fetch(url);
    const body = await response.json().catch(() => ({}));
    const directorCount = Array.isArray(body.directors) ? body.directors.length : 0;
    if (!response.ok || body.error || !directorCount) {
      const error = body.error || body.message || `Scrape returned ${response.status}${directorCount ? "" : " with no directors"}.`;
      console.error("[cron:sp500] Company refresh failed", { company: company.company, ticker: company.ticker, status: response.status, error });
      return { ok: false, company: company.company, ticker: company.ticker, status: response.status, error, ms: Date.now() - startedAt };
    }
    console.log("[cron:sp500] Company refreshed", { company: company.company, ticker: company.ticker, directors: directorCount, ms: Date.now() - startedAt });
    return { ok: true, company: company.company, ticker: company.ticker, directors: directorCount, ms: Date.now() - startedAt };
  } catch (error) {
    console.error("[cron:sp500] Company refresh threw", { company: company.company, ticker: company.ticker, error });
    return { ok: false, company: company.company, ticker: company.ticker, status: null, error: error?.message || "Request failed.", ms: Date.now() - startedAt };
  }
}

function getBaseUrl(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  if (host) return `${protocol}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  throw new Error("Unable to resolve deployment host for scraper refresh.");
}

function readPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeSummary(summary) {
  try {
    const kv = await kvClient();
    if (!kv) return false;
    await kv.set(SUMMARY_KEY, summary);
    return true;
  } catch (error) {
    console.error("[cron:sp500] Failed to write KV summary", error);
    return false;
  }
}

async function kvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn("[cron:sp500] KV_REST_API_URL or KV_REST_API_TOKEN missing; cron summary will not be persisted.");
    return null;
  }
  const { kv } = await import("@vercel/kv");
  return kv;
}
