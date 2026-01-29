// Background Service Worker for YouTube Feed Filter
// Handles API calls to Ollama (bypasses CORS/Shields restrictions)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scoreVideos') {
        fetch(request.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.body)
        })
        .then(response => response.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));

        return true; // Keep channel open for async response
    }
});

console.log('YouTube Feed Filter background worker loaded');
