const SUMMARY_KEY = "cron:sp500:last-run";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const kv = await kvClient();
    if (!kv) {
      response.status(200).json({});
      return;
    }

    const status = await kv.get(SUMMARY_KEY);
    response.status(200).json(status || {});
  } catch (error) {
    console.error("[cron:sp500-status] Failed to read KV summary", error);
    response.status(200).json({});
  }
}

async function kvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}
