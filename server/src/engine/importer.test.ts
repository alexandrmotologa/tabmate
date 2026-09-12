import { describe, it, expect } from 'vitest';
import { parseExpenseCsv } from './importer.js';

describe('CSV importer engine', () => {
  it('parses standard TabMate CSV format', () => {
    const csv = `Date,Title,Category,Paid By,Amount,Currency,Notes
"2026-09-12","Airbnb Villa","lodging","Alex",360.00,"EUR","3 nights"
"2026-09-12","Colosseum Tickets","entertainment","Elena",125.00,"EUR","Group pass"`;

    const res = parseExpenseCsv(csv);
    expect(res).toHaveLength(2);
    expect(res[0].title).toBe('Airbnb Villa');
    expect(res[0].amount).toBe(360);
    expect(res[0].payerName).toBe('Alex');
    expect(res[1].title).toBe('Colosseum Tickets');
    expect(res[1].amount).toBe(125);
  });

  it('parses Splitwise exported CSV format with Cost header', () => {
    const csv = `Date,Description,Category,Cost,Currency,Alex,Dan
2026-08-01,Dinner with Wine,Food,65.50,EUR,32.75,32.75
2026-08-02,Groceries,Groceries,24.00,EUR,12.00,12.00`;

    const res = parseExpenseCsv(csv);
    expect(res).toHaveLength(2);
    expect(res[0].title).toBe('Dinner with Wine');
    expect(res[0].amount).toBe(65.5);
    expect(res[1].title).toBe('Groceries');
    expect(res[1].amount).toBe(24);
  });

  it('ignores empty lines and malformed rows', () => {
    const csv = `Date,Description,Amount\n\n\n`;
    const res = parseExpenseCsv(csv);
    expect(res).toHaveLength(0);
  });
});
