// Router mezi obrazovkami a sdílený stav.
import { load, save, backupDue } from './storage.js';
import { todayISO } from './schedule.js';
import { setLanguage, translateDom } from './i18n.js';
import * as entry from './ui/entry.js';
import * as month from './ui/month.js';
import * as compare from './ui/compare.js';
import * as settings from './ui/settings.js';

const SCREENS = { entry, month, compare, settings };
const DEFAULT_SCREEN = 'entry';

const screenEl = document.getElementById('screen');
const tabbar = document.getElementById('tabbar');
const backupBanner = document.getElementById('backup-banner');
let lastHash = null;
let dirty = false;       // uživatel něco píše a ještě neuložil
let updateReady = false; // nová verze čeká na obnovení
document.addEventListener('input', () => { dirty = true; });

// Kontext předávaný obrazovkám: data + uložení + překreslení.
const ctx = {
  data: load(),
  save() {
    save(ctx.data);
    applySettings();
    render();
  }
};

function applySettings() {
  const s = ctx.data.settings;
  setLanguage(s.lang, s.currency);
  document.documentElement.dataset.theme = s.theme;
  translateDom();
}

function render() {
  if (updateReady) return location.reload();
  dirty = false;
  const [name, param] = location.hash.slice(1).split('/'); // např. #entry/2026-09-28
  const screen = SCREENS[name] ? name : DEFAULT_SCREEN;
  tabbar.querySelectorAll('a').forEach(a => {
    a.toggleAttribute('aria-current', a.dataset.tab === screen);
  });
  backupBanner.hidden = screen === 'settings' || !backupDue(ctx.data, todayISO());
  screenEl.replaceChildren();
  if (location.hash !== lastHash) { // animace jen při přechodu, ne při uložení
    lastHash = location.hash;
    screenEl.classList.remove('enter');
    void screenEl.offsetWidth; // restart animace přechodu
    screenEl.classList.add('enter');
  }
  SCREENS[screen].render(screenEl, ctx, param);
}

// Při psaní (otevřená klávesnice / výběr času) nesmí spodní lišty zakrývat pole.
// focusout → chvíli počkat, přechod na další pole nemá lišty rozblikat.
const isField = el => el?.matches?.('input, textarea, select');
document.addEventListener('focusin', e => { if (isField(e.target)) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => setTimeout(() => {
  document.body.classList.toggle('typing', isField(document.activeElement));
}, 100));

window.addEventListener('hashchange', render);
applySettings();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Při návratu do aplikace zkontrolovat novou verzi.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
  });

  // Nová verze převzala řízení → jednou obnovit, ať se hned ukáže. Když je
  // rozepsaný formulář, počkat na uložení / přechod jinam (render), ať se nic neztratí.
  const hadController = !!navigator.serviceWorker.controller; // při první instalaci neobnovovat
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (dirty) updateReady = true;
    else location.reload();
  });
}
