/**
 * CSV serialization.
 *
 * Format contract (identical for filtered and unfiltered exports):
 * - UTF-8, no BOM
 * - comma delimiter
 * - `\n` line break, including one trailing line break after the last row
 * - RFC 4180 quoting: fields containing `,`, `"`, CR or LF are quoted and
 *   embedded quotes are doubled
 * - empty values are written as empty fields
 * - amounts use fixed 2 decimals, no thousands separator and no currency symbol
 * - timestamps are ISO 8601 UTC strings ending in `Z`
 */
import { ORDER_COLUMNS } from './orders.js';

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatAmount(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return formatCsvField(value);
  }
  return numeric.toFixed(2);
}

/**
 * @param {string} field
 * @returns {string}
 */
export function escapeCsvField(field) {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * @param {string} column
 * @param {object} order
 * @returns {string}
 */
function renderField(column, order) {
  if (column === 'amount') {
    return formatAmount(order.amount);
  }
  return formatCsvField(order[column]);
}

/**
 * @param {object[]} orders
 * @param {readonly string[]} [columns]
 * @returns {string}
 */
export function serializeOrdersToCsv(orders, columns = ORDER_COLUMNS) {
  const lines = [columns.join(',')];
  for (const order of orders) {
    lines.push(columns.map((column) => escapeCsvField(renderField(column, order))).join(','));
  }
  return `${lines.join('\n')}\n`;
}
