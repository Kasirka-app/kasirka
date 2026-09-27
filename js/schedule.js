// Rozvrh krátký/dlouhý týden (dvoutýdenní cyklus).
// Data jsou řetězce 'YYYY-MM-DD'; počítá se v UTC, aby nevadil přechod na letní čas.

const DAY_MS = 86400000;

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return toISO(new Date(parseDate(iso).getTime() + n * DAY_MS));
}

// 0 = neděle … 6 = sobota
export function weekday(iso) {
  return parseDate(iso).getUTCDay();
}

export function mondayOf(iso) {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

export function weekType(iso, schedule) {
  const weeks = Math.round((parseDate(mondayOf(iso)) - parseDate(schedule.anchorMonday)) / (7 * DAY_MS));
  const same = ((weeks % 2) + 2) % 2 === 0;
  return same ? schedule.anchorType : (schedule.anchorType === 'short' ? 'long' : 'short');
}

export function isScheduled(iso, schedule) {
  return schedule[weekType(iso, schedule)].includes(weekday(iso));
}

// „Tento týden je krátký/dlouhý“ – přesune kotvu na pondělí aktuálního týdne.
export function setWeekType(schedule, todayIso, type) {
  return { ...schedule, anchorMonday: mondayOf(todayIso), anchorType: type };
}

// Dnešní datum v místním čase.
export function todayISO(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 'YYYY-MM' posunutý o n měsíců.
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// ISO číslo týdne – jen informativně v kalendáři. Typ týdne se podle něj NEpočítá
// (rok může mít 53 týdnů a parita by se na přelomu roku rozbila).
export function isoWeek(iso) {
  const thursday = addDays(mondayOf(iso), 3);
  return Math.floor((parseDate(thursday) - parseDate(thursday.slice(0, 4) + '-01-01')) / (7 * DAY_MS)) + 1;
}
