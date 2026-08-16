/** Предел одного запроса к функции — 3.5 МБ, base64 раздувает файл в 1.33 раза.
 *  2.5 МБ при 64 kbps моно — примерно 5 минут звука. */
export const MAX_AUDIO_BYTES = 2.5 * 1024 * 1024;
const PHOTO_MAX_SIDE = 1600;

export function validateAudio(file: File): string | null {
  const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
  if (!isMp3) return 'Нужен файл mp3';
  if (file.size > MAX_AUDIO_BYTES) {
    return `Файл ${megabytes(file.size)} МБ — слишком большой. Предел ${megabytes(MAX_AUDIO_BYTES)} МБ: пересохраните в 64 kbps моно`;
  }
  return null;
}

export function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Сотрудник не должен думать про размеры фотографий, а гость — ждать
 *  загрузки восьмимегабайтного снимка с телефона. */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не поддерживает обработку изображений');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('Не удалось сжать изображение');
  return blob;
}

/** Длительность нужна, чтобы плеер показывал время до загрузки метаданных. */
export function readDuration(file: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const finish = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.addEventListener('loadedmetadata', () =>
      finish(Number.isFinite(probe.duration) ? Math.round(probe.duration) : undefined),
    );
    probe.addEventListener('error', () => finish(undefined));
    probe.src = url;
  });
}
