import { fetchImage, convert } from './convert.js';

chrome.runtime.onMessage.addListener(({ target, srcUrl, ext, quality }, _, reply) => {
  if (target !== 'offscreen') return;
  fetchImage(srcUrl)
    .then(async ({ blob, name }) => {
      const out = await convert(blob, ext, quality);
      reply({ url: URL.createObjectURL(out), filename: `${name}.${ext}` });
    })
    .catch(e => reply({ error: e.message }));
  return true;
});
