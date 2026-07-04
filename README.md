# BigQuery Release Pulse

A premium, interactive web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that aggregates, filters, and shares Google Cloud BigQuery release notes.

## 🚀 Features

- **Dual-Mode Sync**:
  - **Live Sync**: Fetches the official Google Cloud BigQuery release notes Atom feed (`https://cloud.google.com/feeds/bigquery-release-notes.xml`) in real-time.
  - **Fidelity Fallback**: If the feed rate-limits the requests (returns HTTP 429 Captcha blocks) or is offline, the backend seamlessly falls back to a high-fidelity local cache of recent releases. A pulsing header indicator shows the sync state (Live Sync vs Cached Mode).
- **Interactive Insights Panel**: Displays real-time metrics of updates, calculating counts and percentages of Features, Fixes, and Announcements with animated sidebar charts.
- **Advanced Searching & Tag Filtering**:
  - Instantly search all releases by keywords, components, or categories.
  - Toggle tags to filter by release types (Features, Fixes, Changes, Deprecations).
  - Sort release timelines by Newest or Oldest first.
- **Bookmarks/Starring**: Star important updates to save them to local storage. View them anytime in the "Starred Updates" tab.
- **Detailed View Modal**: Click on any update card to view full details, category tags, calendar dates, and direct links to the official Google Cloud source documentation.
- **Twitter Composer & Preview Card**:
  - Click the **Tweet** button on any update card or inside the modal to open a custom Tweet Composer.
  - Pre-drafts a tweet using the update content, appropriate hashtags (`#BigQuery #GoogleCloud`), and category hashtags.
  - Tracks character length (280-character limit indicator) and alerts if it's too long.
  - Generates a Twitter Web Intent link to share on your feed instantly.
- **Design & Aesthetics**:
  - Glassmorphic panels with backdrop blurs.
  - Rich dark theme (default) and clean light theme toggle.
  - Dynamic micro-animations, hover scaling, and timeline node markers.
  - Fully responsive grid layout for desktop, tablet, and mobile.

---

## 📁 Project Structure

```text
bigquery_release_notes/
├── app.py                 # Flask server, Atom XML parser, and fallback cache
├── README.md              # Documentation and running instructions
├── templates/
│   └── index.html         # HTML layout, modals, and templates
└── static/
    ├── css/
    │   └── style.css      # Vanilla CSS styles, variables, transitions, and dark/light modes
    └── js/
        └── main.js        # Client-side state, filters, theme toggle, and Twitter Composer
```

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have Python 3.8+ installed on your machine. You will also need `Flask` and `BeautifulSoup4` which are used for the backend:
```bash
pip install Flask beautifulsoup4
```

### 2. Running the Server
From the root of the project directory (`C:\Users\Singama\bigquery_release_notes`), run:
```bash
python app.py
```

### 3. Open the App
Open your favorite web browser and navigate to:
```text
http://127.0.0.1:5000
```

---

## 📝 Technologies Used
1. **Backend**: Python 3, Flask, standard XML parser, BeautifulSoup4
2. **Frontend**: HTML5, Vanilla JavaScript, CSS3 variables, FontAwesome Icons, Google Fonts (Outfit, Inter)
