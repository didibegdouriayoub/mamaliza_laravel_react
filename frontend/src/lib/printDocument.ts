/**
 * Opens a styled print window with the given HTML body content.
 * The caller builds the inner HTML; this function wraps it in a
 * fully-styled document shell and triggers the browser print dialog.
 */
export function printDocument(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    /* ── Reset & base ───────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 10pt; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    /* ── Brand colours ──────────────────────────────────────── */
    :root {
      --red:   #D4162E;
      --red-lt:#FDE8EB;
      --gray:  #64748b;
      --line:  #e2e8f0;
      --ok:    #16a34a;
      --warn:  #d97706;
      --err:   #dc2626;
    }

    /* ── Page shell ─────────────────────────────────────────── */
    .page {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 40px 48px;
    }

    /* ── Header ─────────────────────────────────────────────── */
    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 16px;
      border-bottom: 3px solid var(--red);
      margin-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon {
      width: 40px; height: 40px;
      background: var(--red);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -1px;
    }
    .brand-name { font-size: 13pt; font-weight: 700; color: #1a1a1a; }
    .brand-sub  { font-size: 8pt;  color: var(--gray); margin-top: 1px; }
    .doc-meta   { text-align: right; font-size: 8pt; color: var(--gray); line-height: 1.7; }
    .doc-title  { font-size: 16pt; font-weight: 700; color: var(--red); margin-top: 2px; }

    /* ── Section headings ───────────────────────────────────── */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--gray);
      border-bottom: 1px solid var(--line);
      padding-bottom: 4px;
      margin: 20px 0 10px;
    }

    /* ── Summary cards ──────────────────────────────────────── */
    .cards { display: flex; gap: 12px; margin-bottom: 20px; }
    .card {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      text-align: center;
    }
    .card-label { font-size: 8pt; color: var(--gray); margin-bottom: 4px; }
    .card-value { font-size: 14pt; font-weight: 700; }
    .card-value.green  { color: var(--ok); }
    .card-value.orange { color: var(--warn); }
    .card-value.red    { color: var(--err); }
    .card-desc  { font-size: 7.5pt; color: var(--gray); margin-top: 2px; }

    /* ── Alert banners ──────────────────────────────────────── */
    .alert {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px;
      border-radius: 6px;
      font-size: 8.5pt;
      margin-bottom: 10px;
    }
    .alert.warn  { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .alert.ok    { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .alert.info  { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

    /* ── Tables ─────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 6px;
    }
    thead tr {
      background: #f8fafc;
    }
    th {
      text-align: left;
      padding: 7px 9px;
      font-weight: 600;
      color: var(--gray);
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-bottom: 1px solid var(--line);
    }
    th.r, td.r { text-align: right; }
    td {
      padding: 7px 9px;
      border-bottom: 1px solid var(--line);
      color: #1a1a1a;
    }
    tr:last-child td { border-bottom: none; }
    tr.alt { background: #f8fafc; }
    tr.total td { font-weight: 700; border-top: 2px solid var(--line); background: #f8fafc; }

    /* ── Badges ─────────────────────────────────────────────── */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 7pt;
      font-weight: 600;
      letter-spacing: .04em;
    }
    .badge-ok     { background: #dcfce7; color: var(--ok); }
    .badge-low    { background: #fef9c3; color: var(--warn); }
    .badge-out    { background: #fee2e2; color: var(--err); }
    .badge-need   { color: var(--err); font-weight: 600; }
    .badge-gray   { background: #f1f5f9; color: #475569; }
    .badge-red    { background: #fee2e2; color: var(--red); }
    .badge-blue   { background: #dbeafe; color: #1d4ed8; }
    .badge-green  { background: #dcfce7; color: var(--ok); }
    .badge-yellow { background: #fef9c3; color: #92400e; }

    /* ── Batch section ──────────────────────────────────────── */
    .batch-block {
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-bottom: 14px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .batch-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      padding: 9px 12px;
      border-bottom: 1px solid var(--line);
    }
    .batch-header .batch-num {
      font-weight: 700;
      font-size: 9.5pt;
    }
    .batch-header .batch-meta {
      font-size: 8pt;
      color: var(--gray);
    }
    .batch-header .batch-meta span {
      font-family: monospace;
      background: #e2e8f0;
      padding: 1px 6px;
      border-radius: 4px;
      color: #1a1a1a;
      font-size: 8pt;
    }

    /* ── Signature block ────────────────────────────────────── */
    .signatures {
      display: flex;
      gap: 40px;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }
    .sig-box { flex: 1; }
    .sig-label { font-size: 8pt; color: var(--gray); margin-bottom: 28px; }
    .sig-line  { border-bottom: 1px solid #1a1a1a; }
    .sig-name  { font-size: 7.5pt; color: var(--gray); margin-top: 4px; }

    /* ── Footer ─────────────────────────────────────────────── */
    .doc-footer {
      margin-top: 32px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #94a3b8;
    }

    /* ── Print media ────────────────────────────────────────── */
    @page { margin: 14mm 10mm; }
    @media print {
      .page { padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${bodyHtml}
  </div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`);

  win.document.close();
}

/** Format a date string as DD/MM/YYYY */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Format a number as €X,XXX.XX */
export function fmtEur(n: number): string {
  return '€' + n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
