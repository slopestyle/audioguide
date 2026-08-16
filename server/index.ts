import { handle, type ApiRequest, type Env } from './handler.ts';

/** Точка входа Yandex Cloud Functions. Событие приходит и от публичной ссылки
 *  функции, и от API Gateway — поля называются по-разному, поэтому нормализуем. */
interface YandexEvent {
  httpMethod?: string;
  path?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

export async function handler(event: YandexEvent) {
  const request: ApiRequest = {
    method: event.httpMethod ?? 'GET',
    path: event.path ?? event.url ?? '/',
    headers: lowercaseKeys(event.headers ?? {}),
    body: event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? ''),
  };

  const response = await handle(request, process.env as Env);

  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body === null ? '' : JSON.stringify(response.body),
    isBase64Encoded: false,
  };
}

function lowercaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}
