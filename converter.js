import { DEFAULTS, convert, fetchImage, cleanName } from './convert.js';

const $ = sel => document.querySelector(sel);
const drop = $('#drop');
const thumbs = $('#thumbs');
const fileInput = $('#file');
const meta = $('#meta');
const quality = $('#quality');
const qualityValue = $('#quality-value');
const qualityRow = $('#quality-row');
const ask = $('#ask');
const askNote = $('#ask-note');
const copy = $('#copy');
const go = $('#go');
const status = $('#status');
const downloads = new Map();
let items = [];
let loadRun = 0;
let busy = false;

const settings = await chrome.storage.sync.get(DEFAULTS);
($(`input[name=format][value="${settings.format}"]`) ?? $('input[name=format]')).checked = true;
quality.value = settings.quality;
ask.checked = settings.askWhere;
syncQuality();

function selectedFormat() {
  return $('input[name=format]:checked').value;
}

function syncQuality() {
  qualityRow.hidden = selectedFormat() === 'png';
  qualityValue.textContent = quality.value;
}

function syncControls() {
  const many = items.length > 1;
  go.disabled = busy || !items.length;
  go.textContent = many ? `Download all (${items.length})` : 'Download';
  copy.disabled = busy || items.length !== 1;
  ask.disabled = many;
  askNote.hidden = !many;
}

function say(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function typeLabel(mime) {
  return (mime.split('/')[1] || 'unknown').split('+')[0].toUpperCase();
}

async function readable(item) {
  const img = new Image();
  img.src = URL.createObjectURL(item.blob);
  try {
    await img.decode();
    img.alt = img.title = item.name;
    return { ...item, img };
  } catch {
    URL.revokeObjectURL(img.src);
    return null;
  }
}

async function load(list) {
  const run = ++loadRun;
  say(list.length ? 'Loading…' : '');
  const loaded = (await Promise.all(list.map(readable))).filter(Boolean);
  if (run !== loadRun) return loaded.forEach(i => URL.revokeObjectURL(i.img.src));

  if (!loaded.length) return say(list.length ? "That doesn't look like an image this browser can read." : 'Nothing image-like there.', true);

  items.forEach(i => URL.revokeObjectURL(i.img.src));
  items = loaded;
  thumbs.replaceChildren(...items.map(i => i.img));
  drop.classList.add('has-image');
  drop.classList.toggle('multi', items.length > 1);

  const [first] = items;
  meta.textContent = items.length === 1
    ? `${first.name} · ${first.img.naturalWidth}×${first.img.naturalHeight} · ${typeLabel(first.blob.type)} · ${formatSize(first.blob.size)}`
    : `${items.length} images · ${formatSize(items.reduce((sum, i) => sum + i.blob.size, 0))}`;

  const skipped = list.length - items.length;
  say(skipped ? `Skipped ${skipped} file${skipped > 1 ? 's' : ''} this browser can't read.` : '', skipped > 0);
  syncControls();
}

async function loadUrl(url) {
  say('Fetching…');
  try {
    await load([await fetchImage(url)]);
  } catch (e) {
    say(`Couldn't fetch that URL: ${e.message}`, true);
  }
}

function loadFiles(files) {
  return load([...files].map(file => ({ blob: file, name: cleanName(file.name) })));
}

function take(data) {
  if (data.files.length) return loadFiles(data.files);
  const url = (data.getData('text/uri-list') || data.getData('text/plain'))
    .split('\n')
    .map(line => line.trim())
    .find(line => /^(https?|data):/i.test(line));
  if (url) return loadUrl(url);
  say('Nothing image-like there.', true);
}

async function save({ blob, name }, ext, saveAs) {
  const out = await convert(blob, ext, +quality.value);
  const url = URL.createObjectURL(out);
  try {
    const id = await chrome.downloads.download({ url, filename: `${name}.${ext}`, saveAs, conflictAction: 'uniquify' });
    downloads.set(id, url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return out;
}

function setBusy(value) {
  busy = value;
  syncControls();
}

document.querySelectorAll('input[name=format]').forEach(radio =>
  radio.addEventListener('change', () => {
    syncQuality();
    chrome.storage.sync.set({ format: radio.value });
  }),
);
quality.addEventListener('input', syncQuality);
quality.addEventListener('change', () => chrome.storage.sync.set({ quality: +quality.value }));
ask.addEventListener('change', () => chrome.storage.sync.set({ askWhere: ask.checked }));

drop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFiles(fileInput.files);
  fileInput.value = '';
});

addEventListener('paste', e => take(e.clipboardData));
addEventListener('dragover', e => {
  e.preventDefault();
  drop.classList.add('over');
});
addEventListener('dragleave', e => {
  if (!e.relatedTarget) drop.classList.remove('over');
});
addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('over');
  take(e.dataTransfer);
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': convert(items[0].blob, 'png') })]);
    say('Copied to clipboard as PNG.');
  } catch (e) {
    say(`Couldn't copy: ${e.message}`, true);
  }
});

go.addEventListener('click', async () => {
  const ext = selectedFormat();
  const batch = [...items];
  const single = batch.length === 1;
  const failed = [];
  let saved = 0;
  let lastSize = 0;
  setBusy(true);
  for (const [index, item] of batch.entries()) {
    say(single ? 'Converting…' : `Converting ${index + 1} of ${batch.length}…`);
    try {
      lastSize = (await save(item, ext, single && ask.checked)).size;
      saved++;
    } catch (e) {
      if (!/cancel/i.test(e.message)) failed.push(`${item.name}: ${e.message}`);
    }
  }
  setBusy(false);

  if (failed.length) say(`${saved} saved, ${failed.length} failed. ${failed.join('; ')}`, true);
  else if (!saved) say('');
  else if (single) say(`Downloading ${batch[0].name}.${ext} (${formatSize(lastSize)})`);
  else say(`Saved ${saved} images to your Downloads folder.`);
});

chrome.downloads.onChanged.addListener(({ id, state }) => {
  if (!state || state.current === 'in_progress' || !downloads.has(id)) return;
  URL.revokeObjectURL(downloads.get(id));
  downloads.delete(id);
});
