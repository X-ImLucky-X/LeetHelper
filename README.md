# 🚀 LeetHelper

> **An all-in-one interview preparation platform combining curated DSA sheets, company-specific question banks, and realistic coding assessments.**

LeetHelper is a highly responsive **Single Page Application (SPA)** designed to streamline technical interview preparation. Instead of switching between multiple websites for problem lists, company tags, explanations, and mock tests, LeetHelper consolidates everything into one productivity-focused interface.

Built with aspiring software engineers in mind, the platform helps users revise efficiently, target specific companies, and simulate real coding assessments under time constraints.

---

## ✨ Features

* 📚 Browse popular DSA sheets (Striver A2Z, NeetCode 150, TUF, and more)
* 🔍 Filter questions by topic and difficulty
* 📊 Visualize difficulty distributions dynamically
* 💡 Access multiple solution approaches for each problem
* 📖 View complete walkthroughs from the Doocs LeetCode repository
* 🏢 Prepare using interview questions from **650+ companies**
* ⏳ Filter company questions by interview recency
* 🧪 Take realistic timed mock assessments
* 💻 Compile and execute code directly in the browser
* 📋 Copy code snippets instantly
* 🧮 Render mathematical notations using LaTeX
* 📈 Self-evaluate performance using interactive scorecards

---

# 🏗️ Application Architecture

LeetHelper follows a modular SPA architecture:

```text
LeetHelper
│
├── Sidebar Navigation
│     ├── Sheets
│     ├── Companies
│     └── Mock Test
│
└── Main Content Viewport
      ├── DSA Revision Engine
      ├── Company Interview Explorer
      └── Assessment Simulator
```

The layout consists of:

* **Sticky Sidebar Navigation**
* **Dynamic Content Viewport**
* **Client-side View Switching**
* **On-demand Data Fetching**
* **Integrated Compiler Backend**

---

# 📚 Sheets Page

## Purpose

Acts as the primary revision hub for curated DSA sheets.

Supports collections such as:

* Striver A2Z Sheet
* NeetCode 150
* TUF Sheet
* Custom DSA Sheets

---

## Key Components

### 🗂️ Sheet Selector

Quickly switch between different preparation sheets.

---

### 🏷️ Topic Filters

Filter questions by categories including:

* Arrays
* Strings
* Linked Lists
* Trees
* Graphs
* Dynamic Programming
* Greedy
* Backtracking
* Sliding Window
* And more...

Supports:

* Single-topic filtering
* Multi-topic filtering

---

### 📊 Difficulty Dashboard

Displays real-time statistics for filtered questions.

Shows:

```text
Easy    → Count
Medium  → Count
Hard    → Count
```

---

### 📝 Interactive Question Cards

Each question card contains:

* Problem title
* Difficulty badge
* Topic labels
* Expansion controls

---

### 🔗 Practice Resources

Direct shortcuts to:

* LeetCode problem page
* Video explanations
* Written editorials

---

### 💡 Multi-Approach Solutions

View various approaches including:

```text
Brute Force
Better Solution
Optimal Solution
```

Each approach provides:

* Explanation
* Code implementation
* Time complexity
* Space complexity

---

### 📖 Doocs Walkthrough Integration

Automatically fetches detailed markdown explanations from the **Doocs LeetCode repository**.

Features:

* Full editorial walkthroughs
* Syntax-highlighted code
* Optional **C++ Only Mode**

---

### 📋 Copy-to-Clipboard

Hover over any code snippet to instantly copy it.

---

### 🧮 LaTeX Support

Mathematical expressions such as:

```text
O(N log N)
O(V + E)
2^N
```

are rendered beautifully for readability.

---

# 🏢 Companies Page

## Purpose

Focused preparation for company-specific interview rounds.

Provides access to questions asked by **650+ technology companies**.

---

## Key Components

### 🔍 Company Search

Instantly search companies including:

* Google
* Amazon
* Microsoft
* Meta
* Adobe
* Uber
* Netflix

and hundreds more.

---

### ⏳ Recency Filters

Filter questions by when they were reported:

```text
Last 30 Days
Last 3 Months
Last 6 Months
More than 6 Months
```

---

### 📈 Dynamic Question Ranking

Questions are loaded dynamically through:

```text
/api/company?name=XYZ
```

Ranking factors include:

* Interview frequency
* Priority score
* Recent appearance trends

---

### 📖 Walkthrough Support

Fetch detailed explanations using LeetCode frontend IDs.

Includes:

* Problem discussion
* Optimal solutions
* Complexity analysis

---

# 🧪 Mock Test Mode

## Purpose

Simulates realistic online coding assessments.

Designed to recreate interview pressure and improve problem-solving speed.

---

## Test Configuration

Choose question sources from:

```text
DSA Sheets
Company Questions
```

Preset modes include:

```text
Google Round
Full Assessment
Custom Assessment
```

---

## 🔒 Distraction-Free Lockout

During an active test:

* Sidebar navigation is disabled
* Browsing controls are dimmed
* Accidental exits are prevented

---

## 📝 Exam View

Displays all selected questions in an exam-focused layout.

Features:

* Expanded problem statements
* Clean reading interface
* Timer visibility

---

## ⏰ Live Countdown Timer

Tracks remaining exam duration.

Behavior:

```text
Normal State
↓
Warning State (< 5 Minutes)
↓
Red Pulsing Alert
```

---

# 💻 Sandbox Compiler

Integrated execution environment supporting:

```text
C++
Java
Python
JavaScript
```

---

## Compiler Features

### Code Editor

Write solutions directly inside the platform.

---

### Custom Input Support

Provide stdin values for testing.

---

### Output Console

Displays:

* Standard Output
* Runtime Errors
* Compilation Errors

---

### Secure Execution

Code execution is processed through the backend compiler service.

Safety measures include:

```text
5-Second Timeout
Execution Isolation
Infinite Loop Protection
```

---

# 📊 Interactive Scorecard

After submission:

* Solutions become locked
* Official editorials are revealed
* Self-assessment begins

---

## Self-Grading Options

For each question:

```text
✓ Correct
✗ Incorrect
```

---

## Performance Meter

Score visualization includes:

```text
Green Glow  → Passing (≥ 70%)
Red Glow    → Improvement Needed (< 70%)
```

---

# 🛠️ Tech Stack

## Frontend

```text
React
TypeScript
Vite
Tailwind CSS
```

---

## Backend

```text
Node.js
Express.js
```

---

## Compiler Infrastructure

```text
Sandboxed Execution Environment
5-Second Runtime Limits
stdin Support
```

---

## Additional Integrations

```text
Doocs LeetCode Repository
LaTeX Rendering Engine
Clipboard Utilities
CSV-Based Company Dataset
```

---

# 🚀 Getting Started

## Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/LeetHelper.git
```

---

## Install frontend dependencies

```bash
npm install
```

---

## Start the frontend

```bash
npm run dev
```

---

## Start the backend server

```bash
node server.js
```

---

# 🎯 Why LeetHelper?

Interview preparation often involves juggling multiple platforms:

* One for DSA sheets,
* another for company questions,
* another for explanations,
* and yet another for mock assessments.

**LeetHelper unifies the entire preparation workflow into a single, focused environment.**

It is designed to help candidates:

* Revise efficiently,
* practice strategically,
* and perform confidently during interviews.

---

# 👨‍💻 Author

**Lakshya Kumar Singh**

B.Tech CSE Student • Software Developer • Machine Learning Enthusiast

---

<div align="center">

### ⭐ If you find LeetHelper useful, consider starring the repository!

**Practice Smarter. Interview Better.**

</div>
