import { signal } from '@preact/signals';

/** Маршрутизация по hash: GitHub Pages не умеет отдавать index.html на
 *  произвольный путь, а адреса гость всё равно не набирает руками. */
export type Route = { name: 'keypad' } | { name: 'stand'; number: number } | { name: 'list' };

export const paths = {
  keypad: '#/',
  list: '#/list',
  stand: (number: number) => `#/s/${number}`,
};

export function parseHash(hash: string): Route {
  const stand = /^#\/s\/(\d{1,4})$/.exec(hash);
  if (stand) return { name: 'stand', number: Number(stand[1]) };
  if (hash === paths.list) return { name: 'list' };
  return { name: 'keypad' };
}

export const route = signal<Route>(parseHash(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parseHash(location.hash);
  window.scrollTo(0, 0);
});

export function go(path: string): void {
  if (location.hash !== path) location.hash = path;
}
