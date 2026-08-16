import { t } from '../core/i18n';
import { LANGS, isLangCode, lang, setLang } from '../core/lang';
import { go, paths } from '../app/router';
import { settingsOpen } from './SettingsPanel';

interface Props {
  /** Номер стенда в шапке — тем же шрифтом, что цифры на табличках. */
  number?: number;
  back?: boolean;
}

export function Header({ number, back }: Props) {
  return (
    <header class="header">
      {back && (
        <button
          class="btn btn--ghost btn--icon"
          onClick={() => go(paths.keypad)}
          aria-label={t('back')}
        >
          <span aria-hidden="true">←</span>
        </button>
      )}

      {number === undefined ? (
        <h1 class="header__title">{t('appName')}</h1>
      ) : (
        <span class="header__number">{number}</span>
      )}

      <label class="sr-only" for="lang-select">
        {t('language')}
      </label>
      <select
        id="lang-select"
        class="select"
        value={lang.value ?? 'ru'}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (isLangCode(value)) setLang(value);
        }}
      >
        {LANGS.map((item) => (
          <option key={item.code} value={item.code}>
            {item.short}
          </option>
        ))}
      </select>

      <button
        class="btn btn--ghost btn--icon"
        onClick={() => (settingsOpen.value = !settingsOpen.value)}
        aria-expanded={settingsOpen.value}
        aria-label={t('appearance')}
      >
        <span aria-hidden="true" style="font-family: var(--font-display); font-size: 1.25rem">
          Aa
        </span>
      </button>
    </header>
  );
}
