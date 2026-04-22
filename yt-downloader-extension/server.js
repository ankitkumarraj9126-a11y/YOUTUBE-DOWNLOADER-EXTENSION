#!/usr/bin/env node
/**
 * YT Downloader — Local Backend Server
 * 
 * Runs on http://localhost:9000
 * Wraps yt-dlp to handle download requests from the Chrome extension.
 * 
 * Requirements:
 *   - Node.js 16+
 *   - yt-dlp installed and in PATH (https://github.com/yt-dlp/yt-dlp)
 *   - ffmpeg installed (for audio conversion and merging)
 * 
 * Start: node server.js
 */

const http = require('http');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 9000;
const DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'YTDownloader');
const BIN_DIR = path.join(__dirname, 'bin');

// Ensure directories exist
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

// Help locate binaries in local bin folder
function getToolPath(cmd) {
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const localPath = path.join(BIN_DIR, cmd + ext);
  
  if (fs.existsSync(localPath)) return localPath;
  return cmd; // Fallback to system PATH
}

// Check for required CLI tools
async function checkDependencies() {
  const check = (cmd) => new Promise(resolve => {
    const proc = spawn(cmd, ['--version']);
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 2000);

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
  });

  return {
    ytdlp: await check(getToolPath('yt-dlp')),
    ffmpeg: await check(getToolPath('ffmpeg'))
  };
}


// In-memory job tracker
const jobs = {};

// ── CORS helper ──
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
}

function sendJSON(res, status, data) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Build yt-dlp args ──
function buildArgs(url, type, quality) {
  const args = ['--newline', '--progress', '-o', path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s')];

  if (type === 'audio') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', quality === '320' ? '0' : quality === '256' ? '5' : '9');
  } else {
    // Map quality to yt-dlp format string
    const heightMap = { '2160': 2160, '1440': 1440, '1080': 1080, '720': 720, '480': 480, '360': 360 };
    const h = heightMap[quality] || 1080;
    args.push('-f', `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`, '--merge-output-format', 'mp4');
  }

  args.push(url);
  return args;
}

// ── Parse yt-dlp progress line ──
function parseProgress(line) {
  // Example: [download]  45.2% of  123.45MiB at  2.34MiB/s ETA 00:30
  const match = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\w+\/s)?/);
  if (match) {
    return {
      percent: Math.round(parseFloat(match[1])),
      speed: match[2] || ''
    };
  }
  return null;
}

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`[Server] ${req.method} ${url.pathname}`);

  // /download — start a download job
  if (url.pathname === '/download') {
    const handleDownloadRequest = (ytUrl, type, quality) => {
      if (!ytUrl || (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be'))) {
        return sendJSON(res, 400, { error: 'Invalid YouTube URL' });
      }

      const jobId = randomUUID();
      jobs[jobId] = { status: 'running', percent: 0, speed: '', error: null };

      const args = buildArgs(ytUrl, type, quality);
      console.log(`[Job ${jobId}] Starting: yt-dlp ${args.join(' ')}`);

      const proc = spawn(getToolPath('yt-dlp'), args);

      proc.on('error', (err) => {
        jobs[jobId].status = 'error';
        jobs[jobId].error = `Failed to start yt-dlp: ${err.message}`;
        console.error(`[Job ${jobId}] spawn error:`, err);
      });

      proc.stdout.on('data', data => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const progress = parseProgress(line);
          if (progress) {
            jobs[jobId].percent = progress.percent;
            jobs[jobId].speed = progress.speed;
          }
        }
      });

      proc.stderr.on('data', data => {
        console.error(`[Job ${jobId}] stderr:`, data.toString());
      });

      proc.on('close', code => {
        if (jobs[jobId].status === 'error') return;
        if (code === 0) {
          jobs[jobId].status = 'done';
          jobs[jobId].percent = 100;
          console.log(`[Job ${jobId}] Completed.`);
        } else {
          jobs[jobId].status = 'error';
          jobs[jobId].error = `yt-dlp exited with code ${code}`;
          console.error(`[Job ${jobId}] Failed with code ${code}`);
        }
      });

      sendJSON(res, 200, { jobId });
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const { url: ytUrl, type, quality } = JSON.parse(body);
          handleDownloadRequest(ytUrl, type, quality);
        } catch (e) {
          sendJSON(res, 400, { error: 'Bad request: ' + e.message });
        }
      });
    } else if (req.method === 'GET') {
      const ytUrl = url.searchParams.get('url');
      const type = url.searchParams.get('type');
      const quality = url.searchParams.get('quality');
      handleDownloadRequest(ytUrl, type, quality);
    }
    return;
  }

  // GET /progress/:jobId — check job progress
  const progressMatch = url.pathname.match(/^\/progress\/([a-f0-9-]+)$/i);
  if (req.method === 'GET' && progressMatch) {
    const jobId = progressMatch[1];
    const job = jobs[jobId];
    if (!job) {
      return sendJSON(res, 404, { error: 'Job not found' });
    }
    return sendJSON(res, 200, job);
  }

  // GET /health — health check with dependency diagnostic
  if (req.method === 'GET' && url.pathname === '/health') {
    checkDependencies().then(deps => {
      sendJSON(res, 200, { 
        status: 'ok', 
        dependencies: deps
      });
    });
    return;
  }

  // POST /setup — automatic dependency installer
  if (req.method === 'POST' && url.pathname === '/setup') {
    const https = require('https');
    
    const download = (url, dest) => new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, res => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', err => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    const runSetup = async () => {
      try {
        console.log('[Setup] Starting auto-installation...');
        const isWin = os.platform() === 'win32';
        if (!isWin) throw new Error('Auto-setup only supported on Windows for now.');

        const ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
        const ytdlpDest = path.join(BIN_DIR, 'yt-dlp.exe');
        
        await download(ytdlpUrl, ytdlpDest);
        console.log('[Setup] yt-dlp downloaded.');

        sendJSON(res, 200, { success: true, message: 'Setup complete! Please restart server for full effect.' });
      } catch (e) {
        console.error('[Setup] Error:', e);
        sendJSON(res, 500, { error: e.message });
      }
    };

    runSetup();
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('--------------------------------------------------');
  console.log(`🚀 YT Downloader Server [ENGINEER MODE]`);
  console.log(`✅ Listening on: All Interfaces (Dual-Stack)`);
  console.log(`💡 Access via: http://127.0.0.1:${PORT}, http://[::1]:${PORT}, or http://localhost:${PORT}`);
  console.log(`📁 Target Dir: ${DOWNLOAD_DIR}`);
  console.log('--------------------------------------------------\n');
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => process.exit(0));
});
