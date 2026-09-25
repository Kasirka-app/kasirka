// Čisté výpočetní funkce – žádný DOM, žádný stav.
// Všechny příplatky se sčítají (extra + svátek + po 22:00 + víkend).
import { isScheduled, weekday, addDays } from './schedule.js';
import { isHoliday } from './holidays.js';

const DAY_MIN = 1440;
const KEYS = ['base', 'tips', 'companies', 'late', 'weekend', 'holiday', 'extra', 'sick'];

const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const round2 = x => Math.round(x * 100) / 100;

// Směna v minutách od půlnoci dne začátku; konec před začátkem = přes půlnoc.
function span(from, to) {
  const start = toMin(from);
  let end = toMin(to);
  if (end < start) end += DAY_MIN;
  return { start, end };
}

export function shiftHours(from, to) {
  const { start, end } = span(from, to);
  return (end - start) / 60;
}

// Hodiny po lateFrom (např. 22:00) – na předvyplnění day.lateHours.
export function lateHours(from, to, lateFrom) {
  const { start, end } = span(from, to);
  return Math.max(0, end - Math.max(start, toMin(lateFrom))) / 60;
}

// Hodiny odpracované v sobotu/neděli, po minutách podle kalendářního dne.
export function weekendHours(iso, from, to) {
  const { start, end } = span(from, to);
  const isWeekend = wd => wd === 0 || wd === 6;
  const wd = weekday(iso);
  let min = 0;
  if (isWeekend(wd)) min += Math.min(end, DAY_MIN) - start;
  if (end > DAY_MIN && isWeekend((wd + 1) % 7)) min += end - DAY_MIN;
  return min / 60;
}

function empty() {
  return Object.fromEntries([...KEYS, 'total', 'hours'].map(k => [k, 0]));
}

function finish(r) {
  for (const k of KEYS) r[k] = round2(r[k]);
  r.total = round2(KEYS.reduce((sum, k) => sum + r[k], 0));
  return r;
}

// Sazby platné v měsíci ym ('YYYY-MM'): poslední záznam s from <= ym.
export function ratesFor(ym, settings) {
  return settings.rates.filter(r => r.from <= ym).sort((a, b) => a.from.localeCompare(b.from)).at(-1);
}

// Automatické štítky dne (bez ručního přepsání).
export function dayFlags(iso, settings) {
  return {
    scheduled: isScheduled(iso, settings.schedule),
    holiday: isHoliday(iso, settings.holidayCountry)
  };
}

// Rozpad jednoho dne. day může být undefined (nic nezapsáno).
export function dayBreakdown(iso, day, settings) {
  const r = empty();
  if (!day) return finish(r);
  const rates = ratesFor(iso.slice(0, 7), settings);
  const rate = rates.hourlyRate;
  const flags = dayFlags(iso, settings);

  const hourly = settings.payType === 'hourly';

  // Nepřítomnost se řeší jen v plánovaný den.
  if (day.type === 'sick') {
    if (flags.scheduled && !hourly) r.sick = -settings.absenceHours * rate;
    return finish(r);
  }
  if (day.type === 'vacation') {
    if (flags.scheduled && hourly) r.base = settings.absenceHours * rate; // pevný základ dovolenou už obsahuje
    return finish(r);
  }
  if (day.type !== 'work') return finish(r); // výměna

  const hours = shiftHours(day.from, day.to);
  const companies = day.companies ?? [];
  r.hours = hours;
  r.tips = day.tips ?? 0;
  r.companies = companies.reduce((s, c) => s + (c.bonus ?? 0), 0);
  // Po 22:00 jen s firmou, jednou za den bez ohledu na počet firem.
  if (companies.length) r.late = Math.round((day.lateHours ?? 0) * rates.lateRate);
  r.weekend = weekendHours(iso, day.from, day.to) * rates.weekendRate;
  if (day.holidayOverride ?? flags.holiday) r.holiday = hours * rate;
  // Hodinová mzda: každá hodina v základu, extra den nemá smysl. Pevný základ: směna mimo rozvrh = extra.
  if (hourly) r.base = hours * rate;
  else if (day.extraOverride ?? !flags.scheduled) r.extra = hours * rate;
  return finish(r);
}

// Rozpad měsíce ('YYYY-MM'). Směna patří do dne (a měsíce), kdy začala.
// Měsíc bez jediného záznamu = 0 (ani základ).
export function monthBreakdown(ym, days, settings) {
  const r = empty();
  let shifts = 0;
  const entries = Object.entries(days).filter(([iso]) => iso.startsWith(ym + '-'));
  for (const [iso, day] of entries) {
    const d = dayBreakdown(iso, day, settings);
    for (const k of [...KEYS, 'hours']) r[k] += d[k];
    if (day.type === 'work') shifts++;
  }
  if (entries.length && settings.payType === 'fixed') r.base = ratesFor(ym, settings).baseSalary;
  return { ...finish(r), shifts };
}

// Plánované dny v minulosti bez záznamu (jen připomínka, nic se nestrhává).
// Hlásí se až od prvního zápisu v aplikaci; dnešek ne, směna může ještě běžet.
export function missingDays(ym, days, settings, todayIso) {
  const first = Object.keys(days).sort()[0];
  const out = [];
  if (!first) return out;
  for (let iso = ym + '-01'; iso.startsWith(ym); iso = addDays(iso, 1)) {
    if (iso > first && iso < todayIso && !days[iso] && isScheduled(iso, settings.schedule)) out.push(iso);
  }
  return out;
}

// Změna v % oproti předchozí hodnotě; null, když předchozí je 0.
export function pctChange(current, previous) {
  return previous ? Math.round((current - previous) / Math.abs(previous) * 1000) / 10 : null;
}

// Souhrn za měsíce yms (od nejstaršího): rozpad po měsících a ukazatele.
export function periodStats(yms, days, settings) {
  const months = yms.map(ym => {
    const companies = Object.entries(days)
      .filter(([iso, d]) => iso.startsWith(ym + '-') && d.type === 'work')
      .flatMap(([, d]) => d.companies ?? []);
    return { ym, ...monthBreakdown(ym, days, settings), companyCount: companies.length };
  });
  const sum = k => months.reduce((s, m) => s + m[k], 0);
  const withData = months.filter(m => m.total);
  const best = withData.reduce((a, m) => (!a || m.total > a.total ? m : a), null);
  return {
    months,
    avgTips: sum('shifts') ? Math.round(sum('tips') / sum('shifts')) : 0,
    hourly: sum('hours') ? Math.round(sum('total') / sum('hours') * 100) / 100 : 0,
    best: best && { ym: best.ym, total: best.total },
    companyCount: sum('companyCount'),
    companyBonus: sum('companies')
  };
}
