import assert from "node:assert/strict";
import test from "node:test";
import { findLatestDef14a } from "../src/server/sp500Scraper.js";
import { parseIssuerTables } from "../src/server/ukReportTables.js";
import { mergeCompanyRecords } from "../src/data/publishedData.js";
import { validatePublishedResult } from "../scripts/refresh-published-data.mjs";

test("picks the newest definitive proxy even outside the old cutoff", () => {
  const filing = findLatestDef14a({ cik: "00042", filings: { recent: {
    form: ["DEF 14A", "DEFA14A", "DEF 14A", "DEF 14A"],
    filingDate: ["2025-05-20", "2027-07-21", "2027-05-11", "2026-05-20"],
    accessionNumber: ["42-25-01", "42-27-02", "42-27-01", "42-26-01"],
    primaryDocument: ["old.htm", "supplement.htm", "new.htm", "also-old.htm"]
  } } });
  assert.equal(filing.filingDate, "2027-05-11");
  assert.match(filing.url, /new\.htm$/);
});

test("keeps a sourced manual year and adds newer years without duplicating the director", () => {
  const previous = { id: "example", directors: [{ id: "original", name: "Sir Mark Tucker", type: "non-executive", years: {
    2024: { source: "manual", sourceUrl: "https://example.org/filing", totalCompensation: 150 }
  } }] };
  const incoming = { id: "example", directors: [{ id: "new", name: "Mark Tucker", type: "non-executive", years: {
    2024: { totalCompensation: 155 }, 2025: { totalCompensation: 148 }
  } }] };
  const result = mergeCompanyRecords(previous, incoming);
  assert.equal(result.directors.length, 1);
  assert.equal(result.directors[0].id, "original");
  assert.equal(result.directors[0].years[2024].totalCompensation, 150);
  assert.equal(result.directors[0].years[2025].totalCompensation, 148);
  assert.equal(mergeCompanyRecords(result, { directors: [] }), result);
});

test("rejects a stale UK fallback and obvious text fragments", () => {
  const item = { id: "bp", ticker: "BP", index: "FTSE100" };
  const scrape = { status: "live", fiscalYear: 2025, latestFiscalYear: 2025, filingUrl: "https://example.org/report.pdf" };
  assert.throws(() => validatePublishedResult(item, { scrape: { ...scrape, fiscalYear: 2024 } }), /Latest annual report/);
  assert.throws(() => validatePublishedResult(item, { scrape, directors: [{ name: "Image: Retail", type: "executive", years: {
    2025: { totalCompensation: 250000 }
  } }] }), /No compensation rows/);
});

test("parses the Shell audited table in GBP thousands, not a narrative salary figure", () => {
  const text = `Single figure of total remuneration for Executive Directors (audited)
£ thousand
Wael Sawan Sinead Gorman
2025 2024 2025 2024
Salaries [A] 1,535 1,455 1,014 961
Taxable benefits [B] 77 45 35 32
Pension [C] 307 291 203 192
Annual bonus [D] 2,725 2,925 1,800 1,930
Share award [E] 9,112 3,899 5,418 4,136
Total remuneration 13,756 8,615 8,470 7,251`;
  const { directors } = parseIssuerTables(text, "shell", 2025);
  assert.deepEqual(directors.map((person) => person.records[2025].totalCompensation), [13756000, 8470000]);
  assert.equal(parseIssuerTables(text, "shell", 2026).directors.length, 0);
});
