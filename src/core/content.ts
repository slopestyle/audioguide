import { isLangCode } from './lang';
import type { Guide, LangCode, Stand, StandContent } from './types';

/** Файл не похож на гид — единственная ошибка, из-за которой мы сдаёмся. */
export class GuideFormatError extends Error {}

/** Путь к файлу в public/ с учётом подпути GitHub Pages. */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

export async function loadGuide(abort?: AbortSignal): Promise<Guide> {
  const res = await fetch(asset('content.json'), { signal: abort });
  if (!res.ok) throw new Error(`content.json: HTTP ${res.status}`);
  return parseGuide(await res.json());
}

/** Один битый стенд не должен уносить весь гид: такие записи пропускаем,
 *  остальная экспозиция продолжает работать. */
export function parseGuide(raw: unknown): Guide {
  if (typeof raw !== 'object' || raw === null) {
    throw new GuideFormatError('content.json: ожидался объект');
  }
  const src = raw as Record<string, unknown>;
  if (!Array.isArray(src.stands)) {
    throw new GuideFormatError('content.json: нет списка stands');
  }

  const languages = Array.isArray(src.languages) ? src.languages.filter(isLangCode) : [];

  const stands: Stand[] = [];
  for (const item of src.stands) {
    const stand = parseStand(item);
    if (stand) stands.push(stand);
  }
  stands.sort((a, b) => a.number - b.number);

  return {
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : '',
    languages: languages.length > 0 ? languages : ['ru'],
    stands,
  };
}

function parseStand(raw: unknown): Stand | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.number !== 'number' || !Number.isInteger(src.number) || src.number < 0) {
    return null;
  }

  const content: Stand['content'] = {};
  if (typeof src.content === 'object' && src.content !== null) {
    for (const [code, value] of Object.entries(src.content)) {
      if (!isLangCode(code)) continue;
      const parsed = parseContent(value);
      if (parsed) content[code] = parsed;
    }
  }

  return {
    number: src.number,
    photo: typeof src.photo === 'string' ? src.photo : undefined,
    content,
  };
}

function parseContent(raw: unknown): StandContent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.title !== 'string' || src.title.trim() === '') return null;
  return {
    title: src.title,
    text: typeof src.text === 'string' && src.text.trim() !== '' ? src.text : undefined,
    audio: typeof src.audio === 'string' && src.audio.trim() !== '' ? src.audio : undefined,
    duration: typeof src.duration === 'number' && src.duration > 0 ? src.duration : undefined,
  };
}

export function findStand(guide: Guide, number: number): Stand | undefined {
  return guide.stands.find((s) => s.number === number);
}

export function neighbours(guide: Guide, number: number): { prev?: number; next?: number } {
  const index = guide.stands.findIndex((s) => s.number === number);
  if (index < 0) return {};
  return {
    prev: guide.stands[index - 1]?.number,
    next: guide.stands[index + 1]?.number,
  };
}

export interface StandView {
  /** Контент на выбранном языке — может существовать без аудио. */
  requested?: StandContent;
  /** Язык звучащей дорожки: выбранный или запасной. */
  audioLang?: LangCode;
  audio?: StandContent;
  /** Языки, на которых озвучка есть, — для кнопок переключения. */
  audioLangs: LangCode[];
}

/** Пропуск языка — штатное состояние, а не ошибка: музей открывается
 *  с русским и английским, остальные доезжают позже. */
export function viewStand(stand: Stand, preferred: LangCode, available: LangCode[]): StandView {
  const requested = stand.content[preferred];
  const audioLangs = fallbackOrder(preferred, available).filter(
    (code) => stand.content[code]?.audio,
  );
  const audioLang = requested?.audio ? preferred : audioLangs[0];

  return {
    requested,
    audioLang,
    audio: audioLang ? stand.content[audioLang] : undefined,
    audioLangs,
  };
}

/** Выбранный язык, затем русский и английский как самые вероятные понятные,
 *  затем всё остальное. */
export function fallbackOrder(preferred: LangCode, available: LangCode[]): LangCode[] {
  const order: LangCode[] = [preferred, 'ru', 'en'];
  for (const code of available) {
    if (!order.includes(code)) order.push(code);
  }
  return order.filter((code) => code === preferred || available.includes(code));
}

/** Заголовок для списка стендов: на выбранном языке, иначе на любом доступном. */
export function standTitle(stand: Stand, preferred: LangCode, available: LangCode[]): string {
  for (const code of fallbackOrder(preferred, available)) {
    const title = stand.content[code]?.title;
    if (title) return title;
  }
  return '';
}

/** Есть ли стенд с более длинным номером, начинающимся на набранные цифры.
 *  Если нет — можно открывать сразу, не заставляя жать «Слушать». */
export function hasLongerNumber(guide: Guide, typed: string): boolean {
  return guide.stands.some((s) => {
    const value = String(s.number);
    return value.length > typed.length && value.startsWith(typed);
  });
}
