// Obrazovka Srovnání – graf posledních 6/12 měsíců, ukazatele, změna proti předchozímu měsíci.
// Období je v URL: #compare/12 (výchozí 6).
import { t, formatMoney, formatDate, formatNumber, formatCompact } from '../i18n.js';
import { periodStats, pctChange } from '../calc.js';
import { addMonths, parseDate, todayISO } from '../schedule.js';

// Pořadí = pořadí ve sloupci (od základny), musí sedět s paletou v styles.css.
const STACK = ['base', 'tips', 'companies', 'late', 'weekend', 'holiday', 'extra'];
const PARTS = [...STACK, 'sick'];
const PERIODS = [6, 12];

const monthName = (ym, month = 'long') =>
  formatDate(parseDate(ym + '-01'), { month, year: month === 'long' ? 'numeric' : undefined, timeZone: 'UTC' });

function change(cur, prev) {
  const p = pctChange(cur, prev);
  if (p === null) return '<span class="muted">—</span>';
  const arrow = p > 0 ? '▲' : p < 0 ? '▼' : '';
  return `${arrow} ${p > 0 ? '+' : ''}${formatNumber(p, 1)} %`;
}

export function render(root, ctx, param) {
  const { settings, days } = ctx.data;
  const n = PERIODS.includes(Number(param)) ? Number(param) : PERIODS[0];
  const current = todayISO().slice(0, 7);
  const yms = Array.from({ length: n }, (_, i) => addMonths(current, i - n + 1));
  const stats = periodStats(yms, days, settings);
  const cur = stats.months.at(-1);
  const prev = periodStats([addMonths(current, -1)], days, settings).months[0];

  const stackSum = m => STACK.reduce((s, k) => s + Math.max(0, m[k]), 0);
  const max = Math.max(...stats.months.map(stackSum));

  const chart = `
    <div class="chart ${n > 6 ? 'dense' : ''}" role="list" aria-label="${t('compare.chartLabel')}">
      ${stats.months.map(m => `
        <button class="col ${m.ym === current ? 'current' : ''}" data-ym="${m.ym}" role="listitem"
                title="${monthName(m.ym)}: ${formatMoney(m.total)}">
          <span class="col-track" style="--h: ${max ? stackSum(m) / max * 100 : 0}%">
            <span class="col-value">${m.total ? formatCompact(m.total) : ''}</span>
            <span class="col-bar">
              ${STACK.filter(k => m[k] > 0).map(k =>
                `<span style="--c: var(--c-${k}); flex-grow: ${m[k]}"></span>`).join('')}
            </span>
          </span>
          <span class="col-label">${monthName(m.ym, 'short')}</span>
        </button>`).join('')}
    </div>
    <ul class="dot-legend">
      ${STACK.map(k => `<li><i class="dot" style="--c: var(--c-${k})"></i>${t('part.' + k)}</li>`).join('')}
    </ul>`;

  const rows = ['total', ...PARTS].filter(k => cur[k] || prev[k]);

  root.innerHTML = `
    <h1>${t('tab.compare')}</h1>
    <div class="segmented period" id="period">
      ${PERIODS.map(p => `<button data-n="${p}" class="${p === n ? 'on' : ''}">${t('compare.months', { n: p })}</button>`).join('')}
    </div>

    ${stats.best ? `
    <div class="card">${chart}</div>

    <div class="kpis">
      <div class="card kpi"><span class="muted">${t('compare.avgTips')}</span><strong>${formatMoney(stats.avgTips)}</strong></div>
      <div class="card kpi"><span class="muted">${t('compare.hourly')}</span><strong>${t('compare.perHour', { v: formatMoney(Math.round(stats.hourly)) })}</strong></div>
      <div class="card kpi"><span class="muted">${t('compare.best')}</span><strong>${formatMoney(Math.round(stats.best.total))}</strong><span class="muted">${monthName(stats.best.ym)}</span></div>
      <div class="card kpi"><span class="muted">${t('compare.companies')}</span><strong>${stats.companyCount}×</strong><span class="muted">${formatMoney(stats.companyBonus)}</span></div>
    </div>

    <h2>${t('compare.vsPrev', { cur: monthName(current), prev: monthName(addMonths(current, -1)) })}</h2>
    <div class="card">
      <table class="diff-table">
        ${rows.map(k => `
          <tr class="${k === 'total' ? 'total-row' : ''}">
            <th>${k === 'total' ? t('compare.total') : `<span class="part" style="--c: var(--c-${k})">${t('part.' + k)}</span>`}</th>
            <td>${formatMoney(cur[k])}</td>
            <td class="pct">${change(cur[k], prev[k])}</td>
          </tr>`).join('')}
      </table>
    </div>` : `<div class="card muted">${t('compare.empty')}</div>`}`;

  root.querySelector('#period').addEventListener('click', e => {
    const p = e.target.closest('button')?.dataset.n;
    if (p) location.hash = `#compare/${p}`;
  });
  root.querySelector('.chart')?.addEventListener('click', e => {
    const ym = e.target.closest('[data-ym]')?.dataset.ym;
    if (ym) location.hash = `#month/${ym}`;
  });
}
