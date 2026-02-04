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
1. Open the browser extensions page and enable Developer mode
2. Click "Load unpacked" and select `extension/`
3. Open a GitHub Stars list page or any repository page

## Usage
1. Fill in PAT and Gist info on the settings page
2. Click "Test Token" to verify permissions
3. Click "Sync" or enable auto sync

Follow the in-app setup steps if you need guidance for PAT and Gist.

## Package & Release
- Update version: `extension/manifest.json`
- Build zip (PowerShell):

```powershell
Compress-Archive -Path extension\* -DestinationPath dist\github-stars-manager-v0.1.0.zip -Force
```

## Star History
```
https://api.star-history.com/svg?repos=banshanshenlou/github-starts&type=Date
```

## License
See `LICENSE`.
