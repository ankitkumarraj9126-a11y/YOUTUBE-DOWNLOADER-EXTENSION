// ── State ──
let currentVideo = null;
let selectedType = 'video';
let selectedQuality = '1080';
let isDownloading = false;
let SERVER_URL = 'http://localhost:9000'; // Default, will fallback to 127.0.0.1 if needed


// ── DOM refs ──
const statusDot     = document.getElementById('statusDot');
const noVideo       = document.getElementById('noVideo');
const videoInfo     = document.getElementById('videoInfo');
const videoThumb    = document.getElementById('videoThumb');
const videoDuration = document.getElementById('videoDuration');
const videoTitle    = document.getElementById('videoTitle');
const videoChannel  = document.getElementById('videoChannel');
const formatSection = document.getElementById('formatSection');
const videoQualities = document.getElementById('videoQualities');
const audioQualities = document.getElementById('audioQualities');
const downloadBtn   = document.getElementById('downloadBtn');
const btnLabel      = document.getElementById('btnLabel');
const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const historyList   = document.getElementById('historyList');
const clearHistory  = document.getElementById('clearHistory');

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await detectVideo();
  await renderHistory();
  bindEvents();
  
  // Engineer's Connectivity Check: Test localhost first, then 127.0.0.1
  await bootstrapConnection();
  
  // Start server heartbeat
  setInterval(checkServerHealth, 5000);
});

async function bootstrapConnection() {
  const targets = ['http://localhost:9000', 'http://127.0.0.1:9000'];
  for (const url of targets) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        SERVER_URL = url;
        console.log(`[Engineer] Connected via ${url}`);
        checkServerHealth();
        return;
      }
    } catch (e) {
      console.warn(`[Engineer] Failed to reach ${url}`);
    }
  }
  checkServerHealth(); // Will set error state if both fail
}


// ── Server Health Check ──
async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(1500) 
    });
    if (res.ok) {
      statusDot.className = 'status-dot active';
      statusDot.title = `Connected to server at ${SERVER_URL}`;
      
      // If we recovered, fix the button if needed
      if (currentVideo && !isDownloading && downloadBtn.disabled) {
        btnLabel.textContent = 'Download';
        downloadBtn.disabled = false;
      }
    } else {
      throw new Error();
    }
  } catch (e) {
    statusDot.className = 'status-dot error';
    statusDot.title = 'Local server not found. Please ensure server.js is running.';
    
    if (currentVideo && !isDownloading) {
      btnLabel.innerHTML = 'Server Offline <span style="font-size:10px; opacity:0.8;">(Click for Help)</span>';
      downloadBtn.disabled = false; // Enable it so they can click to see the guide
      downloadBtn.onclick = () => {
        chrome.tabs.create({ url: 'https://github.com/YOUR_USERNAME/YOUR_REPO#setup' });
      };
    }

  }
}

// ── Detect YouTube video in active tab ──
async function detectVideo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return setNoVideo();

    const url = new URL(tab.url);
    const isYouTube = url.hostname.includes('youtube.com');
    const videoId = url.searchParams.get('v');

    if (!isYouTube || !videoId) return setNoVideo();

    // Fetch video metadata via YouTube oEmbed
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return setNoVideo();

    const data = await res.json();
    currentVideo = {
      id: videoId,
      title: data.title,
      channel: data.author_name,
      thumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: tab.url
    };

    showVideo(currentVideo);
  } catch (e) {
    setNoVideo();
  }
}

function setNoVideo() {
  // Only change status dot to grey if we haven't already set it to error by health check
  if (!statusDot.classList.contains('error')) {
    statusDot.className = 'status-dot';
  }
  noVideo.style.display = 'flex';
  videoInfo.style.display = 'none';
  formatSection.style.display = 'none';
  downloadBtn.disabled = true;
  btnLabel.textContent = 'No video detected';
}

function showVideo(v) {
  statusDot.className = 'status-dot active';
  noVideo.style.display = 'none';
  videoInfo.style.display = 'block';
  formatSection.style.display = 'flex';
  downloadBtn.disabled = false;

  videoThumb.src = v.thumb;
  videoTitle.textContent = v.title;
  videoChannel.textContent = v.channel;
  btnLabel.textContent = 'Download';
  videoDuration.textContent = '';  // Duration requires YT Data API key
}

// ── Format / Quality selection ──
function bindEvents() {
  // Format tabs
  document.querySelectorAll('.fmt-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fmt-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;

      if (selectedType === 'video') {
        videoQualities.style.display = 'grid';
        audioQualities.style.display = 'none';
        selectedQuality = '1080';
        setActiveQuality(videoQualities, '1080');
      } else {
        videoQualities.style.display = 'none';
        audioQualities.style.display = 'grid';
        selectedQuality = '320';
        setActiveQuality(audioQualities, '320');
      }
    });
  });

  // Quality buttons
  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.quality-grid');
      parent.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedQuality = btn.dataset.quality;
    });
  });

  // Download
  downloadBtn.addEventListener('click', handleDownload);

  // Clear history
  clearHistory.addEventListener('click', async () => {
    await chrome.storage.local.set({ downloadHistory: [] });
    renderHistory();
  });
}

function setActiveQuality(container, quality) {
  container.querySelectorAll('.quality-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.quality === quality);
  });
}

// ── Download handler ──
async function handleDownload() {
  if (!currentVideo || isDownloading) return;

  // NOTE: Real downloading from YouTube requires a backend server or a library
  // like yt-dlp running locally, because YouTube streams are protected.
  // This extension is architected to send requests to a local backend at
  // http://localhost:9000, which you run with yt-dlp.
  //
  // See README.md for setup instructions.

  isDownloading = true;
  downloadBtn.disabled = true;

  progressWrap.style.display = 'flex';
  setProgress(0, 'Connecting to local server…');

  try {
    const ext = selectedType === 'audio' ? 'mp3' : 'mp4';
    const quality = selectedQuality;

    // Send download request to local yt-dlp server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for handshake
    
    let resp;
    const downloadData = {
      url: `https://www.youtube.com/watch?v=${currentVideo.id}`,
      type: selectedType,
      quality: selectedQuality
    };

    try {
      // 1. Try POST first (Standard)
      resp = await fetch(`${SERVER_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(downloadData),
        signal: controller.signal
      });
    } catch (postErr) {
      console.warn('[Engineer] POST failed, retrying with GET fallback...', postErr);
      
      // 2. Fallback to GET if POST is blocked (CORS/Network error)
      const params = new URLSearchParams(downloadData).toString();
      resp = await fetch(`${SERVER_URL}/download?${params}`, {
        method: 'GET',
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || 'Server error: ' + resp.status);
    }

    setProgress(30, 'Downloading…');

    // Poll for progress
    const { jobId } = await resp.json();
    await pollProgress(jobId);

    // Save to history
    await addToHistory({
      title: currentVideo.title,
      type: selectedType,
      quality,
      ext,
      date: new Date().toISOString()
    });

    setProgress(100, 'Done!');
    await renderHistory();

    setTimeout(resetDownload, 2000);
  } catch (e) {
    console.error('Download error:', e);
    let msg = 'Error: ' + e.message;
    if (e.name === 'AbortError') {
      msg = 'Connection timeout. Check server.';
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      msg = 'Server unreachable. Run server.js';
    }
    
    setProgress(0, msg);
    statusDot.className = 'status-dot error';
    setTimeout(resetDownload, 4000);
  }
}

async function pollProgress(jobId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(`${SERVER_URL}/progress/${jobId}`);
        const d = await r.json();
        setProgress(d.percent, `${d.percent}% — ${d.speed || ''}`);
        if (d.percent >= 100 || d.status === 'done') {
          clearInterval(interval);
          resolve();
        }
        if (d.status === 'error') {
          clearInterval(interval);
          reject(new Error(d.message));
        }
      } catch {
        if (attempts > 30) { clearInterval(interval); reject(new Error('Timeout')); }
      }
    }, 800);
  });
}

function setProgress(pct, label) {
  progressFill.style.width = pct + '%';
  progressLabel.textContent = label;
}

function resetDownload() {
  isDownloading = false;
  downloadBtn.disabled = false;
  progressWrap.style.display = 'none';
  setProgress(0, '');
  statusDot.className = 'status-dot active';
}

// ── History ──
async function addToHistory(entry) {
  const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');
  downloadHistory.unshift(entry);
  const trimmed = downloadHistory.slice(0, 10); // Keep last 10
  await chrome.storage.local.set({ downloadHistory: trimmed });
}

async function renderHistory() {
  const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');

  if (downloadHistory.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No downloads yet</p>';
    return;
  }

  historyList.innerHTML = downloadHistory.map(item => {
    const date = new Date(item.date);
    const timeStr = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const typeLabel = item.type === 'audio' ? `MP3 ${item.quality}k` : `MP4 ${item.quality}p`;
    return `
      <div class="history-item">
        <span class="history-title">${escapeHtml(item.title)}</span>
        <span class="history-meta">${typeLabel} · ${timeStr}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
