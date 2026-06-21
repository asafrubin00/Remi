import { companies } from "../src/data/mockRemuneration.js";
import { scrapeFtseCompany } from "../src/server/ftseScraper.js";
import { scrapeSp500Company } from "../src/server/sp500Scraper.js";

const cikMap = {
  microsoft: "0000789019",
  jpmorgan: "0000019617"
};

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const companyId = String(request.query.companyId || "").toLowerCase();
  const company = companies.find((item) => item.id === companyId);
  if (!company) {
    response.status(404).json({ error: "Company not found" });
    return;
  }

  try {
    if (company.index === "SP500") {
      const skipCache = request.query.fresh === "1" || request.query.skipCache === "1";
      response.status(200).json(await scrapeSp500Company(company.ticker || company.company, { skipCache }));
      return;
    }

    if (company.index?.startsWith("FTSE")) {
      const skipCache = request.query.fresh === "1" || request.query.skipCache === "1";
      response.status(200).json(await scrapeFtseCompany(company.company, { skipCache }));
      return;
    }

    const scraped = company.index === "SP500" ? await scrapeUsCompany(company) : await scrapeUkCompany(company);
    response.status(200).json({
      ...company,
      scrape: scraped,
      cacheTtlHours: 24,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    response.status(200).json({
      ...company,
      scrape: {
        status: "fallback",
        message: error.message || "Live scrape unavailable; returning seeded data."
      },
      cacheTtlHours: 24,
      lastUpdated: new Date().toISOString()
    });
  }
}

async function scrapeUkCompany(company) {
  const companyHouse = await searchCompaniesHouse(company.company);
  const reportUrl = company.directors[0]?.sourceUrl;
  const reportText = reportUrl ? await tryExtractPdfText(reportUrl) : "";

  return {
    status: companyHouse ? "live-metadata" : "fallback",
    jurisdiction: "UK",
    companiesHouse: companyHouse,
    annualReportUrl: reportUrl,
    parsedTextSample: reportText.slice(0, 1200),
    message: companyHouse
      ? "Companies House metadata fetched; remuneration data remains normalised through the seeded schema until parser confidence is sufficient."
      : "Companies House credentials unavailable or lookup failed; returning seeded remuneration data."
  };
}

async function scrapeUsCompany(company) {
  if (company.ticker || company.company) {
    return scrapeSp500Company(company.ticker || company.company);
  }

  const cik = cikMap[company.id];
  if (!cik) throw new Error("No CIK mapping for seeded company.");

  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: {
      "User-Agent": process.env.SEC_USER_AGENT || "Remi remuneration dashboard contact@example.com",
      Accept: "application/json"
    }
  });
  if (!res.ok) throw new Error("SEC EDGAR lookup failed.");

  const data = await res.json();
  const filings = data.filings?.recent || {};
  const proxyIndex = filings.form?.findIndex((form) => form === "DEF 14A") ?? -1;
  const latestProxy =
    proxyIndex >= 0
      ? {
          form: filings.form[proxyIndex],
          filingDate: filings.filingDate[proxyIndex],
          accessionNumber: filings.accessionNumber[proxyIndex],
          primaryDocument: filings.primaryDocument[proxyIndex]
        }
      : null;

  return {
    status: latestProxy ? "live-metadata" : "fallback",
    jurisdiction: "US",
    cik,
    latestProxy,
    message: latestProxy
      ? "Latest DEF 14A metadata fetched from SEC EDGAR; compensation rows are returned in the seeded normalised schema."
      : "No DEF 14A found in recent SEC submissions; returning seeded remuneration data."
  };
}

async function searchCompaniesHouse(companyName) {
  if (!process.env.COMPANIES_HOUSE_API_KEY) return null;

  const credentials = Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY}:`).toString("base64");
  const res = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data.items?.[0];
  if (!hit) return null;
  return {
    companyNumber: hit.company_number,
    title: hit.title,
    status: hit.company_status,
    companyType: hit.company_type,
    addressSnippet: hit.address_snippet
  };
}

async function tryExtractPdfText(url) {
  if (!url.toLowerCase().endsWith(".pdf")) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const buffer = Buffer.from(await res.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  } catch {
    return "";
  }
}
