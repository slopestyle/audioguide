/** Проверка развёрнутой функции до захода в админку:
 *  npm run server:check -- https://functions.yandexcloud.net/<id> ivanov ПАРОЛЬ
 *
 *  Отделяет проблемы облака от проблем браузера и переводит коды ответа
 *  в понятные причины. */
const [url, login, password] = process.argv.slice(2);

if (!url || !login || !password) {
  console.error('Использование: npm run server:check -- <URL функции> <логин> <пароль>');
  process.exit(1);
}

const endpoint = url.replace(/\/+$/, '');
console.log(`Запрос: POST ${endpoint} (action: login)\n`);

let response;
try {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', login, password }),
  });
} catch (failure) {
  console.error('Не удалось соединиться с функцией. Проверьте URL и интернет.');
  console.error(String(failure));
  process.exit(1);
}

const text = await response.text();

switch (response.status) {
  case 200: {
    const session = JSON.parse(text);
    console.log('Всё работает.');
    console.log(`Сотрудник: ${session.name}`);
    console.log(`Сессия до: ${new Date(session.expiresAt).toLocaleString('ru-RU')}`);
    break;
  }
  case 401:
    // bad_credentials — действие login отработало и отказало по паролю.
    // unauthorized — до проверки пароля не дошло: действие не распознано.
    if (text.includes('bad_credentials')) {
      console.log('Функция работает, но пара логин-пароль не подошла.');
      console.log('Проверьте пароль и то, что запись сотрудника попала в USERS.');
    } else {
      console.log('Функция не распознала действие login — почти наверняка в облаке');
      console.log('лежит старая версия кода. Пересоберите архив (npm run server:zip)');
      console.log('и создайте новую версию функции.');
    }
    break;
  case 403:
    console.log('Функция не публичная: разрешите вызов без авторизации');
    console.log('(вкладка «Обзор» → «Публичная функция»).');
    break;
  case 404:
    console.log('Действие не распознано. Обычно причина в точке входа:');
    console.log('она должна быть index.handler, а в архиве — файлы, а не папка.');
    break;
  case 400:
    console.log('Функция не приняла запрос. Если в ответе «invalid functionID»,');
    console.log('в URL лишний путь: нужен адрес без хвоста после идентификатора.');
    break;
  case 500:
    console.log('Функция запустилась, но не настроена.');
    console.log('Проверьте переменные окружения: SESSION_SECRET, GITHUB_TOKEN, GITHUB_REPO, USERS.');
    break;
  default:
    console.log(`Неожиданный ответ ${response.status}.`);
}

console.log(`\nОтвет функции: ${text.slice(0, 400)}`);
