import { printDocument, fmtDate } from '@/lib/printDocument';
import { Order } from '@/models/types';

export type DocKind = 'facture' | 'devis' | 'bl';

const COMPANY = {
  name: 'MAMALIA SARL',
  address: 'Hay Al Majd Lot 139 N°1 - Tanger',
  tel: '0695070681',
  if_: '52442341',
  tp: '57124515',
  rc: '126869',
  ice: '003064129000011',
  cnss: '5261335',
  email: 'mamalia12023@gmail.com',
};

/** Product prices already include the tax (TTC): HT and TVA are worked back from them. */
const TVA_RATE = 0.2;
const toHT = (ttc: number) => ttc / (1 + TVA_RATE);

const fmtMAD = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

const CSS = `
  .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
  .inv-title{font-size:34pt;font-weight:900;color:#D4162E;line-height:1;}
  .inv-co-name{font-size:11pt;font-weight:700;margin-top:6px;}
  .inv-co-info{font-size:7.5pt;color:#64748b;line-height:1.75;margin-top:3px;}
  .inv-ref-box{background:#f1f5f9;padding:14px 18px;min-width:190px;border-radius:4px;text-align:left;}
  .inv-ref-lbl{font-size:6.5pt;text-transform:uppercase;letter-spacing:.09em;color:#64748b;}
  .inv-ref-num{font-size:12pt;font-weight:800;color:#D4162E;margin:2px 0 10px;}
  .inv-ref-field{font-size:6.5pt;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-top:7px;}
  .inv-ref-val{font-size:9pt;font-weight:600;color:#1a1a1a;}
  .inv-sep{border:none;border-top:1.5px solid #e2e8f0;margin:10px 0;}
  .inv-sep-red{border:none;border-top:2px solid #D4162E;margin:12px 0;}
  .inv-parties{display:flex;gap:10px;margin:14px 0;}
  .inv-party{flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:11px 14px;border-radius:4px;}
  .inv-party-lbl{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#D4162E;margin-bottom:5px;}
  .inv-party-name{font-size:10pt;font-weight:700;}
  .inv-party-info{font-size:7.5pt;color:#64748b;margin-top:3px;line-height:1.65;}
  table.inv-tbl{width:100%;border-collapse:collapse;font-size:8pt;margin-top:14px;}
  table.inv-tbl thead tr{background:#D4162E;}
  table.inv-tbl th{color:#fff;padding:8px 10px;font-size:7pt;font-weight:700;text-align:left;letter-spacing:.04em;}
  table.inv-tbl th.r{text-align:right;}
  table.inv-tbl th.c{text-align:center;}
  table.inv-tbl td{padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#1a1a1a;}
  table.inv-tbl td.r{text-align:right;}
  table.inv-tbl td.c{text-align:center;}
  table.inv-tbl tbody tr:last-child td{border-bottom:none;}
  .inv-totals{margin-top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
  .inv-tot-row{display:flex;width:280px;justify-content:space-between;font-size:9pt;}
  .inv-tot-row span:first-child{color:#64748b;}
  .inv-tot-row span:last-child{font-weight:600;text-align:right;}
  .inv-ttc{background:#D4162E;color:#fff;padding:8px 14px;border-radius:4px;margin-top:4px;display:flex;width:280px;justify-content:space-between;font-size:10pt;font-weight:700;}
  .inv-thank{text-align:center;font-size:9pt;color:#64748b;margin-top:24px;}
  .inv-footer-legal{text-align:center;font-size:6.5pt;color:#94a3b8;margin-top:6px;}
  .bl-sign{display:flex;gap:40px;margin-top:48px;}
  .bl-sign div{flex:1;border-top:1px solid #1a1a1a;padding-top:6px;font-size:8pt;color:#64748b;}
`;

/** Add `days` to an ISO date (for the devis validity date). */
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/**
 * Print a facture, a devis or a bon de livraison (delivery note: quantities only, no prices) for an order.
 * The reference is the order's sequential number (FA-2026-0001 / DV-2026-0001).
 */
export function printOrderDocument(order: Order, kind: DocKind, customerAddress = '') {
  const ref = order.docNumber ?? `#${order.id}`;
  const showPrices = kind !== 'bl';
  const title = kind === 'devis' ? 'DEVIS' : kind === 'bl' ? 'BON DE LIVRAISON' : 'FACTURE';
  const created = order.createdAt || new Date().toISOString();
  const secondLabel = kind === 'devis' ? "Validité jusqu'au" : kind === 'bl' ? 'Livraison' : "Date d'échéance";
  const secondDate = kind === 'devis' ? addDays(created, 30) : created;

  const ttc = +order.totalAmount.toFixed(2);
  const totalHT = +toHT(ttc).toFixed(2);
  const tva = +(ttc - totalHT).toFixed(2);

  const rows = (order.items || []).map(item => showPrices
    ? `<tr>
        <td>${esc(item.productName)}</td>
        <td>${item.finishedProductId ? String(item.finishedProductId).padStart(3, '0') : '—'}</td>
        <td class="c">${item.quantity}</td>
        <td class="r">${fmtMAD(toHT(item.unitPrice ?? 0))}</td>
        <td class="r" style="color:#D4162E;font-weight:700;">${fmtMAD(toHT(item.total))}</td>
      </tr>`
    : `<tr>
        <td>${esc(item.productName)}</td>
        <td>${item.finishedProductId ? String(item.finishedProductId).padStart(3, '0') : '—'}</td>
        <td class="c">${item.quantity}</td>
      </tr>`).join('');

  const head = showPrices
    ? `<th>Désignation</th><th>Réf. Produit</th><th class="c">Qté</th><th class="r">P.U. HT (MAD)</th><th class="r">Total HT (MAD)</th>`
    : `<th>Désignation</th><th>Réf. Produit</th><th class="c">Qté</th>`;

  const totals = showPrices
    ? `<div class="inv-totals">
        <div class="inv-tot-row"><span>Total HT</span><span>${fmtMAD(totalHT)}</span></div>
        <div class="inv-tot-row"><span>TVA (${TVA_RATE * 100}%)</span><span>${fmtMAD(tva)}</span></div>
        <div class="inv-ttc"><span>Total TTC</span><span>${fmtMAD(ttc)}</span></div>
      </div>`
    : `<div class="bl-sign"><div>Livré par</div><div>Reçu par (nom, date, signature)</div></div>`;

  const html = `
    <style>${CSS}</style>
    <div class="inv-top">
      <div>
        <div class="inv-title">${title}</div>
        <div class="inv-co-name">${COMPANY.name}</div>
        <div class="inv-co-info">
          ${COMPANY.address}<br>
          Tél : ${COMPANY.tel}<br>
          IF : ${COMPANY.if_} | TP : ${COMPANY.tp}<br>
          RC : ${COMPANY.rc} | ICE : ${COMPANY.ice}<br>
          CNSS : ${COMPANY.cnss}<br>
          Email : ${COMPANY.email}
        </div>
      </div>
      <div class="inv-ref-box">
        <div class="inv-ref-lbl">Référence</div>
        <div class="inv-ref-num">${esc(ref)}</div>
        <div class="inv-ref-field">Date d'émission</div>
        <div class="inv-ref-val">${fmtDate(created)}</div>
        <div class="inv-ref-field">${secondLabel}</div>
        <div class="inv-ref-val">${fmtDate(secondDate)}</div>
      </div>
    </div>

    <hr class="inv-sep">

    <div class="inv-parties">
      <div class="inv-party">
        <div class="inv-party-lbl">Émetteur</div>
        <div class="inv-party-name">${COMPANY.name}</div>
        <div class="inv-party-info">Hay Al Majd Lot 139 N°1<br>Tanger, Maroc<br>ICE : ${COMPANY.ice}</div>
      </div>
      <div class="inv-party">
        <div class="inv-party-lbl">Client</div>
        <div class="inv-party-name">${esc(order.customerName)}</div>
        <div class="inv-party-info">${customerAddress ? esc(customerAddress).replace(/\n/g, '<br>') : '&nbsp;'}</div>
      </div>
    </div>

    <table class="inv-tbl">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${totals}

    <div class="push-bottom">
      <div class="inv-thank">Merci pour votre confiance</div>
      <hr class="inv-sep-red">
      <div class="inv-footer-legal">
        ${COMPANY.name} | IF : ${COMPANY.if_} | TP : ${COMPANY.tp} | RC : ${COMPANY.rc} | ICE : ${COMPANY.ice} | CNSS : ${COMPANY.cnss}
      </div>
    </div>`;

  printDocument(`${title} ${ref}`, html, { fullPage: true });
}
