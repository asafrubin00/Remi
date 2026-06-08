import { debugFtseCompany } from "../../src/server/ftseScraper.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const result = await debugFtseCompany(request.query.company || request.query.q);
  response.status(result.error ? 500 : 200).json(result);
}
