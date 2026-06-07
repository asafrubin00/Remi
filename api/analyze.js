const system = `You are Remi, an expert remuneration analyst. You provide concise, 
plain-English analysis of executive and non-executive pay data. 
Write in flowing prose, maximum 150 words. No bullet points. No headers. 
Be specific about numbers. Flag anything notable — high pay ratios, 
low say-on-pay approval, significant LTIP vesting, cross-index anomalies. 
Maintain a neutral, analytical tone — like a senior ISS analyst briefing 
a fund manager.`;

const model = "claude-haiku-4-5-20251001";

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
        max_tokens: 300,
        stream: true,
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

    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff"
    });

    const decoder = new TextDecoder();
    const reader = anthropicResponse.body?.getReader();
    if (!reader) throw new Error("Anthropic stream unavailable");

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const text = extractTextDelta(event);
        if (text) response.write(text);
      }
    }

    buffer += decoder.decode();
    const remainingText = extractTextDelta(buffer);
    if (remainingText) response.write(remainingText);
    response.end();
  } catch (error) {
    console.error("[api/analyze] Unhandled analysis failure", error);
    if (!response.headersSent) {
      response.status(500).json({ analysis: "Analysis unavailable." });
    } else {
      response.end();
    }
  }
}

function extractTextDelta(event) {
  return event
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6).trim())
    .filter((data) => data && data !== "[DONE]")
    .map((data) => {
      try {
        const parsed = JSON.parse(data);
        return parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" ? parsed.delta.text : "";
      } catch {
        return "";
      }
    })
    .join("");
}
