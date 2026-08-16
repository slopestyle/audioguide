import { apiBase, endSession, session, type Session } from './session';

export type ErrorKind =
  | 'auth'
  | 'credentials'
  | 'conflict'
  | 'too_large'
  | 'forbidden'
  | 'network'
  | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** Действие передаётся полем `action`, а не путём: прямая ссылка на функцию
 *  в Yandex Cloud подпути не принимает. */
async function call<T>(action: string, payload: object = {}, auth = true): Promise<T> {
  if (!apiBase.value) {
    throw new ApiError('server', 'Не задан адрес обработчика админки');
  }

  let response: Response;
  try {
    response = await fetch(apiBase.value, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Не Authorization: его перехватывает Yandex Cloud и отвечает 403.
        ...(auth && session.value ? { 'x-session': session.value.token } : {}),
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new ApiError('network', 'Нет связи с обработчиком');
  }

  if (response.status === 401) {
    // Для входа это неверная пара, для остальных вызовов — истёкшая сессия.
    if (auth) endSession();
    throw new ApiError(auth ? 'auth' : 'credentials', 'Требуется вход');
  }
  // 403 приходит не от обработчика, а от самого облака — как правило,
  // когда функция непубличная или залита старая версия.
  if (response.status === 403) throw new ApiError('forbidden', 'Облако отклонило запрос');
  if (response.status === 409) throw new ApiError('conflict', 'Контент изменился');
  if (response.status === 413) throw new ApiError('too_large', 'Файл слишком большой');
  if (!response.ok) throw new ApiError('server', `Ошибка обработчика (${response.status})`);

  return (await response.json()) as T;
}

export function login(name: string, password: string): Promise<Session> {
  return call<Session>('login', { login: name, password }, false);
}

export function fetchState(): Promise<{ headSha: string; date: string; name: string }> {
  return call('state');
}

export async function uploadBlob(base64: string): Promise<string> {
  const result = await call<{ sha: string }>('blob', { content: base64 });
  return result.sha;
}

export interface Change {
  path: string;
  blobSha: string | null;
}

export async function publish(
  baseSha: string,
  message: string,
  changes: Change[],
): Promise<string> {
  const result = await call<{ commitSha: string }>('commit', { baseSha, message, changes });
  return result.commitSha;
}
