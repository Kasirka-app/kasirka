// Státní svátky podle země. Nová země = nový klíč v HOLIDAYS.
import { addDays } from './schedule.js';

// Velikonoční neděle (gregoriánský kalendář, anonymní algoritmus).
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const HOLIDAYS = {
  CZ: year => {
    const easter = easterSunday(year);
    return [
      '01-01', '05-01', '05-08', '07-05', '07-06', '09-28',
      '10-28', '11-17', '12-24', '12-25', '12-26'
    ].map(md => `${year}-${md}`).concat(addDays(easter, -2), addDays(easter, 1));
  }
};

export function holidaysOf(year, country) {
  return HOLIDAYS[country]?.(year) ?? [];
}

export function isHoliday(iso, country) {
  return holidaysOf(Number(iso.slice(0, 4)), country).includes(iso);
}
