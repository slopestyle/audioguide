import { signal } from '@preact/signals';
import type { LangCode } from './types';
import { read, write } from './storage';

export interface LangInfo {
  code: LangCode;
  /** Название на самом языке — гость ищет знакомые буквы, а не перевод. */
  label: string;
  short: string;
  dir: 'ltr' | 'rtl';
}

export const LANGS: readonly LangInfo[] = [
  { code: 'ru', label: 'Русский', short: 'RU', dir: 'ltr' },
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
  { code: 'zh', label: '中文', short: '中文', dir: 'ltr' },
  { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl' },
];

const STORAGE_KEY = 'mf.lang';

export function isLangCode(value: unknown): value is LangCode {
  return LANGS.some((l) => l.code === value);
}

export function langInfo(code: LangCode): LangInfo {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

/** null — язык ещё не выбран, показываем экран выбора. */
export const lang = signal<LangCode | null>(restore());

function restore(): LangCode | null {
  const stored = read(STORAGE_KEY);
  return isLangCode(stored) ? stored : null;
}

export function setLang(code: LangCode): void {
  lang.value = code;
  write(STORAGE_KEY, code);
  applyToDocument(code);
}

/** lang/dir на <html> нужны экранному диктору (выбор голоса) и вёрстке RTL. */
export function applyToDocument(code: LangCode): void {
  const info = langInfo(code);
  document.documentElement.lang = info.code;
  document.documentElement.dir = info.dir;
}

/** Язык интерфейса до того, как гость выбрал свой. */
export function uiLang(): LangCode {
  return lang.value ?? 'ru';
}
