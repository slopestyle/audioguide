// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import guideFixture from '../../public/content.json' with { type: 'json' };

const loginMock = vi.fn();
const stateMock = vi.fn();
const uploadBlobMock = vi.fn();
const publishMock = vi.fn();

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    login: loginMock,
    fetchState: stateMock,
    uploadBlob: uploadBlobMock,
    publish: publishMock,
  };
});

const { ApiError } = await import('./api');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();

  stateMock.mockResolvedValue({ headSha: 'head-sha', date: '2026-08-16T10:00:00Z', name: 'Иван' });
  uploadBlobMock.mockResolvedValue('blob-sha');
  publishMock.mockResolvedValue('commit-sha');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(guideFixture)))),
  );
});

afterEach(cleanup);

async function mount() {
  const { AdminApp } = await import('./AdminApp');
  render(<AdminApp />);
}

async function signIn() {
  loginMock.mockResolvedValue({ token: 'сессия', name: 'Иван', expiresAt: Date.now() + 3600_000 });
  await mount();
  fireEvent.input(screen.getByLabelText('Логин'), { target: { value: 'ivanov' } });
  fireEvent.input(screen.getByLabelText('Пароль'), { target: { value: 'пароль' } });
  fireEvent.click(screen.getByText('Войти'));
}

it('не пускает дальше формы при неверном пароле', async () => {
  loginMock.mockRejectedValue(new ApiError('credentials', 'нет'));
  await mount();

  fireEvent.input(screen.getByLabelText('Логин'), { target: { value: 'ivanov' } });
  fireEvent.input(screen.getByLabelText('Пароль'), { target: { value: 'не тот' } });
  fireEvent.click(screen.getByText('Войти'));

  expect(await screen.findByText('Неверный логин или пароль')).toBeTruthy();
  expect(screen.queryByText('Готовность экспозиции')).toBeNull();
});

it('объясняет, что обработчик недоступен, а не «что-то пошло не так»', async () => {
  loginMock.mockRejectedValue(new ApiError('network', 'нет связи'));
  await mount();

  fireEvent.input(screen.getByLabelText('Логин'), { target: { value: 'ivanov' } });
  fireEvent.input(screen.getByLabelText('Пароль'), { target: { value: 'пароль' } });
  fireEvent.click(screen.getByText('Войти'));

  expect(await screen.findByText(/Нет связи с обработчиком/)).toBeTruthy();
});

it('после входа показывает матрицу готовности', async () => {
  await signIn();

  expect(await screen.findByText('Готовность экспозиции')).toBeTruthy();
  expect(screen.getByText('Красная Поляна до курорта')).toBeTruthy();
  // У стенда 3 английский без записи — в матрице это «текст», а не «готово».
  expect(screen.getByText('English: текст')).toBeTruthy();
});

it('правка названия попадает в публикацию одним коммитом', async () => {
  await signIn();
  fireEvent.click(await screen.findByText('Ретро-снаряжение'));

  const title = await screen.findByLabelText(/Название на языке/);
  fireEvent.input(title, { target: { value: 'Ретро-снаряжение и лыжи' } });

  fireEvent.click(await screen.findByText('Опубликовать'));

  await waitFor(() => expect(publishMock).toHaveBeenCalled());
  const [baseSha, message, changes] = publishMock.mock.calls[0];
  expect(baseSha).toBe('head-sha');
  expect(message).toBe('Обновление контента');
  expect(changes).toEqual([{ path: 'public/content.json', blobSha: 'blob-sha' }]);
});

it('при чужой публикации предупреждает вместо перезаписи', async () => {
  publishMock.mockRejectedValueOnce(new ApiError('conflict', 'занято'));
  await signIn();

  fireEvent.click(await screen.findByText('Ретро-снаряжение'));
  fireEvent.input(await screen.findByLabelText(/Название на языке/), {
    target: { value: 'Другое название' },
  });
  fireEvent.click(await screen.findByText('Опубликовать'));

  expect(await screen.findByText(/Кто-то опубликовал раньше/)).toBeTruthy();
});
