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

window.addEventListener('hashchange', render);
applySettings();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
