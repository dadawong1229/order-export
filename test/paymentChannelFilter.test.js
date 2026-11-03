import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_PAYMENT_CHANNELS,
  parsePaymentChannelFilter,
  PaymentChannelValidationError,
} from '../src/paymentChannelFilter.js';
import { PAYMENT_CHANNELS, normalizePaymentChannel } from '../src/paymentChannels.js';

describe('payment channel filter parsing', () => {
  it('treats a missing parameter as no filter', () => {
    assert.deepEqual(parsePaymentChannelFilter([]), { channels: [], filterApplied: false });
    assert.deepEqual(parsePaymentChannelFilter(undefined), {
      channels: [],
      filterApplied: false,
    });
  });

  it('treats empty and whitespace-only values as no filter (AC-2)', () => {
    for (const rawValues of [[''], ['   '], ['', ''], ['', '  ', '\t']]) {
      assert.deepEqual(parsePaymentChannelFilter(rawValues), {
        channels: [],
        filterApplied: false,
      });
    }
  });

  it('ignores empty values mixed with valid values (AC-10)', () => {
    assert.deepEqual(parsePaymentChannelFilter(['', 'alipay']), {
      channels: ['alipay'],
      filterApplied: true,
    });
    assert.deepEqual(parsePaymentChannelFilter(['  ', 'alipay', '']), {
      channels: ['alipay'],
      filterApplied: true,
    });
  });

  it('accepts a single valid channel (AC-3)', () => {
    assert.deepEqual(parsePaymentChannelFilter(['alipay']), {
      channels: ['alipay'],
      filterApplied: true,
    });
  });

  it('trims whitespace and matches case-insensitively (AC-9)', () => {
    assert.deepEqual(parsePaymentChannelFilter(['  ALIPAY  ']), {
      channels: ['alipay'],
      filterApplied: true,
    });
    assert.deepEqual(parsePaymentChannelFilter(['WeChat_Pay ']), {
      channels: ['wechat_pay'],
      filterApplied: true,
    });
    assert.deepEqual(parsePaymentChannelFilter(['UnIoN_PaY']), {
      channels: ['union_pay'],
      filterApplied: true,
    });
  });

  it('deduplicates values after normalization (AC-8)', () => {
    assert.deepEqual(
      parsePaymentChannelFilter(['alipay', 'ALIPAY', ' alipay ']).channels,
      ['alipay'],
    );

    const result = parsePaymentChannelFilter([
      'alipay',
      'wechat_pay',
      'union_pay',
      'bank_card',
      'paypal',
      'ALIPAY',
    ]);
    assert.deepEqual(result.channels, [
      'alipay',
      'wechat_pay',
      'union_pay',
      'bank_card',
      'paypal',
    ]);
    assert.equal(result.filterApplied, true);
  });

  it('accepts five distinct channels (AC-4)', () => {
    const result = parsePaymentChannelFilter(PAYMENT_CHANNELS.slice(0, 5));
    assert.equal(result.channels.length, 5);
    assert.equal(result.filterApplied, true);
  });

  it('rejects more than five distinct channels (AC-5)', () => {
    assert.equal(PAYMENT_CHANNELS.length >= 6, true);

    assert.throws(
      () => parsePaymentChannelFilter(PAYMENT_CHANNELS.slice(0, 6)),
      (error) => {
        assert.ok(error instanceof PaymentChannelValidationError);
        assert.equal(error.code, 'TOO_MANY_PAYMENT_CHANNELS');
        assert.equal(error.details.max, MAX_PAYMENT_CHANNELS);
        assert.equal(error.details.count, 6);
        assert.match(error.message, /5/);
        assert.match(error.message, /6/);
        return true;
      },
    );
  });

  it('rejects an invalid channel value (AC-6)', () => {
    assert.throws(
      () => parsePaymentChannelFilter(['unknown_channel']),
      (error) => {
        assert.ok(error instanceof PaymentChannelValidationError);
        assert.equal(error.code, 'INVALID_PAYMENT_CHANNEL');
        assert.deepEqual(error.details.invalid_values, ['unknown_channel']);
        assert.match(error.message, /unknown_channel/);
        return true;
      },
    );
  });

  it('reports only invalid values when valid and invalid are mixed (AC-7)', () => {
    assert.throws(
      () => parsePaymentChannelFilter(['alipay', 'wechat_pay', 'unknown_channel']),
      (error) => {
        assert.equal(error.code, 'INVALID_PAYMENT_CHANNEL');
        assert.deepEqual(error.details.invalid_values, ['unknown_channel']);
        return true;
      },
    );
  });

  it('deduplicates invalid values in the error (AC-6)', () => {
    assert.throws(
      () => parsePaymentChannelFilter(['unknown_channel', 'unknown_channel']),
      (error) => {
        assert.deepEqual(error.details.invalid_values, ['unknown_channel']);
        return true;
      },
    );
  });

  it('checks invalid values before the count limit (AC-7)', () => {
    assert.throws(
      () => parsePaymentChannelFilter([...PAYMENT_CHANNELS, 'unknown_channel']),
      (error) => {
        assert.equal(error.code, 'INVALID_PAYMENT_CHANNEL');
        assert.deepEqual(error.details.invalid_values, ['unknown_channel']);
        return true;
      },
    );
  });

  it('does not split comma separated values', () => {
    assert.throws(
      () => parsePaymentChannelFilter(['alipay,wechat_pay']),
      (error) => {
        assert.equal(error.code, 'INVALID_PAYMENT_CHANNEL');
        assert.deepEqual(error.details.invalid_values, ['alipay,wechat_pay']);
        return true;
      },
    );
  });

  it('recognizes every value of the single channel enum (AC-14)', () => {
    for (const channel of PAYMENT_CHANNELS) {
      assert.equal(normalizePaymentChannel(channel), channel);
      assert.deepEqual(parsePaymentChannelFilter([channel]).channels, [channel]);
    }
  });
});
