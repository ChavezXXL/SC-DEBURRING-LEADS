import type { Lead } from '../types';

/**
 * Shared CSV export for leads — the single source of truth for column order
 * and RFC-4180 escaping. Both the Settings "Export leads CSV" and the Leads-tab
 * "Export selected" bulk action import from here so the two exports can never
 * drift apart.
 */

/** Exact export column order — matches the lead schema fields that matter. */
export const CSV_COLUMNS = [
  'co',
  'address',
  'city',
  'r',
  't',
  'status',
  'em',
  'ph',
  'web',
  'pm',
  'who',
  'lastContactedAt',
  'touchCount',
] as const;

/** RFC-4180 escaping: quote any field with commas, quotes, or newlines. */
export function csvEscape(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildLeadsCsv(leads: Lead[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = leads.map((l) => CSV_COLUMNS.map((c) => csvEscape(l[c])).join(','));
  return [header, ...rows].join('\r\n');
}

/**
 * Trigger a browser download of the given leads as a CSV file.
 * Prepends a UTF-8 BOM so Excel opens it without mangling accents.
 */
export function downloadLeadsCsv(leads: Lead[], filename: string): void {
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + buildLeadsCsv(leads)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
