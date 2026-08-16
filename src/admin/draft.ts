import { signal } from '@preact/signals';
import { parseGuide } from '../core/content';
import { read, write } from '../core/storage';
import type { Guide, LangCode, Stand, StandContent } from '../core/types';

const DRAFT_KEY = 'mf.admin.draft';

export interface PendingFile {
  base64: string;
  size: number;
  name: string;
}

export const draft = signal<Guide | null>(null);
export const baseSha = signal<string | null>(null);
/** Путь в репозитории → файл. Только в памяти: аудио в base64 не влезает
 *  в localStorage, а тихо потерянная правка хуже честного предупреждения. */
export const pending = signal<Record<string, PendingFile>>({});

export const audioPath = (number: number, lang: LangCode) => `media/${number}/${lang}.mp3`;
export const photoPath = (number: number) => `media/${number}/photo.webp`;
export const repoPath = (asset: string) => `public/${asset}`;

export function startEditing(remote: Guide): void {
  draft.value = restoreSaved() ?? remote;
}

export function hasSavedDraft(): boolean {
  return restoreSaved() !== null;
}

export function discardDraft(remote: Guide): void {
  draft.value = remote;
  pending.value = {};
  write(DRAFT_KEY, '');
}

function restoreSaved(): Guide | null {
  const raw = read(DRAFT_KEY);
  if (!raw) return null;
  try {
    return parseGuide(JSON.parse(raw));
  } catch {
    return null;
  }
}

function commitDraft(next: Guide): void {
  next.stands.sort((a, b) => a.number - b.number);
  draft.value = next;
  write(DRAFT_KEY, JSON.stringify(next));
}

function edit(number: number, change: (stand: Stand) => Stand): void {
  const current = draft.value;
  if (!current) return;
  commitDraft({
    ...current,
    stands: current.stands.map((stand) => (stand.number === number ? change(stand) : stand)),
  });
}

function editContent(
  number: number,
  lang: LangCode,
  change: (content: StandContent) => StandContent | undefined,
): void {
  edit(number, (stand) => {
    const updated = change(stand.content[lang] ?? { title: '' });
    const content = { ...stand.content };
    if (updated) content[lang] = updated;
    else delete content[lang];
    return { ...stand, content };
  });
}

export function addStand(number: number): boolean {
  const current = draft.value;
  if (!current || current.stands.some((stand) => stand.number === number)) return false;
  commitDraft({ ...current, stands: [...current.stands, { number, content: {} }] });
  return true;
}

export function removeStand(number: number): void {
  const current = draft.value;
  if (!current) return;
  commitDraft({ ...current, stands: current.stands.filter((stand) => stand.number !== number) });
}

export function setTitle(number: number, lang: LangCode, title: string): void {
  editContent(number, lang, (content) => ({ ...content, title }));
}

export function setText(number: number, lang: LangCode, text: string): void {
  editContent(number, lang, (content) => ({ ...content, text: text || undefined }));
}

export function attachAudio(
  number: number,
  lang: LangCode,
  file: PendingFile,
  duration?: number,
): void {
  const asset = audioPath(number, lang);
  pending.value = { ...pending.value, [repoPath(asset)]: file };
  editContent(number, lang, (content) => ({ ...content, audio: asset, duration }));
}

/** Файл остаётся в репозитории, но на него больше никто не ссылается:
 *  удалять его отдельно незачем, места он занимает мегабайты. */
export function detachAudio(number: number, lang: LangCode): void {
  const asset = audioPath(number, lang);
  const rest = { ...pending.value };
  delete rest[repoPath(asset)];
  pending.value = rest;
  editContent(number, lang, (content) => ({ ...content, audio: undefined, duration: undefined }));
}

export function attachPhoto(number: number, file: PendingFile): void {
  const asset = photoPath(number);
  pending.value = { ...pending.value, [repoPath(asset)]: file };
  edit(number, (stand) => ({ ...stand, photo: asset }));
}

export function removeContent(number: number, lang: LangCode): void {
  detachAudio(number, lang);
  editContent(number, lang, () => undefined);
}

export type Readiness = 'empty' | 'text' | 'ready';

export function readiness(stand: Stand, lang: LangCode): Readiness {
  const content = stand.content[lang];
  if (!content?.title) return 'empty';
  return content.audio ? 'ready' : 'text';
}

export function serialise(guide: Guide): string {
  return JSON.stringify(
    { ...guide, updatedAt: new Date().toISOString(), stands: guide.stands },
    null,
    2,
  );
}

export function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
