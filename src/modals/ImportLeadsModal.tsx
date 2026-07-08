import React, { useMemo, useRef, useState } from 'react';
import { Upload, X, Check, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Lead } from '../types';

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  /** Current workspace leads — used to skip duplicates. */
  existingLeads: Lead[];
  /** Active workspace tenant — every imported lead is stamped with this. */
  tenantId: string | undefined;
  /** Called after a successful import with the number of leads written. */
  onImported: (count: number) => void;
}

/** Firestore batch cap is 500 ops; stay comfortably under. */
const BATCH_CHUNK = 400;

/**
 * CSV lead import — onboard a whole lead list in one shot.
 *
 * Flow: choose/paste a CSV → headers auto-map to lead fields → preview shows
 * what's new vs. duplicate → import writes in batched chunks, every row stamped
 * with the ACTIVE workspace's tenantId (so a super-admin imports into whichever
 * client they're operating).
 *
 * Dedupe: a row is a duplicate if its normalized company name OR its email
 * matches an existing lead (or an earlier row in the same file).
 */
export function ImportLeadsModal({
  open,
  onClose,
  existingLeads,
  tenantId,
  onImported,
}: ImportLeadsModalProps) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; dupes: number; empty: number } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!csvText.trim()) return null;
    try {
      return analyzeCsv(csvText, existingLeads);
    } catch (e: any) {
      return { error: e?.message || 'Could not parse that CSV.' } as const;
    }
  }, [csvText, existingLeads]);

  if (!open) return null;

  const reset = () => {
    setCsvText('');
    setFileName(null);
    setError(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(f);
  };

  const runImport = async () => {
    if (!parsed || 'error' in parsed || parsed.rows.length === 0 || busy) return;
    if (!tenantId) {
      setError('No workspace loaded — pick a client workspace first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const stamp = `[${new Date().toISOString().slice(0, 10)}] Imported from CSV${
        fileName ? ` (${fileName})` : ''
      }.`;
      const leads: Lead[] = parsed.rows.map((r) => ({
        id:
          (r.co || 'lead').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) +
          '-' +
          Math.random().toString(36).substring(2, 7),
        tenantId,
        status: 'new',
        notes: r.notes ? `${r.notes}\n${stamp}` : stamp,
        t: 2,
        r: 'Other',
        co: r.co,
        city: r.city || '',
        ph: r.ph || '',
        em: r.em || '',
        web: r.web || '',
        who: r.who || '',
        role: r.role || '',
        pm: r.pm || '',
        pm_title: r.pm_title || '',
        parts: r.parts || '',
        pitch: '',
      }));
      for (let i = 0; i < leads.length; i += BATCH_CHUNK) {
        const batch = writeBatch(db);
        for (const lead of leads.slice(i, i + BATCH_CHUNK)) {
          batch.set(doc(db, 'leads', lead.id), lead);
        }
        await batch.commit();
      }
      setDone({ imported: leads.length, dupes: parsed.dupes, empty: parsed.empty });
      onImported(leads.length);
    } catch (e: any) {
      setError(e?.message || 'Import failed — nothing may have been written. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import leads from CSV"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-apex-850 shadow-2xl shadow-black/60 ring-1 ring-white/10 motion-safe:animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-6 pb-3 pt-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Import leads</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Drop in a CSV — duplicates are skipped automatically.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {done ? (
            <>
              <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/30">
                <Check size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                <div className="text-sm text-emerald-300">
                  <div className="font-semibold">
                    {done.imported} lead{done.imported === 1 ? '' : 's'} imported
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-300/80">
                    {done.dupes} duplicate{done.dupes === 1 ? '' : 's'} skipped
                    {done.empty > 0 ? ` · ${done.empty} empty row${done.empty === 1 ? '' : 's'} ignored` : ''}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 rounded-xl bg-apex-800 px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-slate-100"
                >
                  Import another file
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              {/* File picker */}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-apex-800/50 px-4 py-8 text-sm text-slate-400 transition hover:border-apex-accent/40 hover:text-slate-200"
              >
                <FileSpreadsheet size={20} className="text-apex-accent" />
                {fileName ? (
                  <span className="truncate text-slate-200">{fileName}</span>
                ) : (
                  <span>
                    Choose a CSV file
                    <span className="block text-[10px] text-slate-500">
                      Exported from Excel, Sheets, Apollo, or another CRM
                    </span>
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />

              {/* Paste fallback */}
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none hover:text-slate-300">
                  …or paste CSV text
                </summary>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setFileName(null);
                  }}
                  rows={5}
                  placeholder={'company,city,email\nAcme Machine,Burbank,rfq@acme.com'}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-apex-800 px-3 py-2 font-mono text-[11px] text-slate-100 placeholder-slate-600 focus:border-apex-accent/60 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
                />
              </details>

              {/* Preview */}
              {parsed && 'error' in parsed && (
                <Callout tone="red">{parsed.error}</Callout>
              )}
              {parsed && !('error' in parsed) && (
                <div className="rounded-xl bg-apex-800 p-4 ring-1 ring-white/10">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                    Preview
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <PreviewStat label="New leads" value={parsed.rows.length} accent="text-emerald-400" />
                    <PreviewStat label="Duplicates" value={parsed.dupes} accent="text-amber-400" />
                    <PreviewStat label="Empty rows" value={parsed.empty} accent="text-slate-400" />
                  </div>
                  {parsed.mappedColumns.length > 0 && (
                    <div className="mt-3 text-[10px] text-slate-500">
                      Matched columns:{' '}
                      <span className="text-slate-400">{parsed.mappedColumns.join(', ')}</span>
                    </div>
                  )}
                  {parsed.rows.length > 0 && (
                    <div className="mt-2 truncate text-[10px] text-slate-500">
                      First: <span className="text-slate-300">{parsed.rows[0].co}</span>
                      {parsed.rows[0].city ? ` — ${parsed.rows[0].city}` : ''}
                      {parsed.rows[0].em ? ` · ${parsed.rows[0].em}` : ''}
                    </div>
                  )}
                  {parsed.rows.length === 0 && (
                    <div className="mt-3 text-[11px] text-amber-300">
                      Nothing new to import — every row matched an existing lead. Make sure
                      the file has a company or email column.
                    </div>
                  )}
                </div>
              )}

              {error && <Callout tone="red">{error}</Callout>}

              <button
                onClick={runImport}
                disabled={busy || !parsed || 'error' in parsed || parsed.rows.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-apex-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {busy
                  ? 'Importing…'
                  : parsed && !('error' in parsed) && parsed.rows.length > 0
                    ? `Import ${parsed.rows.length} lead${parsed.rows.length === 1 ? '' : 's'}`
                    : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- pieces --------------------------------------------------------------- */

function PreviewStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg bg-apex-850 px-2 py-2 ring-1 ring-white/10">
      <div className={`text-lg font-semibold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'red'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ---- CSV parsing + mapping ------------------------------------------------ */

interface ImportRow {
  co: string;
  city?: string;
  em?: string;
  ph?: string;
  web?: string;
  who?: string;
  role?: string;
  pm?: string;
  pm_title?: string;
  parts?: string;
  notes?: string;
}

/** RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, commas and
 * newlines inside quotes. No external dependency. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      cur = '';
      rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  rows.push(row);
  // Drop fully-empty trailing rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Header → Lead-field mapping. First alias that matches wins per field. */
const HEADER_MAP: Array<{ field: keyof ImportRow; aliases: string[] }> = [
  { field: 'co', aliases: ['company', 'company name', 'business', 'business name', 'account', 'organization', 'shop', 'co', 'name'] },
  { field: 'city', aliases: ['city', 'location', 'town'] },
  { field: 'em', aliases: ['email', 'e-mail', 'email address', 'em', 'work email'] },
  { field: 'ph', aliases: ['phone', 'phone number', 'tel', 'telephone', 'ph', 'mobile'] },
  { field: 'web', aliases: ['website', 'web', 'url', 'site', 'domain'] },
  { field: 'who', aliases: ['contact', 'contact name', 'person', 'first name', 'full name', 'who'] },
  { field: 'role', aliases: ['role', 'job title'] },
  { field: 'pm', aliases: ['pm', 'purchasing manager', 'buyer'] },
  { field: 'pm_title', aliases: ['pm title', 'pm_title', 'buyer title'] },
  { field: 'parts', aliases: ['parts', 'products', 'industry', 'what they make'] },
  { field: 'notes', aliases: ['notes', 'note', 'comments', 'description'] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function analyzeCsv(text: string, existing: Lead[]) {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    throw new Error('Need a header row plus at least one data row.');
  }
  const headers = grid[0].map((h) => h.trim().toLowerCase());

  // Map each Lead field to a column index. 'name' is ambiguous — it only maps
  // to company if no better company column exists (checked by alias order:
  // specific aliases come first in the list, so a real "company" column wins).
  const colFor = new Map<keyof ImportRow, number>();
  for (const { field, aliases } of HEADER_MAP) {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1 && ![...colFor.values()].includes(idx)) {
        colFor.set(field, idx);
        break;
      }
    }
  }
  if (!colFor.has('co') && !colFor.has('em')) {
    throw new Error(
      `Couldn't find a company or email column. Headers seen: ${headers.slice(0, 8).join(', ')}`,
    );
  }

  // Existing-lead dedupe keys
  const seenCo = new Set(existing.map((l) => norm(l.co)).filter(Boolean));
  const seenEm = new Set(existing.map((l) => (l.em || '').toLowerCase().trim()).filter(Boolean));

  const rows: ImportRow[] = [];
  let dupes = 0;
  let empty = 0;
  for (const raw of grid.slice(1)) {
    const get = (f: keyof ImportRow) => {
      const idx = colFor.get(f);
      return idx === undefined ? '' : (raw[idx] || '').trim();
    };
    const co = get('co') || get('em').split('@')[1]?.split('.')[0] || '';
    const em = get('em').toLowerCase();
    if (!co && !em) {
      empty++;
      continue;
    }
    const coKey = norm(co);
    if ((coKey && seenCo.has(coKey)) || (em && seenEm.has(em))) {
      dupes++;
      continue;
    }
    if (coKey) seenCo.add(coKey);
    if (em) seenEm.add(em);
    rows.push({
      co: co || em,
      city: get('city'),
      em,
      ph: get('ph'),
      web: get('web'),
      who: get('who'),
      role: get('role'),
      pm: get('pm'),
      pm_title: get('pm_title'),
      parts: get('parts'),
      notes: get('notes'),
    });
  }

  return {
    rows,
    dupes,
    empty,
    mappedColumns: [...colFor.keys()] as string[],
  };
}
