// ── State ──
let currentVideo = null;
let selectedType = 'video';
let selectedQuality = '1080';
let isDownloading = false;
let SERVER_URL = 'http://127.0.0.1:9000'; // Initial default


// ── DOM refs ──
const statusDot = document.getElementById('statusDot');
const noVideo = document.getElementById('noVideo');
const videoInfo = document.getElementById('videoInfo');
const videoThumb = document.getElementById('videoThumb');
const videoDuration = document.getElementById('videoDuration');
const videoTitle = document.getElementById('videoTitle');
const videoChannel = document.getElementById('videoChannel');
const formatSection = document.getElementById('formatSection');
const videoQualities = document.getElementById('videoQualities');
const audioQualities = document.getElementById('audioQualities');
const downloadBtn = document.getElementById('downloadBtn');
const btnLabel = document.getElementById('btnLabel');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved working URL if any
  const saved = await chrome.storage.local.get('working_server_url');
  if (saved.working_server_url) SERVER_URL = saved.working_server_url;

  await detectVideo();
  await renderHistory();
  bindEvents();

  // Smart Discovery
  await bootstrapConnection();

  // Start server heartbeat
  setInterval(checkServerHealth, 5000);
  
  // Keep-alive heartbeat (Smart Shutdown support)
  setInterval(() => {
    fetch(`${SERVER_URL}/ping`).catch(() => {});
  }, 10000);
});

async function bootstrapConnection() {
  const targets = [
    SERVER_URL, // Try the current/saved one first
    'http://127.0.0.1:9000',
    'http://localhost:9000'
  ];
  
  const uniqueTargets = [...new Set(targets)];

  const checkHealth = async (url) => {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) throw new Error('Health check failed');
    return url;
  };

  try {
    const workingUrl = await Promise.any(uniqueTargets.map(checkHealth));

    if (SERVER_URL !== workingUrl) {
      SERVER_URL = workingUrl;
      await chrome.storage.local.set({ working_server_url: workingUrl });
      console.log(`[Engineer] New working URL discovered and saved: ${workingUrl}`);
    }
    return true;
  } catch (e) {
    // All health checks failed
    return false;
  }
}


// ── Server Health Check ──
async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      
      // Engineer's Diagnostic: Check if dependencies are missing
      if (data.dependencies && (!data.dependencies.ytdlp || !data.dependencies.ffmpeg)) {
        statusDot.className = 'status-dot error';
        const missing = !data.dependencies.ytdlp ? 'yt-dlp' : 'ffmpeg';
        statusDot.title = `Missing dependency: ${missing}`;
        
        if (currentVideo && !isDownloading) {
          btnLabel.innerHTML = `One-Click Fix <span style="font-size:10px; opacity:0.8;">(Install ${missing})</span>`;
          downloadBtn.disabled = false;
          downloadBtn.onclick = async () => {
            btnLabel.textContent = 'Installing...';
            downloadBtn.disabled = true;
            try {
              const setupRes = await fetch(`${SERVER_URL}/setup`, { method: 'POST' });
              const setupData = await setupRes.json();
              if (setupData.success) {
                btnLabel.textContent = 'Done! Restarting...';
                setTimeout(() => window.location.reload(), 2000);
              } else {
                throw new Error(setupData.error || 'Setup failed');
              }
            } catch (err) {
              alert('Setup failed: ' + err.message);
              btnLabel.textContent = 'Fix Failed';
              setTimeout(() => checkServerHealth(), 3000);
            }
          };
        }
        return;
      }

      statusDot.className = 'status-dot active';
      statusDot.title = `Connected to server at ${SERVER_URL}`;
      
      // Reset onclick if it was hijacked by errors
      downloadBtn.onclick = handleDownload;

      // If we recovered, fix the button if needed
      if (currentVideo && !isDownloading) {
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
      downloadBtn.disabled = false; 
      downloadBtn.onclick = () => {
        chrome.tabs.create({ url: 'https://github.com/ankitkumarraj9126-a11y' });
      };
    }
  }
}


// ── Detect YouTube video in active tab ──
function getYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // handled youtu.be/abc
    if (hostname === 'youtu.be') {
      return pathname.slice(1).split(/[?#]/)[0];
    }

    if (hostname.includes('youtube.com')) {
      // handled /shorts/abc, /live/abc, /embed/abc, /v/abc
      const paths = ['/shorts/', '/live/', '/embed/', '/v/'];
      for (const p of paths) {
        if (pathname.startsWith(p)) {
          const parts = pathname.split('/');
          return parts[2] ? parts[2].split(/[?#]/)[0] : null;
        }
      }
      
      // handled /watch?v=abc
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    console.error('[Engineer] getYouTubeVideoId error:', e);
    return null;
  }
  return null;
}

async function detectVideo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return setNoVideo();

    const videoId = getYouTubeVideoId(tab.url);
    if (!videoId) return setNoVideo();

    console.log('[Engineer] Detected videoId:', videoId);

    // 1. Try fetching via oEmbed (fastest, cleanest metadata)
    let metadata = null;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      console.log('[Engineer] Trying oEmbed:', oembedUrl);
      const res = await fetch(oembedUrl);
      if (res.ok) {
        metadata = await res.json();
        console.log('[Engineer] oEmbed success:', metadata.title);
      } else {
        console.warn('[Engineer] oEmbed returned status:', res.status);
      }
    } catch (e) {
      console.warn('[Engineer] oEmbed fetch failed, will try content script fallback', e);
    }

    if (metadata && metadata.title) {
      currentVideo = {
        id: videoId,
        title: metadata.title,
        channel: metadata.author_name,
        thumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: tab.url
      };
    } else {
      // 2. Fallback: Request metadata from content script (scraping)
      console.log('[Engineer] Trying content script fallback for tab:', tab.id);
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_DATA' });
        console.log('[Engineer] Content script response:', response);
        if (response && response.title) {
          currentVideo = {
            id: videoId,
            title: response.title,
            channel: response.channel || 'YouTube User',
            thumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            url: tab.url
          };
        } else {
          throw new Error('Content script returned no data or empty title');
        }
      } catch (e) {
        console.error('[Engineer] Metadata detection failed:', e);
        return setNoVideo();
      }
    }

    showVideo(currentVideo);
  } catch (e) {
    console.error('[Engineer] detectVideo fatal error:', e);
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

  isDownloading = true;
  downloadBtn.disabled = true;

  progressWrap.style.display = 'flex';
  setProgress(0, 'Connecting to local server…');

  try {
    const ext = selectedType === 'audio' ? 'mp3' : 'mp4';
    const quality = selectedQuality;

    const attemptDownload = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); 
      
      const downloadData = {
        url: `https://www.youtube.com/watch?v=${currentVideo.id}`,
        type: selectedType,
        quality: selectedQuality
      };

      try {
        let resp = await fetch(`${SERVER_URL}/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(downloadData),
          signal: controller.signal
        });

        if (!resp.ok) {
          // Fallback to GET if POST is blocked or fails
          console.warn('[Engineer] POST failed, retrying with GET...');
          const params = new URLSearchParams(downloadData).toString();
          resp = await fetch(`${SERVER_URL}/download?${params}`, {
            method: 'GET',
            signal: controller.signal
          });
        }

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Server error: ' + resp.status);
        }
        return resp;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let resp;
    try {
      resp = await attemptDownload();
    } catch (e) {
      // If first attempt fails, try to re-bootstrap the connection once
      console.log('[Engineer] First attempt failed, re-bootstrapping...');
      const recovered = await bootstrapConnection();
      if (recovered) {
        resp = await attemptDownload();
      } else {
        throw e; // Still unreachable
      }
    }

    setProgress(30, 'Downloading…');
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
        if (!r.ok) throw new Error('Progress fetch failed');
        
        const d = await r.json();
        setProgress(d.percent || 0, `${d.percent || 0}% — ${d.speed || ''}`);
        
        if (d.status === 'done' || d.percent >= 100) {
          setProgress(100, '100% — Download Complete!');
          progressWrap.classList.add('completed');
          clearInterval(interval);
          resolve();
        }
        
        if (d.status === 'error') {
          clearInterval(interval);
          reject(new Error(d.error || 'Unknown server error'));
        }
      } catch (e) {
        if (attempts > 100) { 
          clearInterval(interval); 
          reject(new Error('Progress timeout or server disconnected')); 
        }
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// ── Advanced Neon Particle System ──
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function initParticles() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  particles = [];
  const colors = ['#00f2ff', '#ff00ff', '#00ff00', '#bc13fe'];
  for (let i = 0; i < 40; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update and draw particles
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.fill();
    ctx.shadowBlur = 0; // Reset for performance

    // Draw connecting lines
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p.x - p2.x;
      const dy = p.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 100) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = (1 - dist / 100) * 0.5;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  });
  
  requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', initParticles);
initParticles();
animateParticles();
