import { effect, signal } from '@preact/signals';
import { read, write } from './storage';

export type TextSize = 'md' | 'lg' | 'xl';
/** 'auto' — фирменная палитра со следованием системной тёмной теме.
 *  Остальные — схемы ГОСТ Р 52872-2019 для слабовидящих. */
export type Scheme = 'auto' | 'bw' | 'wb' | 'yb';

const KEY_TEXT = 'mf.text';
const KEY_SCHEME = 'mf.scheme';
const KEY_IMAGES = 'mf.images';

export const textSize = signal<TextSize>(restoreText());
export const scheme = signal<Scheme>(restoreScheme());
export const showImages = signal<boolean>(read(KEY_IMAGES) !== 'off');

function restoreText(): TextSize {
  const value = read(KEY_TEXT);
  return value === 'lg' || value === 'xl' ? value : 'md';
}

function restoreScheme(): Scheme {
  const value = read(KEY_SCHEME);
  return value === 'bw' || value === 'wb' || value === 'yb' ? value : 'auto';
}

/** Настройки живут в data-атрибутах <html>: вся раскраска и масштаб —
 *  дело CSS-переменных, компоненты о них не знают. */
export function applySettings(): void {
  effect(() => {
    const root = document.documentElement;

    if (textSize.value === 'md') root.removeAttribute('data-text');
    else root.dataset.text = textSize.value;

    if (scheme.value === 'auto') root.removeAttribute('data-scheme');
    else root.dataset.scheme = scheme.value;

    root.dataset.images = showImages.value ? 'on' : 'off';

    write(KEY_TEXT, textSize.value);
    write(KEY_SCHEME, scheme.value);
    write(KEY_IMAGES, showImages.value ? 'on' : 'off');
  });
}
