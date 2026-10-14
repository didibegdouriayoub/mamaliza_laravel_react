import { printDocument, fmtDate } from '@/lib/printDocument';
import type { Tournee } from '@/services/tourneeService';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

const CSS = `
  .tp-title{font-size:20pt;font-weight:800;color:#D4162E;}
  .tp-sub{font-size:10pt;margin:4px 0 14px;color:#1a1a1a;}
  .tp-h{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:16px 0 6px;}
  table.tp{width:100%;border-collapse:collapse;font-size:9pt;}
  table.tp th{background:#D4162E;color:#fff;text-align:left;padding:6px 8px;font-size:8pt;}
  table.tp td{border-bottom:1px solid #cbd5e1;padding:7px 8px;}
  table.tp td.c,table.tp th.c{text-align:center;}
  table.tp.write td{height:26px;}
  .tp-sign{display:flex;gap:40px;}
  .tp-sign div{flex:1;border-top:1px solid #1a1a1a;padding-top:6px;font-size:8pt;color:#64748b;}
`;

/** Paper for the worker: what he takes (to sign) and a table to write who got what during the day. */
export function printTourneeSheet(t: Tournee) {
  const rows = t.items.map(i => `<tr>
      <td>${esc(i.product_name)}</td>
      <td>${esc(i.lot_code || '—')}${i.lot_date ? ` <span style="color:#64748b">· ${fmtDate(i.lot_date)}</span>` : ''}</td>
      <td class="c"><b>${i.qty_loaded}</b></td>
    </tr>`).join('');
  const blank = Array.from({ length: 14 }, () => '<tr><td></td><td></td><td></td></tr>').join('');

  const html = `
    <style>${CSS}</style>
    <div class="tp-title">BON DE CHARGEMENT</div>
    <div class="tp-sub"><b>${esc(t.worker_name)}</b> · ${fmtDate(t.date)} · Tournée #${t.id}${t.notes ? ` · ${esc(t.notes)}` : ''}</div>

    <div class="tp-h">Marchandise chargée</div>
    <table class="tp">
      <thead><tr><th>Produit</th><th>Lot</th><th class="c">Quantité</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="tp-h">Livraisons (à remplir pendant la journée)</div>
    <table class="tp write">
      <thead><tr><th style="width:38%">Client</th><th>Produits donnés</th><th class="c" style="width:16%">Encaissé</th></tr></thead>
      <tbody>${blank}</tbody>
    </table>

    <div class="push-bottom">
      <div class="tp-sign"><div>Chargé par</div><div>Reçu par ${esc(t.worker_name)} (signature)</div></div>
    </div>`;

  printDocument(`Tournée ${t.worker_name} ${t.date}`, html, { fullPage: true });
}
