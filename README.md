# YouTube Feed Filter

A browser extension that uses local AI (Ollama) to filter YouTube recommendations. Removes clickbait, fear-mongering content, and low-quality videos from your feed.

## Features

- **AI-powered scoring**: Each video is scored 0-100 based on quality
- **Real-time badges**: See scores directly on video thumbnails
- **Auto-hide low quality**: Videos below threshold are hidden
- **Removes Shorts**: Hides all YouTube Shorts
- **Removes Ads**: Hides sponsored content and ad slots
- **Topic saturation**: Tracks watched topics to reduce repetitive content
- **Works with Brave Shields**: Uses background worker for API calls

## Requirements

- [Ollama](https://ollama.ai/) running locally with `llama3.2:3b` model
- Chromium-based browser (Chrome, Brave, Edge)

## Installation

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
```

### 2. Configure Ollama for CORS (if needed)

Create `/etc/systemd/system/ollama.service.d/override.conf`:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
```

Then restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 3. Load Extension

1. Open `chrome://extensions` or `brave://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `youtube-filter` folder

## Scoring Criteria

| Score | Quality |
|-------|---------|
| 80-100 | Educational, technical, informative |
| 60-79 | Decent, interesting content |
| 40-59 | Mediocre, mild clickbait |
| 20-39 | Low quality, fear-mongering |
| 0-19 | Pure clickbait, rage-bait |

## Configuration

Click the extension icon to access settings:

- **Threshold**: Hide videos below this score (default: 60)
- **Show Scores**: Toggle badge visibility
- **Enable/Disable**: Turn filtering on/off

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main filtering logic
- `background.js` - API communication (bypasses CORS)
- `popup.html/js` - Settings UI
- `style.css` - Badge and filter styles

## License

MIT
