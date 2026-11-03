/**
 * Single source of truth for payment channels.
 *
 * Order data, filtering and validation all read from this module. Adding a
 * channel must only require changing this list.
 */
export const PAYMENT_CHANNELS = Object.freeze([
  'alipay',
  'wechat_pay',
  'union_pay',
  'bank_card',
  'paypal',
  'stripe',
  'apple_pay',
]);

const CANONICAL_BY_LOWERCASE = new Map(
  PAYMENT_CHANNELS.map((channel) => [channel.toLowerCase(), channel]),
);

/**
 * Resolve a user supplied value to the canonical channel value.
 *
 * Matching is case-insensitive and surrounding whitespace is ignored.
 * Returns null when the value does not match any known channel.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function normalizePaymentChannel(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return CANONICAL_BY_LOWERCASE.get(value.trim().toLowerCase()) ?? null;
}
