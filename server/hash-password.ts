import { randomBytes } from 'node:crypto';
import { hashPassword, newSalt } from './auth.ts';

/** Выдаёт сотруднику пароль и готовую запись для переменной USERS:
 *  node server/hash-password.ts ivanov "Иван Иванов" */
const [login, name] = process.argv.slice(2);

if (!login) {
  console.error('Использование: node server/hash-password.ts <логин> ["Имя сотрудника"]');
  process.exit(1);
}

// Пароль генерируем сами: придуманные людьми пароли — главная причина,
// по которой перебор вообще имеет смысл.
const password = randomBytes(12).toString('base64url');
const salt = newSalt();

console.log(`\nЛогин:  ${login}`);
console.log(`Пароль: ${password}`);
console.log('\nЗапись для переменной окружения USERS:\n');
console.log(JSON.stringify({ login, name: name ?? login, salt, hash: hashPassword(password, salt) }));
console.log('\nПароль показан один раз — передайте его сотруднику и не храните в переписке.\n');
