import { useState } from 'preact/hooks';
import { findStand, hasLongerNumber } from '../../core/content';
import { t } from '../../core/i18n';
import type { Guide } from '../../core/types';
import { Header } from '../../ui/Header';
import { SettingsPanel } from '../../ui/SettingsPanel';
import { go, paths } from '../router';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function KeypadScreen({ guide }: { guide: Guide }) {
  const [typed, setTyped] = useState('');

  function press(digit: string) {
    const next = (typed + digit).slice(0, 3);
    setTyped(next);

    // Если продолжать номер некуда (нет стенда с более длинным номером),
    // открываем сразу — гость не должен искать кнопку.
    if (findStand(guide, Number(next)) && !hasLongerNumber(guide, next)) {
      open(next);
    }
  }

  function open(value: string) {
    if (!value) return;
    setTyped('');
    go(paths.stand(Number(value)));
  }

  return (
    <main class="page">
      <Header />
      <SettingsPanel />

      <p class="center muted">{t('enterNumber')}</p>
      <div class={typed ? 'display' : 'display display--empty'} aria-live="polite">
        {typed || '—'}
      </div>

      <div class="keypad">
        {KEYS.map((key) => (
          <button key={key} class="key" onClick={() => press(key)}>
            {key}
          </button>
        ))}
        <button
          class="key"
          onClick={() => setTyped(typed.slice(0, -1))}
          disabled={typed === ''}
          aria-label={t('back')}
        >
          <span aria-hidden="true">⌫</span>
        </button>
        <button class="key" onClick={() => press('0')}>
          0
        </button>
        <button
          class="key key--go"
          onClick={() => open(typed)}
          disabled={typed === ''}
          aria-label={t('listen')}
        >
          <span aria-hidden="true">▶</span>
        </button>
      </div>

      <a class="btn btn--block" href={paths.list}>
        {t('allStands')}
      </a>
    </main>
  );
}
