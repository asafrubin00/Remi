const system = `You are Remi, an expert remuneration analyst. You provide concise, 
plain-English analysis of executive and non-executive pay data. 
Write in flowing prose, maximum 150 words. No bullet points. No headers. 
Be specific about numbers. Flag anything notable — high pay ratios, 
low say-on-pay approval, significant LTIP vesting, cross-index anomalies. 
Maintain a neutral, analytical tone — like a senior ISS analyst briefing 
a fund manager.`;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    response.status(503).json({ analysis: "Analysis unavailable." });
    return;
  }

  try {
    const { currentViewData } = request.body || {};
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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

    if (!anthropicResponse.ok) throw new Error("Anthropic request failed");
    const data = await anthropicResponse.json();
    const analysis = data.content?.find((item) => item.type === "text")?.text || "Analysis unavailable.";
    response.status(200).json({ analysis });
  } catch {
    response.status(500).json({ analysis: "Analysis unavailable." });
  }
}
