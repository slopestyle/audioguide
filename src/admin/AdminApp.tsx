import { useEffect, useState } from 'preact/hooks';
import { loadGuide } from '../core/content';
import type { Guide } from '../core/types';
import { ApiError, fetchState, publish, uploadBlob, type Change } from './api';
import {
  baseSha,
  discardDraft,
  draft,
  pending,
  serialise,
  startEditing,
  toBase64,
} from './draft';
import { LoginScreen } from './screens/LoginScreen';
import { MatrixScreen } from './screens/MatrixScreen';
import { StandEditor } from './screens/StandEditor';
import { endSession, session } from './session';

export function AdminApp() {
  return session.value ? <Workspace /> : <LoginScreen />;
}

interface Status {
  kind: 'idle' | 'loading' | 'publishing' | 'error';
  message?: string;
}

function Workspace() {
  const [remote, setRemote] = useState<Guide | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [message, setMessage] = useState('');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  // Файлы живут только в памяти вкладки — предупреждаем перед закрытием.
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.value).length > 0) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  async function load() {
    setStatus({ kind: 'loading' });
    try {
      const [guide, state] = await Promise.all([loadGuide(), fetchState()]);
      setRemote(guide);
      startEditing(guide);
      baseSha.value = state.headSha;
      setPublishedAt(state.date);
      setStatus({ kind: 'idle' });
    } catch (failure) {
      setStatus({ kind: 'error', message: describe(failure) });
    }
  }

  async function doPublish() {
    const guide = draft.value;
    if (!guide || !baseSha.value) return;

    setStatus({ kind: 'publishing' });
    try {
      const changes: Change[] = [];
      // Файлы уезжают по одному, но до финального вызова репозиторий не меняется.
      for (const [path, file] of Object.entries(pending.value)) {
        changes.push({ path, blobSha: await uploadBlob(file.base64) });
      }
      changes.push({
        path: 'public/content.json',
        blobSha: await uploadBlob(toBase64(serialise(guide))),
      });

      await publish(baseSha.value, message.trim() || 'Обновление контента', changes);
      pending.value = {};
      setMessage('');
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.kind === 'conflict') {
        const state = await fetchState().catch(() => null);
        if (state) baseSha.value = state.headSha;
        setStatus({
          kind: 'error',
          message:
            'Кто-то опубликовал раньше. Ваши правки на месте — нажмите «Опубликовать» ещё раз, чтобы наложить их поверх.',
        });
        return;
      }
      setStatus({ kind: 'error', message: describe(failure) });
    }
  }

  const guide = draft.value;
  const files = Object.keys(pending.value).length;
  const textChanged =
    remote !== null && guide !== null && JSON.stringify(guide.stands) !== JSON.stringify(remote.stands);
  const changed = files > 0 || textChanged;
  const stand = guide && editing !== null ? guide.stands.find((s) => s.number === editing) : undefined;

  return (
    <main class="page page--wide">
      <header class="header">
        <h1 class="header__title">Админка · Музей друзей</h1>
        <span class="muted">{session.value?.name}</span>
        <button
          class="btn btn--ghost"
          onClick={() => {
            if (!changed || confirm('Есть неопубликованные правки. Всё равно выйти?')) endSession();
          }}
        >
          Выйти
        </button>
      </header>

      {publishedAt && <p class="muted">В зале сейчас версия от {formatMoment(publishedAt)}</p>}

      {status.kind === 'error' && (
        <p class="notice" role="alert">
          {status.message}{' '}
          <button class="btn" onClick={() => void load()}>
            Перезагрузить
          </button>
        </p>
      )}

      {changed && (
        <section class="publish">
          <strong>
            Не опубликовано: {textChanged ? 'правки текстов' : ''}
            {textChanged && files > 0 ? ', ' : ''}
            {files > 0 ? `файлов — ${files}` : ''}
          </strong>
          <input
            class="input"
            placeholder="Что изменили (необязательно)"
            value={message}
            onInput={(event) => setMessage(event.currentTarget.value)}
          />
          <div class="row">
            <button
              class="btn btn--primary"
              onClick={() => void doPublish()}
              disabled={status.kind === 'publishing'}
            >
              {status.kind === 'publishing' ? 'Публикуем…' : 'Опубликовать'}
            </button>
            <button
              class="btn"
              onClick={() => {
                if (remote && confirm('Отменить все неопубликованные правки?')) {
                  discardDraft(remote);
                  setEditing(null);
                }
              }}
            >
              Отменить правки
            </button>
          </div>
          <p class="muted">После публикации изменения появятся в зале примерно через минуту.</p>
        </section>
      )}

      {status.kind === 'loading' && <p class="muted">Загрузка…</p>}

      {guide &&
        (stand ? (
          <StandEditor stand={stand} onClose={() => setEditing(null)} />
        ) : (
          <MatrixScreen guide={guide} onOpen={setEditing} />
        ))}
    </main>
  );
}

function describe(failure: unknown): string {
  if (failure instanceof ApiError) {
    switch (failure.kind) {
      case 'auth':
        return 'Сессия истекла — войдите заново. Черновик сохранён.';
      case 'network':
        return 'Нет связи с обработчиком.';
      case 'too_large':
        return 'Файл слишком большой: нужен mp3 не тяжелее 2.5 МБ.';
      default:
        return failure.message;
    }
  }
  return 'Не удалось загрузить контент';
}

function formatMoment(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? iso : date.toLocaleString('ru-RU');
}
