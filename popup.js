// Popup script for YouTube Filter

const DEFAULT_CONFIG = {
    apiEndpoint: 'http://192.168.1.67:1880/youtube-filter',
    enabled: true,
    showScores: true,
    threshold: 50,
    topicCooldownDays: 14,
    maxTopicVideos: 4
};

let config = { ...DEFAULT_CONFIG };

// Load config
chrome.storage.local.get(['ytFilterConfig', 'watchedTopics'], (result) => {
    if (result.ytFilterConfig) {
        config = { ...config, ...result.ytFilterConfig };
    }
    updateUI();
    loadTopics(result.watchedTopics || {});
    checkAPI();
});

function updateUI() {
    document.getElementById('enabled').checked = config.enabled;
    document.getElementById('showScores').checked = config.showScores;
    document.getElementById('threshold').value = config.threshold;
    document.getElementById('thresholdValue').textContent = config.threshold;
    document.getElementById('cooldownDays').value = config.topicCooldownDays;
    document.getElementById('maxTopicVideos').value = config.maxTopicVideos;
}

function loadTopics(topics) {
    const container = document.getElementById('topicsList');
    const topicEntries = Object.entries(topics);

    if (topicEntries.length === 0) {
        container.innerHTML = '<em style="color: #666">No topics tracked yet</em>';
        return;
    }

    container.innerHTML = topicEntries
        .sort((a, b) => b[1].count - a[1].count)
        .map(([topic, data]) => `
            <div class="topic">
                <span>${topic}</span>
                <span>
                    <span class="topic-count">${data.count}</span>
                    <button class="topic-clear" data-topic="${topic}">×</button>
                </span>
            </div>
        `).join('');

    // Add click handlers for clear buttons
    container.querySelectorAll('.topic-clear').forEach(btn => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic;
            chrome.storage.local.get(['watchedTopics'], (result) => {
                const topics = result.watchedTopics || {};
                delete topics[topic];
                chrome.storage.local.set({ watchedTopics: topics });
                loadTopics(topics);
            });
        });
    });
}

function saveConfig() {
    chrome.storage.local.set({ ytFilterConfig: config });
}

async function checkAPI() {
    const status = document.getElementById('status');
    try {
        const response = await fetch(config.apiEndpoint + '/health', {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        if (response.ok) {
            status.textContent = '● API Connected';
            status.className = 'status online';
        } else {
            throw new Error('Bad response');
        }
    } catch (e) {
        status.textContent = '○ API Offline - videos will show unfiltered';
        status.className = 'status offline';
    }
}

// Event listeners
document.getElementById('enabled').addEventListener('change', (e) => {
    config.enabled = e.target.checked;
    saveConfig();
});

document.getElementById('showScores').addEventListener('change', (e) => {
    config.showScores = e.target.checked;
    saveConfig();
});

document.getElementById('threshold').addEventListener('input', (e) => {
    config.threshold = parseInt(e.target.value);
    document.getElementById('thresholdValue').textContent = config.threshold;
    saveConfig();
});

document.getElementById('cooldownDays').addEventListener('change', (e) => {
    config.topicCooldownDays = parseInt(e.target.value);
    saveConfig();
});

document.getElementById('maxTopicVideos').addEventListener('change', (e) => {
    config.maxTopicVideos = parseInt(e.target.value);
    saveConfig();
});

document.getElementById('clearTopics').addEventListener('click', () => {
    chrome.storage.local.set({ watchedTopics: {} });
    loadTopics({});
});
