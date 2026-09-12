export interface RateCache {
  base: string;
  rates: Record<string, number>;
  lastUpdated: number;
}

// Fallback rates against EUR
export const FALLBACK_RATES: Record<string, number> = {
  EUR: 1.0,
  USD: 1.08,
  GBP: 0.85,
  RON: 4.98,
  JPY: 162.5,
  CHF: 0.95,
  CAD: 1.48,
  AUD: 1.66,
  HUF: 395.0,
  BGN: 1.96,
  PLN: 4.31,
};

let memoryCache: RateCache = {
  base: 'EUR',
  rates: { ...FALLBACK_RATES },
  lastUpdated: 0,
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Fetches latest exchange rates with base currency (defaults to EUR).
 * Uses open.er-api.com with zero API key required, caching results and falling back gracefully.
 */
export async function fetchExchangeRates(base = 'EUR'): Promise<Record<string, number>> {
  const now = Date.now();
  if (memoryCache.base === base && now - memoryCache.lastUpdated < CACHE_TTL_MS) {
    return memoryCache.rates;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as { rates?: Record<string, number> };
      if (data && data.rates) {
        memoryCache = {
          base,
          rates: { ...FALLBACK_RATES, ...data.rates },
          lastUpdated: now,
        };
        return memoryCache.rates;
      }
    }
  } catch {
    // Network timeout or offline fallback
  }

  // If fetching fails or in offline mode, calculate cross rates from fallback table
  const baseRate = FALLBACK_RATES[base] || 1.0;
  const derivedRates: Record<string, number> = {};
  for (const [cur, rate] of Object.entries(FALLBACK_RATES)) {
    derivedRates[cur] = Math.round((rate / baseRate) * 10000) / 10000;
  }
  return derivedRates;
}

/**
 * Converts an amount from one currency to another using the latest exchange rates.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<{ convertedAmount: number; rate: number }> {
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();

  if (upperFrom === upperTo) {
    return { convertedAmount: amount, rate: 1.0 };
  }

  const rates = await fetchExchangeRates('EUR');
  const fromRate = rates[upperFrom] || FALLBACK_RATES[upperFrom] || 1.0;
  const toRate = rates[upperTo] || FALLBACK_RATES[upperTo] || 1.0;

  // Amount in EUR = amount / fromRate
  // Amount in Target = (amount / fromRate) * toRate
  const rate = toRate / fromRate;
  const convertedAmount = Math.round(amount * rate * 100) / 100;

  return {
    convertedAmount,
    rate: Math.round(rate * 10000) / 10000,
  };
}
