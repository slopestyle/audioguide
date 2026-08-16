import { useState } from 'preact/hooks';
import { ApiError, login } from '../api';
import { apiBase, setApiBase, startSession } from '../session';

export function LoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(!apiBase.value);

  async function submit(event: Event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      startSession(await login(name, password));
    } catch (failure) {
      setError(describe(failure));
      setBusy(false);
    }
  }

  return (
    <main class="page">
      <h1 class="title title--lg">Админка аудиогида</h1>

      <form class="settings" onSubmit={submit}>
        <label class="field">
          Логин
          <input
            class="input"
            autocomplete="username"
            value={name}
            onInput={(event) => setName(event.currentTarget.value)}
            required
          />
        </label>

        <label class="field">
          Пароль
          <input
            class="input"
            type="password"
            autocomplete="current-password"
            value={password}
            onInput={(event) => setPassword(event.currentTarget.value)}
            required
          />
        </label>

        {error && (
          <p class="notice" role="alert">
            {error}
          </p>
        )}

        <button class="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Проверяем…' : 'Войти'}
        </button>
      </form>

      <button class="btn btn--ghost" onClick={() => setShowSettings(!showSettings)}>
        Адрес обработчика
      </button>

      {showSettings && (
        <label class="field">
          Адрес функции, которая проверяет вход
          <input
            class="input"
            value={apiBase.value}
            placeholder="https://functions.yandexcloud.net/…"
            onChange={(event) => setApiBase(event.currentTarget.value)}
          />
        </label>
      )}
    </main>
  );
}

function describe(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'Не удалось войти';
  switch (failure.kind) {
    case 'credentials':
    case 'auth':
      return 'Неверный логин или пароль';
    case 'network':
      return 'Нет связи с обработчиком. Проверьте интернет и адрес функции';
    default:
      return failure.message;
  }
}
