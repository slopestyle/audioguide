import { useState } from 'preact/hooks';
import { asset } from '../../core/content';
import { LANGS, langInfo } from '../../core/lang';
import type { LangCode, Stand } from '../../core/types';
import {
  attachAudio,
  attachPhoto,
  detachAudio,
  pending,
  photoPath,
  removeStand,
  repoPath,
  setText,
  setTitle,
  audioPath,
} from '../draft';
import { compressPhoto, megabytes, readDuration, toBase64, validateAudio } from '../media';

export function StandEditor({ stand, onClose }: { stand: Stand; onClose: () => void }) {
  const [lang, setLang] = useState<LangCode>('ru');
  const [error, setError] = useState<string | null>(null);
  const content = stand.content[lang];
  const uploaded = pending.value[repoPath(audioPath(stand.number, lang))];

  async function pickAudio(file: File) {
    const problem = validateAudio(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const [base64, duration] = await Promise.all([toBase64(file), readDuration(file)]);
    attachAudio(stand.number, lang, { base64, size: file.size, name: file.name }, duration);
  }

  async function pickPhoto(file: File) {
    try {
      const compressed = await compressPhoto(file);
      attachPhoto(stand.number, {
        base64: await toBase64(compressed),
        size: compressed.size,
        name: 'photo.webp',
      });
      setError(null);
    } catch {
      setError('Не удалось обработать изображение');
    }
  }

  return (
    <section>
      <div class="row row--between">
        <h2 class="title title--lg">Стенд № {stand.number}</h2>
        <button class="btn" onClick={onClose}>
          К списку
        </button>
      </div>

      <div class="editor-photo">
        {stand.photo && !pending.value[repoPath(photoPath(stand.number))] && (
          <img src={asset(stand.photo)} alt="" />
        )}
        {pending.value[repoPath(photoPath(stand.number))] && (
          <p class="muted">Новое фото загружено, появится после публикации</p>
        )}
        <label class="btn">
          Фото экспоната
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void pickPhoto(file);
            }}
          />
        </label>
      </div>

      <div class="tabs" role="tablist">
        {LANGS.map((item) => (
          <button
            key={item.code}
            role="tab"
            aria-selected={lang === item.code}
            class={lang === item.code ? 'btn btn--primary' : 'btn'}
            onClick={() => {
              setLang(item.code);
              setError(null);
            }}
          >
            {item.short}
          </button>
        ))}
      </div>

      <label class="field">
        Название на языке «{langInfo(lang).label}»
        <input
          class="input"
          lang={lang}
          dir={langInfo(lang).dir}
          value={content?.title ?? ''}
          onInput={(event) => setTitle(stand.number, lang, event.currentTarget.value)}
        />
      </label>

      <label class="field">
        Текст расшифровки
        <textarea
          class="input"
          rows={8}
          lang={lang}
          dir={langInfo(lang).dir}
          value={content?.text ?? ''}
          onInput={(event) => setText(stand.number, lang, event.currentTarget.value)}
        />
      </label>

      <div class="field">
        Озвучка
        {uploaded ? (
          <p class="notice">
            Загружено: {uploaded.name} ({megabytes(uploaded.size)} МБ). Появится в зале после
            публикации.
          </p>
        ) : content?.audio ? (
          <audio class="preview" controls src={asset(content.audio)} />
        ) : (
          <p class="muted">Файла нет</p>
        )}

        <div class="row">
          <label class="btn">
            {content?.audio ? 'Заменить mp3' : 'Загрузить mp3'}
            <input
              type="file"
              accept="audio/mpeg,.mp3"
              class="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void pickAudio(file);
              }}
            />
          </label>
          {content?.audio && (
            <button class="btn" onClick={() => detachAudio(stand.number, lang)}>
              Убрать озвучку
            </button>
          )}
        </div>
      </div>

      {error && (
        <p class="notice" role="alert">
          {error}
        </p>
      )}

      <button
        class="btn btn--danger"
        onClick={() => {
          if (confirm(`Удалить стенд № ${stand.number} из гида?`)) {
            removeStand(stand.number);
            onClose();
          }
        }}
      >
        Удалить стенд
      </button>
    </section>
  );
}
