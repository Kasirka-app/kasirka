// Obrazovka Měsíc – souhrn, rozpad, kalendář, firmy. Měsíc je v URL: #month/2026-09.
import { t, formatMoney, formatDate, formatNumber } from '../i18n.js';
import { monthBreakdown, dayBreakdown, dayFlags, missingDays } from '../calc.js';
import { addDays, addMonths, parseDate, todayISO, weekday } from '../schedule.js';

const PARTS = ['base', 'tips', 'companies', 'late', 'weekend', 'holiday', 'extra', 'sick'];
const DOTS = ['work', 'extra', 'holiday', 'company', 'vacation', 'sick', 'swapped', 'missing'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const utc = { timeZone: 'UTC' };

export function render(root, ctx, param) {
  const { settings, days } = ctx.data;
  const today = todayISO();
  const ym = /^\d{4}-\d{2}$/.test(param) ? param : today.slice(0, 7);
  const m = monthBreakdown(ym, days, settings);
  const missing = missingDays(ym, days, settings, today);

  const title = formatDate(parseDate(ym + '-01'), { month: 'long', year: 'numeric', ...utc });
  const monthDays = [];
  for (let iso = ym + '-01'; iso.startsWith(ym); iso = addDays(iso, 1)) monthDays.push(iso);

  // Tečky dne: hlavní typ + svátek + firma.
  function dotsOf(iso) {
    const day = days[iso];
    if (!day) return missing.includes(iso) ? ['missing'] : [];
    if (day.type !== 'work') return [day.type];
    const b = dayBreakdown(iso, day, settings);
    return [b.extra ? 'extra' : 'work', b.holiday && 'holiday', day.companies?.length && 'company'].filter(Boolean);
  }
  const dots = Object.fromEntries(monthDays.map(iso => [iso, dotsOf(iso)]));
  const usedDots = DOTS.filter(d => Object.values(dots).some(list => list.includes(d)));

  const positive = PARTS.filter(k => k !== 'sick' && m[k] > 0);
  const sumPositive = positive.reduce((s, k) => s + m[k], 0);

  // Pondělí jako první den týdne (21. 9. 2026 je pondělí).
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map(i =>
    formatDate(parseDate(addDays('2026-09-21', i)), { weekday: 'narrow', ...utc }));
  const lead = (weekday(monthDays[0]) + 6) % 7;

  const companies = monthDays.flatMap(iso => (days[iso]?.type === 'work' ? days[iso].companies ?? [] : [])
    .map(c => ({ ...c, iso })));

  root.innerHTML = `
    <div class="date-nav">
      <button class="icon-btn" data-go="-1" aria-label="${t('month.prev')}">‹</button>
      <h1 class="month-title">${title}</h1>
      <button class="icon-btn" data-go="1" aria-label="${t('month.next')}">›</button>
    </div>

    <div class="card summary">
      <div class="big-number">${formatMoney(m.total)}</div>
      <div class="muted">${t('month.hoursShifts', { h: formatNumber(m.hours, 1), n: m.shifts })}</div>
      ${missing.length ? `<div class="missing-note">${t('month.missing', { n: missing.length })}</div>` : ''}
    </div>

    ${sumPositive ? `
    <div class="card">
      <div class="stack-bar">
        ${positive.map(k => `<span style="--c: var(--c-${k}); width: ${m[k] / sumPositive * 100}%"></span>`).join('')}
      </div>
      <ul class="legend">
        ${PARTS.filter(k => m[k]).map(k => `
          <li class="part" style="--c: var(--c-${k})">
            <span>${t('part.' + k)}</span><strong>${formatMoney(m[k])}</strong>
          </li>`).join('')}
      </ul>
    </div>` : `<div class="card muted">${t('month.empty')}</div>`}

    <div class="card">
      <div class="calendar">
        ${weekdayNames.map(n => `<span class="cal-head">${n}</span>`).join('')}
        ${'<span></span>'.repeat(lead)}
        ${monthDays.map(iso => `
          <button class="cal-day ${iso === today ? 'today' : ''} ${dayFlags(iso, settings).holiday ? 'is-holiday' : ''}" data-iso="${iso}">
            <span>${Number(iso.slice(8))}</span>
            <span class="dots">${dots[iso].map(d => `<i class="dot dot-${d}"></i>`).join('')}</span>
          </button>`).join('')}
      </div>
      ${usedDots.length ? `<ul class="dot-legend">
        ${usedDots.map(d => `<li><i class="dot dot-${d}"></i>${t('dot.' + d)}</li>`).join('')}
      </ul>` : ''}
    </div>

    ${companies.length ? `
    <h2>${t('month.companies')}</h2>
    <div class="card">
      <ul class="company-list">
        ${companies.map(c => `
          <li>
            <span><strong>${esc(c.name) || '—'}</strong>
              <span class="muted">${formatDate(parseDate(c.iso), { day: 'numeric', month: 'numeric', ...utc })}
              ${c.people ? ' · ' + t('month.people', { n: c.people }) : ''}</span></span>
            <strong class="bonus-amount">${formatMoney(c.bonus ?? 0)}</strong>
          </li>`).join('')}
      </ul>
    </div>` : ''}`;

  root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
    location.hash = `#month/${addMonths(ym, Number(btn.dataset.go))}`;
  }));
  root.querySelector('.calendar').addEventListener('click', e => {
    const iso = e.target.closest('[data-iso]')?.dataset.iso;
    if (iso) location.hash = `#entry/${iso}`;
  });
}
