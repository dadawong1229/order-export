import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  escapeCsvField,
  formatAmount,
  serializeOrdersToCsv,
} from '../src/csv.js';
import { ORDER_COLUMNS, SEED_ORDERS } from '../src/orders.js';

const EXPECTED_HEADER =
  'order_id,order_no,user_id,payment_channel,amount,currency,status,created_at';

describe('CSV serialization', () => {
  it('uses the fixed header, column order and UTF-8 text without BOM (AC-11)', () => {
    assert.deepEqual([...ORDER_COLUMNS], EXPECTED_HEADER.split(','));
    const csv = serializeOrdersToCsv([]);
    assert.equal(csv, `${EXPECTED_HEADER}\n`);
    assert.equal(csv.charCodeAt(0), 'o'.charCodeAt(0));
  });

  it('writes an empty result as the header line only (AC-13)', () => {
    const csv = serializeOrdersToCsv([]);
    assert.equal(csv.split('\n').filter(Boolean).length, 1);
    assert.equal(csv, `${EXPECTED_HEADER}\n`);
  });

  it('formats amounts with exactly two decimals and no separators (AC-11)', () => {
    assert.equal(formatAmount(129.5), '129.50');
    assert.equal(formatAmount(88), '88.00');
    assert.equal(formatAmount(1580), '1580.00');
    assert.equal(formatAmount(0.1), '0.10');
    assert.equal(formatAmount(null), '');
  });

  it('renders timestamps unchanged in ISO 8601 UTC form (AC-11)', () => {
    const order = SEED_ORDERS[0];
    const csv = serializeOrdersToCsv([order]);
    const dataLine = csv.split('\n')[1];
    assert.equal(dataLine.split(',')[7], '2026-10-01T08:15:00Z');
  });

  it('renders null and undefined values as empty fields', () => {
    const csv = serializeOrdersToCsv([
      {
        order_id: 'ORD-TEST',
        order_no: null,
        user_id: undefined,
        payment_channel: 'alipay',
        amount: 1,
        currency: 'CNY',
        status: '',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const dataLine = csv.split('\n')[1];
    assert.equal(
      dataLine,
      'ORD-TEST,,,alipay,1.00,CNY,,2026-01-01T00:00:00Z',
    );
  });

  it('quotes fields containing commas, quotes, CR or LF and doubles quotes', () => {
    assert.equal(escapeCsvField('plain'), 'plain');
    assert.equal(escapeCsvField('a,b'), '"a,b"');
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvField('line\nbreak'), '"line\nbreak"');
    assert.equal(escapeCsvField('line\rbreak'), '"line\rbreak"');
  });

  it('uses only LF line breaks and one trailing newline (AC-11)', () => {
    const csv = serializeOrdersToCsv(SEED_ORDERS.slice(0, 2));
    assert.equal(csv.includes('\r'), false);
    assert.equal(csv.endsWith('\n'), true);
    assert.equal(csv.endsWith('\n\n'), false);
    assert.equal(csv.split('\n').length, 4);
  });

  it('keeps the header identical for filtered and unfiltered exports (AC-11)', () => {
    const all = serializeOrdersToCsv(SEED_ORDERS);
    const filtered = serializeOrdersToCsv(
      SEED_ORDERS.filter((order) => order.payment_channel === 'alipay'),
    );
    assert.equal(all.split('\n')[0], filtered.split('\n')[0]);
  });
});
