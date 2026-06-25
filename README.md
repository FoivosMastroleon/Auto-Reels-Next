# Auto Reels Next

A Chrome extension that automatically navigates to the next Short/Reel when the current one ends — works on YouTube, Instagram, and Facebook.

## Features

- Auto-advances to the next reel when the video is about to end (0.3s before)
- Per-platform toggles: enable/disable YouTube Shorts, Instagram Reels, and Facebook Reels independently
- Playback speed control: 1×, 1.5×, 2×
- Loop detection: if a platform loops the same video, the extension skips it anyway
- Reel counter with reset button
- Voice commands (Greek & English): say "επόμενο", "σταμάτα", "ξεκίνα", "γρηγορότερα", "κανονικά"
- Works with SPA navigation on all three platforms — no page reload needed
- Persistent state across sessions via Chrome storage
- Icon turns grey when all platforms are disabled

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. The extension icon appears in the toolbar — red when active, grey when all platforms are disabled.

## Usage

Navigate to any YouTube Short, Instagram Reel, or Facebook Reel — the extension kicks in automatically. Click the toolbar icon to open the popup and configure platforms, speed, reset the counter, or enable voice commands.

### Voice Commands

Enable the microphone toggle in the popup. The first time, a banner will appear on the page — click it to grant microphone permission. Supported commands:

| Greek | English | Action |
|-------|---------|--------|
| επόμενο / επόμενη | next | Go to next reel |
| προηγούμενο / πίσω | previous / back | Go to previous reel |
| σταμάτα / παύση | stop / pause | Pause (auto-next blocked until you resume) |
| ξεκίνα / συνέχισε / παίξε | start / play | Resume current reel |
| γρηγορότερα / γρήγορα | faster | Set speed to 2× |
| κανονικά / αργά | normal / slower | Set speed to 1× |

## How It Works

A background service worker listens for SPA navigation events (`webNavigation.onHistoryStateUpdated`) on YouTube, Instagram, and Facebook. When the URL changes to a reel/shorts page, it injects the content script. The script polls every 300ms for the active video's remaining time. When less than 0.3 seconds remain, it triggers the next-video action (native navigation button on YouTube Shorts, container scroll on Instagram/Facebook). A `MutationObserver` ensures playback speed is applied to dynamically loaded videos.

## File Structure

| File | Description |
|------|-------------|
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | Auto-advance logic, speed control, loop detection, counter, voice commands |
| `background.js` | Service worker: icon drawing + SPA navigation injection |
| `popup.html` | Toolbar popup UI |
| `popup.js` | Per-platform toggles, speed buttons, counter, voice settings |

## Browser Compatibility

Chrome (Manifest V3). Edge (Chromium-based) should also work.

## License

[MIT](LICENSE)
