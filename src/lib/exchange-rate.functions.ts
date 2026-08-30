import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rateSchema = z.object({
  from: z.string().length(3).toUpperCase(),
  to: z.string().length(3).toUpperCase(),
});

/**
 * All rates are anchored to EUR: we fetch how many units of each currency
 * one EUR buys, then derive the cross rate. The returned rate means
 * "1 <from> = rate <to>".
 */
export const getExchangeRate = createServerFn({ method: "GET" })
  .inputValidator((data) => rateSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.from === data.to) return { rate: 1 };

    const symbols = Array.from(new Set([data.from, data.to])).filter((c) => c !== "EUR");

    let perEur: Record<string, number> = { EUR: 1 };
    if (symbols.length > 0) {
      const url = `https://api.frankfurter.app/latest?base=EUR&symbols=${encodeURIComponent(
        symbols.join(",")
      )}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Exchange rate fetch failed: ${response.statusText}`);
      }
      const json = (await response.json()) as { rates: Record<string, number> };
      perEur = { EUR: 1, ...json.rates };
    }

    const fromPerEur = perEur[data.from];
    const toPerEur = perEur[data.to];
    if (!fromPerEur || !toPerEur) {
      throw new Error(`No exchange rate available for ${data.from} → ${data.to}`);
    }

    return { rate: toPerEur / fromPerEur };
  });
