/**
 * Payment channel filter parsing and validation.
 *
 * Rules (see requirement.md section 3.3):
 * 1. Missing, empty or whitespace-only values mean "no filter".
 * 2. Empty values mixed with valid values are ignored.
 * 3. Values are trimmed and matched case-insensitively.
 * 4. Matching values are normalized to canonical enum values and deduplicated.
 * 5. Invalid values are rejected before the count limit is checked.
 * 6. More than five distinct valid channels are rejected.
 *
 * All validation happens before the order query and CSV generation.
 */
import { normalizePaymentChannel } from './paymentChannels.js';

export const MAX_PAYMENT_CHANNELS = 5;

export const INVALID_PAYMENT_CHANNEL = 'INVALID_PAYMENT_CHANNEL';
export const TOO_MANY_PAYMENT_CHANNELS = 'TOO_MANY_PAYMENT_CHANNELS';

export class PaymentChannelValidationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} details
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'PaymentChannelValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {string[]} rawValues repeated `payment_channel` query values
 * @returns {{channels: string[], filterApplied: boolean}}
 * @throws {PaymentChannelValidationError}
 */
export function parsePaymentChannelFilter(rawValues) {
  if (!Array.isArray(rawValues) || rawValues.length === 0) {
    return { channels: [], filterApplied: false };
  }

  const nonEmptyValues = rawValues
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value !== '');

  if (nonEmptyValues.length === 0) {
    return { channels: [], filterApplied: false };
  }

  const invalidValues = [];
  const invalidSeen = new Set();
  const channels = [];
  const channelSeen = new Set();

  for (const value of nonEmptyValues) {
    const canonical = normalizePaymentChannel(value);
    if (canonical === null) {
      if (!invalidSeen.has(value)) {
        invalidSeen.add(value);
        invalidValues.push(value);
      }
      continue;
    }
    if (!channelSeen.has(canonical)) {
      channelSeen.add(canonical);
      channels.push(canonical);
    }
  }

  if (invalidValues.length > 0) {
    throw new PaymentChannelValidationError(
      INVALID_PAYMENT_CHANNEL,
      `存在非法支付渠道值: ${invalidValues.join(', ')}`,
      { invalid_values: invalidValues },
    );
  }

  if (channels.length > MAX_PAYMENT_CHANNELS) {
    throw new PaymentChannelValidationError(
      TOO_MANY_PAYMENT_CHANNELS,
      `最多选择 ${MAX_PAYMENT_CHANNELS} 个支付渠道，当前选择了 ${channels.length} 个`,
      { max: MAX_PAYMENT_CHANNELS, count: channels.length },
    );
  }

  return { channels, filterApplied: true };
}
