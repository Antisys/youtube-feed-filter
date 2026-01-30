# YouTube Feed Filter

A browser extension that uses a local AI (Ollama) to intelligently filter your YouTube feed. It analyzes video titles and channels to score content quality, hiding clickbait, fear-mongering, and low-quality recommendations while surfacing educational and informative content.

## ⚠️ Performance Warning

**This extension requires a powerful computer with a capable GPU or fast CPU.**

The AI scoring process takes approximately **5-10 seconds per video** on a modern laptop. Videos are scored one at a time to provide immediate feedback, but expect some delay before all badges appear. A machine with a dedicated GPU will significantly improve performance.

## Features

- **AI-Powered Quality Scoring**: Each video is analyzed and scored 0-100 based on content quality
- **Real-Time Score Badges**: Visual badges on thumbnails show the AI's quality assessment
- **Automatic Filtering**: Videos below your threshold are automatically hidden
- **Shorts Removal**: Completely hides YouTube Shorts from your feed
- **Ad/Sponsored Removal**: Hides promoted content and ad slots
- **Custom Blacklist**: Block topics via editable `blacklist.json` file
- **View Tracking**: Videos shown 3+ times are automatically hidden (reduces repetition)
- **Works with Ad Blockers**: Uses background worker to bypass CORS restrictions

## Scoring Criteria

| Score | Color | Quality Level |
|-------|-------|---------------|
| 80-100 | 🟢 Green | Educational, technical, informative |
| 60-79 | 🟠 Orange | Decent, interesting content |
| 40-59 | 🔴 Red | Mediocre, mild clickbait |
| 20-39 | 🔴 Red | Low quality, fear-mongering |
| 0-19 | 🔴 Red | Pure clickbait, rage-bait |

## Requirements

- **Ollama** installed and running locally
- A Chromium-based browser (Chrome, Brave, Edge, etc.)
- Sufficient hardware for local LLM inference (see Performance Warning)

## Installation

### Step 1: Install Ollama

Visit [ollama.ai](https://ollama.ai) and follow the installation instructions for your operating system.

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
Download from [ollama.ai/download](https://ollama.ai/download)

**Windows:**
Download the installer from [ollama.ai/download](https://ollama.ai/download)

### Step 2: Download the AI Model

After installing Ollama, download the required model:

```bash
ollama pull llama3.2:3b
```

This downloads a ~2GB model optimized for quick inference.

### Step 3: Configure Ollama for Browser Access

Create a systemd override file to enable CORS (Linux):

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo nano /etc/systemd/system/ollama.service.d/override.conf
```

Add the following content:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
```

Restart Ollama:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

**macOS/Windows:** Set environment variables `OLLAMA_HOST=0.0.0.0` and `OLLAMA_ORIGINS=*` before starting Ollama.

### Step 4: Verify Ollama is Running

Test that Ollama is accessible:

```bash
curl http://localhost:11434/api/generate -d '{"model": "llama3.2:3b", "prompt": "Hi", "stream": false}'
```

You should receive a JSON response.

### Step 5: Install the Browser Extension

1. Download or clone this repository
2. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `youtube-feed-filter` folder

### Step 6: Configure Your Blacklist (Optional)

Edit `blacklist.json` to customize which topics are automatically hidden:

```json
{
  "keywords": [
    "recipe", "cooking", "baking",
    "gold", "silver",
    "your-unwanted-topic"
  ]
}
```

After editing, reload the extension in your browser's extension page.

## Usage

1. Navigate to [youtube.com](https://youtube.com)
2. Wait for videos to load - you'll see score badges appear on thumbnails
3. Videos scoring below the threshold (default: 60) are automatically hidden
4. Click the extension icon to adjust settings

## Configuration Options

Click the extension icon to access:

- **Enable/Disable**: Turn filtering on or off
- **Show Scores**: Toggle visibility of score badges
- **Threshold**: Set minimum score (videos below are hidden)

## Troubleshooting

### Badges not appearing
1. Check that Ollama is running: `curl http://localhost:11434`
2. Verify the model is installed: `ollama list`
3. Check browser console for errors (F12 → Console)

### Extension not working with Brave Shields
The extension uses a background service worker to make API calls, which should work with Shields enabled. If you have issues, try adding `localhost` to Shields exceptions.

### Videos taking too long to score
- Use a machine with better hardware
- Consider using a smaller model (modify `content.js`)
- The extension scores videos one at a time for immediate feedback

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Extension configuration |
| `content.js` | Main filtering logic |
| `background.js` | API communication service worker |
| `blacklist.json` | Customizable topic blacklist |
| `popup.html/js` | Settings popup UI |
| `style.css` | Badge and filter styles |

## Privacy

- All AI processing happens **locally** on your machine
- No data is sent to external servers
- Video titles and channels are only processed by your local Ollama instance
- View counts are stored locally in browser storage

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
