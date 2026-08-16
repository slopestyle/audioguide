import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/** 600 000 итераций — примерно 300 мс на проверку. Это осознанно медленно:
 *  подбор пароля становится бессмысленным без отдельного счётчика попыток. */
const ITERATIONS = 600_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export interface User {
  login: string;
  name: string;
  salt: string;
  hash: string;
}

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password.normalize('NFKC'), salt, ITERATIONS, KEY_LENGTH, DIGEST).toString(
    'hex',
  );
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

/** Сравнение за постоянное время: иначе по времени ответа можно подбирать хеш. */
export function verifyPassword(password: string, user: User): boolean {
  const actual = Buffer.from(hashPassword(password, user.salt), 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function parseUsers(raw: string | undefined): User[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('USERS: ожидался массив');
  return parsed.map((item) => {
    const user = item as Partial<User>;
    if (!user.login || !user.salt || !user.hash) {
      throw new Error('USERS: у записи нет login, salt или hash');
    }
    return { login: user.login, name: user.name ?? user.login, salt: user.salt, hash: user.hash };
  });
}

/** Ищем пользователя всегда одинаково долго, чтобы по времени ответа нельзя
 *  было отличить «нет такого логина» от «неверный пароль». */
export function authenticate(users: User[], login: string, password: string): User | null {
  const found = users.find((user) => user.login === login);
  const probe: User = found ?? {
    login,
    name: '',
    salt: 'missing-user-probe',
    hash: '00'.repeat(KEY_LENGTH),
  };
  const ok = verifyPassword(password, probe);
  return found && ok ? found : null;
}

export interface SessionPayload {
  login: string;
  name: string;
  exp: number;
}

export function createSession(user: User, secret: string, ttlMs: number, now = Date.now()): string {
  const payload: SessionPayload = { login: user.login, name: user.name, exp: now + ttlMs };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}
