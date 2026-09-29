import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getBrief = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ facts: z.string().max(20000), focus: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { generateBrief } = await import("./brief.server");
    try {
      return { text: await generateBrief(data.facts, data.focus), error: null as string | null };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      const msg =
        status === 402
          ? "AI credits are used up for this workspace. Add credits to continue."
          : status === 429
            ? "Too many requests right now — please wait a minute and try again."
            : e instanceof Error
              ? e.message
              : "AI request failed.";
      return { text: "", error: msg };
    }
  });
