// Obrazovka Nastavení – jazyk, motiv, sazby (historie), rozvrh, výchozí směna, záloha.
import { t, LANGUAGES, formatDate, formatNumber } from '../i18n.js';
import { exportJSON, importJSON, clearAll, load } from '../storage.js';
import { addDays, addMonths, parseDate, todayISO, weekType, setWeekType } from '../schedule.js';

const THEMES = ['dark', 'light', 'system'];
const RATE_KEYS = ['baseSalary', 'hourlyRate', 'lateRate', 'weekendRate'];
const PAY_TYPES = ['hourly', 'fixed'];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // pondělím počínaje
const FIRST_FROM = '2000-01'; // první období sazeb platí „od začátku“

const utc = { timeZone: 'UTC' };
const parseNum = s => (s.trim() === '' ? NaN : Number(s.replace(',', '.').replace(/\s/g, '')));

function download(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  URL.revokeObjectURL(url);
}

export function render(root, ctx) {
  const s = ctx.data.settings;
  const today = todayISO();
  s.rates.sort((a, b) => a.from.localeCompare(b.from));

  const seg = (attr, options, current, label) => `
    <div class="segmented" style="grid-template-columns: repeat(${options.length}, 1fr)">
      ${options.map(o => `<button data-${attr}="${o}" class="${o === current ? 'on' : ''}">${t(label + o)}</button>`).join('')}
    </div>`;

  const numField = (label, attrs, value) => `
    <label class="field"><span>${label}</span>
      <input type="text" inputmode="decimal" autocomplete="off" ${attrs} value="${formatNumber(value)}"></label>`;

  const dayName = wd => formatDate(parseDate(addDays('2026-09-20', wd || 7)), { weekday: 'short', ...utc }); // 20. 9. 2026 = neděle

  const rateCards = s.rates.map((r, i) => `
    <div class="card rate">
      <div class="rate-head">
        ${r.from === FIRST_FROM
          ? `<strong>${t('rates.fromStart')}</strong>`
          : `<label class="field"><strong>${t('rates.from')}</strong><input type="month" data-rate="${i}" data-key="from" value="${r.from}"></label>
             <button class="icon-btn danger" data-delete-rate="${i}" aria-label="${t('rates.delete')}">×</button>`}
      </div>
      ${RATE_KEYS.filter(k => k !== 'baseSalary' || s.payType === 'fixed').map(k => numField(t('rates.' + k), `data-rate="${i}" data-key="${k}"`, r[k])).join('')}
    </div>`).reverse().join(''); // nejnovější nahoře

  const weekRow = type => `
    <div class="field week-row"><span>${t('schedule.' + type + 'Days')}</span>
      <div class="weekdays">
        ${WEEKDAYS.map(wd => `<button data-week="${type}" data-wd="${wd}" class="${s.schedule[type].includes(wd) ? 'on' : ''}">${dayName(wd)}</button>`).join('')}
      </div>
    </div>`;

  root.innerHTML = `<div id="settings">
    <h1>${t('tab.settings')}</h1>

    <div class="card">
      <label class="field"><span>${t('settings.language')}</span>
        <select id="lang">${Object.entries(LANGUAGES).map(([code, l]) =>
          `<option value="${code}" ${code === s.lang ? 'selected' : ''}>${l.name}</option>`).join('')}</select>
      </label>
      <div class="field-label">${t('settings.theme')}</div>
      ${seg('theme', THEMES, s.theme, 'theme.')}
    </div>

    <h2>${t('settings.rates')}</h2>
    <div class="card">
      <div class="field-label">${t('settings.payType')}</div>
      ${seg('paytype', PAY_TYPES, s.payType, 'payType.')}
    </div>
    ${rateCards}
    <button class="btn-secondary" id="add-rate">${t('rates.addRaise')}</button>
    <div class="card">
      <label class="field"><span>${t('settings.lateFrom')}</span><input type="time" id="late-from" value="${s.lateFrom}"></label>
      ${numField(t('settings.absenceHours'), 'id="absence-hours"', s.absenceHours)}
    </div>

    <h2>${t('settings.schedule')}</h2>
    <div class="card">
      <div class="field-label">${t('schedule.thisWeek')}</div>
      ${seg('weektype', ['short', 'long'], weekType(today, s.schedule), 'schedule.')}
      ${weekRow('short')}
      ${weekRow('long')}
    </div>

    <h2>${t('settings.defaultShift')}</h2>
    <div class="card time-row">
      <label><span class="muted">${t('entry.from')}</span><input type="time" data-shift="from" value="${s.defaultShift.from}"></label>
      <label><span class="muted">${t('entry.to')}</span><input type="time" data-shift="to" value="${s.defaultShift.to}"></label>
    </div>

    <h2>${t('settings.backup')}</h2>
    <div class="card">
      <div class="field"><span>${t('backup.last')}</span>
        <strong>${s.lastBackupAt ? formatDate(parseDate(s.lastBackupAt), utc) : t('backup.never')}</strong></div>
      <p class="muted hint">${t('backup.hint')}</p>
      <button class="btn-primary" id="export">${t('backup.export')}</button>
      <button class="btn-link" id="import">${t('backup.import')}</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>

    <button class="btn-link danger" id="delete-all">${t('settings.deleteAll')}</button>
  </div>`;

  const $ = sel => root.querySelector(sel);
  const wrap = $('#settings'); // posluchače na obsah, ne na #screen – ten zůstává mezi překresleními

  $('#lang').addEventListener('change', e => { s.lang = e.target.value; ctx.save(); });

  // Tlačítka: motiv, typ týdne, dny rozvrhu, mazání období.
  wrap.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.theme) s.theme = d.theme;
    else if (d.paytype) s.payType = d.paytype;
    else if (d.weektype) s.schedule = setWeekType(s.schedule, today, d.weektype);
    else if (d.week) {
      const days = s.schedule[d.week], wd = Number(d.wd);
      s.schedule[d.week] = days.includes(wd) ? days.filter(x => x !== wd) : [...days, wd];
    } else if (d.deleteRate) {
      if (!confirm(t('rates.confirmDelete'))) return;
      s.rates.splice(Number(d.deleteRate), 1);
    } else return;
    ctx.save();
  });

  // Pole: sazby, příplatek od, srážka, výchozí směna.
  wrap.addEventListener('change', e => {
    const el = e.target, d = el.dataset;
    if (d.rate) {
      const r = s.rates[Number(d.rate)];
      if (d.key === 'from') {
        if (!el.value || s.rates.some(x => x !== r && x.from === el.value)) return ctx.save(); // vrátí původní hodnotu
        r.from = el.value;
      } else {
        const v = parseNum(el.value);
        if (!(v >= 0)) return ctx.save();
        r[d.key] = v;
        if (d.key === 'hourlyRate') r.weekendRate = Math.round(v * 10) / 100; // víkend = 10 % hodinovky
      }
    } else if (el.id === 'late-from' && el.value) s.lateFrom = el.value;
    else if (el.id === 'absence-hours') {
      const v = parseNum(el.value);
      if (v >= 0) s.absenceHours = v;
    } else if (d.shift && el.value) s.defaultShift = { ...s.defaultShift, [d.shift]: el.value };
    else return;
    ctx.save();
  });

  $('#add-rate').addEventListener('click', () => {
    const last = s.rates.at(-1);
    const next = addMonths(today.slice(0, 7), 1);
    const from = last.from >= next ? addMonths(last.from, 1) : next;
    s.rates.push({ ...last, from });
    ctx.save();
  });

  $('#export').addEventListener('click', async () => {
    // Datum zálohy už v souboru, aby obnova z čerstvé zálohy hned nepřipomínala další.
    const json = exportJSON({ ...ctx.data, settings: { ...s, lastBackupAt: today } });
    const file = new File([json], `kasirka-zaloha-${today}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else download(file);
    } catch (err) {
      if (err.name === 'AbortError') return; // uživatel sdílení zrušil
      download(file);
    }
    s.lastBackupAt = today;
    ctx.save();
  });

  $('#import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    try {
      data = importJSON(await file.text());
    } catch {
      alert(t('backup.importError'));
      return;
    }
    if (!confirm(t('backup.importConfirm', { n: Object.keys(data.days).length }))) return;
    ctx.data = data;
    ctx.save();
  });

  $('#delete-all').addEventListener('click', () => {
    if (!confirm(t('settings.confirmDelete1')) || !confirm(t('settings.confirmDelete2'))) return;
    clearAll();
    ctx.data = load();
    ctx.save();
  });
}
