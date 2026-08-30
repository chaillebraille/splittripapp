import { getState, ready, setState } from "@/lib/local/store";
import { getRateTable } from "@/lib/exchange-rate.functions";

const STALE_MS = 6 * 60 * 60 * 1000;

/** Fetches the EUR-anchored rate table when online and caches it for offline use. */
export async function refreshRates(force = false): Promise<void> {
  await ready();
  const state = getState();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const fetchedAt = state.ratesFetchedAt ? Date.parse(state.ratesFetchedAt) : 0;
  if (!force && state.ratesPerEur && Date.now() - fetchedAt < STALE_MS) return;

  try {
    const { perEur } = await getRateTable();
    setState((s) => ({ ...s, ratesPerEur: perEur, ratesFetchedAt: new Date().toISOString() }));
  } catch {
    // Offline or the rate service is unavailable — keep using the cached table.
  }
}

/** Returns "1 <from> = rate <to>", using the cached EUR table so it works offline. */
export async function getExchangeRate({
  data,
}: {
  data: { from: string; to: string };
}): Promise<{ rate: number; cached: boolean; asOf: string | null }> {
  await ready();
  const from = data.from.toUpperCase();
  const to = data.to.toUpperCase();
  if (from === to) return { rate: 1, cached: false, asOf: getState().ratesFetchedAt };

  await refreshRates();

  const state = getState();
  const perEur = state.ratesPerEur;
  const fromPerEur = perEur?.[from];
  const toPerEur = perEur?.[to];
  if (!perEur || !fromPerEur || !toPerEur) {
    throw new Error(`No exchange rate available for ${from} → ${to}`);
  }

  return {
    rate: toPerEur / fromPerEur,
    cached: true,
    asOf: state.ratesFetchedAt,
  };
}
