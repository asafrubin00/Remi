import { scrapeSp500Company } from "../src/server/sp500Scraper.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = request.query.company || request.query.ticker || request.query.q;
  const result = await scrapeSp500Company(query);
  response.status(result.error ? 404 : 200).json(result);
}
