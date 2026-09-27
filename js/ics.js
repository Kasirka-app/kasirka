// Export pracovních dnů podle rozvrhu do kalendáře (.ics, RFC 5545) – čisté funkce.
import { addDays, isScheduled, parseDate, toISO, weekType } from './schedule.js';

const escText = s => s.replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
const ymd = iso => iso.replaceAll('-', '');

// Pracovní dny od fromIso na `months` měsíců dopředu jako celodenní události.
// UID je odvozené z data, takže opakovaný import stejného dne nevytvoří nový záznam.
// describe(weekType) vrací popis události (typ týdne) v jazyce aplikace.
export function buildICS(schedule, fromIso, months, { title, describe, now = new Date() }) {
  const end = parseDate(fromIso);
  end.setUTCMonth(end.getUTCMonth() + months);
  const toIso = toISO(end);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20260927T100000Z

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kasirka//Rozpis smen//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (let iso = fromIso; iso < toIso; iso = addDays(iso, 1)) {
    if (!isScheduled(iso, schedule)) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:kasirka-work-${ymd(iso)}@kasirka-app.github.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(iso)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(iso, 1))}`,
      `SUMMARY:${escText(title)}`,
      `DESCRIPTION:${escText(describe(weekType(iso, schedule)))}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
