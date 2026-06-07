const system = `You are Remi, an expert remuneration analyst. You provide concise, 
plain-English analysis of executive and non-executive pay data. 
Write in flowing prose, maximum 150 words. No bullet points. No headers. 
Be specific about numbers. Flag anything notable — high pay ratios, 
low say-on-pay approval, significant LTIP vesting, cross-index anomalies. 
Maintain a neutral, analytical tone — like a senior ISS analyst briefing 
a fund manager.`;

const defaultModel = "claude-sonnet-4-20250514";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      console.error("[api/analyze] Missing ANTHROPIC_API_KEY in function environment", {
        hasEnvObject: Boolean(process.env),
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      });
      response.status(503).json({ analysis: "Analysis unavailable." });
      return;
    }

    const { currentViewData } = request.body || {};
    const model = process.env.ANTHROPIC_MODEL?.trim() || defaultModel;
    console.info("[api/analyze] Calling Anthropic messages API", {
      model,
      vercelEnv: process.env.VERCEL_ENV,
      payloadBytes: Buffer.byteLength(JSON.stringify(currentViewData || {}), "utf8")
    });

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system,
        messages: [
          {
            role: "user",
            content: `Analyse the following remuneration data: ${JSON.stringify(currentViewData)}`
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      throw new Error(`Anthropic request failed with ${anthropicResponse.status}: ${errorText}`);
    }

    const data = await anthropicResponse.json();
    const analysis = data.content?.find((item) => item.type === "text")?.text || "Analysis unavailable.";
    response.status(200).json({ analysis });
  } catch (error) {
    console.error("[api/analyze] Unhandled analysis failure", error);
    response.status(500).json({ analysis: "Analysis unavailable." });
  }
}
