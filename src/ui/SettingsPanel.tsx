import { signal } from '@preact/signals';
import { t } from '../core/i18n';
import { scheme, showImages, textSize, type Scheme, type TextSize } from '../core/settings';

export const settingsOpen = signal(false);

export function SettingsPanel() {
  if (!settingsOpen.value) return null;

  return (
    <section class="settings" aria-label={t('appearance')}>
      <fieldset>
        <legend>{t('textSize')}</legend>
        {(
          [
            ['md', t('sizeMd')],
            ['lg', t('sizeLg')],
            ['xl', t('sizeXl')],
          ] as [TextSize, string][]
        ).map(([value, label]) => (
          <label class="choice" key={value}>
            <input
              type="radio"
              name="text-size"
              checked={textSize.value === value}
              onChange={() => (textSize.value = value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('colorScheme')}</legend>
        {(
          [
            ['auto', t('schemeAuto')],
            ['bw', t('schemeBw')],
            ['wb', t('schemeWb')],
            ['yb', t('schemeYb')],
          ] as [Scheme, string][]
        ).map(([value, label]) => (
          <label class="choice" key={value}>
            <input
              type="radio"
              name="scheme"
              checked={scheme.value === value}
              onChange={() => (scheme.value = value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('images')}</legend>
        <label class="choice">
          <input
            type="checkbox"
            checked={!showImages.value}
            onChange={(event) => (showImages.value = !event.currentTarget.checked)}
          />
          {t('imagesHide')}
        </label>
      </fieldset>

      <button class="btn btn--block" onClick={() => (settingsOpen.value = false)}>
        {t('close')}
      </button>
    </section>
  );
}
