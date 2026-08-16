export type LangCode = 'ru' | 'en' | 'zh' | 'ar';

/** Контент одного стенда на одном языке. Аудио и текст независимы:
 *  бывает текст без озвучки (перевод готов, запись — нет) и наоборот. */
export interface StandContent {
  title: string;
  text?: string;
  audio?: string;
  /** Длительность в секундах — чтобы показать время до загрузки метаданных. */
  duration?: number;
}

export interface Stand {
  number: number;
  photo?: string;
  content: Partial<Record<LangCode, StandContent>>;
}

export interface Guide {
  updatedAt: string;
  languages: LangCode[];
  stands: Stand[];
}
