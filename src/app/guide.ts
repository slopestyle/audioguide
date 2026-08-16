import { signal } from '@preact/signals';
import { loadGuide } from '../core/content';
import type { Guide } from '../core/types';

export const guide = signal<Guide | null>(null);
export const guideFailed = signal(false);

export async function fetchGuide(): Promise<void> {
  guideFailed.value = false;
  try {
    guide.value = await loadGuide();
  } catch (error) {
    guideFailed.value = true;
    console.error('Не удалось загрузить content.json', error);
  }
}
