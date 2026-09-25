// Obrazovka Zápis – zápis jednoho dne. Datum je v URL: #entry/2026-09-28.
import { t, formatMoney, formatDate, formatNumber } from '../i18n.js';
import { dayBreakdown, dayFlags, lateHours } from '../calc.js';
import { addDays, parseDate, todayISO } from '../schedule.js';

const TYPES = ['work', 'vacation', 'sick', 'swapped'];
const PARTS = ['tips', 'companies', 'late', 'weekend', 'holiday', 'extra', 'sick'];
const NIGHT_UNTIL_HOUR = 6; // zápis do 6:00 ráno patří ke včerejší směně

let savedIso = null; // pro hlášku „Uloženo“ po překreslení

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const signed = n => (n > 0 ? '+' : '') + formatMoney(n);
const parseNum = s => Number(String(s).replace(',', '.').replace(/\s/g, '')) || 0;

function defaultDate() {
  const now = new Date();
  return now.getHours() < NIGHT_UNTIL_HOUR ? addDays(todayISO(now), -1) : todayISO(now);
}

// Nový den: časy z poslední zapsané směny, jinak výchozí směna.
function newDay(days, settings) {
  const last = Object.keys(days).sort().reverse().map(k => days[k]).find(d => d.type === 'work');
  const { from, to } = last ?? settings.defaultShift;
  return { type: 'work', from, to, tips: 0, companies: [], holidayOverride: null, extraOverride: null };
}

// Uloží jen pole, která dávají pro daný typ smysl.
function clean(d) {
  if (d.type !== 'work') return { type: d.type };
  const out = { ...d, companies: d.companies.map(c => ({ ...c })) };
  if (!out.companies.length) delete out.lateHours;
  return out;
}

export function render(root, ctx, param) {
  const { settings, days } = ctx.data;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : defaultDate();
  const saved = days[iso];
  const draft = saved ? structuredClone(saved) : newDay(days, settings);
  draft.companies ??= [];
  const flags = dayFlags(iso, settings);
  const autoLate = () => lateHours(draft.from, draft.to, settings.lateFrom);
  let lateEdited = draft.lateHours != null && draft.lateHours !== autoLate();

  const companyNames = [...new Set(Object.values(days).flatMap(d => (d.companies ?? []).map(c => c.name)).filter(Boolean))];
  const dateLabel = formatDate(parseDate(iso), { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });

  // Nový uživatel (sazby jsou výchozí nuly) – nejdřív nastavení.
  const needsSetup = settings.rates.every(r => !r.baseSalary && !r.hourlyRate);

  root.innerHTML = `
    ${needsSetup ? `
    <div class="card welcome">
      <strong>${t('welcome.title')}</strong>
      <p>${t('welcome.text')}</p>
      <a class="btn-primary" href="#settings">${t('welcome.button')}</a>
    </div>` : ''}

    <div class="date-nav">
      <button class="icon-btn" data-go="-1" aria-label="${t('entry.prevDay')}">‹</button>
      <label class="date-label">
        <span>${dateLabel}${iso === todayISO() ? ` · ${t('entry.today')}` : ''}</span>
        <input type="date" id="date" value="${iso}">
      </label>
      <button class="icon-btn" data-go="1" aria-label="${t('entry.nextDay')}">›</button>
    </div>

    <div class="segmented" id="types">
      ${TYPES.map(ty => `<button data-type="${ty}">${t('type.' + ty)}</button>`).join('')}
    </div>

    <div id="work-fields">
      <div class="card time-row">
        <label><span class="muted">${t('entry.from')}</span><input type="time" id="from" value="${draft.from}"></label>
        <label><span class="muted">${t('entry.to')}</span><input type="time" id="to" value="${draft.to}"></label>
        <span class="hours muted" id="hours"></span>
      </div>

      <div class="chips" id="chips"></div>

      <label class="card tips">
        <span class="muted">${t('entry.tips')}</span>
        <input type="text" id="tips" inputmode="numeric" autocomplete="off" placeholder="0" value="${draft.tips || ''}">
      </label>

      <div id="companies"></div>
      <label class="card field" id="late-row">
        <span>${t('entry.lateHours')}</span>
        <input type="text" id="late" inputmode="decimal" autocomplete="off">
      </label>
      <button class="btn-secondary" id="add-company">${t('entry.addCompany')}</button>
      <datalist id="company-names">${companyNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    </div>

    <p class="hint muted" id="hint"></p>

    ${saved ? `<button class="btn-link danger" id="delete">${t('entry.delete')}</button>` : ''}

    <div class="total-bar">
      <div class="total-head">
        <span class="muted">${t('entry.dayTotal')}</span>
        <strong id="total"></strong>
      </div>
      <div class="mini-parts" id="parts"></div>
      <button class="btn-primary" id="save">${savedIso === iso ? t('entry.saved') : t('entry.save')}</button>
    </div>`;
  savedIso = null;

  const $ = sel => root.querySelector(sel);

  function renderCompanies() {
    $('#companies').innerHTML = draft.companies.map((c, i) => {
      const other = c.bonus && c.bonus !== 500 && c.bonus !== 1000;
      return `
      <div class="card company" data-i="${i}">
        <div class="company-head">
          <input type="text" class="c-name" list="company-names" placeholder="${t('entry.companyName')}" value="${esc(c.name)}">
          <button class="icon-btn c-remove" aria-label="${t('entry.removeCompany')}">×</button>
        </div>
        <label class="field">
          <span class="muted">${t('entry.people')}</span>
          <input type="text" class="c-people" inputmode="numeric" autocomplete="off" value="${c.people || ''}">
        </label>
        <div class="field">
          <span class="muted">${t('entry.bonus')}</span>
          <div class="bonus">
            <button data-bonus="500" class="${c.bonus === 500 ? 'on' : ''}">500</button>
            <button data-bonus="1000" class="${c.bonus === 1000 ? 'on' : ''}">1000</button>
            <input type="text" class="c-bonus ${other ? 'on' : ''}" inputmode="numeric" autocomplete="off"
                   placeholder="${t('entry.bonusOther')}" value="${other ? c.bonus : ''}">
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function update() {
    const isWork = draft.type === 'work';
    root.querySelectorAll('#types button').forEach(b => b.classList.toggle('on', b.dataset.type === draft.type));
    $('#work-fields').hidden = !isWork;

    const b = dayBreakdown(iso, draft, settings);

    if (isWork) {
      $('#hours').textContent = t('entry.hours', { h: formatNumber(b.hours) });
      $('#late-row').hidden = !draft.companies.length;
      if (!lateEdited) draft.lateHours = autoLate();
      if (document.activeElement !== $('#late')) $('#late').value = formatNumber(draft.lateHours);

      // Štítky: aktivní = započítané; ťuknutím se přepíše automatika.
      const holidayOn = draft.holidayOverride ?? flags.holiday;
      const extraOn = draft.extraOverride ?? !flags.scheduled;
      const pay = dayBreakdown(iso, { ...draft, holidayOverride: true }, settings).holiday; // hodiny × sazba
      const extraOff = !extraOn && !flags.scheduled ? t('entry.swapNoExtra') : t('part.extra');
      $('#chips').innerHTML = `
        <button data-chip="holiday" class="chip ${holidayOn ? 'on' : ''}" style="--c: var(--c-holiday)">
          ${t('part.holiday')}${holidayOn ? ' ' + signed(pay) : ''}</button>
        <button data-chip="extra" class="chip ${extraOn ? 'on' : ''}" style="--c: var(--c-extra)">
          ${extraOn ? t('part.extra') + ' ' + signed(pay) : extraOff}</button>`;
    }

    const hint = { vacation: 'entry.hint.vacation', swapped: 'entry.hint.swapped',
      sick: flags.scheduled ? 'entry.hint.sick' : 'entry.hint.sickOff' }[draft.type];
    $('#hint').textContent = hint ? t(hint, { h: settings.sickDeductHours }) : '';

    $('#total').textContent = signed(b.total);
    $('#parts').innerHTML = PARTS.filter(k => b[k]).map(k =>
      `<span class="part" style="--c: var(--c-${k})">${t('part.' + k)} ${signed(b[k])}</span>`).join('');
  }

  // --- Události ---
  root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
    location.hash = `#entry/${addDays(iso, Number(btn.dataset.go))}`;
  }));
  $('#date').addEventListener('change', e => { if (e.target.value) location.hash = `#entry/${e.target.value}`; });

  $('#types').addEventListener('click', e => {
    const ty = e.target.closest('button')?.dataset.type;
    if (!ty) return;
    draft.type = ty;
    update();
  });

  for (const key of ['from', 'to']) {
    $('#' + key).addEventListener('input', e => { if (e.target.value) { draft[key] = e.target.value; update(); } });
  }
  $('#tips').addEventListener('input', e => { draft.tips = Math.round(parseNum(e.target.value)); update(); });
  $('#late').addEventListener('input', e => { lateEdited = true; draft.lateHours = parseNum(e.target.value); update(); });

  $('#chips').addEventListener('click', e => {
    const chip = e.target.closest('button')?.dataset.chip;
    if (!chip) return;
    const auto = chip === 'holiday' ? flags.holiday : !flags.scheduled;
    const key = chip + 'Override';
    const next = !(draft[key] ?? auto);
    draft[key] = next === auto ? null : next;
    update();
  });

  $('#add-company').addEventListener('click', () => {
    draft.companies.push({ id: Date.now(), name: '', people: 0, bonus: 0 });
    renderCompanies();
    update();
    root.querySelector('.company:last-child .c-name').focus();
  });

  $('#companies').addEventListener('input', e => {
    const c = draft.companies[e.target.closest('.company').dataset.i];
    if (e.target.matches('.c-name')) c.name = e.target.value.trim();
    if (e.target.matches('.c-people')) c.people = Math.round(parseNum(e.target.value));
    if (e.target.matches('.c-bonus')) {
      c.bonus = Math.round(parseNum(e.target.value));
      e.target.closest('.bonus').querySelectorAll('button').forEach(b => b.classList.remove('on'));
      e.target.classList.toggle('on', !!c.bonus);
    }
    update();
  });
  $('#companies').addEventListener('click', e => {
    const card = e.target.closest('.company');
    if (!card) return;
    const i = Number(card.dataset.i);
    if (e.target.matches('.c-remove')) {
      draft.companies.splice(i, 1);
      renderCompanies();
    } else if (e.target.dataset.bonus) {
      draft.companies[i].bonus = Number(e.target.dataset.bonus);
      renderCompanies();
    }
    update();
  });

  $('#save').addEventListener('click', () => {
    days[iso] = clean(draft);
    savedIso = iso;
    ctx.save();
  });
  $('#delete')?.addEventListener('click', () => {
    if (!confirm(t('entry.confirmDelete'))) return;
    delete days[iso];
    ctx.save();
  });

  renderCompanies();
  update();
}
