import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rateSchema = z.object({
  from: z.string().length(3).toUpperCase(),
  to: z.string().length(3).toUpperCase(),
});

export const getExchangeRate = createServerFn({ method: "GET" })
  .inputValidator((data) => rateSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.from === data.to) return { rate: 1 };

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(
      data.from
    )}&to=${encodeURIComponent(data.to)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Exchange rate fetch failed: ${response.statusText}`);
    }

    const json = (await response.json()) as { rates: Record<string, number> };
    const rate = json.rates[data.to];
    if (rate == null) {
      throw new Error(`No exchange rate available for ${data.from} → ${data.to}`);
    }

    return { rate };
  });
