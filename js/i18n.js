// Překlady a formátování přes Intl.
// Nový jazyk = nový soubor v i18n/ + import a řádek v LANGUAGES.
import cs from '../i18n/cs.js';
import en from '../i18n/en.js';

export const LANGUAGES = { cs, en };

let dict = cs;
let locale = cs.locale;
let currency = 'CZK';

export function setLanguage(lang, cur = currency) {
  dict = LANGUAGES[lang] ?? cs;
  locale = dict.locale;
  currency = cur;
  document.documentElement.lang = lang;
}

// t('month.total', { n: 3 }) – {n} v textu se nahradí parametrem; chybějící klíč vrátí klíč.
export function t(key, params = {}) {
  const s = dict.strings[key] ?? cs.strings[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

// Haléře jen u neceločíselných částek (např. víkend 285,60).
export function formatMoney(amount, fractionDigits = Number.isInteger(amount) ? 0 : 2) {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency,
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits
  }).format(amount);
}

export function formatNumber(n, maxFractionDigits = 2) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n);
}

// Krátký zápis pro popisky grafu (např. 63 tis.).
export function formatCompact(n) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 0 }).format(n);
}

export function formatDate(date, options = { day: 'numeric', month: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

// Doplní texty do elementů s atributem data-i18n.
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}
