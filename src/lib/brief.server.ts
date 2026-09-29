import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function generateBrief(facts: string, focus: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured for this app.");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "You are a CX analytics advisor for Vireo Audio. Use ONLY numbers present in the FACTS JSON, copied exactly (you may format rupees with Indian commas). Never invent figures. Never recommend retraining an agent unless the fairness model flags them. Write under 220 words, plain markdown, 3 short sections: Finding, Fairness check, Recommended action.",
    prompt: `FOCUS: ${focus}\n\nFACTS:\n${facts}`,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}
