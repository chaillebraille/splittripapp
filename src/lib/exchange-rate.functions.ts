import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rateSchema = z.object({
  from: z.string().length(3).toUpperCase(),
  to: z.string().length(3).toUpperCase(),
});

/**
 * All rates are anchored to EUR: we fetch how many units of each currency
 * one EUR buys, then derive the cross rate. The source covers every currency
 * the app offers; Frankfurter is kept as a fallback for its major currencies.
 */
async function fetchPerEur(): Promise<{ perEur: Record<string, number>; date: string }> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR");
    if (response.ok) {
      const json = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      if (json.result === "success" && json.rates) {
        return {
          perEur: { ...json.rates, EUR: 1 },
          date: new Date(json.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10),
        };
      }
    }
  } catch {
    // fall through to the backup provider
  }

  const response = await fetch("https://api.frankfurter.app/latest?base=EUR");
  if (!response.ok) throw new Error(`Exchange rate fetch failed: ${response.statusText}`);
  const json = (await response.json()) as { rates: Record<string, number>; date: string };
  return { perEur: { EUR: 1, ...json.rates }, date: json.date };
}

export const getExchangeRate = createServerFn({ method: "GET" })
  .inputValidator((data) => rateSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.from === data.to) return { rate: 1 };

    const { perEur } = await fetchPerEur();
    const fromPerEur = perEur[data.from];
    const toPerEur = perEur[data.to];
    if (!fromPerEur || !toPerEur) {
      throw new Error(`No exchange rate available for ${data.from} → ${data.to}`);
    }

    return { rate: toPerEur / fromPerEur };
  });

/** Full "units per 1 EUR" table, cached offline by the client. */
export const getRateTable = createServerFn({ method: "GET" }).handler(async () => fetchPerEur());
