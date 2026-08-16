import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, newSalt } from './auth.ts';
import { GitHubError } from './github.ts';
import { handle, MAX_FILE_BYTES, type ApiRequest, type Env } from './handler.ts';

vi.mock('./github.ts', async () => {
  const actual = await vi.importActual<typeof import('./github.ts')>('./github.ts');
  return {
    ...actual,
    head: vi.fn(async () => ({ sha: 'head-sha', treeSha: 'tree-sha', date: '2026-08-16T00:00:00Z' })),
    createBlob: vi.fn(async () => 'blob-sha'),
    commit: vi.fn(async () => 'new-commit-sha'),
  };
});

const github = await import('./github.ts');

const salt = newSalt();
const env: Env = {
  SESSION_SECRET: 'секрет',
  GITHUB_TOKEN: 'токен',
  GITHUB_REPO: 'slopestyle/audioguide',
  USERS: JSON.stringify([
    { login: 'ivanov', name: 'Иван', salt, hash: hashPassword('пароль-музея', salt) },
  ]),
};

/** Действие едет в теле: прямая ссылка на функцию подпути не принимает. */
function call(action: string, payload: object = {}, token?: string): ApiRequest {
  return {
    method: 'POST',
    path: '/',
    headers: token ? { 'x-session': token } : {},
    body: JSON.stringify({ action, ...payload }),
  };
}

async function signIn(): Promise<string> {
  const response = await handle(call('login', { login: 'ivanov', password: 'пароль-музея' }), env);
  return (response.body as { token: string }).token;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('вход', () => {
  it('выдаёт сессию по верной паре', async () => {
    const response = await handle(
      call('login', { login: 'ivanov', password: 'пароль-музея' }),
      env,
    );
    expect(response.status).toBe(200);
    expect((response.body as { name: string }).name).toBe('Иван');
  });

  it('отвечает одинаково на неверный пароль и несуществующий логин', async () => {
    const wrongPassword = await handle(call('login', { login: 'ivanov', password: 'нет' }), env);
    const wrongLogin = await handle(
      call('login', { login: 'petrov', password: 'пароль-музея' }),
      env,
    );
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(wrongLogin.body);
  });
});

describe('защита методов', () => {
  it('не пускает без сессии', async () => {
    for (const request of [
      call('state'),
      call('blob', { content: 'AAAA' }),
      call('commit', { baseSha: 'x', changes: [] }),
    ]) {
      expect((await handle(request, env)).status).toBe(401);
    }
    expect(github.createBlob).not.toHaveBeenCalled();
  });

  it('закрывает доступ сразу, как только сотрудника убрали из списка', async () => {
    const token = await signIn();

    expect((await handle(call('state', {}, token), env)).status).toBe(200);
    expect((await handle(call('state', {}, token), { ...env, USERS: '[]' })).status).toBe(401);
  });

  it('не пускает с подделанным токеном', async () => {
    expect((await handle(call('state', {}, 'подделка.подпись'), env)).status).toBe(401);
  });

  it('принимает сессию и в Authorization — на случай работы через API Gateway', async () => {
    const token = await signIn();
    const response = await handle(
      {
        method: 'POST',
        path: '/',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'state' }),
      },
      env,
    );
    expect(response.status).toBe(200);
  });
});

describe('публикация', () => {
  it('отдаёт текущий коммит для проверки конфликтов', async () => {
    const response = await handle(call('state', {}, await signIn()), env);
    expect(response.status).toBe(200);
    expect((response.body as { headSha: string }).headSha).toBe('head-sha');
  });

  it('загружает файл и создаёт коммит от имени сотрудника', async () => {
    const token = await signIn();
    const blob = await handle(call('blob', { content: 'AAAA' }, token), env);
    expect((blob.body as { sha: string }).sha).toBe('blob-sha');

    const published = await handle(
      call(
        'commit',
        { baseSha: 'head-sha', message: 'Стенд 12', changes: [{ path: 'a', blobSha: 'blob-sha' }] },
        token,
      ),
      env,
    );
    expect(published.status).toBe(200);
    expect(vi.mocked(github.commit).mock.calls[0][1].author).toBe('Иван');
  });

  it('отклоняет файл больше предела одного запроса', async () => {
    const token = await signIn();
    const oversized = 'A'.repeat(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8);
    const response = await handle(call('blob', { content: oversized }, token), env);
    expect(response.status).toBe(413);
    expect(github.createBlob).not.toHaveBeenCalled();
  });

  it('сообщает о чужой публикации вместо перезаписи', async () => {
    vi.mocked(github.commit).mockRejectedValueOnce(new GitHubError('Контент изменился', 409));
    const response = await handle(
      call('commit', { baseSha: 'старый', changes: [{ path: 'a', blobSha: 'b' }] }, await signIn()),
      env,
    );
    expect(response.status).toBe(409);
  });
});

describe('служебное', () => {
  it('понимает и маршрут в пути — на случай работы через API Gateway', async () => {
    const response = await handle(
      {
        method: 'POST',
        path: '/login',
        headers: {},
        body: JSON.stringify({ login: 'ivanov', password: 'пароль-музея' }),
      },
      env,
    );
    expect(response.status).toBe(200);
  });

  it('отвечает на preflight и отдаёт заголовки CORS', async () => {
    const response = await handle({ method: 'OPTIONS', path: '/', headers: {}, body: '' }, env);
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://slopestyle.github.io');
  });

  it('не притворяется работающим при незаполненных переменных', async () => {
    const response = await handle(call('login', { login: 'a', password: 'b' }), {});
    expect(response.status).toBe(500);
  });
});
