/**
 * HTTP request handler for the order export API.
 *
 * `GET /api/orders/export` validates the payment channel filter first, then
 * queries orders and serializes the already-filtered rows to CSV. Validation
 * failures return JSON 400 responses without touching the order data source.
 */
import { createOrderRepository } from './orders.js';
import { serializeOrdersToCsv } from './csv.js';
import {
  parsePaymentChannelFilter,
  PaymentChannelValidationError,
} from './paymentChannelFilter.js';

export const EXPORT_PATH = '/api/orders/export';

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {object} body
 */
function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {PaymentChannelValidationError} error
 */
function sendValidationError(response, error) {
  sendJson(response, 400, {
    error: {
      code: error.code,
      message: error.message,
      ...error.details,
    },
  });
}

/**
 * Create the request handler.
 *
 * The repository is injectable so tests can verify that validation failures
 * never reach the order query stage.
 *
 * @param {{repository?: ReturnType<typeof createOrderRepository>}} [options]
 */
export function createRequestHandler({ repository = createOrderRepository() } = {}) {
  return function handleRequest(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname !== EXPORT_PATH) {
      sendJson(response, 404, {
        error: { code: 'NOT_FOUND', message: '接口不存在' },
      });
      return;
    }

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      sendJson(response, 405, {
        error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求' },
      });
      return;
    }

    let filter;
    try {
      filter = parsePaymentChannelFilter(url.searchParams.getAll('payment_channel'));
    } catch (error) {
      if (error instanceof PaymentChannelValidationError) {
        sendValidationError(response, error);
        return;
      }
      throw error;
    }

    const orders = repository.listByPaymentChannels(filter.channels);
    const csv = serializeOrdersToCsv(orders);

    response.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="orders.csv"',
      'Content-Length': Buffer.byteLength(csv),
    });
    response.end(csv);
  };
}
