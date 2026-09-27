// Obrazovka Měsíc – souhrn, rozpad, kalendář, firmy. Měsíc je v URL: #month/2026-09.
import { t, formatMoney, formatDate, formatNumber } from '../i18n.js';
import { monthBreakdown, dayBreakdown, dayFlags, missingDays, monthHours } from '../calc.js';
import { addDays, addMonths, parseDate, todayISO, mondayOf, weekType, isoWeek } from '../schedule.js';
import { shareApp } from './share.js';

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
  const hrs = monthHours(ym, days, settings);
  const left = hrs.planned - hrs.done;

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
  // Řádky kalendáře = týdny od pondělí; u každého štítek D/K podle rozvrhu.
  const weeks = [];
  for (let monday = mondayOf(monthDays[0]); monday <= monthDays.at(-1); monday = addDays(monday, 7)) weeks.push(monday);

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
      <div class="muted">${t('month.hoursShifts', { h: formatNumber(hrs.done, 1), plan: formatNumber(hrs.planned, 1), n: m.shifts })}</div>
      ${hrs.planned ? `<div class="hours-left">${left > 0 ? t('month.hoursLeft', { h: formatNumber(left, 1) }) : left < 0 ? t('month.hoursOver', { h: formatNumber(-left, 1) }) : t('month.hoursDone')}</div>` : ''}
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
      <div class="cal-nav">
        <button class="icon-btn" data-go="-1" aria-label="${t('month.prev')}">‹</button>
        <strong class="month-title">${title}</strong>
        <button class="icon-btn" data-go="1" aria-label="${t('month.next')}">›</button>
      </div>
      <div class="calendar">
        <span></span>
        ${weekdayNames.map(n => `<span class="cal-head">${n}</span>`).join('')}
        ${weeks.map(monday => {
          const type = weekType(monday, settings.schedule);
          return `
          <span class="cal-week" title="${t('week.' + type)} · ${t('week.number', { n: isoWeek(monday) })}">
            <b>${t('week.' + type + 'Short')}</b><small>${isoWeek(monday)}</small>
          </span>
          ${[0, 1, 2, 3, 4, 5, 6].map(i => {
            const iso = addDays(monday, i);
            if (!iso.startsWith(ym)) return '<span></span>';
            const flags = dayFlags(iso, settings);
            return `
            <button class="cal-day ${iso === today ? 'today' : ''} ${flags.holiday ? 'is-holiday' : ''} ${flags.scheduled ? 'is-work' : ''}" data-iso="${iso}">
              <span>${Number(iso.slice(8))}</span>
              <span class="dots">${dots[iso].map(d => `<i class="dot dot-${d}"></i>`).join('')}</span>
            </button>`;
          }).join('')}`;
        }).join('')}
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
    </div>` : ''}

    <button class="btn-link" id="share">${t('share.button')}</button>`;

  const goMonth = n => { location.hash = `#month/${addMonths(ym, n)}`; };
  root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => goMonth(Number(btn.dataset.go))));
  root.querySelector('#share').addEventListener('click', shareApp);

  // Přejetí prstem po kalendáři: doleva = další měsíc, doprava = předchozí.
  const cal = root.querySelector('.calendar');
  let touch = null;
  cal.addEventListener('touchstart', e => { touch = e.touches[0]; }, { passive: true });
  cal.addEventListener('touchend', e => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.clientX;
    const dy = e.changedTouches[0].clientY - touch.clientY;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(dx < 0 ? 1 : -1);
  });

  cal.addEventListener('click', e => {
    const iso = e.target.closest('[data-iso]')?.dataset.iso;
    if (iso) location.hash = `#entry/${iso}`;
  });
}
