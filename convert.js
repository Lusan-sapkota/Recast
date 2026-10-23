export const FORMATS = {
  png: { label: 'PNG', mime: 'image/png' },
  jpg: { label: 'JPG', mime: 'image/jpeg', lossy: true, opaque: true },
  webp: { label: 'WebP', mime: 'image/webp', lossy: true },
  ico: { label: 'ICO', mime: 'image/x-icon' },
  bmp: { label: 'BMP', mime: 'image/bmp', opaque: true },
};

const ICO_SIZES = [16, 32, 48, 256];

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

async function toIco(img, width, height) {
  const pngs = await Promise.all(ICO_SIZES.map(async size => {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const scale = Math.min(size / width, size / height);
    const w = width * scale;
    const h = height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  }));

  const header = new DataView(new ArrayBuffer(6 + 16 * ICO_SIZES.length));
  header.setUint16(2, 1, true);
  header.setUint16(4, ICO_SIZES.length, true);
  let offset = header.byteLength;
  ICO_SIZES.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header.setUint8(entry, size % 256);
    header.setUint8(entry + 1, size % 256);
    header.setUint16(entry + 4, 1, true);
    header.setUint16(entry + 6, 32, true);
    header.setUint32(entry + 8, pngs[i].length, true);
    header.setUint32(entry + 12, offset, true);
    offset += pngs[i].length;
  });
  return new Blob([header, ...pngs], { type: FORMATS.ico.mime });
}

function toBmp(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const fileSize = 54 + rowSize * height;
  const bytes = new Uint8Array(fileSize);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, rowSize * height, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  for (let y = 0; y < height; y++) {
    let dst = 54 + (height - 1 - y) * rowSize;
    for (let src = y * width * 4, end = src + width * 4; src < end; src += 4) {
      bytes[dst++] = data[src + 2];
      bytes[dst++] = data[src + 1];
      bytes[dst++] = data[src];
    }
  }
  return new Blob([bytes], { type: FORMATS.bmp.mime });
}

export async function convert(blob, ext, quality = DEFAULTS.quality) {
  const { label, mime, opaque } = FORMATS[ext];
  const img = await decode(blob);
  const width = img.naturalWidth ?? img.width;
  const height = img.naturalHeight ?? img.height;
  if (!width || !height) throw new Error('Image has no size');

  if (ext === 'ico') {
    const out = await toIco(img, width, height);
    img.close?.();
    return out;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (opaque) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();

  if (ext === 'bmp') return toBmp(ctx, width, height);
  const out = await canvas.convertToBlob({ type: mime, quality: quality / 100 });
  if (out.type !== mime) throw new Error(`This browser can't encode ${label}`);
  return out;
}
