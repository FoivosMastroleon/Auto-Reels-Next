# Auto YouTube Shorts Next

A Chrome extension that automatically navigates to the next YouTube Short when the current one ends.

## Features

- Auto-advances to the next Short when the video is about to end (0.3s before)
- Toggle on/off from the Chrome toolbar with a click
- Works with YouTube's SPA navigation — no page reload needed
- Persistent state across sessions via Chrome storage

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. The extension icon appears in the toolbar — red when active, grey when disabled.

## Usage

Navigate to any [YouTube Short](https://www.youtube.com/shorts) — the extension kicks in automatically. Click the toolbar icon to toggle it on or off at any time.

## How It Works

A background service worker listens for YouTube SPA navigation events (`webNavigation.onHistoryStateUpdated`). Each time the URL changes to a Shorts page, it injects the content script which polls every 300ms for the video's remaining time. When less than 0.3 seconds remain, it scrolls the Shorts container to the next video.

## File Structure

| File | Description |
|------|-------------|
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | Auto-advance logic injected into Shorts pages |
| `background.js` | Service worker: icon drawing + SPA navigation injection |
| `popup.html` | Toolbar popup UI |
| `popup.js` | Toggle on/off logic |

## Browser Compatibility

Chrome (Manifest V3). Edge (Chromium-based) should also work.

## License

[MIT](LICENSE)
