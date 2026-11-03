import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createRequestHandler, EXPORT_PATH } from '../src/app.js';
import { createOrderRepository, ORDER_COLUMNS, SEED_ORDERS } from '../src/orders.js';
import { PAYMENT_CHANNELS } from '../src/paymentChannels.js';

async function startServer(repository) {
  const server = createServer(createRequestHandler({ repository }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function buildUrl(baseUrl, values) {
  const params = new URLSearchParams();
  for (const value of values) {
    params.append('payment_channel', value);
  }
  return `${baseUrl}${EXPORT_PATH}?${params.toString()}`;
}

async function getExport(baseUrl, values) {
  const url = values === undefined ? `${baseUrl}${EXPORT_PATH}` : buildUrl(baseUrl, values);
  return fetch(url);
}

async function getRaw(baseUrl, rawQuery) {
  return fetch(`${baseUrl}${EXPORT_PATH}${rawQuery}`);
}

function parseCsv(text) {
  assert.equal(text.endsWith('\n'), true, 'CSV must end with one newline');
  const lines = text.slice(0, -1).split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((name, index) => [name, cells[index]]));
  });
  return { header, rows, lines };
}

function expectedRow(order) {
  return {
    order_id: order.order_id,
    order_no: order.order_no,
    user_id: order.user_id,
    payment_channel: order.payment_channel,
    amount: order.amount.toFixed(2),
    currency: order.currency,
    status: order.status,
    created_at: order.created_at,
  };
}

function expectedRowsFor(channels) {
  const selected = new Set(channels);
  return SEED_ORDERS.filter((order) => selected.has(order.payment_channel)).map(expectedRow);
}

describe('GET /api/orders/export', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await startServer(createOrderRepository());
    baseUrl = server.baseUrl;
  });

  after(async () => {
    await server.close();
  });

  it('AC-1 exports all orders when no filter is supplied', async () => {
    const response = await getExport(baseUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(
      response.headers.get('content-disposition'),
      'attachment; filename="orders.csv"',
    );

    const { header, rows } = parseCsv(await response.text());
    assert.deepEqual(header, [...ORDER_COLUMNS]);
    assert.equal(rows.length, SEED_ORDERS.length);
    assert.deepEqual(rows, SEED_ORDERS.map(expectedRow));
  });

  it('AC-2 exports all orders for empty and whitespace-only parameters', async () => {
    const baseline = await (await getExport(baseUrl)).text();

    for (const rawQuery of [
      '?payment_channel=',
      '?payment_channel=%20',
      '?payment_channel=&payment_channel=',
      '?payment_channel=%20&payment_channel=%09',
    ]) {
      const response = await getRaw(baseUrl, rawQuery);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), baseline, rawQuery);
    }
  });

  it('AC-3 filters by a single valid channel', async () => {
    const response = await getExport(baseUrl, ['alipay']);
    assert.equal(response.status, 200);

    const { rows } = parseCsv(await response.text());
    assert.deepEqual(rows, expectedRowsFor(['alipay']));
    assert.equal(rows.every((row) => row.payment_channel === 'alipay'), true);
  });

  it('AC-4 filters by five valid channels', async () => {
    const channels = PAYMENT_CHANNELS.slice(0, 5);
    const response = await getExport(baseUrl, channels);
    assert.equal(response.status, 200);

    const { rows } = parseCsv(await response.text());
    assert.deepEqual(rows, expectedRowsFor(channels));
  });

  it('AC-5 rejects six distinct channels with a clear error', async () => {
    const response = await getExport(baseUrl, PAYMENT_CHANNELS.slice(0, 6));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('content-disposition'), null);
    assert.equal(response.headers.get('content-type')?.includes('text/csv'), false);

    const body = await response.json();
    assert.equal(body.error.code, 'TOO_MANY_PAYMENT_CHANNELS');
    assert.equal(body.error.max, 5);
    assert.equal(body.error.count, 6);
    assert.match(body.error.message, /5/);
    assert.match(body.error.message, /6/);
  });

  it('AC-6 rejects a single invalid channel value', async () => {
    const response = await getExport(baseUrl, ['unknown_channel']);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('content-disposition'), null);

    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_PAYMENT_CHANNEL');
    assert.deepEqual(body.error.invalid_values, ['unknown_channel']);
    assert.match(body.error.message, /unknown_channel/);
  });

  it('AC-7 rejects mixed valid and invalid values, reporting only invalid ones', async () => {
    const response = await getExport(baseUrl, ['alipay', 'wechat_pay', 'unknown_channel']);
    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_PAYMENT_CHANNEL');
    assert.deepEqual(body.error.invalid_values, ['unknown_channel']);
  });

  it('AC-8 deduplicates values before applying the limit', async () => {
    const deduplicated = ['alipay', 'wechat_pay', 'union_pay', 'bank_card', 'paypal'];
    const withDuplicate = [...deduplicated, 'ALIPAY'];

    const duplicateResponse = await getExport(baseUrl, withDuplicate);
    assert.equal(duplicateResponse.status, 200);
    const duplicateBody = await duplicateResponse.text();

    const deduplicatedResponse = await getExport(baseUrl, deduplicated);
    assert.equal(deduplicatedResponse.status, 200);
    assert.equal(duplicateBody, await deduplicatedResponse.text());
  });

  it('AC-9 accepts case and whitespace variants like the canonical value', async () => {
    const canonical = await (await getExport(baseUrl, ['alipay'])).text();
    const canonicalWechat = await (await getExport(baseUrl, ['wechat_pay'])).text();

    const variant = await getRaw(baseUrl, '?payment_channel=%20ALIPAY%20');
    assert.equal(variant.status, 200);
    assert.equal(await variant.text(), canonical);

    const wechatVariant = await getRaw(baseUrl, '?payment_channel=WeChat_Pay%20');
    assert.equal(wechatVariant.status, 200);
    assert.equal(await wechatVariant.text(), canonicalWechat);
  });

  it('AC-10 ignores empty values mixed with a valid value', async () => {
    const response = await getRaw(baseUrl, '?payment_channel=&payment_channel=alipay');
    assert.equal(response.status, 200);

    const baseline = await (await getExport(baseUrl, ['alipay'])).text();
    assert.equal(await response.text(), baseline);
  });

  it('AC-11 keeps the CSV format identical between filtered and unfiltered exports', async () => {
    const unfilteredText = await (await getExport(baseUrl)).text();
    const filteredText = await (await getExport(baseUrl, ['alipay', 'wechat_pay'])).text();

    const unfiltered = parseCsv(unfilteredText);
    const filtered = parseCsv(filteredText);

    assert.deepEqual(filtered.header, unfiltered.header);
    assert.equal(unfilteredText.includes('\r'), false);
    assert.equal(filteredText.includes('\r'), false);

    for (const text of [unfilteredText, filteredText]) {
      const { rows } = parseCsv(text);
      for (const row of rows) {
        assert.match(row.amount, /^\d+\.\d{2}$/);
        assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      }
    }

    const timestamps = filtered.rows.map((row) => row.created_at);
    assert.deepEqual(timestamps, [...timestamps].sort());
  });

  it('AC-12 returns exactly the rows of the selected channels, without duplicates', async () => {
    const channels = ['alipay', 'wechat_pay', 'paypal'];
    const response = await getExport(baseUrl, channels);
    assert.equal(response.status, 200);

    const { rows } = parseCsv(await response.text());
    const expected = expectedRowsFor(channels);
    assert.deepEqual(rows, expected);

    const ids = rows.map((row) => row.order_id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(
      rows.every((row) => channels.includes(row.payment_channel)),
      true,
    );
  });

  it('AC-13 returns a header-only CSV for a valid channel without orders', async () => {
    const response = await getExport(baseUrl, ['apple_pay']);
    assert.equal(response.status, 200);

    const text = await response.text();
    assert.equal(text, `${ORDER_COLUMNS.join(',')}\n`);
  });

  it('AC-14 accepts each value from the single channel enum', async () => {
    assert.equal(PAYMENT_CHANNELS.length >= 6, true);
    for (const channel of PAYMENT_CHANNELS) {
      const response = await getExport(baseUrl, [channel]);
      assert.equal(response.status, 200, channel);
    }
  });

  it('AC-15 unfiltered behavior is unchanged by filtering support', async () => {
    const response = await getExport(baseUrl);
    assert.equal(response.status, 200);
    const { rows } = parseCsv(await response.text());
    assert.equal(rows.length, SEED_ORDERS.length);
  });

  it('AC-16 validates before querying orders and never starts a CSV response', async () => {
    const calls = { listByPaymentChannels: 0, listAll: 0, lastChannels: null };
    const repository = {
      listAll() {
        calls.listAll += 1;
        return createOrderRepository().listAll();
      },
      listByPaymentChannels(channels) {
        calls.listByPaymentChannels += 1;
        calls.lastChannels = channels;
        return createOrderRepository().listByPaymentChannels(channels);
      },
    };
    const spyServer = await startServer(repository);

    try {
      for (const values of [PAYMENT_CHANNELS, ['unknown_channel'], ['alipay', 'unknown_channel']]) {
        const response = await getExport(spyServer.baseUrl, values);
        assert.equal(response.status, 400);
        assert.equal(response.headers.get('content-disposition'), null);
        assert.equal(response.headers.get('content-type')?.includes('text/csv'), false);
        await response.text();
      }
      assert.equal(calls.listByPaymentChannels, 0);
      assert.equal(calls.listAll, 0);

      const valid = await getExport(spyServer.baseUrl, ['  ALIPAY ', 'WeChat_Pay']);
      assert.equal(valid.status, 200);
      await valid.text();
      assert.equal(calls.listByPaymentChannels, 1);
      assert.equal(calls.listAll, 0);
      assert.deepEqual(calls.lastChannels, ['alipay', 'wechat_pay']);
    } finally {
      await spyServer.close();
    }
  });
});
