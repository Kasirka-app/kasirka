// „Doporuč kolegovi“ – systémové sdílení, jinak zkopírování odkazu.
import { t } from '../i18n.js';

export async function shareApp() {
  const url = new URL('./?ref=kolega', location.href).href; // ref = příchod z doporučení
  const text = t('share.text');
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // uživatel sdílení zavřel
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  alert(t('share.copied'));
}
