import { FORMATS, DEFAULTS } from './convert.js';

const CONVERTER = 'converter.html';
const OFFSCREEN = 'offscreen.html';
const TITLE = chrome.runtime.getManifest().action.default_title;
let creating = null;
let converting = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'root', title: 'Save image as type', contexts: ['image'] });
    for (const [ext, { label }] of Object.entries(FORMATS))
      chrome.contextMenus.create({ id: ext, parentId: 'root', title: label, contexts: ['image'] });
  });
});

chrome.action.onClicked.addListener(async tab => {
  const [open] = await chrome.runtime.getContexts({
    contextTypes: ['TAB'],
    documentUrls: [chrome.runtime.getURL(CONVERTER)],
  });
  if (open) return chrome.windows.update(open.windowId, { focused: true });
  const width = 460;
  const height = 640;
  const parent = await chrome.windows.get(tab.windowId).catch(() => null);
  const position = Number.isFinite(parent?.left) && Number.isFinite(parent?.width)
    ? {
        left: Math.round(parent.left + (parent.width - width) / 2),
        top: Math.round(parent.top + Math.max(0, (parent.height - height) / 2)),
      }
    : {};
  chrome.windows.create({ url: CONVERTER, type: 'popup', width, height, ...position });
});

chrome.contextMenus.onClicked.addListener(async ({ menuItemId: ext, srcUrl }, tab) => {
  converting++;
  try {
    const { askWhere, quality } = await chrome.storage.sync.get(DEFAULTS);
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', srcUrl, ext, quality });
    if (!res?.url) throw new Error(res?.error ?? 'Converter did not respond');
    await chrome.downloads.download({ url: res.url, filename: res.filename, saveAs: askWhere, conflictAction: 'uniquify' });
  } catch (e) {
    if (!/cancel/i.test(e.message)) flagError(tab?.id, e);
  }
  converting--;
  closeIfIdle();
});

chrome.downloads.onChanged.addListener(({ state }) => {
  if (state && state.current !== 'in_progress') closeIfIdle();
});

async function hasOffscreen() {
  return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  creating ??= chrome.offscreen
    .createDocument({ url: OFFSCREEN, reasons: ['BLOBS'], justification: 'Convert images and hold the result until it is downloaded' })
    .finally(() => (creating = null));
  await creating;
}

async function closeIfIdle() {
  if (converting) return;
  const active = await chrome.downloads.search({ state: 'in_progress' });
  if (active.some(d => d.byExtensionId === chrome.runtime.id)) return;
  if (await hasOffscreen()) chrome.offscreen.closeDocument().catch(() => {});
}

function flagError(tabId, e) {
  chrome.action.setBadgeBackgroundColor({ color: '#dc2626', tabId });
  chrome.action.setBadgeText({ text: '!', tabId });
  chrome.action.setTitle({ title: `Couldn't save image: ${e.message}`, tabId });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', tabId });
    chrome.action.setTitle({ title: TITLE, tabId });
  }, 6000);
}
