import { describe, expect, it } from 'vitest';
import { MAX_AUDIO_BYTES, validateAudio } from './media';

function fakeFile(name: string, type: string, size: number): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateAudio', () => {
  it('пропускает mp3 подходящего размера', () => {
    expect(validateAudio(fakeFile('ru.mp3', 'audio/mpeg', 1_400_000))).toBeNull();
  });

  it('узнаёт mp3 по расширению, если браузер не подставил тип', () => {
    expect(validateAudio(fakeFile('ru.MP3', '', 1000))).toBeNull();
  });

  it('отклоняет не mp3', () => {
    expect(validateAudio(fakeFile('ru.wav', 'audio/wav', 1000))).toMatch(/mp3/);
  });

  it('отклоняет файл, который не пролезет в один запрос, и объясняет как быть', () => {
    const message = validateAudio(fakeFile('ru.mp3', 'audio/mpeg', MAX_AUDIO_BYTES + 1));
    expect(message).toMatch(/64 kbps/);
  });
});
