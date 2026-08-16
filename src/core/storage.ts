/** localStorage бросает исключение в приватном режиме Safari и при выключенных
 *  cookies. Настройки — не тот случай, ради которого стоит ронять аудиогид. */

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* тихо: гость просто потеряет настройку между сессиями */
  }
}
