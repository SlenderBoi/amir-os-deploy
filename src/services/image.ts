/** Downscales an uploaded image to a small JPEG data URL so posters stay light in IndexedDB and in backups (~20–40 KB). */
export async function fileToPoster(file: File, maxWidth = 360): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('فقط فایل تصویر قابل قبول است.');
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم تصویر بیشتر از ۱۵ مگابایت است.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('پردازش تصویر در این مرورگر ممکن نیست.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}
