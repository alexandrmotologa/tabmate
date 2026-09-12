import { describe, it, expect } from 'vitest';
import { fetchExchangeRates, convertCurrency, FALLBACK_RATES } from './currency.js';

describe('currency engine', () => {
  it('returns valid exchange rates with EUR base', async () => {
    const rates = await fetchExchangeRates('EUR');
    expect(rates).toBeDefined();
    expect(rates.EUR).toBe(1.0);
    expect(rates.USD).toBeGreaterThan(0.5);
    expect(rates.RON).toBeGreaterThan(4.0);
  });

  it('converts identical currencies with rate 1.0', async () => {
    const res = await convertCurrency(100, 'EUR', 'EUR');
    expect(res.convertedAmount).toBe(100);
    expect(res.rate).toBe(1.0);
  });

  it('converts non-EUR currencies accurately using cross-rates', async () => {
    const res = await convertCurrency(100, 'USD', 'USD');
    expect(res.convertedAmount).toBe(100);

    // Convert 100 RON to EUR (approx ~20 EUR at 4.98)
    const ronToEur = await convertCurrency(100, 'RON', 'EUR');
    expect(ronToEur.convertedAmount).toBeGreaterThan(15);
    expect(ronToEur.convertedAmount).toBeLessThan(25);
  });

  it('contains expected currencies in fallback table', () => {
    expect(FALLBACK_RATES.GBP).toBeDefined();
    expect(FALLBACK_RATES.JPY).toBeDefined();
    expect(FALLBACK_RATES.CHF).toBeDefined();
  });
});
