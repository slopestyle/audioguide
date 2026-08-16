import { signal } from '@preact/signals';
import { read, write } from '../core/storage';

export interface Session {
  token: string;
  name: string;
  expiresAt: number;
}

const API_KEY = 'mf.admin.api';
const SESSION_KEY = 'mf.admin.session';

/** Адрес функции задаётся при сборке, но его можно поменять руками:
 *  иначе развернуть облако нельзя без пересборки сайта. */
export const apiBase = signal(read(API_KEY) ?? import.meta.env.VITE_ADMIN_API ?? '');
export const session = signal<Session | null>(restore());

export function setApiBase(url: string): void {
  apiBase.value = url.trim().replace(/\/+$/, '');
  write(API_KEY, apiBase.value);
}

export function startSession(value: Session): void {
  session.value = value;
  try {
    // sessionStorage, а не localStorage: сессия умирает вместе с вкладкой.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    /* сессия проживёт до перезагрузки страницы */
  }
}

export function endSession(): void {
  session.value = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* нечего чистить */
  }
}

function restore(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Session;
    return value.expiresAt > Date.now() ? value : null;
  } catch {
    return null;
  }
}
