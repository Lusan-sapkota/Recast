export const FORMATS = {
  png: { label: 'PNG', mime: 'image/png' },
  jpg: { label: 'JPG', mime: 'image/jpeg' },
  webp: { label: 'WebP', mime: 'image/webp' },
};

export const DEFAULTS = { format: 'png', askWhere: true, quality: 92 };

export function cleanName(name) {
  return name
    .replace(/\.[^.]*$/, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120) || 'image';
}

export function nameFromUrl(url) {
  try {
    const { protocol, pathname } = new URL(url);
    return /^https?:$/.test(protocol) ? cleanName(decodeURIComponent(pathname.split('/').pop())) : 'image';
  } catch {
    return 'image';
  }
}

export async function fetchImage(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { blob: await res.blob(), name: nameFromUrl(url) };
}

async function decode(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error("Couldn't read this image");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function convert(blob, ext, quality = DEFAULTS.quality) {
  const { label, mime } = FORMATS[ext];
  const img = await decode(blob);
  const width = img.naturalWidth ?? img.width;
  const height = img.naturalHeight ?? img.height;
  if (!width || !height) throw new Error('Image has no size');

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (ext === 'jpg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();

  const out = await canvas.convertToBlob({ type: mime, quality: quality / 100 });
  if (out.type !== mime) throw new Error(`This browser can't encode ${label}`);
  return out;
}
