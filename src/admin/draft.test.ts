// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Guide } from '../core/types';
import {
  addStand,
  attachAudio,
  detachAudio,
  draft,
  pending,
  readiness,
  removeStand,
  serialise,
  setTitle,
  startEditing,
} from './draft';

const remote: Guide = {
  updatedAt: '2026-01-01T00:00:00Z',
  languages: ['ru', 'en', 'zh', 'ar'],
  stands: [
    { number: 1, content: { ru: { title: 'Поляна', audio: 'media/1/ru.mp3' }, en: { title: 'Polyana' } } },
  ],
};

beforeEach(() => {
  localStorage.clear();
  pending.value = {};
  startEditing(structuredClone(remote));
});

describe('матрица готовности', () => {
  it('различает пусто, только текст и готово', () => {
    const stand = draft.value!.stands[0];
    expect(readiness(stand, 'ru')).toBe('ready');
    expect(readiness(stand, 'en')).toBe('text');
    expect(readiness(stand, 'zh')).toBe('empty');
  });
});

describe('правка стендов', () => {
  it('добавляет стенд и держит список в порядке номеров', () => {
    expect(addStand(10)).toBe(true);
    expect(addStand(5)).toBe(true);
    expect(draft.value!.stands.map((s) => s.number)).toEqual([1, 5, 10]);
  });

  it('не создаёт второй стенд с тем же номером', () => {
    expect(addStand(1)).toBe(false);
  });

  it('удаляет стенд', () => {
    removeStand(1);
    expect(draft.value!.stands).toHaveLength(0);
  });

  it('правит заголовок на нужном языке, не задевая остальные', () => {
    setTitle(1, 'zh', '红波利亚纳');
    const stand = draft.value!.stands[0];
    expect(stand.content.zh?.title).toBe('红波利亚纳');
    expect(stand.content.ru?.title).toBe('Поляна');
  });
});

describe('файлы', () => {
  it('кладёт аудио в очередь публикации и прописывает путь в контент', () => {
    attachAudio(1, 'en', { base64: 'AAAA', size: 1000, name: 'en.mp3' }, 42);

    expect(pending.value['public/media/1/en.mp3'].name).toBe('en.mp3');
    expect(draft.value!.stands[0].content.en?.audio).toBe('media/1/en.mp3');
    expect(draft.value!.stands[0].content.en?.duration).toBe(42);
  });

  it('убирает аудио и из контента, и из очереди', () => {
    attachAudio(1, 'en', { base64: 'AAAA', size: 1000, name: 'en.mp3' });
    detachAudio(1, 'en');

    expect(pending.value['public/media/1/en.mp3']).toBeUndefined();
    expect(draft.value!.stands[0].content.en?.audio).toBeUndefined();
    expect(draft.value!.stands[0].content.en?.title).toBe('Polyana');
  });
});

describe('черновик', () => {
  it('переживает перезагрузку страницы', () => {
    setTitle(1, 'ru', 'Новое название');
    draft.value = null;
    startEditing(structuredClone(remote));
    expect(draft.value!.stands[0].content.ru?.title).toBe('Новое название');
  });

  it('при сохранении обновляет дату публикации', () => {
    const saved = JSON.parse(serialise(draft.value!)) as Guide;
    expect(saved.updatedAt).not.toBe(remote.updatedAt);
    expect(saved.stands[0].content.ru?.title).toBe('Поляна');
  });
});
