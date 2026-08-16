import { describe, expect, it } from 'vitest';
import {
  fallbackOrder,
  findStand,
  GuideFormatError,
  hasLongerNumber,
  neighbours,
  parseGuide,
  standTitle,
  viewStand,
} from './content';
import type { Guide, Stand } from './types';

const raw = {
  updatedAt: '2026-08-16T12:00:00Z',
  languages: ['ru', 'en', 'zh', 'ar', 'klingon'],
  stands: [
    { number: 12, content: { ru: { title: 'Ретро', audio: 'media/12/ru.mp3' } } },
    { number: 1, content: { ru: { title: 'Поляна', audio: 'media/1/ru.mp3' } } },
    { number: 'два', content: {} },
    null,
  ],
};

describe('parseGuide', () => {
  it('сортирует стенды по номеру и отбрасывает битые записи', () => {
    const guide = parseGuide(raw);
    expect(guide.stands.map((s) => s.number)).toEqual([1, 12]);
  });

  it('игнорирует неизвестные языки', () => {
    expect(parseGuide(raw).languages).toEqual(['ru', 'en', 'zh', 'ar']);
  });

  it('отбрасывает контент без заголовка', () => {
    const guide = parseGuide({
      stands: [{ number: 5, content: { ru: { audio: 'a.mp3' }, en: { title: 'Ok' } } }],
    });
    expect(guide.stands[0].content.ru).toBeUndefined();
    expect(guide.stands[0].content.en?.title).toBe('Ok');
  });

  it('сдаётся только если файл вообще не гид', () => {
    expect(() => parseGuide({ foo: 1 })).toThrow(GuideFormatError);
    expect(() => parseGuide(null)).toThrow(GuideFormatError);
  });
});

const guide: Guide = {
  updatedAt: '',
  languages: ['ru', 'en', 'zh', 'ar'],
  stands: [
    {
      number: 1,
      content: {
        ru: { title: 'Поляна', audio: 'media/1/ru.mp3' },
        en: { title: 'Polyana', audio: 'media/1/en.mp3' },
      },
    },
    {
      number: 3,
      content: {
        ru: { title: 'Бугель', audio: 'media/3/ru.mp3' },
        en: { title: 'Rope tow', text: 'Перевод есть, записи нет' },
      },
    },
    { number: 10, content: { zh: { title: '奥运', audio: 'media/10/zh.mp3' } } },
    { number: 11, content: {} },
  ],
};

describe('viewStand', () => {
  it('играет на выбранном языке, когда он озвучен', () => {
    const view = viewStand(guide.stands[0], 'en', guide.languages);
    expect(view.audioLang).toBe('en');
    expect(view.audio?.audio).toBe('media/1/en.mp3');
  });

  it('при отсутствии озвучки оставляет текст на выбранном языке и берёт запасное аудио', () => {
    const view = viewStand(guide.stands[1], 'en', guide.languages);
    expect(view.requested?.text).toBe('Перевод есть, записи нет');
    expect(view.requested?.audio).toBeUndefined();
    expect(view.audioLang).toBe('ru');
    expect(view.audioLangs).toEqual(['ru']);
  });

  it('сообщает, что аудио нет вовсе', () => {
    const view = viewStand(guide.stands[3], 'ru', guide.languages);
    expect(view.audioLang).toBeUndefined();
    expect(view.audioLangs).toEqual([]);
  });

  it('для арабского гостя предлагает китайскую озвучку, если другой нет', () => {
    const view = viewStand(guide.stands[2], 'ar', guide.languages);
    expect(view.audioLang).toBe('zh');
  });
});

describe('fallbackOrder', () => {
  it('ставит выбранный язык первым, затем русский и английский', () => {
    expect(fallbackOrder('zh', ['ru', 'en', 'zh', 'ar'])).toEqual(['zh', 'ru', 'en', 'ar']);
  });

  it('не выдумывает языков, которых нет в гиде', () => {
    expect(fallbackOrder('ar', ['ru'])).toEqual(['ar', 'ru']);
  });
});

describe('навигация по номерам', () => {
  it('находит соседей по порядку, а не по арифметике', () => {
    expect(neighbours(guide, 3)).toEqual({ prev: 1, next: 10 });
    expect(neighbours(guide, 1).prev).toBeUndefined();
    expect(neighbours(guide, 999)).toEqual({});
  });

  it('видит, что номер можно продолжить', () => {
    expect(hasLongerNumber(guide, '1')).toBe(true); // есть 10 и 11
    expect(hasLongerNumber(guide, '3')).toBe(false); // стендов 30-39 нет
  });

  it('находит стенд по номеру', () => {
    expect(findStand(guide, 10)?.number).toBe(10);
    expect(findStand(guide, 47)).toBeUndefined();
  });
});

describe('standTitle', () => {
  it('берёт заголовок на доступном языке, если своего нет', () => {
    const stand: Stand = guide.stands[2];
    expect(standTitle(stand, 'ru', guide.languages)).toBe('奥运');
  });

  it('возвращает пустую строку для пустого стенда', () => {
    expect(standTitle(guide.stands[3], 'ru', guide.languages)).toBe('');
  });
});
