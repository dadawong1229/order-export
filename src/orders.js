/**
 * In-memory order data source.
 *
 * A new project has no database yet, so the data source is a deterministic
 * seed. Filtering is applied here, at the query stage, before any CSV
 * serialization happens.
 */

/**
 * CSV columns. The order is part of the CSV format contract and must not
 * change when a filter is applied.
 */
export const ORDER_COLUMNS = Object.freeze([
  'order_id',
  'order_no',
  'user_id',
  'payment_channel',
  'amount',
  'currency',
  'status',
  'created_at',
]);

/**
 * Deterministic seed data. `stripe` intentionally has no orders so that the
 * empty-result case can be exercised with a valid channel.
 */
export const SEED_ORDERS = Object.freeze([
  {
    order_id: 'ORD-0001',
    order_no: 'NO20261001001',
    user_id: 'U1001',
    payment_channel: 'alipay',
    amount: 129.5,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-01T08:15:00Z',
  },
  {
    order_id: 'ORD-0002',
    order_no: 'NO20261001002',
    user_id: 'U1002',
    payment_channel: 'wechat_pay',
    amount: 88,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-01T09:40:00Z',
  },
  {
    order_id: 'ORD-0003',
    order_no: 'NO20261001003',
    user_id: 'U1003',
    payment_channel: 'union_pay',
    amount: 320.75,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-01T11:05:00Z',
  },
  {
    order_id: 'ORD-0004',
    order_no: 'NO20261002004',
    user_id: 'U1004',
    payment_channel: 'bank_card',
    amount: 999.99,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-02T02:20:00Z',
  },
  {
    order_id: 'ORD-0005',
    order_no: 'NO20261002005',
    user_id: 'U1005',
    payment_channel: 'alipay',
    amount: 12.3,
    currency: 'CNY',
    status: 'refunded',
    created_at: '2026-10-02T06:00:00Z',
  },
  {
    order_id: 'ORD-0006',
    order_no: 'NO20261003006',
    user_id: 'U1006',
    payment_channel: 'paypal',
    amount: 45.6,
    currency: 'USD',
    status: 'paid',
    created_at: '2026-10-03T03:10:00Z',
  },
  {
    order_id: 'ORD-0007',
    order_no: 'NO20261003007',
    user_id: 'U1007',
    payment_channel: 'wechat_pay',
    amount: 260,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-03T07:45:00Z',
  },
  {
    order_id: 'ORD-0008',
    order_no: 'NO20261004008',
    user_id: 'U1008',
    payment_channel: 'union_pay',
    amount: 75.05,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-04T01:30:00Z',
  },
  {
    order_id: 'ORD-0009',
    order_no: 'NO20261004009',
    user_id: 'U1009',
    payment_channel: 'alipay',
    amount: 1580,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-04T10:25:00Z',
  },
  {
    order_id: 'ORD-0010',
    order_no: 'NO20261005010',
    user_id: 'U1010',
    payment_channel: 'bank_card',
    amount: 33.33,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-05T05:50:00Z',
  },
  {
    order_id: 'ORD-0011',
    order_no: 'NO20261005011',
    user_id: 'U1011',
    payment_channel: 'wechat_pay',
    amount: 420,
    currency: 'CNY',
    status: 'paid',
    created_at: '2026-10-05T12:15:00Z',
  },
  {
    order_id: 'ORD-0012',
    order_no: 'NO20261006012',
    user_id: 'U1012',
    payment_channel: 'stripe',
    amount: 19.99,
    currency: 'USD',
    status: 'paid',
    created_at: '2026-10-06T04:35:00Z',
  },
]);

/**
 * Stable row order: created_at ascending, then order_id ascending.
 *
 * @param {object[]} orders
 * @returns {object[]}
 */
export function sortOrders(orders) {
  return [...orders].sort((left, right) => {
    if (left.created_at !== right.created_at) {
      return left.created_at < right.created_at ? -1 : 1;
    }
    return left.order_id < right.order_id ? -1 : left.order_id > right.order_id ? 1 : 0;
  });
}

/**
 * Create an order repository over the supplied rows.
 *
 * `listByPaymentChannels` is the query stage used by the export endpoint. An
 * empty channel list means "no filter", so all orders are returned.
 *
 * @param {object[]} [orders]
 */
export function createOrderRepository(orders = SEED_ORDERS) {
  const rows = sortOrders(orders);

  return {
    listAll() {
      return [...rows];
    },
    /**
     * @param {string[]} [channels] canonical channel values
     * @returns {object[]}
     */
    listByPaymentChannels(channels) {
      if (!Array.isArray(channels) || channels.length === 0) {
        return [...rows];
      }
      const selected = new Set(channels);
      return rows.filter((order) => selected.has(order.payment_channel));
    },
  };
}
