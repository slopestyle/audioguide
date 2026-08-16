import { authenticate, createSession, parseUsers, verifySession, type SessionPayload } from './auth.ts';
import { commit, createBlob, GitHubError, head, type Change, type Repo } from './github.ts';

export interface Env {
  SESSION_SECRET?: string;
  USERS?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  ALLOWED_ORIGIN?: string;
}

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** Предел одного запроса к функции — 3.5 МБ; base64 раздувает файл в 1.33 раза. */
export const MAX_FILE_BYTES = 2.5 * 1024 * 1024;

export interface Payload {
  action?: string;
  login?: string;
  password?: string;
  content?: string;
  baseSha?: string;
  message?: string;
  changes?: Change[];
}

export async function handle(request: ApiRequest, env: Env): Promise<ApiResponse> {
  const cors = corsHeaders(env);

  if (request.method === 'OPTIONS') return { status: 204, body: null, headers: cors };

  try {
    const config = readConfig(env);
    const payload = parseBody<Payload>(request);
    const route = payload.action ?? lastSegment(request.path);

    if (route === 'login') return { ...(await login(payload, config)), headers: cors };

    const session = verifySession(bearer(request), config.secret);
    // Логин сверяется со списком на каждом запросе: убрали сотрудника из USERS —
    // доступ закрылся сразу, а не через 12 часов, когда истечёт его сессия.
    const known = session !== null && config.users.some((user) => user.login === session.login);
    if (!session || !known) {
      return { status: 401, body: { error: 'unauthorized' }, headers: cors };
    }

    switch (route) {
      case 'state':
        return { ...(await state(config.repo, session)), headers: cors };
      case 'blob':
        return { ...(await blob(payload, config.repo)), headers: cors };
      case 'commit':
        return { ...(await publish(payload, config.repo, session)), headers: cors };
      default:
        return { status: 404, body: { error: 'not_found' }, headers: cors };
    }
  } catch (error) {
    if (error instanceof GitHubError) {
      return { status: error.status, body: { error: 'github', message: error.message }, headers: cors };
    }
    console.error(error);
    return { status: 500, body: { error: 'internal' }, headers: cors };
  }
}

interface Config {
  secret: string;
  users: ReturnType<typeof parseUsers>;
  repo: Repo;
}

function readConfig(env: Env): Config {
  const [owner, repo] = (env.GITHUB_REPO ?? '').split('/');
  if (!env.SESSION_SECRET || !env.GITHUB_TOKEN || !owner || !repo) {
    throw new Error('Функция не настроена: нужны SESSION_SECRET, GITHUB_TOKEN, GITHUB_REPO');
  }
  return {
    secret: env.SESSION_SECRET,
    users: parseUsers(env.USERS),
    repo: { owner, repo, branch: env.GITHUB_BRANCH ?? 'main', token: env.GITHUB_TOKEN },
  };
}

async function login(payload: Payload, config: Config): Promise<Omit<ApiResponse, 'headers'>> {
  const { login: name, password } = payload;
  if (!name || !password) {
    return { status: 400, body: { error: 'bad_request' } };
  }

  const user = authenticate(config.users, name, password);
  // Одинаковый ответ на неизвестный логин и неверный пароль: подсказка, что
  // именно неверно, помогает подбирать.
  if (!user) return { status: 401, body: { error: 'bad_credentials' } };

  const token = createSession(user, config.secret, SESSION_TTL_MS);
  return {
    status: 200,
    body: { token, name: user.name, expiresAt: Date.now() + SESSION_TTL_MS },
  };
}

async function state(repo: Repo, session: SessionPayload): Promise<Omit<ApiResponse, 'headers'>> {
  const current = await head(repo);
  return { status: 200, body: { headSha: current.sha, date: current.date, name: session.name } };
}

async function blob(payload: Payload, repo: Repo): Promise<Omit<ApiResponse, 'headers'>> {
  const { content } = payload;
  if (!content) return { status: 400, body: { error: 'bad_request' } };

  const bytes = Math.floor((content.length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) {
    return { status: 413, body: { error: 'too_large', limit: MAX_FILE_BYTES } };
  }

  return { status: 200, body: { sha: await createBlob(repo, content) } };
}

async function publish(
  payload: Payload,
  repo: Repo,
  session: SessionPayload,
): Promise<Omit<ApiResponse, 'headers'>> {
  if (!payload.baseSha || !Array.isArray(payload.changes) || payload.changes.length === 0) {
    return { status: 400, body: { error: 'bad_request' } };
  }

  const sha = await commit(repo, {
    baseSha: payload.baseSha,
    message: payload.message?.trim() || 'Обновление контента',
    changes: payload.changes,
    author: session.name,
  });
  return { status: 200, body: { commitSha: sha } };
}

function parseBody<T>(request: ApiRequest): Partial<T> {
  if (!request.body) return {};
  try {
    return JSON.parse(request.body) as T;
  } catch {
    return {};
  }
}

function bearer(request: ApiRequest): string | undefined {
  const header = request.headers.authorization ?? request.headers.Authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Прямая ссылка на функцию не принимает подпути: «/<id>/login» она считает
 *  испорченным идентификатором. Поэтому основной способ выбрать действие —
 *  поле `action` в теле запроса, а путь читается только ради API Gateway. */
function lastSegment(path: string): string {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  return segments.at(-1) ?? '';
}

/** Сессия ездит заголовком Authorization, а не cookie, поэтому CSRF невозможен
 *  и достаточно разрешить один источник. */
function corsHeaders(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? 'https://slopestyle.github.io',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    'content-type': 'application/json; charset=utf-8',
  };
}
