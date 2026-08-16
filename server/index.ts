import { handle, type ApiRequest, type Env } from './handler.ts';

/** Точка входа Yandex Cloud Functions. Событие приходит и от публичной ссылки
 *  функции, и от API Gateway — поля называются по-разному, поэтому нормализуем. */
interface YandexEvent {
  httpMethod?: string;
  path?: string;
  url?: string;
  headers?: Record<string, string>;
  /** Обычно строка, но при некоторых интеграциях приходит уже разобранный JSON. */
  body?: string | Record<string, unknown>;
  isBase64Encoded?: boolean;
}

export async function handler(event: YandexEvent) {
  const request: ApiRequest = {
    method: event.httpMethod ?? 'GET',
    path: event.path ?? event.url ?? '/',
    headers: lowercaseKeys(event.headers ?? {}),
    body: readBody(event),
  };

  const response = await handle(request, process.env as Env);

  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body === null ? '' : JSON.stringify(response.body),
    isBase64Encoded: false,
  };
}

function readBody(event: YandexEvent): string {
  if (event.body === undefined) return '';
  if (typeof event.body !== 'string') return JSON.stringify(event.body);
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

function lowercaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}
