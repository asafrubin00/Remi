import { scrapeFtseBatch } from "../../src/server/ftseScraper.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  const companies = body.companies || body.names || [];
  if (!Array.isArray(companies)) {
    response.status(400).json({ error: "Request body must include a companies or names array." });
    return;
  }

  const skipCache = request.query.fresh === "1" || request.query.skipCache === "1" || body.fresh === true || body.fresh === 1 || body.fresh === "1";
  const results = await scrapeFtseBatch(companies, { skipCache });
  response.status(200).json({ results });
}
