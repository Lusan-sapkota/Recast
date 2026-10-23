<p align="center">
  <img src="icons/logo.svg" alt="Recast logo" width="112">
</p>

<h1 align="center">Recast</h1>

<p align="center">Save any image as PNG, JPG or WebP. Right from the page, entirely in your browser.</p>

<p align="center">
  <a href="https://github.com/Lusan-sapkota/Recast/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Lusan-sapkota/Recast?color=606c38&label=release"></a>
  <a href="manifest.json"><img alt="Manifest version" src="https://img.shields.io/github/manifest-json/v/Lusan-sapkota/Recast?color=bc6c25&label=manifest"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-dda15e?logo=googlechrome&logoColor=white">
  <a href="https://github.com/Lusan-sapkota/Recast/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Lusan-sapkota/Recast/total?color=283618"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/Lusan-sapkota/Recast?color=606c38"></a>
</p>

---

Sites often send WebP or AVIF even when the link says `.png`, so "Save image as" hands you a format you didn't want. Recast converts it before saving.

## Features

- **Right-click any image** → *Save image as type* → PNG, JPG or WebP
- **Converter window** (toolbar icon or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>): drop, browse or paste (<kbd>Ctrl</kbd>+<kbd>V</kbd>) an image or image URL
- **Batch:** convert several images in one go
- **Copy as PNG** to the clipboard
- Real save dialog, original filename kept, `.jpg` never `.jfif`
- Transparent areas turn white in JPG instead of black
- SVG input supported, quality slider for JPG and WebP

## Privacy

Everything runs locally. No analytics, no remote code, no content scripts. Permissions: `contextMenus`, `downloads`, `offscreen`, `storage`, plus host access so it can fetch the image you right-clicked.

## Install

1. Download `recast-v*.zip` from the [latest release](https://github.com/Lusan-sapkota/Recast/releases/latest) and unzip it into a folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick that folder.

Works in Chrome, Brave, Edge and other Chromium browsers (version 116+).

## Limits

- Hotlink-protected and `blob:` images can't be fetched; the toolbar icon shows a red `!` with the reason.
- Animated images save as their first frame. Metadata (EXIF) is not kept.
- AVIF and GIF output are not possible: browsers can't encode them.

## License

[MIT](LICENSE)
