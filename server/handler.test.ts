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

function request(method: string, path: string, body?: unknown, token?: string): ApiRequest {
  return {
    method,
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

async function signIn(): Promise<string> {
  const response = await handle(
    request('POST', '/login', { login: 'ivanov', password: 'пароль-музея' }),
    env,
  );
  return (response.body as { token: string }).token;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('вход', () => {
  it('выдаёт сессию по верной паре', async () => {
    const response = await handle(
      request('POST', '/login', { login: 'ivanov', password: 'пароль-музея' }),
      env,
    );
    expect(response.status).toBe(200);
    expect((response.body as { name: string }).name).toBe('Иван');
  });

  it('отвечает одинаково на неверный пароль и несуществующий логин', async () => {
    const wrongPassword = await handle(
      request('POST', '/login', { login: 'ivanov', password: 'нет' }),
      env,
    );
    const wrongLogin = await handle(
      request('POST', '/login', { login: 'petrov', password: 'пароль-музея' }),
      env,
    );
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(wrongLogin.body);
  });
});

describe('защита методов', () => {
  it('не пускает без сессии', async () => {
    for (const call of [
      request('GET', '/state'),
      request('POST', '/blob', { content: 'AAAA' }),
      request('POST', '/commit', { baseSha: 'x', changes: [] }),
    ]) {
      expect((await handle(call, env)).status).toBe(401);
    }
    expect(github.createBlob).not.toHaveBeenCalled();
  });

  it('не пускает с подделанным токеном', async () => {
    const response = await handle(request('GET', '/state', undefined, 'подделка.подпись'), env);
    expect(response.status).toBe(401);
  });
});

describe('публикация', () => {
  it('отдаёт текущий коммит для проверки конфликтов', async () => {
    const response = await handle(request('GET', '/state', undefined, await signIn()), env);
    expect(response.status).toBe(200);
    expect((response.body as { headSha: string }).headSha).toBe('head-sha');
  });

  it('загружает файл и создаёт коммит от имени сотрудника', async () => {
    const token = await signIn();
    const blob = await handle(request('POST', '/blob', { content: 'AAAA' }, token), env);
    expect((blob.body as { sha: string }).sha).toBe('blob-sha');

    const published = await handle(
      request(
        'POST',
        '/commit',
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
    const response = await handle(request('POST', '/blob', { content: oversized }, token), env);
    expect(response.status).toBe(413);
    expect(github.createBlob).not.toHaveBeenCalled();
  });

  it('сообщает о чужой публикации вместо перезаписи', async () => {
    vi.mocked(github.commit).mockRejectedValueOnce(new GitHubError('Контент изменился', 409));
    const response = await handle(
      request(
        'POST',
        '/commit',
        { baseSha: 'старый', changes: [{ path: 'a', blobSha: 'b' }] },
        await signIn(),
      ),
      env,
    );
    expect(response.status).toBe(409);
  });
});

describe('служебное', () => {
  it('отвечает на preflight и отдаёт заголовки CORS', async () => {
    const response = await handle(request('OPTIONS', '/login'), env);
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://slopestyle.github.io');
  });

  it('узнаёт маршрут и при вызове по прямой ссылке на функцию', async () => {
    const response = await handle(
      request('POST', '/d4e1abcdef23456789/login', { login: 'ivanov', password: 'пароль-музея' }),
      env,
    );
    expect(response.status).toBe(200);
  });

  it('не притворяется работающим при незаполненных переменных', async () => {
    const response = await handle(request('POST', '/login', { login: 'a', password: 'b' }), {});
    expect(response.status).toBe(500);
  });
});
