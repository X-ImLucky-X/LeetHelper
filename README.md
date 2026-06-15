# LeetHelper 🚀

LeetHelper is a premium, ultra-fast coding interview revision dashboard. It lets you select popular DSA sheets (like NeetCode 150 or Striver A2Z) or browse interview questions from over **650+ companies** (like Google, Amazon, Microsoft, Meta). 

Review problem descriptions, constraints, company tags, and code solutions all in one single, focused screen without clicking back and forth.

---

## Key Features

- **DSA Sheets Mode**: Browse popular curated sheets with topic filters, search, and difficulty metrics.
- **Company Interview Sheets Mode**: Explore questions asked in real interviews at **657 companies**.
  - **Timeframe Grouping**: Questions are grouped by timeframe priority (`30 Days`, `3 Months`, `6 Months`, `> 6 Months`).
  - **Frequency Sorting**: Questions are sorted inside their timeframes by interview frequency descending.
  - **Search Companies**: Search and filter through the list of 650+ companies in real-time.
- **Mock Coding Assessment Mode (New)**: Test your skills in a distraction-free, timed round.
  - **Customizable Mix**: Select presets (Standard, Google Round, Full Assessment) or configure custom Easy/Medium/Hard question counts.
  - **Live Countdown Timer**: Built-in timer with colored warnings (pulse red alert under 5 minutes) and automatic test submission on expiration.
  - **Integrated Code Editor**: Write and sketch out solutions directly in the card scratchpad. Solutions are locked during the test to prevent peeking.
  - **Self-Grading Scorecard**: Compare your code side-by-side with official optimal solutions and self-grade your answers to generate an interactive scorecard.
- **LaTeX Math Rendering**: Natively parses and renders mathematical expressions ($...$ and $$...$$) using KaTeX for crisp math formulas.
- **Code Walkthrough Solutions**: Fetches and renders detailed solutions dynamically from GitHub.
- **Copy Code Integration**: Hover over any code block in descriptions or walkthroughs to copy the code snippet to your clipboard in one click.
- **Responsive Premium Theme**: Built using a modern obsidian indigo dark mode theme with glassmorphism sidebar effects, smooth scale animations, and difficulty-based glows.

---

## Technical Stack & Architecture

LeetHelper is designed to be lightweight, portable, and extremely fast:

1. **Frontend**: Pure HTML5, CSS3 (Vanilla), and Vanilla JavaScript.
   - External libraries loaded via CDN: `marked.js` (Markdown parsing) and `katex.js` (Math formula rendering).
   - Optimizations: Render-limiting (only renders 50 company list items at a time) and search input debouncing (120ms) to ensure smooth layout rendering.
2. **Backend**: A minimal Node.js HTTP server (`server.js`) with **zero npm dependencies**.
   - Serves static assets.
   - Exposes REST API endpoints `/api/companies` and `/api/company` to parse CSV directories on the fly.
   - **In-Memory Caching**: Caches parsed lists in memory so subsequent company loads serve in less than 1ms.

---

## How to Run Locally

Since LeetHelper has no build step and zero external npm dependencies, running it is simple:

1. Clone or download this folder.
2. Ensure you have [Node.js](https://nodejs.org/) installed.
3. Open a terminal inside the project directory and run:
   ```bash
   node server.js
   ```
4. Open your browser and navigate to:
   ```
   http://127.0.0.1:5173
   ```

---

## How to Publish & Share

Since LeetHelper is a self-contained Node.js web app, you can easily host it for free so anyone can use it.

### Option 1: Render (Recommended - Free)
1. Push this repository to your GitHub account (see instructions below).
2. Go to [Render](https://render.com/) and log in with GitHub.
3. Click **New** -> **Web Service**.
4. Connect this repository.
5. Set the settings:
   - **Environment**: `Node`
   - **Build Command**: (leave blank or `npm install` though there are no dependencies)
   - **Start Command**: `node server.js`
6. Render will assign a free `onrender.com` URL (e.g., `https://leethelper.onrender.com`) that anyone can open in their browser!

### Option 2: Heroku
1. Create a Heroku account and click **Create New App**.
2. Connect your GitHub repository.
3. Under the **Deploy** tab, select **Enable Automatic Deploys** and click **Deploy Branch**.
4. Heroku will read the `package.json` start command and serve the app.

---

## Committing and Pushing to GitHub

Run these commands in your terminal to initialize git, commit the clean files, and push to your GitHub repository:

```bash
# Initialize git (if not already done)
git init

# Stage all files (excluding folders in .gitignore)
git add .

# Create the initial commit
git commit -m "Initial commit: Redesigned LeetHelper with companywise questions, KaTeX math rendering, and copy code feature"

# Add your GitHub remote repository (replace with your actual repo link)
git remote add origin https://github.com/YOUR_USERNAME/LeetHelper.git

# Rename branch to main
git branch -M main

# Push the code to GitHub
git push -u origin main
```
