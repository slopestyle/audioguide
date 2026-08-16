import { signal } from '@preact/signals';

/** Единственный на всё приложение <audio>: экраны его не пересоздают,
 *  иначе звук обрывается при переходе между стендами. */
const audio = new Audio();
audio.preload = 'metadata';

export const position = signal(0);
export const duration = signal(0);
export const playing = signal(false);
export const failed = signal(false);

let currentSrc: string | null = null;
let pendingSeek: number | null = null;

audio.addEventListener('timeupdate', () => {
  position.value = audio.currentTime;
});
audio.addEventListener('durationchange', () => {
  duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;
});
audio.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== null) {
    audio.currentTime = Math.min(pendingSeek, audio.duration || pendingSeek);
    pendingSeek = null;
  }
});
audio.addEventListener('play', () => {
  playing.value = true;
  failed.value = false;
});
audio.addEventListener('pause', () => {
  playing.value = false;
});
audio.addEventListener('ended', () => {
  playing.value = false;
  position.value = 0;
});
audio.addEventListener('error', () => {
  failed.value = true;
  playing.value = false;
});

export interface TrackMeta {
  number: number;
  title: string;
  artwork?: string;
}

export interface OpenOptions {
  /** Позиция в секундах: при смене языка гость продолжает с того же места. */
  at?: number;
  autoplay?: boolean;
}

export function open(src: string, meta: TrackMeta, options: OpenOptions = {}): void {
  const at = options.at ?? 0;

  if (src !== currentSrc) {
    currentSrc = src;
    failed.value = false;
    duration.value = 0;
    position.value = at;
    pendingSeek = at > 0 ? at : null;
    audio.src = src;
    audio.load();
  } else if (options.at !== undefined) {
    seek(at);
  }

  setMediaMetadata(meta);
  if (options.autoplay !== false) void play();
}

export async function play(): Promise<void> {
  try {
    await audio.play();
  } catch {
    // Браузер заблокировал автозапуск — это не ошибка загрузки:
    // гость просто увидит крупную кнопку «Слушать».
    playing.value = false;
  }
}

export function pause(): void {
  audio.pause();
}

export function toggle(): void {
  if (audio.paused) void play();
  else pause();
}

export function seek(seconds: number): void {
  const target = Math.max(0, seconds);
  if (audio.readyState === 0) {
    pendingSeek = target;
    position.value = target;
    return;
  }
  audio.currentTime = audio.duration ? Math.min(target, audio.duration) : target;
  position.value = audio.currentTime;
}

export function skip(delta: number): void {
  seek(audio.currentTime + delta);
}

export function retry(): void {
  if (!currentSrc) return;
  failed.value = false;
  pendingSeek = position.value > 0 ? position.value : null;
  audio.load();
  void play();
}

export function release(): void {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  currentSrc = null;
  position.value = 0;
  duration.value = 0;
  failed.value = false;
}

/** Управление с экрана блокировки: телефон в кармане, звук в наушниках. */
function setMediaMetadata(meta: TrackMeta): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${meta.number}. ${meta.title}`,
    artist: 'Музей друзей',
    artwork: meta.artwork ? [{ src: meta.artwork, sizes: '512x512' }] : [],
  });
}

export function setTrackNavigation(prev: (() => void) | null, next: (() => void) | null): void {
  if (!('mediaSession' in navigator)) return;
  safeHandler('previoustrack', prev);
  safeHandler('nexttrack', next);
}

function safeHandler(action: MediaSessionAction, handler: (() => void) | null): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Действие не поддерживается этим браузером — не повод падать.
  }
}

if ('mediaSession' in navigator) {
  safeHandler('play', () => void play());
  safeHandler('pause', pause);
  safeHandler('seekbackward', () => skip(-15));
  safeHandler('seekforward', () => skip(15));
}
