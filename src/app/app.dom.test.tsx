// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import guideFixture from '../../fixtures/content.sample.json' with { type: 'json' };

beforeAll(() => {
  // happy-dom не реализует воспроизведение — плееру достаточно заглушек.
  const media = window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
  media.load = () => {};
  media.play = () => Promise.resolve();
  media.pause = () => {};
});

beforeEach(() => {
  localStorage.clear();
  location.hash = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(guideFixture)))),
  );
  vi.resetModules();
});

// Без явной очистки старое дерево остаётся в документе и продолжает слушать
// hashchange от предыдущего экземпляра роутера.
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-scheme');
  document.documentElement.removeAttribute('data-text');
});

/** Модули читают язык и маршрут при импорте, поэтому импортируем начисто. */
async function mount() {
  const { App } = await import('./App');
  render(<App />);
}

it('гость выбирает язык, набирает номер и попадает на стенд', async () => {
  await mount();

  fireEvent.click(await screen.findByText('Русский'));
  expect(await screen.findByText('Введите номер стенда')).toBeTruthy();

  // Номер 1 не открывается сразу: есть стенды 10, 11 и 12.
  fireEvent.click(screen.getByText('1'));
  expect(screen.queryByText('Ретро-снаряжение')).toBeNull();

  fireEvent.click(screen.getByText('2'));
  await waitFor(() => expect(screen.getByText('Ретро-снаряжение')).toBeTruthy());
});

it('предлагает другой язык, когда стенд не озвучен на выбранном', async () => {
  localStorage.setItem('mf.lang', 'en');
  location.hash = '#/s/3';
  await mount();

  // У стенда 3 английский перевод есть, а записи нет.
  expect(await screen.findByText('The Rope Tow')).toBeTruthy();
  expect(
    screen.getByText('This stand is not yet narrated in the selected language.'),
  ).toBeTruthy();
  expect(screen.getByText('Русский')).toBeTruthy();
});

it('сообщает о несуществующем номере вместо пустого экрана', async () => {
  localStorage.setItem('mf.lang', 'ru');
  location.hash = '#/s/47';
  await mount();

  expect(await screen.findByText(/Такого стенда нет/)).toBeTruthy();
  expect(screen.getByText('Проверьте номер на табличке.')).toBeTruthy();
});

it('переключает схему для слабовидящих на весь документ', async () => {
  localStorage.setItem('mf.lang', 'ru');
  const { applySettings } = await import('../core/settings');
  applySettings();
  await mount();

  fireEvent.click(await screen.findByLabelText('Оформление'));
  fireEvent.click(await screen.findByText('Белым по чёрному'));
  await waitFor(() => expect(document.documentElement.dataset.scheme).toBe('wb'));

  fireEvent.click(screen.getByText('Очень крупный'));
  await waitFor(() => expect(document.documentElement.dataset.text).toBe('xl'));
});
