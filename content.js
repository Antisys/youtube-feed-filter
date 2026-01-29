// YouTube Feed Filter - Content Script
(function() {
    'use strict';

    // Configuration
    let CONFIG = {
        apiEndpoint: 'http://localhost:11434/api/generate',
        enabled: true,
        showScores: true,
        threshold: 60,  // Hide videos scoring below this
        topicCooldownDays: 14,
        maxTopicVideos: 4
    };

    // Load config from storage
    chrome.storage.local.get(['ytFilterConfig'], (result) => {
        if (result.ytFilterConfig) {
            CONFIG = { ...CONFIG, ...result.ytFilterConfig };
        }
    });

    // Topic tracking
    let watchedTopics = {};
    chrome.storage.local.get(['watchedTopics'], (result) => {
        if (result.watchedTopics) {
            watchedTopics = result.watchedTopics;
            cleanOldTopics();
        }
    });

    // Video view count tracking (hide after 3 views)
    let videoViewCounts = {};
    chrome.storage.local.get(['videoViewCounts'], (result) => {
        if (result.videoViewCounts) {
            videoViewCounts = result.videoViewCounts;
            cleanOldViewCounts();
        }
    });

    function cleanOldViewCounts() {
        // Remove entries older than 30 days
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        let changed = false;
        for (const videoId in videoViewCounts) {
            if (now - videoViewCounts[videoId].lastSeen > maxAge) {
                delete videoViewCounts[videoId];
                changed = true;
            }
        }
        if (changed) {
            chrome.storage.local.set({ videoViewCounts });
        }
    }

    // Track which videos we've already counted this session
    const sessionCounted = new Set();

    function trackVideoView(videoId) {
        // Only count once per session
        if (sessionCounted.has(videoId)) {
            return videoViewCounts[videoId]?.count || 0;
        }
        sessionCounted.add(videoId);

        if (!videoViewCounts[videoId]) {
            videoViewCounts[videoId] = { count: 0, lastSeen: Date.now() };
        }
        videoViewCounts[videoId].count++;
        videoViewCounts[videoId].lastSeen = Date.now();
        chrome.storage.local.set({ videoViewCounts });
        return videoViewCounts[videoId].count;
    }

    function getVideoViewCount(videoId) {
        return videoViewCounts[videoId]?.count || 0;
    }

    function cleanOldTopics() {
        const now = Date.now();
        const cooldownMs = CONFIG.topicCooldownDays * 24 * 60 * 60 * 1000;
        for (const topic in watchedTopics) {
            if (now - watchedTopics[topic].lastSeen > cooldownMs) {
                delete watchedTopics[topic];
            }
        }
        chrome.storage.local.set({ watchedTopics });
    }

    // Cache for already-scored videos
    const scoreCache = new Map();

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Extract video info from a video element
    function extractVideoInfo(videoElement) {
        // Try multiple selector patterns for title
        const titleEl = videoElement.querySelector('#video-title') ||
                        videoElement.querySelector('a#video-title-link') ||
                        videoElement.querySelector('[id="video-title"]') ||
                        videoElement.querySelector('h3 a') ||
                        videoElement.querySelector('a[title]');

        // Try multiple selector patterns for channel
        const channelEl = videoElement.querySelector('#channel-name a') ||
                          videoElement.querySelector('ytd-channel-name a') ||
                          videoElement.querySelector('[id="channel-name"] a') ||
                          videoElement.querySelector('.ytd-channel-name');

        // Try multiple selector patterns for video link
        const linkEl = videoElement.querySelector('a#thumbnail') ||
                       videoElement.querySelector('a[href*="/watch?v="]') ||
                       videoElement.querySelector('a[href*="shorts/"]');

        // Get title from element text or title attribute
        let title = titleEl?.textContent?.trim() || titleEl?.getAttribute('title')?.trim();

        // Debug: log what we found
        if (!title && !linkEl) {
            console.log('YT Filter: Could not extract from element:', videoElement.tagName, videoElement.id);
        }

        const channel = channelEl?.textContent?.trim() || 'Unknown';
        const videoUrl = linkEl?.href || titleEl?.href || '';

        // Extract video ID from URL
        let videoId = '';
        const watchMatch = videoUrl.match(/[?&]v=([^&]+)/);
        const shortsMatch = videoUrl.match(/shorts\/([^?&]+)/);
        videoId = watchMatch?.[1] || shortsMatch?.[1] || '';

        if (!title || !videoId) return null;

        return {
            id: videoId,
            title,
            channel,
            element: videoElement
        };
    }

    // Check if video element is sponsored/promoted
    function isSponsored(videoElement) {
        // Look for sponsored/ad indicators
        const sponsoredTexts = ['Sponsored', 'Ad', 'Anzeige', 'Gesponsert'];

        // Check for ad badges and ad elements
        const adBadge = videoElement.querySelector('[class*="ad-badge"]') ||
                        videoElement.querySelector('[class*="sponsored"]') ||
                        videoElement.querySelector('ytd-ad-slot-renderer') ||
                        videoElement.querySelector('[id*="ad-slot"]') ||
                        videoElement.closest('ytd-ad-slot-renderer');
        if (adBadge) return true;

        // Check for sponsored text in metadata
        const metaElements = videoElement.querySelectorAll('span, yt-formatted-string');
        for (const el of metaElements) {
            const text = el.textContent?.trim();
            if (sponsoredTexts.some(s => text === s)) return true;
        }

        return false;
    }

    // Check if video matches blacklisted topics
    function isBlacklistedTopic(videoElement) {
        const titleEl = videoElement.querySelector('#video-title') ||
                        videoElement.querySelector('a#video-title-link') ||
                        videoElement.querySelector('h3 a');
        const title = (titleEl?.textContent || titleEl?.getAttribute('title') || '').toLowerCase();

        const channelEl = videoElement.querySelector('#channel-name a') ||
                          videoElement.querySelector('ytd-channel-name a');
        const channel = (channelEl?.textContent || '').toLowerCase();

        const blacklist = [
            // Cooking/baking
            'recipe', 'recipes', 'cooking', 'baking', 'cook', 'bake',
            'kitchen', 'chef', 'food', 'meal', 'dinner', 'lunch', 'breakfast',
            'dish', 'cuisine', 'rezept', 'kochen', 'backen', 'kueche', 'kuche',
            'essen', 'gericht', 'mahlzeit',
            // Precious metals / investment spam
            'gold', 'silver', 'silber'
        ];

        const text = title + ' ' + channel;
        return blacklist.some(keyword => text.includes(keyword));
    }

    // Check if element is a Short
    function isShort(videoElement) {
        // Check for shorts URL
        const link = videoElement.querySelector('a[href*="/shorts/"]');
        if (link) return true;

        // Check for shorts-specific elements
        if (videoElement.tagName === 'YTD-REEL-ITEM-RENDERER' ||
            videoElement.tagName === 'YTD-REEL-SHELF-RENDERER' ||
            videoElement.closest('ytd-reel-shelf-renderer') ||
            videoElement.closest('ytd-rich-shelf-renderer[is-shorts]')) {
            return true;
        }

        // Check for "Shorts" label
        const overlay = videoElement.querySelector('[overlay-style="SHORTS"]') ||
                        videoElement.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]');
        if (overlay) return true;

        return false;
    }

    // Find all video elements on page
    function findVideoElements() {
        // Hide entire Shorts shelves
        document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]').forEach(shelf => {
            if (!shelf.dataset.ytFiltered) {
                shelf.style.display = 'none';
                shelf.dataset.ytFiltered = 'shorts-shelf';
                console.log('YT Filter: HIDDEN shorts shelf');
            }
        });

        // Hide ad slots
        document.querySelectorAll('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer').forEach(ad => {
            if (!ad.dataset.ytFiltered) {
                ad.style.display = 'none';
                ad.dataset.ytFiltered = 'ad';
                console.log('YT Filter: HIDDEN ad element');
            }
        });

        const selectors = [
            'ytd-rich-item-renderer',           // Home page grid
            'ytd-video-renderer',               // Search results
            'ytd-compact-video-renderer',       // Sidebar recommendations
            'ytd-grid-video-renderer'           // Channel page grid
        ];

        const elements = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (!el.dataset.ytFiltered) {
                    // Hide sponsored videos immediately
                    if (isSponsored(el)) {
                        el.style.display = 'none';
                        el.dataset.ytFiltered = 'sponsored';
                        console.log('YT Filter: HIDDEN sponsored video');
                    // Hide Shorts immediately
                    } else if (isShort(el)) {
                        el.style.display = 'none';
                        el.dataset.ytFiltered = 'short';
                        console.log('YT Filter: HIDDEN short');
                    // Hide blacklisted topics
                    } else if (isBlacklistedTopic(el)) {
                        el.style.display = 'none';
                        el.dataset.ytFiltered = 'blacklisted';
                        console.log('YT Filter: HIDDEN blacklisted topic');
                    } else {
                        // Check if video was already shown 3+ times
                        const videoInfo = extractVideoInfo(el);
                        if (videoInfo) {
                            // Track view and check count BEFORE processing
                            const viewCount = trackVideoView(videoInfo.id);
                            if (viewCount >= 3) {
                                el.style.display = 'none';
                                el.dataset.ytFiltered = 'seen-too-often';
                                console.log('YT Filter: HIDDEN (seen', viewCount, 'times)', videoInfo.title.substring(0, 25));
                            } else {
                                elements.push(el);
                            }
                        } else {
                            elements.push(el);
                        }
                    }
                }
            });
        });
        return elements;
    }

    // Score a single video via Ollama API
    async function scoreOneVideo(video) {
        if (scoreCache.has(video.id)) {
            return { ...video, ...scoreCache.get(video.id) };
        }

        const saturatedTopics = Object.keys(watchedTopics).filter(t =>
            watchedTopics[t].count >= CONFIG.maxTopicVideos
        );

        const prompt = `Score this YouTube video 0-100 for quality.

SCORING:
- 80-100: Educational, technical, informative
- 60-79: Decent, interesting
- 40-59: Mediocre, clickbait
- 20-39: Low quality, fear-mongering, speculation
- 0-19: Pure clickbait, panic, rage-bait

FILTER OUT: Fear headlines, speculation, AI slop, clickbait (ALL CAPS, !!!)
KEEP: Technical content, tutorials, thoughtful analysis

${saturatedTopics.length > 0 ? 'SATURATED TOPICS (score lower): ' + saturatedTopics.join(', ') : ''}

VIDEO: [${video.channel}] ${video.title}

Respond ONLY with JSON: {"score": 75, "reason": "brief reason"}`;

        try {
            const result = await chrome.runtime.sendMessage({
                action: 'scoreVideos',
                endpoint: CONFIG.apiEndpoint,
                body: {
                    model: 'llama3.2:3b',
                    prompt: prompt,
                    stream: false
                }
            });

            if (result.success) {
                const content = result.data.response || '';
                const jsonMatch = content.match(/\{[^}]+\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const scoreData = {
                        score: parsed.score || 50,
                        reason: parsed.reason || ''
                    };
                    scoreCache.set(video.id, scoreData);
                    console.log('YT Filter:', video.title.substring(0, 25), '→', scoreData.score);
                    return { ...video, ...scoreData };
                }
            }
        } catch (e) {
            console.log('YT Filter: API error for', video.title.substring(0, 20));
        }

        return { ...video, score: 50, reason: 'Not scored' };
    }

    // Score videos one by one, applying badges immediately
    async function scoreVideos(videos) {
        if (!CONFIG.enabled || videos.length === 0) return [];

        const results = [];
        for (const video of videos) {
            const scored = await scoreOneVideo(video);
            results.push(scored);
            // Apply badge immediately for this single video
            applyFilter([scored]);
        }
        return results;
    }

    // Apply filtering to videos
    function applyFilter(scoredVideos) {
        scoredVideos.forEach(video => {
            const el = video.element;
            el.dataset.ytFiltered = 'true';
            el.dataset.ytScore = video.score;

            // View count already tracked in findVideoElements
            const viewCount = getVideoViewCount(video.id);

            if (video.score < CONFIG.threshold) {
                el.classList.add('yt-filter-hidden');
                el.dataset.ytReason = video.reason || 'Low score';
            } else {
                el.classList.remove('yt-filter-hidden');
            }

            // Add score badge if enabled
            if (CONFIG.showScores && !el.querySelector('.yt-filter-badge')) {
                const badge = document.createElement('div');
                badge.className = 'yt-filter-badge';
                badge.textContent = `${video.score}`;
                badge.style.cssText = `
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    background: ${video.score >= 70 ? '#4CAF50' : video.score >= 50 ? '#FF9800' : '#f44336'};
                    color: white;
                    padding: 8px 14px;
                    border-radius: 6px;
                    font-size: 24px;
                    font-weight: bold;
                    z-index: 9999;
                    pointer-events: none;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                `;
                badge.title = `${video.reason || ''} (${viewCount}x)`;

                // Make parent relative and add badge
                el.style.position = 'relative';
                el.appendChild(badge);
            }

            // Hide low-scoring videos
            if (video.score < CONFIG.threshold) {
                el.style.display = 'none';
                console.log('YT Filter: HIDDEN', video.title.substring(0,25), 'score:', video.score);
            }
        });
    }

    // Main processing function
    const processVideos = debounce(async () => {
        if (!CONFIG.enabled) return;

        const videoElements = findVideoElements();
        if (videoElements.length === 0) return;

        const videos = videoElements
            .map(extractVideoInfo)
            .filter(v => v !== null);

        if (videos.length === 0) return;

        console.log(`YT Filter: Processing ${videos.length} videos`);
        await scoreVideos(videos);
        // Badges are applied one by one in scoreVideos
    }, 500);

    // Track when user clicks a video (for topic tracking)
    document.addEventListener('click', (e) => {
        const videoLink = e.target.closest('a[href*="watch?v="]');
        if (!videoLink) return;

        const videoEl = videoLink.closest('[data-yt-filtered]');
        if (!videoEl) return;

        const titleEl = videoEl.querySelector('#video-title');
        const title = titleEl?.textContent?.trim();
        if (!title) return;

        // Send to API to extract topic
        fetch(CONFIG.apiEndpoint + '/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        }).then(r => r.json()).then(data => {
            if (data.topic) {
                if (!watchedTopics[data.topic]) {
                    watchedTopics[data.topic] = { count: 0, lastSeen: Date.now() };
                }
                watchedTopics[data.topic].count++;
                watchedTopics[data.topic].lastSeen = Date.now();
                chrome.storage.local.set({ watchedTopics });
                console.log(`YT Filter: Topic "${data.topic}" count: ${watchedTopics[data.topic].count}`);
            }
        }).catch(() => {});
    });

    // Observe DOM changes for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
        let hasNewVideos = false;
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 &&
                    (node.tagName?.includes('VIDEO') ||
                     node.tagName?.includes('RENDERER') ||
                     node.querySelector?.('[id*="video"]'))) {
                    hasNewVideos = true;
                }
            });
        });
        if (hasNewVideos) {
            processVideos();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial processing with delay for page load
    setTimeout(() => {
        const elements = findVideoElements();
        console.log('YT Filter: Found', elements.length, 'video elements');
        if (elements.length > 0) {
            const videos = elements.map(extractVideoInfo).filter(v => v !== null);
            console.log('YT Filter: Extracted', videos.length, 'video infos');
            if (videos.length > 0) {
                console.log('YT Filter: First video:', videos[0]);
            }
        }
        processVideos();
    }, 2000);

    // Re-process on navigation (YouTube is SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(processVideos, 1000);
        }
    }).observe(document.querySelector('title'), { childList: true });

    // Listen for config updates from popup
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.ytFilterConfig) {
            CONFIG = { ...CONFIG, ...changes.ytFilterConfig.newValue };
            // Re-process with new settings
            document.querySelectorAll('[data-yt-filtered]').forEach(el => {
                delete el.dataset.ytFiltered;
            });
            processVideos();
        }
    });

    console.log('YouTube Feed Filter loaded');
})();
