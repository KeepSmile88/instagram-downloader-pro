# Instagram Downloader Pro

Professional Instagram media downloader Chrome extension with advanced features.

## Features

- 🚀 **Lightning Fast** - Download hundreds of media in minutes
- 🎯 **Smart Filters** - Filter by type, size, resolution
- 🔄 **Resume Capability** - Auto-resume interrupted downloads
- 🎨 **Beautiful UI** - Modern and intuitive interface
- 🔒 **Privacy First** - All data stays on your device
- 📦 **Bulk Download** - Download entire profiles at once
- 🎬 **Video Support** - High-quality video downloads
- 📸 **Image Support** - Full resolution images

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/instagram-downloader-pro.git
cd instagram-downloader-pro
Install dependencies:

bash
npm install
Build the extension:

bash
npm run build
Load in Chrome:

Open Chrome and navigate to chrome://extensions/

Enable "Developer mode"

Click "Load unpacked"

Select the dist folder

Development
Build for development (with watch):
bash
npm run dev
Build for production:
bash
npm run build
Create release ZIP:
bash
npm run zip
Usage
Navigate to any Instagram profile

Click the purple "Scan & Download All" button

Preview and select media you want to download

Click "Download" and wait for completion

Keyboard Shortcuts
Ctrl+Shift+S - Scan current profile

Ctrl+Shift+D - Toggle download panel

Ctrl+Shift+I - Open extension popup

Project Structure
text
instagram-downloader-pro/
├── src/
│   ├── background/         # Background service worker
│   │   ├── index.js
│   │   ├── session-manager.js
│   │   ├── download-manager.js
│   │   └── network-monitor.js
│   ├── content/            # Content scripts
│   │   ├── index.js
│   │   ├── scanner.js
│   │   ├── ui-injector.js
│   │   └── credentials-extractor.js
│   ├── core/               # Core modules
│   │   ├── logger.js
│   │   ├── storage.js
│   │   ├── error-handler.js
│   │   └── media-extractor.js
│   ├── ui/                 # UI pages
│   │   ├── popup/
│   │   ├── preview/
│   │   ├── onboarding/
│   │   ├── options/
│   │   └── components/
│   └── utils/              # Utilities
│       └── helpers.js
├── assets/                 # Icons and images
├── manifest.json           # Extension manifest
├── package.json
├── webpack.config.js
└── README.md
Technologies
Manifest V3 - Latest Chrome extension standard

ES6+ JavaScript - Modern JavaScript features

Webpack 5 - Module bundling

CSS3 - Modern styling

Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

License
MIT License - see LICENSE file for details

Disclaimer
This extension is for educational purposes only. Please respect Instagram's Terms of Service and copyright laws. Only download content you have permission to download.

Support
🐛 Report a bug

💡 Request a feature

📖 Read the docs

Credits
Made with ❤️ by the community