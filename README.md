# GitHub Stars Manager

[Chinese (简体中文)](README.zh-CN.md)

## Overview
GitHub Stars Manager is a browser extension that enhances GitHub starred repositories with groups, tags, notes, and Gist-based sync across devices.

## Key Features
- Sidebar drawer: group tree, starred list, search/filter/sort, sync and settings
- Page enhancements: inline edit on Stars list and repository pages
- Sync: manual/auto sync, conflict prompts, version selection
- i18n: auto language selection based on system locale

## Install (Dev)
1. Install dependencies: `npm install`
2. Build extension:
   - Chrome/Edge: `npm run build`
   - Firefox (MV3): `npm run build:firefox`
3. Open the browser extensions page and enable Developer mode
4. Click "Load unpacked" and select output directory:
   - Chrome/Edge: `.output/chrome-mv3`
   - Firefox: `.output/firefox-mv3`
5. Open a GitHub Stars list page or any repository page

## Usage
1. Fill in PAT and Gist info on the settings page
2. Click "Test Token" to verify permissions
3. Click "Sync" or enable auto sync

Follow the in-app setup steps if you need guidance for PAT and Gist.

## Package & Release
- Update version: `wxt.config.ts` and `package.json`
- Build zip:

```bash
npm run zip
npm run zip:firefox
```

Build verification:

```bash
npm run verify:build
```

`extension/` is kept as a legacy source snapshot during migration for rollback and comparison.

## Star History
![Star History](https://api.star-history.com/svg?repos=banshanshenlou/github-starts&type=Date)

## Sponsor
If you find this project useful, feel free to support it.

| Alipay | WeChat Pay |
| --- | --- |
| ![Alipay QR](docs/alipay.jpg) | ![WeChat Pay QR](docs/wepay.png) |

## License
See `LICENSE`.
