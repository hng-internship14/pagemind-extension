# PageMind — AI Page Summarizer Chrome Extension

> Instantly summarize any webpage using **OpenAI's GPT-4o-mini**. Get structured bullet-point summaries, key insights, and estimated reading time without leaving your tab.

---

## ✨ Features

- **AI-Powered Summarization**: Uses state-of-the-art Large Language Models (GPT-4o-mini) for high-accuracy summaries.
- **One-click activation**: Instantly analyze any article, blog post, or news story.
- **Structured Output**: Concise bullet points, 3 key insights, and reading time estimates.
- **In-page Highlighting**: Visually marks the most important phrases on the page for quick scanning.
- **Real-time Word Count**: Displays the total word count of the analyzed text.
- **Accessibility**: Full keyboard navigation support and high-contrast visible focus states.
- **Smart Caching**: Results are stored locally per URL to prevent redundant API calls.

---

## 🚀 Installation (Local / Unpacked)

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/hng-internship14/pagemind-extension.git
   ```
2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
3. **Enable Developer Mode**
   - Toggle the switch in the top-right corner.
4. **Load the extension**
   - Click **"Load unpacked"** and select the `pagemind-extension` folder.
5. **Add your OpenAI API Key**
   - Click the PageMind icon in your toolbar.
   - Enter your `sk-...` key in the setup screen.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
│                                                                 │
│  ┌──────────────┐    messages     ┌────────────────────────┐   │
│  │  popup.html  │ ──────────────► │  background/           │   │
│  │  popup.js    │ ◄────────────── │  service-worker.js     │   │
│  │  popup.css   │   summary data  │                        │   │
│  └──────────────┘                 │  • OpenAI Fetch()      │   │
│         │                         │  • Secure API Handling │   │
│         │ chrome.tabs.sendMessage  │  • Error Management    │   │
│         ▼                         └──────────┬─────────────┘   │
│  ┌──────────────────────┐                    │ fetch()         │
│  │  content/            │                    ▼                 │
│  │  content-script.js   │         ┌──────────────────────┐    │
│  │                      │         │  OpenAI API (GPT-4o)  │    │
│  │  • Content extraction│         └──────────────────────┘    │
│  │  • DOM highlighting  │                                      │
│  └──────────────────────┘         ┌────────────────────────┐   │
│                                   │  chrome.storage.local  │   │
│                                   │  • apiKey (Encrypted)  │   │
│                                   │  • cachedSummaries     │   │
│                                   └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Decisions

- **Background Execution**: All AI API calls are performed in the Background Service Worker. This ensures that the API key is never exposed to the webpage DOM or the content script environment.
- **Isolated Storage**: The API key is stored using `chrome.storage.local`, which is scoped specifically to the extension and cannot be accessed by external websites.
- **XSS Mitigation**: Generated AI content is sanitized using a dedicated utility (`utils/sanitize.js`) before being rendered into the popup UI.
- **Minimal Permissions**: Uses only the `activeTab` permission to ensure the extension only interacts with pages when the user explicitly triggers it.

---

## ⚙️ Technical Choices

- **GPT-4o-mini**: Chosen for its balance of high speed, low cost, and superior reasoning capabilities compared to smaller models.
- **JSON Response Format**: Employs OpenAI's structured output mode to ensure reliable parsing of summaries, insights, and highlighting phrases.
- **Vanilla JS & CSS**: Built without heavy frameworks to ensure a lightweight footprint and zero build-time complexity for easy inspection.

---

## 📄 License

MIT License — free to use, modify, and distribute.

## NOTE
The MIT License is not certified but only used for professional
