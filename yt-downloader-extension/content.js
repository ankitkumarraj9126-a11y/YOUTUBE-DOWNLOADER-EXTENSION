// Content script — runs on YouTube pages
// Communicates page data to the popup if needed.

(function () {
  'use strict';

  // Extract video metadata from the page DOM
  function getVideoData() {
    // 1. Try to find the title
    const title = 
      document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || // Older YT
      document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() ||             // Newer YT
      document.querySelector('.shortsVideoAdapterContainer .title')?.textContent?.trim() || // Shorts
      document.title.replace(' - YouTube', '');

    // 2. Try to find the channel name
    const channel = 
      document.querySelector('#channel-name a')?.textContent?.trim() ||
      document.querySelector('ytd-channel-name yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('.shortsVideoAdapterContainer .channel-name')?.textContent?.trim() ||
      '';

    // 3. Try to find duration
    const duration = 
      document.querySelector('.ytp-time-duration')?.textContent?.trim() || 
      '';

    return { title, channel, duration };
  }

  // Listen for popup requesting video info
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_VIDEO_DATA') {
      sendResponse(getVideoData());
    }
  });
})();
