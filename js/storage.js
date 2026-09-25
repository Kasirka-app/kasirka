// Načítání/ukládání do localStorage, migrace schématu, export/import.

import { parseDate } from './schedule.js';

const KEY = 'kasirka';
const BACKUP_DAYS = 30;
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  schemaVersion: SCHEMA_VERSION, lang: 'cs', currency: 'CZK', theme: 'dark',
  // Historie sazeb (navýšení mzdy): každá platí od začátku měsíce `from` do další.
  // Výchozí nuly – každý si sazby vyplní sám (Zápis do té doby ukazuje uvítací kartu).
  rates: [{ from: '2000-01', baseSalary: 0, hourlyRate: 0, lateRate: 0, weekendRate: 0 }],
  lateFrom: '22:00',
  defaultShift: { from: '10:00', to: '22:00' },
  schedule: { anchorMonday: '2026-09-21', anchorType: 'short',
              short: [3, 4], long: [1, 2, 5, 6, 0] },
  sickDeductHours: 12, holidayCountry: 'CZ',
  lastBackupAt: null
};

// MIGRATIONS[n] převádí data z verze n na n + 1.
const MIGRATIONS = {};

export function migrate(data) {
  let v = data.settings.schemaVersion ?? 0;
  if (v > SCHEMA_VERSION) throw new Error(`Unsupported schemaVersion ${v}`);
  while (v < SCHEMA_VERSION) {
    data = MIGRATIONS[v](data);
    data.settings.schemaVersion = ++v;
  }
  return data;
}

function withDefaults(data) {
  return {
    settings: { ...structuredClone(DEFAULT_SETTINGS), ...data?.settings },
    days: data?.days ?? {}
  };
}

export function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return withDefaults(null);
  return withDefaults(migrate(JSON.parse(raw)));
}

export function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function exportJSON(data) {
  return JSON.stringify(data, null, 2);
}

// Vyhodí výjimku, pokud text není platná záloha.
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data?.settings || typeof data.days !== 'object') throw new Error('Invalid backup');
  return withDefaults(migrate(data));
}

export function clearAll() {
  localStorage.removeItem(KEY);
}

// Připomínka zálohy: poslední záloha (nebo první zápis, pokud záloha nikdy nebyla) je starší než 30 dní.
export function backupDue(data, todayIso) {
  const since = data.settings.lastBackupAt ?? Object.keys(data.days).sort()[0];
  if (!since) return false;
  return (parseDate(todayIso) - parseDate(since)) / 86400000 > BACKUP_DAYS;
}
