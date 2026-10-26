### DEVELOPMENT.md（开发指南）

```markdown
# Development Guide

Complete guide for developing and contributing to Instagram Downloader Pro.

## Prerequisites

- **Node.js**: v16 or higher
- **npm**: v7 or higher
- **Chrome**: v88 or higher
- **Git**: Latest version
- **Code Editor**: VS Code recommended

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/instagram-downloader-pro.git
cd instagram-downloader-pro
2. Install Dependencies
bash
npm install
3. Create Icon Assets
Follow the ICONS.md guide to create required icon files in assets/icons/.

4. Build Extension
bash
# Development build with watch mode
npm run dev

# Production build
npm run build
5. Load in Chrome
Open Chrome and go to chrome://extensions/

Enable "Developer mode" (top right)

Click "Load unpacked"

Select the dist folder

Project Setup
Directory Structure
See PROJECT_STRUCTURE.md for complete structure.

Key Files
src/background/index.js - Background service entry

src/content/index.js - Content script entry

src/ui/*/ - UI pages

manifest.json - Extension manifest

Development Workflow
Daily Development
bash
# Start development server with watch
npm run dev

# In another terminal, make changes to source files
# Webpack will auto-rebuild on file changes

# Reload extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Click reload icon on your extension
Testing Changes
Make code changes

Webpack auto-rebuilds

Reload extension in Chrome

Test on Instagram

Check console for logs

Debugging
Background Service Worker
javascript
// In background code
console.log('Debug message');

// View logs:
// chrome://extensions/ → Click "Inspect views: service worker"
Content Script
javascript
// In content code
console.log('Debug message');

// View logs:
// F12 Developer Tools → Console tab
UI Pages
javascript
// In UI code
console.log('Debug message');

// View logs:
// Right-click page → Inspect → Console tab
Code Style
JavaScript
javascript
// Use ES6+ features
import { Module } from './module.js';

// Use async/await
async function fetchData() {
  const result = await someAsyncOperation();
  return result;
}

// Use arrow functions
const map = array.map(item => item.value);

// Use destructuring
const { prop1, prop2 } = object;

// Use template literals
const message = `Hello, ${name}!`;
Naming Conventions
javascript
// Classes: PascalCase
class SessionManager {}

// Functions: camelCase
function handleDownload() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private methods: _prefixed
_privateMethod() {}
Comments
javascript
/**
 * Function description
 * @param {string} param1 - Description
 * @param {number} param2 - Description
 * @returns {Promise<Object>} Description
 */
async function myFunction(param1, param2) {
  // Implementation
}
Building
Development Build
bash
npm run dev
Features:

Source maps enabled

No minification

Fast rebuild

Console logs included

Production Build
bash
npm run build
Features:

Source maps disabled

Full minification

Optimized assets

Console logs removed

Create Release
bash
npm run zip
Creates: releases/instagram-downloader-pro-v2.0.0.zip

Testing
Manual Testing
Profile Scanning

Navigate to Instagram profile

Click "Scan & Download All"

Verify media detection

Download

Select media items

Click "Download"

Verify downloads complete

Settings

Open options page

Change settings

Verify persistence

Error Handling

Test with invalid profiles

Test with network offline

Verify error messages

Testing Checklist
 Profile scanning works

 Media preview displays

 Downloads complete successfully

 Settings save correctly

 Error messages show properly

 UI responsive on different screens

 Icons display correctly

 Keyboard shortcuts work

 Theme switching works

 Network errors handled

Common Issues
Build Fails
bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
Extension Won't Load
Check manifest.json syntax

Verify all required files exist

Check Chrome console for errors

Try removing and re-adding extension

Content Script Not Injecting
Check permissions in manifest

Verify URL matches pattern

Check for JavaScript errors

Try hard refresh (Ctrl+Shift+R)

Git Workflow
Branches
main - Production ready code

develop - Development branch

feature/* - New features

fix/* - Bug fixes

Commit Messages
text
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
chore: Update dependencies
Pull Requests
Create feature branch

Make changes

Test thoroughly

Create PR to develop

Wait for review

Merge after approval

Performance Tips
Optimize Scanning
javascript
// Use requestIdleCallback for non-critical work
requestIdleCallback(() => {
  // Low priority work
});

// Debounce scroll events
const handleScroll = debounce(() => {
  // Handle scroll
}, 100);
Reduce Memory Usage
javascript
// Clear references when done
this.largeArray = null;

// Use weak maps for caching
const cache = new WeakMap();

// Unsubscribe from events
element.removeEventListener('click', handler);
Efficient DOM Manipulation
javascript
// Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => fragment.appendChild(item));
container.appendChild(fragment);

// Use classList instead of style
element.classList.add('active');
Resources
Chrome Extension Docs

Manifest V3 Migration

Webpack Documentation

MDN Web Docs

Getting Help
Check existing issues

Create new issue with:

Clear description

Steps to reproduce

Expected vs actual behavior

Screenshots if applicable