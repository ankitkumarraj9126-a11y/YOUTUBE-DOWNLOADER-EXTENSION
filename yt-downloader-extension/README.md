# YT Downloader — Chrome Extension

A clean, dark-themed Chrome extension to download YouTube videos and audio using **yt-dlp** running locally on your machine.

---

## Project Structure

```
yt-downloader-extension/
├── manifest.json       # Chrome extension manifest (MV3)
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic
├── background.js       # Service worker
├── content.js          # YouTube page content script
├── server.js           # Local Node.js backend (wraps yt-dlp)
├── icons/              # Extension icons (you need to add these)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## How It Works

```
Chrome Extension (popup.js)
        │
        │  HTTP POST /download
        ▼
Local Server (server.js @ localhost:9000)
        │
        │  spawns process
        ▼
    yt-dlp (CLI tool)
        │
        │  saves file
        ▼
~/Downloads/YTDownloader/
```

The extension itself cannot download YouTube videos directly — YouTube's streams are protected. Instead, the popup sends a request to a small Node.js server running on your machine, which runs `yt-dlp` to do the actual downloading.

---

## Prerequisites

### 1. Install yt-dlp

**macOS (Homebrew):**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows:**
Download `yt-dlp.exe` from https://github.com/yt-dlp/yt-dlp/releases and add it to your PATH.

### 2. Install ffmpeg (required for audio extraction and video merging)

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

### 3. Install Node.js

Download from https://nodejs.org (v16 or newer).

---

## Setup

### Step 1 — Add extension icons

Create or place PNG icons in the `icons/` folder:
- `icon16.png` (16×16)
- `icon32.png` (32×32)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

You can use any red play-button style icon, or generate one at https://favicon.io.

### Step 2 — Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `yt-downloader-extension/` folder
5. The extension icon will appear in your toolbar

### Step 3 — Start the local server

In a terminal, from this project folder:

```bash
node server.js
```

You should see:
```
✅ YT Downloader server running at http://localhost:9000
📁 Downloads saved to: ~/Downloads/YTDownloader
```

Keep this terminal running while using the extension.

---

## Usage

1. Go to any YouTube video (e.g. `https://www.youtube.com/watch?v=...`)
2. Click the **YTdown** extension icon in your toolbar
3. The video title and thumbnail will appear
4. Choose **Video** or **Audio** format
5. Select your preferred quality
6. Click **Download**
7. Find your file in `~/Downloads/YTDownloader/`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Local server not found" | Make sure `node server.js` is running in a terminal |
| yt-dlp not found | Ensure yt-dlp is installed and in your system PATH |
| No audio in video | Install ffmpeg — required for merging audio+video streams |
| Video not detected | Make sure you're on a `youtube.com/watch?v=...` URL |
| Extension not loading | Check Chrome console at `chrome://extensions` for errors |

---

## Legal Note

This tool is for **personal use only**. Downloading YouTube content may violate YouTube's Terms of Service. Only download content you have rights to, or that is in the public domain. Respect copyright.

---

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JS (no framework)
- Node.js HTTP server
- yt-dlp (the actual downloader)
- ffmpeg (audio/video processing)
