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
  const monthDaysOf = y => {
    const out = [];
    for (let iso = y + '-01'; iso.startsWith(y); iso = addDays(iso, 1)) out.push(iso);
    return out;
  };
  const monthDays = monthDaysOf(ym);

  // Tečky dne: hlavní typ + svátek + firma. miss = nezapsané dny daného měsíce.
  function dotsOf(iso, miss) {
    const day = days[iso];
    if (!day) return miss.includes(iso) ? ['missing'] : [];
    if (day.type !== 'work') return [day.type];
    const b = dayBreakdown(iso, day, settings);
    return [b.extra ? 'extra' : 'work', b.holiday && 'holiday', day.companies?.length && 'company'].filter(Boolean);
  }
  const usedDots = DOTS.filter(d => monthDays.some(iso => dotsOf(iso, missing).includes(d)));

  const positive = PARTS.filter(k => k !== 'sick' && m[k] > 0);
  const sumPositive = positive.reduce((s, k) => s + m[k], 0);

  // Pondělí jako první den týdne (21. 9. 2026 je pondělí).
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map(i =>
    formatDate(parseDate(addDays('2026-09-21', i)), { weekday: 'narrow', ...utc }));

  // Mřížka jednoho měsíce: řádky = týdny od pondělí, u každého štítek D/K podle rozvrhu.
  function calendarGrid(y) {
    const daysOfY = monthDaysOf(y);
    const miss = y === ym ? missing : missingDays(y, days, settings, today);
    const weeks = [];
    for (let monday = mondayOf(daysOfY[0]); monday <= daysOfY.at(-1); monday = addDays(monday, 7)) weeks.push(monday);
    return `
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
            if (!iso.startsWith(y)) return '<span></span>';
            const flags = dayFlags(iso, settings);
            return `
            <button class="cal-day ${iso === today ? 'today' : ''} ${flags.holiday ? 'is-holiday' : ''} ${flags.scheduled ? 'is-work' : ''}" data-iso="${iso}">
              <span>${Number(iso.slice(8))}</span>
              <span class="dots">${dotsOf(iso, miss).map(d => `<i class="dot dot-${d}"></i>`).join('')}</span>
            </button>`;
          }).join('')}`;
        }).join('')}
      </div>`;
  }

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
      <div class="cal-strip">
        ${[-1, 0, 1].map(n => `<div class="cal-panel">${calendarGrid(addMonths(ym, n))}</div>`).join('')}
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

  root.querySelector('#share').addEventListener('click', shareApp);

  // Kalendář jede s prstem: předchozí / aktuální / další měsíc vedle sebe s přichytáváním
  // (scroll-snap). Po dojetí na sousední měsíc se obrazovka přepne na něj – jeho mřížka
  // je pak prostřední panel, takže přechod je plynulý.
  const strip = root.querySelector('.cal-strip');
  strip.scrollLeft = strip.clientWidth;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let touching = false, settleTimer, switched = false;
  const switchTo = n => {
    if (switched) return;
    switched = true;
    location.hash = `#month/${addMonths(ym, n)}`;
  };
  const settle = () => {
    if (touching) return;
    const n = Math.round(strip.scrollLeft / strip.clientWidth) - 1;
    if (n) switchTo(n);
  };

  // Šipky: pás plynule odjede a měsíc se přepne po dojetí (nespoléhá na události posunu).
  root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
    const n = Number(btn.dataset.go);
    strip.scrollTo({ left: strip.clientWidth * (1 + n), behavior: smooth ? 'smooth' : 'auto' });
    setTimeout(() => switchTo(n), smooth ? 350 : 0);
  }));
  strip.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  strip.addEventListener('touchend', () => { touching = false; clearTimeout(settleTimer); settleTimer = setTimeout(settle, 120); }, { passive: true });
  strip.addEventListener('scroll', () => { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 120); }, { passive: true });
  strip.addEventListener('scrollend', settle);

  strip.addEventListener('click', e => {
    const iso = e.target.closest('[data-iso]')?.dataset.iso;
    if (iso) location.hash = `#entry/${iso}`;
  });
}
