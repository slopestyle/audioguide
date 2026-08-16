import { describe, expect, it } from 'vitest';
import {
  authenticate,
  createSession,
  hashPassword,
  newSalt,
  parseUsers,
  verifyPassword,
  verifySession,
  type User,
} from './auth.ts';

const salt = newSalt();
const user: User = {
  login: 'ivanov',
  name: 'Иван',
  salt,
  hash: hashPassword('правильный-пароль', salt),
};

describe('пароли', () => {
  it('не хранит пароль, только хеш от него', () => {
    expect(user.hash).not.toContain('правильный-пароль');
    expect(user.hash).toHaveLength(64);
  });

  it('с разной солью один пароль даёт разные хеши', () => {
    expect(hashPassword('пароль', 'a')).not.toBe(hashPassword('пароль', 'b'));
  });

  it('принимает верный пароль и отвергает неверный', () => {
    expect(verifyPassword('правильный-пароль', user)).toBe(true);
    expect(verifyPassword('другой', user)).toBe(false);
    expect(verifyPassword('', user)).toBe(false);
  });
});

describe('authenticate', () => {
  it('пускает только с верной парой логин-пароль', () => {
    expect(authenticate([user], 'ivanov', 'правильный-пароль')).toBe(user);
    expect(authenticate([user], 'ivanov', 'неверный')).toBeNull();
    expect(authenticate([user], 'petrov', 'правильный-пароль')).toBeNull();
  });

  it('не падает на пустом списке сотрудников', () => {
    expect(authenticate([], 'ivanov', 'любой')).toBeNull();
  });
});

describe('сессии', () => {
  const secret = 'секрет-для-подписи';

  it('выдаёт токен, который принимается до истечения срока', () => {
    const token = createSession(user, secret, 1000, 0);
    expect(verifySession(token, secret, 500)?.login).toBe('ivanov');
  });

  it('отвергает просроченную сессию', () => {
    const token = createSession(user, secret, 1000, 0);
    expect(verifySession(token, secret, 1001)).toBeNull();
  });

  it('отвергает подделанные и чужие токены', () => {
    const token = createSession(user, secret, 1000, 0);
    const [body, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ login: 'root', name: 'x', exp: 1e15 })).toString(
      'base64url',
    );

    expect(verifySession(`${forged}.${signature}`, secret, 0)).toBeNull();
    expect(verifySession(`${body}.${signature}x`, secret, 0)).toBeNull();
    expect(verifySession(token, 'другой-секрет', 0)).toBeNull();
    expect(verifySession(undefined, secret, 0)).toBeNull();
    expect(verifySession('мусор', secret, 0)).toBeNull();
  });
});

describe('parseUsers', () => {
  it('читает список из переменной окружения', () => {
    const users = parseUsers(JSON.stringify([{ login: 'a', name: 'A', salt: 's', hash: 'h' }]));
    expect(users).toHaveLength(1);
  });

  it('громко падает на неполной записи, а не пускает всех подряд', () => {
    expect(() => parseUsers('[{"login":"a"}]')).toThrow();
    expect(parseUsers(undefined)).toEqual([]);
  });
});
