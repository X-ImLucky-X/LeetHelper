// Global error listener to display errors directly on the screen
window.addEventListener("error", (event) => {
  let errBox = document.getElementById("error-boundary-toast");
  if (!errBox) {
    errBox = document.createElement("div");
    errBox.id = "error-boundary-toast";
    errBox.style.cssText = "position:fixed;bottom:20px;left:20px;right:20px;background:#ef4444;color:white;padding:16px;border-radius:8px;z-index:99999;font-family:monospace;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,0.5);line-height:1.4;word-break:break-all;";
    document.body.appendChild(errBox);
  }
  errBox.innerHTML = `<strong>Runtime Error:</strong><br>${event.message}<br><small>at ${event.filename}:${event.lineno}:${event.colno}</small>`;
});

if (typeof REVISION_SHEETS === "undefined" || !REVISION_SHEETS || REVISION_SHEETS.length === 0) {
  const showError = () => {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "padding: 40px; text-align: center; color: #ef4444; font-family: sans-serif; max-width: 600px; margin: 80px auto; border: 1px solid #ef4444; border-radius: 8px; background: rgba(239, 68, 68, 0.1);";
    errorDiv.innerHTML = `
      <h2>Failed to load dataset</h2>
      <p>The file <code>data.js</code> could not be loaded, parsed, or is empty.</p>
      <p>Please check the browser console or make sure <code>data.js</code> is valid.</p>
    `;
    document.body.replaceChildren(errorDiv);
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", showError);
  } else {
    showError();
  }
  throw new Error("REVISION_SHEETS is not defined or is empty in data.js");
}

const ITEMS_PER_PAGE = 35;

const state = {
  mode: "sheets", // "sheets", "companies", or "test"
  sheetId: REVISION_SHEETS[0].id,
  topics: new Set(),
  search: "",
  showOptimalFirst: true,
  renderLimit: ITEMS_PER_PAGE,
  
  // Company state
  companies: [],
  companySearch: "",
  selectedCompanyId: null,
  companyQuestions: [],
  timeFilters: new Set(),

  // Mock Test state
  testActive: false,
  testTimerInterval: null,
  testRemainingSeconds: 0,
  testQuestions: [],
  testAnswers: {},
  testSelectedLangs: {},
  testGrades: {}
};

const sheetList = document.querySelector("#sheetList");
const topicList = document.querySelector("#topicList");
const questionGrid = document.querySelector("#questionGrid");
const activeSheetLabel = document.querySelector("#activeSheet");
const topicHeading = document.querySelector("#topicHeading");
const searchInput = document.querySelector("#searchInput");
const showOptimalFirstInput = document.querySelector("#showOptimalFirst");
const cardTemplate = document.querySelector("#questionCardTemplate");

function currentSheet() {
  return REVISION_SHEETS.find((sheet) => sheet.id === state.sheetId);
}

function getDoocsSolutionsUrl(question) {
  if (!question.frontendId) return null;
  const idStr = String(question.frontendId).padStart(4, '0');
  const lowerBound = Math.floor(question.frontendId / 100) * 100;
  const upperBound = lowerBound + 99;
  const rangeStr = String(lowerBound).padStart(4, '0') + '-' + String(upperBound).padStart(4, '0');
  
  const titleForFolder = question.officialTitle || question.title;
  const folderName = `${idStr}.${titleForFolder}`;
  return `https://raw.githubusercontent.com/doocs/leetcode/main/solution/${rangeStr}/${encodeURIComponent(folderName)}/README_EN.md`;
}

function getTopics(sheet) {
  return [...new Set(sheet.questions.map((question) => question.topic))];
}

function selectSheet(sheetId) {
  state.sheetId = sheetId;
  state.topics = new Set();
  state.search = "";
  state.renderLimit = ITEMS_PER_PAGE;
  searchInput.value = "";
  render();
}

function showAllTopics() {
  state.topics = new Set();
  state.renderLimit = ITEMS_PER_PAGE;
  render();
}

function toggleTopic(topic) {
  if (state.topics.has(topic)) {
    state.topics.delete(topic);
  } else {
    state.topics.add(topic);
  }
  state.renderLimit = ITEMS_PER_PAGE;
  render();
}

function filteredQuestions() {
  const term = state.search.trim().toLowerCase();
  return currentSheet().questions.filter((question) => {
    const isTopicMatch = state.topics.size === 0 || state.topics.has(question.topic);
    const isSearchMatch =
      !term ||
      [question.title, question.topic, question.difficulty, ...question.tags]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return isTopicMatch && isSearchMatch;
  });
}

function renderSheets() {
  sheetList.replaceChildren(
    ...REVISION_SHEETS.map((sheet) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `sheet-button${sheet.id === state.sheetId ? " active" : ""}`;
      button.innerHTML = `<span>${sheet.name}</span><span>${sheet.questions.length}</span>`;
      button.title = sheet.description;
      button.addEventListener("click", () => selectSheet(sheet.id));
      return button;
    })
  );
}

function renderTopics() {
  const sheet = currentSheet();
  const topics = getTopics(sheet);
  const allTopicsButton = document.createElement("button");
  allTopicsButton.type = "button";
  allTopicsButton.className = `topic-button${state.topics.size === 0 ? " active" : ""}`;
  allTopicsButton.innerHTML = `<span>All topics</span><span>${sheet.questions.length}</span>`;
  allTopicsButton.addEventListener("click", showAllTopics);

  topicList.replaceChildren(
    allTopicsButton,
    ...topics.map((topic) => {
      const count = sheet.questions.filter((question) => question.topic === topic).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `topic-button${state.topics.has(topic) ? " active" : ""}`;
      button.innerHTML = `<span>${topic}</span><span>${count}</span>`;
      button.addEventListener("click", () => toggleTopic(topic));
      return button;
    })
  );
}

function renderStats(questions) {
  const easy = questions.filter(q => q.difficulty.toLowerCase() === "easy").length;
  const medium = questions.filter(q => q.difficulty.toLowerCase() === "medium").length;
  const hard = questions.filter(q => q.difficulty.toLowerCase() === "hard").length;

  document.querySelector("#totalCount").textContent = questions.length;
  document.querySelector("#easyCount").textContent = easy;
  document.querySelector("#mediumCount").textContent = medium;
  document.querySelector("#hardCount").textContent = hard;
}

function orderedSolutions(question) {
  if (!state.showOptimalFirst) {
    return question.solutions;
  }
  return [...question.solutions].sort((left, right) => {
    const leftOptimal = left.label.toLowerCase().includes("optimal") ? -1 : 0;
    const rightOptimal = right.label.toLowerCase().includes("optimal") ? -1 : 0;
    return leftOptimal - rightOptimal;
  });
}

function addCopyButtons(container) {
  const preElements = container.querySelectorAll("pre");
  preElements.forEach((pre) => {
    if (pre.querySelector(".copy-code-btn")) return;

    pre.style.position = "relative";
    
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-code-btn";
    btn.innerHTML = `
      <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      <span>Copy</span>
    `;
    
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const code = pre.querySelector("code")?.innerText || pre.innerText.replace(/Copy\s*$/i, "");
      navigator.clipboard.writeText(code.trim()).then(() => {
        btn.classList.add("copied");
        btn.innerHTML = `
          <svg class="check-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Copied!</span>
        `;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          `;
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy text: ", err);
      });
    });

    pre.appendChild(btn);
  });
}

function renderMath(container) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(container, {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\(", right: "\\)", display: false},
        {left: "\\[", right: "\\]", display: true}
      ],
      throwOnError: false
    });
  }
}

function renderQuestion(question) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const difficulty = node.querySelector(".difficulty");
  const titleText = node.querySelector(".question-title-text");
  const topicBadge = node.querySelector(".question-topic-badge");
  const meta = node.querySelector(".question-meta");
  const tabs = node.querySelector(".solution-tabs");
  const panel = node.querySelector(".solution-panel");
  const solutions = [...orderedSolutions(question)];
  if (question.frontendId) {
    solutions.push({
      label: "All Approaches (Walkthrough)",
      isWalkthrough: true,
      idea: "",
      time: "",
      space: ""
    });
  }

  difficulty.textContent = question.difficulty;
  difficulty.classList.add(question.difficulty.toLowerCase());
  
  titleText.textContent = question.title;
  topicBadge.textContent = question.topic;
  meta.textContent = question.tags.join(", ");

  // Render external link buttons
  const linksContainer = node.querySelector(".external-links");
  linksContainer.replaceChildren();

  if (question.url) {
    const btn = document.createElement("a");
    btn.href = question.url;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "link-btn practice-link";
    btn.innerHTML = `<span>Practice</span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;
    linksContainer.appendChild(btn);
  }

  if (question.yt_link) {
    const btn = document.createElement("a");
    btn.href = question.yt_link;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "link-btn video-link";
    btn.innerHTML = `<span>Watch Video</span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    linksContainer.appendChild(btn);
  } else if (question.nurl) {
    const btn = document.createElement("a");
    btn.href = question.nurl;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "link-btn video-link neetcode-link";
    btn.innerHTML = `<span>Video Solution</span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    linksContainer.appendChild(btn);
  }

  if (question.post_link) {
    const btn = document.createElement("a");
    btn.href = question.post_link;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "link-btn article-link";
    btn.innerHTML = `<span>Read Article</span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    linksContainer.appendChild(btn);
  }

  if (question.plus_link) {
    const btn = document.createElement("a");
    btn.href = question.plus_link;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "link-btn plus-link";
    btn.innerHTML = `<span>TUF Plus</span><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    linksContainer.appendChild(btn);
  }

  // Populate Topics panel
  const topicsBtn = node.querySelector(".topics-btn");
  const topicsPanel = node.querySelector(".topics-panel");

  if (question.topicTags && question.topicTags.length) {
    topicsPanel.replaceChildren(
      ...question.topicTags.map(tag => {
        const span = document.createElement("span");
        span.className = "topic-tag-chip";
        span.textContent = tag;
        return span;
      })
    );
  } else {
    topicsPanel.innerHTML = `<span class="muted-text">No topic tags available.</span>`;
  }

  // Toggle Panels (stopPropagation prevents the card from collapsing)
  topicsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = topicsPanel.classList.toggle("hidden");
    topicsBtn.classList.toggle("active", !isHidden);
  });

  // Render description HTML
  const contentHtml = node.querySelector(".problem-content-html");
  if (question.content) {
    contentHtml.innerHTML = question.content;
  } else {
    contentHtml.innerHTML = `<p>${question.summary}</p>`;
  }

  // Expand/Collapse Card on Header click
  const toggleExpand = (e) => {
    if (e.target.closest("a") || e.target.closest("input") || e.target.closest(".badge-btn") || e.target.closest(".solution-tab") || e.target.closest(".copy-code-btn")) {
      return;
    }
    const isExpanded = node.classList.toggle("expanded");
    node.classList.toggle("collapsed");
    if (isExpanded) {
      addCopyButtons(node);
      // Compile LaTeX math ONLY when first expanded
      if (!contentHtml.classList.contains("math-rendered")) {
        renderMath(contentHtml);
        contentHtml.classList.add("math-rendered");
      }
      // Compile solution panel math ONLY when expanded and not already rendered
      if (!panel.classList.contains("math-rendered") && !panel.querySelector(".walkthrough-loader")) {
        renderMath(panel);
        panel.classList.add("math-rendered");
      }
    }
  };

  node.querySelector(".card-main-header").addEventListener("click", toggleExpand);

  function selectSolution(solution) {
    tabs.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.label === solution.label);
    });

    if (solution.isWalkthrough) {
      panel.innerHTML = `
        <div class="walkthrough-loader">
          <p class="muted-text">Loading detailed walkthrough from GitHub... ⏳</p>
        </div>
      `;
      
      const url = getDoocsSolutionsUrl(question);
      if (!url) {
        panel.innerHTML = `<p class="muted-text">Detailed walkthrough not available.</p>`;
        return;
      }

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.text();
        })
        .then(markdown => {
          const parts = markdown.split(/^## Solutions?|^## 解法/im);
          const solutionsMarkdown = parts[1] || parts[0];
          
          let html = "";
          if (typeof marked !== 'undefined') {
            if (typeof marked.parse === 'function') {
              html = marked.parse(solutionsMarkdown);
            } else if (typeof marked === 'function') {
              html = marked(solutionsMarkdown);
            } else {
              html = `<pre>${solutionsMarkdown}</pre>`;
            }
          } else {
            html = `<pre>${solutionsMarkdown}</pre>`;
          }
          
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = html;
          
          panel.innerHTML = `
            <div class="split-pane-layout">
              <div class="solution-strategy-pane"></div>
              <div class="solution-code-pane">
                <div class="walkthrough-header-row">
                  <label class="cpp-toggle-label">
                    <input type="checkbox" class="cpp-only-toggle" checked />
                    Show C++ Only
                  </label>
                </div>
                <div class="walkthrough-code-content"></div>
              </div>
            </div>
          `;

          const strategyPane = panel.querySelector(".solution-strategy-pane");
          const codeContent = panel.querySelector(".walkthrough-code-content");

          Array.from(tempDiv.childNodes).forEach(child => {
            const tag = child.tagName;
            const text = child.textContent ? child.textContent.trim().toLowerCase() : "";
            const isCodeOrLangHeader = tag === "PRE" || (tag === "H4" && ["c++", "cpp", "java", "python", "python3", "go", "golang", "rust", "typescript", "ts", "javascript", "js", "c#", "csharp", "c", "php", "swift", "kotlin", "scala", "ruby", "sql"].includes(text));
            
            if (isCodeOrLangHeader) {
              codeContent.appendChild(child);
            } else {
              strategyPane.appendChild(child);
            }
          });

          const toggle = panel.querySelector(".cpp-only-toggle");

          function applyCppFilter() {
            const cppOnly = toggle.checked;
            const headers = codeContent.querySelectorAll("h4");
            
            let hasCppHeader = false;
            headers.forEach(h4 => {
              const lang = h4.textContent.trim().toLowerCase();
              if (lang === "c++" || lang === "cpp") {
                hasCppHeader = true;
              }
            });

            let warningBox = codeContent.querySelector(".cpp-unavailable-warning");
            if (cppOnly && !hasCppHeader && headers.length > 0) {
              if (!warningBox) {
                warningBox = document.createElement("div");
                warningBox.className = "cpp-unavailable-warning";
                warningBox.style.cssText = "padding: 10px 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; color: #fbbf24; font-size: 0.85rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-weight: 500;";
                warningBox.innerHTML = `<span>⚠️ C++ solution is not available for this problem. Showing other languages instead.</span>`;
                codeContent.insertBefore(warningBox, codeContent.firstChild);
              }
              headers.forEach(h4 => {
                h4.style.display = "";
                const nextPre = h4.nextElementSibling;
                if (nextPre && nextPre.tagName === "PRE") nextPre.style.display = "";
              });
              return;
            } else {
              if (warningBox) {
                warningBox.remove();
              }
            }

            headers.forEach(h4 => {
              const lang = h4.textContent.trim().toLowerCase();
              if (["c++", "cpp", "java", "python", "python3", "go", "golang", "rust", "typescript", "ts", "javascript", "js", "c#", "csharp", "c", "php", "swift", "kotlin", "scala", "ruby", "sql"].includes(lang)) {
                if (lang === "c++" || lang === "cpp") {
                  h4.style.display = "";
                  const nextPre = h4.nextElementSibling;
                  if (nextPre && nextPre.tagName === "PRE") nextPre.style.display = "";
                } else {
                  h4.style.display = cppOnly ? "none" : "";
                  const nextPre = h4.nextElementSibling;
                  if (nextPre && nextPre.tagName === "PRE") nextPre.style.display = cppOnly ? "none" : "";
                }
              }
            });
          }

          toggle.addEventListener("change", applyCppFilter);
          applyCppFilter();
          addCopyButtons(panel);
          renderMath(panel);
          panel.classList.add("math-rendered");
        })
        .catch(err => {
          console.error("Walkthrough load error:", err);
          panel.innerHTML = `
            <p class="muted-text">Failed to load detailed walkthrough from GitHub.</p>
            <p class="muted-text" style="font-size:0.82rem; color:var(--danger)">Error: ${err.message}</p>
            <p class="muted-text" style="font-size:0.82rem">Attempted URL: <a href="${url}" target="_blank" style="color:var(--accent); text-decoration:underline">${url}</a></p>
            <p class="muted-text">You can practice the problem directly on LeetCode using the link above.</p>
          `;
        });
    } else {
      panel.innerHTML = `
        <div class="split-pane-layout">
          <div class="solution-strategy-pane">
            <h3>${solution.label} Approach</h3>
            <p>${solution.idea}</p>
            <div class="complexity">
              <span>Time: ${solution.time}</span>
              <span>Space: ${solution.space}</span>
            </div>
          </div>
          <div class="solution-code-pane empty-code-pane">
            <div class="no-code-message">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="muted-icon"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              <p class="muted-text">Full solution code is available in the <strong>All Approaches (Walkthrough)</strong> tab.</p>
              <p class="muted-text" style="font-size: 0.82rem; margin-top: 4px;">Or practice directly on LeetCode by clicking the button below.</p>
              ${question.url ? `<a href="${question.url}" target="_blank" rel="noopener noreferrer" class="link-btn practice-link" style="margin-top: 16px; width: fit-content; align-self: center;"><span>Practice Now</span></a>` : ""}
            </div>
          </div>
        </div>
      `;
      addCopyButtons(panel);
      if (node.classList.contains("expanded")) {
        renderMath(panel);
        panel.classList.add("math-rendered");
      } else {
        panel.classList.remove("math-rendered");
      }
    }
  }

  tabs.replaceChildren(
    ...solutions.map((solution) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "solution-tab";
      button.dataset.label = solution.label;
      button.textContent = solution.label;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        selectSolution(solution);
      });
      return button;
    })
  );

  selectSolution(solutions[0]);
  return node;
}

function renderQuestions(questions) {
  if (!questions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No questions match this focus. Try another topic or search term.";
    questionGrid.replaceChildren(empty);
    return;
  }

  // If in company mode, render the Priority Slicing Table Grid!
  if (state.mode === "companies") {
    const tableContainer = document.createElement("div");
    tableContainer.className = "company-table-container";
    
    const table = document.createElement("table");
    table.className = "company-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Difficulty</th>
          <th>Timeframe</th>
          <th>Frequency</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    
    const tbody = table.querySelector("tbody");
    
    const hasMore = questions.length > state.renderLimit;
    const visibleQs = hasMore ? questions.slice(0, state.renderLimit) : questions;
    
    visibleQs.forEach((q) => {
      const tr = document.createElement("tr");
      tr.className = `company-row-item${q.id === state.activeDrawerQuestionId ? " active-row" : ""}`;
      
      const freqTag = q.tags.find(t => t.startsWith("Freq:"));
      const freqVal = freqTag ? freqTag.replace("Freq:", "").trim() : "N/A";
      
      tr.innerHTML = `
        <td class="col-id">#${q.frontendId || "N/A"}</td>
        <td class="col-title">${q.title}</td>
        <td class="col-difficulty"><span class="difficulty-chip ${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
        <td class="col-timeframe">${q.topic}</td>
        <td class="col-freq">${freqVal}</td>
      `;
      
      tr.addEventListener("click", () => {
        // Highlight active row
        tbody.querySelectorAll(".active-row").forEach(r => r.classList.remove("active-row"));
        tr.classList.add("active-row");
        state.activeDrawerQuestionId = q.id;
        openQuestionInDrawer(q);
      });
      
      tbody.appendChild(tr);
    });
    
    tableContainer.appendChild(table);
    
    const children = [tableContainer];
    
    if (hasMore) {
      const footer = document.createElement("div");
      footer.className = "load-more-container";
      
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "load-more-btn";
      btn.innerHTML = `
        <span>Load More (${questions.length - state.renderLimit} remaining)</span>
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.renderLimit += ITEMS_PER_PAGE;
        renderQuestions(filteredCompanyQuestions());
      });
      footer.appendChild(btn);
      children.push(footer);
    }
    
    questionGrid.replaceChildren(...children);
    return;
  }

  const hasMore = questions.length > state.renderLimit;
  const visibleQs = hasMore ? questions.slice(0, state.renderLimit) : questions;

  const children = [];

  if (state.topics.size === 1) {
    children.push(...visibleQs.map(renderQuestion));
  } else {
    const groups = {};
    visibleQs.forEach((q) => {
      if (!groups[q.topic]) {
        groups[q.topic] = [];
      }
      groups[q.topic].push(q);
    });

    for (const topic in groups) {
      const header = document.createElement("div");
      header.className = "topic-group-header";

      const topicQuestionsCount = state.mode === "sheets"
        ? currentSheet().questions.filter((q) => q.topic === topic).length
        : state.companyQuestions.filter((q) => q.topic === topic).length;

      header.innerHTML = `
        <h3>${topic}</h3>
        <span class="topic-count-badge">${topicQuestionsCount} Questions</span>
      `;
      children.push(header);

      groups[topic].forEach((q) => {
        children.push(renderQuestion(q));
      });
    }
  }

  if (hasMore) {
    const footer = document.createElement("div");
    footer.className = "load-more-container";
    
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "load-more-btn";
    btn.innerHTML = `
      <span>Load More (${questions.length - state.renderLimit} remaining)</span>
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;
    btn.addEventListener("click", () => {
      state.renderLimit += ITEMS_PER_PAGE;
      if (state.mode === "sheets") {
        renderQuestions(filteredQuestions());
      } else {
        renderQuestions(filteredCompanyQuestions());
      }
    });
    footer.appendChild(btn);
    children.push(footer);
  }

  questionGrid.replaceChildren(...children);
}

function renderHeader() {
  const sheet = currentSheet();
  activeSheetLabel.textContent = sheet.name;
  topicHeading.textContent =
    state.topics.size === 0
      ? "All topics"
      : [...state.topics].join(", ");
}

function render() {
  if (state.mode === "sheets") {
    const questions = filteredQuestions();
    renderSheets();
    renderTopics();
    renderHeader();
    renderStats(questions);
    renderQuestions(questions);
  } else if (state.mode === "companies") {
    const questions = filteredCompanyQuestions();
    renderCompanies();
    renderTimeFilters();
    renderCompanyHeader();
    renderStats(questions);
    renderQuestions(questions);
  } else if (state.mode === "test") {
    renderTestOnboarding();
  }
}

// Company Helper Functions
function filteredCompanyQuestions() {
  const term = state.search.trim().toLowerCase();
  return state.companyQuestions.filter(q => {
    const isTimeMatch = state.timeFilters.size === 0 || state.timeFilters.has(q.topic);
    const isSearchMatch =
      !term ||
      [q.title, q.topic, q.difficulty, ...q.tags]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return isTimeMatch && isSearchMatch;
  });
}

function renderCompanies() {
  const term = state.companySearch.trim().toLowerCase();
  const filtered = state.companies.filter(c => c.name.toLowerCase().includes(term));
  
  const companyList = document.querySelector("#companyList");
  if (!filtered.length) {
    companyList.innerHTML = `<p class="muted-text" style="font-size:0.85rem; padding:8px 12px;">No companies found</p>`;
    return;
  }
  
  const limit = 50;
  const itemsToShow = filtered.slice(0, limit);
  
  companyList.replaceChildren(
    ...itemsToShow.map(c => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `company-button${c.id === state.selectedCompanyId ? " active" : ""}`;
      button.innerHTML = `<span>${c.name}</span>`;
      button.addEventListener("click", () => selectCompany(c.id));
      return button;
    })
  );
  
  if (filtered.length > limit) {
    const moreIndicator = document.createElement("p");
    moreIndicator.className = "muted-text";
    moreIndicator.style.cssText = "font-size:0.75rem; text-align:center; padding:6px; margin:4px 0 0 0; border-top:1px solid var(--panel-border); background:rgba(0,0,0,0.1);";
    moreIndicator.textContent = `+ ${filtered.length - limit} more (refine search)`;
    companyList.appendChild(moreIndicator);
  }
}

function selectCompany(companyId) {
  state.selectedCompanyId = companyId;
  state.renderLimit = ITEMS_PER_PAGE;
  
  if (companyList) {
    companyList.classList.remove("active");
  }
  
  const company = state.companies.find(c => c.id === companyId);
  if (company && companySearchInput) {
    companySearchInput.value = company.name;
    state.companySearch = company.name;
  }
  
  const grid = document.querySelector("#questionGrid");
  grid.innerHTML = `<div class="empty-state"><p class="muted-text">Loading company questions... ⏳</p></div>`;
  
  fetch(`/api/company?name=${companyId}`)
    .then(res => {
      if (!res.ok) throw new Error("Status " + res.status);
      return res.json();
    })
    .then(data => {
      state.companyQuestions = data;
      state.timeFilters = new Set();
      render();
    })
    .catch(err => {
      console.error(err);
      grid.innerHTML = `<div class="empty-state"><p class="muted-text" style="color:var(--danger)">Failed to load questions: ${err.message}</p></div>`;
    });
}

function openQuestionInDrawer(q) {
  if (!rightDrawer || !drawerTitle || !drawerContent) return;
  
  drawerTitle.textContent = q.title;
  
  // Render the question card
  const card = renderQuestion(q);
  
  // Make sure it is expanded inside the drawer
  card.classList.remove("collapsed");
  card.classList.add("expanded");
  card.classList.add("in-drawer");
  
  drawerContent.replaceChildren(card);
  
  // Compile math and show copy buttons
  addCopyButtons(card);
  const contentHtml = card.querySelector(".problem-content-html");
  if (contentHtml && !contentHtml.classList.contains("math-rendered")) {
    renderMath(contentHtml);
    contentHtml.classList.add("math-rendered");
  }
  const panel = card.querySelector(".solution-panel");
  if (panel && !panel.classList.contains("math-rendered") && !panel.querySelector(".walkthrough-loader")) {
    renderMath(panel);
    panel.classList.add("math-rendered");
  }
  
  rightDrawer.classList.add("open");
}

function renderTimeFilters() {
  const list = document.querySelector("#timeFilterList");
  const timeframes = ["30 Days", "3 Months", "6 Months", "> 6 Months"];
  
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `topic-button${state.timeFilters.size === 0 ? " active" : ""}`;
  allBtn.innerHTML = `<span>All time</span><span>${state.companyQuestions.length}</span>`;
  allBtn.addEventListener("click", () => {
    state.timeFilters = new Set();
    state.renderLimit = ITEMS_PER_PAGE;
    render();
  });
  
  list.replaceChildren(
    allBtn,
    ...timeframes.map(tf => {
      const count = state.companyQuestions.filter(q => q.topic === tf).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `topic-button${state.timeFilters.has(tf) ? " active" : ""}`;
      button.innerHTML = `<span>${tf}</span><span>${count}</span>`;
      button.addEventListener("click", () => toggleTimeFilter(tf));
      return button;
    })
  );
}

function toggleTimeFilter(tf) {
  if (state.timeFilters.has(tf)) {
    state.timeFilters.delete(tf);
  } else {
    state.timeFilters.add(tf);
  }
  state.renderLimit = ITEMS_PER_PAGE;
  render();
}

function renderCompanyHeader() {
  const activeSheetLabel = document.querySelector("#activeSheet");
  const topicHeading = document.querySelector("#topicHeading");
  const company = state.companies.find(c => c.id === state.selectedCompanyId);
  
  activeSheetLabel.textContent = company ? `${company.name} Interview Questions` : "Company Questions";
  topicHeading.textContent =
    state.timeFilters.size === 0
      ? "All timeframes"
      : [...state.timeFilters].join(", ");
}

function initCompanies() {
  fetch("/api/companies")
    .then(res => res.json())
    .then(data => {
      state.companies = data;
      if (data.length > 0 && !state.selectedCompanyId) {
        state.selectedCompanyId = data[0].id;
      }
      populateTestSourceDropdown();
    })
    .catch(err => console.error("Failed to load companies list:", err));
}

// Sidebar Tab Selectors
const tabSheets = document.querySelector("#tabSheets");
const tabCompanies = document.querySelector("#tabCompanies");
const tabTest = document.querySelector("#tabTest");
const sheetsSection = document.querySelector("#sheetsSection");
const companiesSection = document.querySelector("#companiesSection");
const testSection = document.querySelector("#testSection");
const companySearchInput = document.querySelector("#companySearchInput");
const companyList = document.querySelector("#companyList");
const rightDrawer = document.querySelector("#rightDrawer");
const drawerTitle = document.querySelector("#drawerTitle");
const drawerContent = document.querySelector("#drawerContent");
const closeDrawerBtn = document.querySelector("#closeDrawerBtn");

tabSheets.addEventListener("click", () => {
  if (state.testActive) return;
  if (rightDrawer) rightDrawer.classList.remove("open");
  tabSheets.classList.add("active");
  tabCompanies.classList.remove("active");
  tabTest.classList.remove("active");
  sheetsSection.classList.remove("hidden");
  companiesSection.classList.add("hidden");
  testSection.classList.add("hidden");
  
  state.mode = "sheets";
  state.search = "";
  state.renderLimit = ITEMS_PER_PAGE;
  searchInput.value = "";
  render();
});

tabCompanies.addEventListener("click", () => {
  if (state.testActive) return;
  if (rightDrawer) rightDrawer.classList.remove("open");
  tabCompanies.classList.add("active");
  tabSheets.classList.remove("active");
  tabTest.classList.remove("active");
  companiesSection.classList.remove("hidden");
  sheetsSection.classList.add("hidden");
  testSection.classList.add("hidden");
  
  state.mode = "companies";
  state.search = "";
  state.renderLimit = ITEMS_PER_PAGE;
  searchInput.value = "";
  
  if (state.companyQuestions.length === 0 && state.selectedCompanyId) {
    selectCompany(state.selectedCompanyId);
  } else {
    render();
  }
});

tabTest.addEventListener("click", () => {
  if (state.testActive) return;
  if (rightDrawer) rightDrawer.classList.remove("open");
  tabTest.classList.add("active");
  tabSheets.classList.remove("active");
  tabCompanies.classList.remove("active");
  testSection.classList.remove("hidden");
  sheetsSection.classList.add("hidden");
  companiesSection.classList.add("hidden");
  
  state.mode = "test";
  state.search = "";
  state.renderLimit = ITEMS_PER_PAGE;
  searchInput.value = "";
  render();
});

// Mock Test Settings Observers
const testMixSelect = document.querySelector("#testMixSelect");
const customMixGroup = document.querySelector("#customMixGroup");
const startTestBtn = document.querySelector("#startTestBtn");
const submitTestBtn = document.querySelector("#submitTestBtn");
const exitTestBtn = document.querySelector("#exitTestBtn");

testMixSelect.addEventListener("change", (e) => {
  if (e.target.value === "custom") {
    customMixGroup.classList.remove("hidden");
  } else {
    customMixGroup.classList.add("hidden");
  }
});

startTestBtn.addEventListener("click", startMockTest);
submitTestBtn.addEventListener("click", () => submitMockTest(false));
exitTestBtn.addEventListener("click", exitMockTest);

// Mock Test Features & Core Functions
function populateTestSourceDropdown() {
  const select = document.querySelector("#testSourceSelect");
  if (!select) return;
  
  const options = [];
  
  // Add sheets
  REVISION_SHEETS.forEach(sheet => {
    const opt = document.createElement("option");
    opt.value = `sheet-${sheet.id}`;
    opt.textContent = `Sheet: ${sheet.name}`;
    options.push(opt);
  });
  
  // Add companies
  state.companies.forEach(company => {
    const opt = document.createElement("option");
    opt.value = `company-${company.id}`;
    opt.textContent = `Company: ${company.name}`;
    options.push(opt);
  });
  
  select.replaceChildren(...options);
}

function renderTestOnboarding() {
  const activeSheetLabel = document.querySelector("#activeSheet");
  const topicHeading = document.querySelector("#topicHeading");
  const grid = document.querySelector("#questionGrid");
  
  activeSheetLabel.textContent = "Assessments & Mock Rounds";
  topicHeading.textContent = "Prepare under real-world pressure";
  
  document.querySelector("#totalCount").textContent = "0";
  document.querySelector("#easyCount").textContent = "0";
  document.querySelector("#mediumCount").textContent = "0";
  document.querySelector("#hardCount").textContent = "0";
  
  grid.innerHTML = `
    <div class="empty-state" style="text-align: left; padding: 40px; max-width: 650px; margin: 0 auto; line-height: 1.6;">
      <h3 style="font-family: var(--font-heading); font-size: 1.4rem; color: var(--text-primary); margin-top: 0; margin-bottom: 12px; font-weight: 800;">
        Mock Assessment Mode
      </h3>
      <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.95rem;">
        Simulate an actual technical phone screen or onsite coding round. Choose a question source and difficulty preset in the sidebar, set your target timer, and start.
      </p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); padding: 16px; border-radius: 8px;">
          <h4 style="color: var(--accent); margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 700;">⏱️ Timed Pressure</h4>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Timer counts down automatically. The assessment auto-submits once the time expires.</p>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); padding: 16px; border-radius: 8px;">
          <h4 style="color: var(--accent); margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 700;">🚫 No Solution Peeking</h4>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Official solutions and hints are locked during the test so you can focus on writing your code.</p>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); padding: 16px; border-radius: 8px;">
          <h4 style="color: var(--accent); margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 700;">📝 Code Sketching</h4>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Use the integrated scratchpad editor for each problem to type out your solutions.</p>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); padding: 16px; border-radius: 8px;">
          <h4 style="color: var(--accent); margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 700;">✅ Self-Grading</h4>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Review your sketch code side-by-side with the official optimal walkthroughs to grade yourself.</p>
        </div>
      </div>
      
      <p style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; margin: 0; text-align: center;">
        Select your config in the sidebar and click <strong>Start Mock Round</strong> to begin.
      </p>
    </div>
  `;
}

function getRandomSample(arr, size) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

function startMockTest() {
  const sourceVal = document.querySelector("#testSourceSelect").value;
  const mixVal = document.querySelector("#testMixSelect").value;
  const durationMinutes = parseInt(document.querySelector("#testTimeInput").value, 10) || 45;
  
  if (!sourceVal) return;
  
  let questionsPromise;
  let sourceName = "";
  
  if (sourceVal.startsWith("sheet-")) {
    const sheetId = sourceVal.replace("sheet-", "");
    const sheet = REVISION_SHEETS.find(s => s.id === sheetId);
    sourceName = sheet ? sheet.name : "Revision Sheet";
    questionsPromise = Promise.resolve(sheet ? sheet.questions : []);
  } else if (sourceVal.startsWith("company-")) {
    const companyId = sourceVal.replace("company-", "");
    const company = state.companies.find(c => c.id === companyId);
    sourceName = company ? company.name : "Company";
    questionsPromise = fetch(`/api/company?name=${companyId}`)
      .then(res => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.json();
      });
  }
  
  const standardView = document.querySelector("#standardView");
  const testView = document.querySelector("#testView");
  standardView.classList.add("hidden");
  testView.classList.remove("hidden");
  
  const testQuestionGrid = document.querySelector("#testQuestionGrid");
  testQuestionGrid.innerHTML = `<div class="empty-state"><p class="muted-text">Preparing assessment questions... ⏳</p></div>`;
  
  questionsPromise
    .then(questions => {
      if (!questions || questions.length === 0) {
        throw new Error("No questions available in the selected source.");
      }
      
      let easyCount = 0;
      let mediumCount = 0;
      let hardCount = 0;
      
      if (mixVal === "easy-medium") {
        easyCount = 1;
        mediumCount = 1;
      } else if (mixVal === "medium-hard") {
        mediumCount = 1;
        hardCount = 1;
      } else if (mixVal === "full") {
        easyCount = 1;
        mediumCount = 2;
        hardCount = 1;
      } else if (mixVal === "custom") {
        easyCount = parseInt(document.querySelector("#easyCountInput").value, 10) || 0;
        mediumCount = parseInt(document.querySelector("#mediumCountInput").value, 10) || 0;
        hardCount = parseInt(document.querySelector("#hardCountInput").value, 10) || 0;
      }
      
      const easyQs = questions.filter(q => q.difficulty.toLowerCase() === "easy");
      const mediumQs = questions.filter(q => q.difficulty.toLowerCase() === "medium");
      const hardQs = questions.filter(q => q.difficulty.toLowerCase() === "hard");
      
      const selected = [];
      selected.push(...getRandomSample(easyQs, easyCount));
      selected.push(...getRandomSample(mediumQs, mediumCount));
      selected.push(...getRandomSample(hardQs, hardCount));
      
      const totalWanted = easyCount + mediumCount + hardCount;
      if (selected.length < totalWanted && questions.length > selected.length) {
        const remaining = questions.filter(q => !selected.includes(q));
        selected.push(...getRandomSample(remaining, totalWanted - selected.length));
      }
      
      if (selected.length === 0) {
        throw new Error("Could not select any questions. Try a different source or mix.");
      }
      
      state.testActive = true;
      state.testQuestions = selected;
      state.testAnswers = {};
      state.testSelectedLangs = {};
      state.testGrades = {};
      state.testRemainingSeconds = durationMinutes * 60;
      
      document.querySelector(".sidebar").classList.add("test-locked");
      document.querySelector("#startTestBtn").disabled = true;
      
      document.querySelector("#testNameLabel").textContent = `${sourceName} Mock Test`;
      
      renderTestQuestions();
      
      updateTimerDisplay();
      if (state.testTimerInterval) clearInterval(state.testTimerInterval);
      state.testTimerInterval = setInterval(tickTimer, 1000);
      
      document.querySelector("#testScorecard").classList.add("hidden");
    })
    .catch(err => {
      console.error(err);
      testQuestionGrid.innerHTML = `
        <div class="empty-state">
          <p class="muted-text" style="color:var(--danger)">Failed to start test: ${err.message}</p>
          <button onclick="exitMockTest()" class="test-exit-btn" style="margin-top:12px; width:auto;">Go Back</button>
        </div>
      `;
    });
}

function renderTestQuestions() {
  const grid = document.querySelector("#testQuestionGrid");
  grid.replaceChildren();
  
  if (!state.testStdins) state.testStdins = {};
  
  state.testQuestions.forEach((q, idx) => {
    const card = renderQuestion(q);
    
    card.classList.add("in-test");
    
    const titleText = card.querySelector(".question-title-text");
    titleText.textContent = `Problem ${idx + 1}: ${q.title}`;
    
    card.classList.remove("collapsed");
    card.classList.add("expanded");
    
    const editorPanel = document.createElement("div");
    editorPanel.className = "test-code-editor-panel";
    editorPanel.innerHTML = `
      <div class="editor-header">
        <span>Sketch your solution</span>
        <select class="editor-lang-select" aria-label="Select Programming Language">
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
      </div>
      <textarea class="editor-textarea" placeholder="Write your code or approach here...\n\nNote: To run your code, include standard I/O driver code (e.g. main() or console.log) that processes the input and prints the result." aria-label="Code Editor"></textarea>
      
      <div class="compiler-section">
        <div class="compiler-row">
          <div class="compiler-input-col">
            <label class="editor-label">Custom Input (stdin)</label>
            <textarea class="compiler-stdin" placeholder="Enter custom input here..." aria-label="Custom Input"></textarea>
          </div>
          <div class="compiler-output-col">
            <label class="editor-label">Execution Results</label>
            <div class="compiler-results-box">
              <span class="placeholder">Click 'Run Code' to see output...</span>
            </div>
          </div>
        </div>
        <div class="compiler-actions">
          <button class="run-code-btn" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Run Code</span>
          </button>
        </div>
      </div>
    `;
    
    const textarea = editorPanel.querySelector(".editor-textarea");
    const langSelect = editorPanel.querySelector(".editor-lang-select");
    const stdinArea = editorPanel.querySelector(".compiler-stdin");
    const resultsBox = editorPanel.querySelector(".compiler-results-box");
    const runBtn = editorPanel.querySelector(".run-code-btn");
    
    const qId = q.id || q.title;
    if (state.testAnswers[qId]) {
      textarea.value = state.testAnswers[qId];
    }
    if (state.testSelectedLangs[qId]) {
      langSelect.value = state.testSelectedLangs[qId];
    } else {
      state.testSelectedLangs[qId] = langSelect.value;
    }
    if (state.testStdins[qId]) {
      stdinArea.value = state.testStdins[qId];
    }
    
    textarea.addEventListener("input", (e) => {
      state.testAnswers[qId] = e.target.value;
    });
    
    langSelect.addEventListener("change", (e) => {
      state.testSelectedLangs[qId] = e.target.value;
    });
    
    stdinArea.addEventListener("input", (e) => {
      state.testStdins[qId] = e.target.value;
    });
    
    runBtn.addEventListener("click", () => {
      const codeVal = textarea.value;
      const langVal = langSelect.value;
      const stdinVal = stdinArea.value;
      
      runBtn.disabled = true;
      runBtn.querySelector("span").textContent = "Running...";
      resultsBox.className = "compiler-results-box"; // Clear status classes
      resultsBox.innerHTML = `Running code... ⏳`;
      
      fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: codeVal,
          lang: langVal,
          input: stdinVal
        })
      })
        .then(res => {
          if (!res.ok) throw new Error(`Server returned status ${res.status}`);
          return res.json();
        })
        .then(data => {
          runBtn.disabled = false;
          runBtn.querySelector("span").textContent = "Run Code";
          
          if (data.code === 0) {
            resultsBox.classList.add("success");
            let output = data.stdout;
            if (data.stderr) {
              output += "\n" + data.stderr;
            }
            resultsBox.textContent = output || "Success (Process finished with no output)";
          } else {
            resultsBox.classList.add("error");
            let output = "";
            if (data.stderr) {
              output += data.stderr;
            }
            if (data.stdout) {
              output += (output ? "\n" : "") + data.stdout;
            }
            resultsBox.textContent = output || `Error: Process exited with code ${data.code}`;
          }
        })
        .catch(err => {
          runBtn.disabled = false;
          runBtn.querySelector("span").textContent = "Run Code";
          resultsBox.classList.add("error");
          resultsBox.textContent = `Error: ${err.message}`;
        });
    });
    
    const detailsDiv = card.querySelector(".details-collapsible");
    detailsDiv.appendChild(editorPanel);
    
    grid.appendChild(card);
    renderMath(card);
  });
}

function tickTimer() {
  if (!state.testActive) return;
  
  state.testRemainingSeconds--;
  updateTimerDisplay();
  
  if (state.testRemainingSeconds <= 0) {
    clearInterval(state.testTimerInterval);
    submitMockTest(true);
  }
}

function updateTimerDisplay() {
  const timerCard = document.querySelector(".test-timer-card");
  const timerLabel = document.querySelector("#testTimerLabel");
  if (!timerLabel) return;
  
  const minutes = Math.floor(state.testRemainingSeconds / 60);
  const seconds = state.testRemainingSeconds % 60;
  
  timerLabel.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  
  if (state.testRemainingSeconds < 300) {
    timerCard.classList.add("time-low");
    timerCard.classList.remove("time-warning");
  } else if (state.testRemainingSeconds < 600) {
    timerCard.classList.add("time-warning");
    timerCard.classList.remove("time-low");
  } else {
    timerCard.classList.remove("time-low");
    timerCard.classList.remove("time-warning");
  }
}

function submitMockTest(isTimeout = false) {
  if (!state.testActive) return;
  
  if (state.testTimerInterval) clearInterval(state.testTimerInterval);
  
  if (!isTimeout) {
    const confirmSubmit = confirm("Are you sure you want to submit your assessment?");
    if (!confirmSubmit) {
      state.testTimerInterval = setInterval(tickTimer, 1000);
      return;
    }
  } else {
    alert("Time's up! Your mock test is being submitted automatically.");
  }
  
  state.testActive = false;
  
  document.querySelectorAll(".editor-textarea").forEach(ta => ta.disabled = true);
  document.querySelectorAll(".editor-lang-select").forEach(sel => sel.disabled = true);
  document.querySelectorAll(".compiler-stdin").forEach(ta => ta.disabled = true);
  document.querySelectorAll(".run-code-btn").forEach(btn => btn.disabled = true);
  
  document.querySelectorAll("#testQuestionGrid .question-card").forEach(card => {
    card.classList.remove("in-test");
    addCopyButtons(card);
  });
  
  renderScorecard();
}

function renderScorecard() {
  const scorecard = document.querySelector("#testScorecard");
  const details = document.querySelector("#scorecardDetails");
  
  scorecard.classList.remove("hidden");
  
  state.testQuestions.forEach(q => {
    const qId = q.id || q.title;
    if (!state.testGrades[qId]) {
      state.testGrades[qId] = null;
    }
  });
  
  updateScorecardSummary();
  
  details.replaceChildren(
    ...state.testQuestions.map((q, idx) => {
      const qId = q.id || q.title;
      const item = document.createElement("div");
      item.className = "scorecard-item";
      
      const titleSpan = document.createElement("div");
      titleSpan.className = "scorecard-item-title";
      titleSpan.innerHTML = `
        <span>Problem ${idx + 1}: ${q.title}</span>
        <span class="difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
      `;
      
      const actions = document.createElement("div");
      actions.className = "scorecard-item-actions";
      
      const correctBtn = document.createElement("button");
      correctBtn.type = "button";
      correctBtn.className = "self-grade-btn correct";
      correctBtn.textContent = "Correct";
      if (state.testGrades[qId] === "correct") correctBtn.classList.add("active");
      
      const incorrectBtn = document.createElement("button");
      incorrectBtn.type = "button";
      incorrectBtn.className = "self-grade-btn incorrect";
      incorrectBtn.textContent = "Incorrect";
      if (state.testGrades[qId] === "incorrect") incorrectBtn.classList.add("active");
      
      correctBtn.addEventListener("click", () => {
        state.testGrades[qId] = "correct";
        correctBtn.classList.add("active");
        incorrectBtn.classList.remove("active");
        updateScorecardSummary();
      });
      
      incorrectBtn.addEventListener("click", () => {
        state.testGrades[qId] = "incorrect";
        incorrectBtn.classList.add("active");
        correctBtn.classList.remove("active");
        updateScorecardSummary();
      });
      
      actions.appendChild(correctBtn);
      actions.appendChild(incorrectBtn);
      
      item.appendChild(titleSpan);
      item.appendChild(actions);
      return item;
    })
  );
}

function updateScorecardSummary() {
  const summaryLabel = document.querySelector("#scorecardSummaryLabel");
  const scorecardCard = document.querySelector("#testScorecard");
  
  const total = state.testQuestions.length;
  let correct = 0;
  let incorrect = 0;
  let ungraded = 0;
  
  state.testQuestions.forEach(q => {
    const qId = q.id || q.title;
    const grade = state.testGrades[qId];
    if (grade === "correct") correct++;
    else if (grade === "incorrect") incorrect++;
    else ungraded++;
  });
  
  if (ungraded > 0) {
    summaryLabel.innerHTML = `Assessment submitted! Please compare your sketch code with the solutions shown below and self-grade your answers.<br><strong>Progress:</strong> ${correct} Correct, ${incorrect} Incorrect, ${ungraded} Ungraded`;
    scorecardCard.classList.remove("failed-scorecard");
  } else {
    const scorePct = Math.round((correct / total) * 100);
    summaryLabel.innerHTML = `<strong>Assessment Complete!</strong> Final Score: <strong>${correct}/${total} (${scorePct}%)</strong>.<br>Great work! You can exit the mock mode to resume standard browsing.`;
    
    if (scorePct >= 70) {
      scorecardCard.classList.remove("failed-scorecard");
    } else {
      scorecardCard.classList.add("failed-scorecard");
    }
  }
}

function exitMockTest() {
  if (state.testActive) {
    const confirmExit = confirm("Are you sure you want to exit? Your active test progress will be lost.");
    if (!confirmExit) return;
  }
  
  if (state.testTimerInterval) clearInterval(state.testTimerInterval);
  state.testActive = false;
  state.testQuestions = [];
  state.testAnswers = {};
  state.testGrades = {};
  
  document.querySelector(".sidebar").classList.remove("test-locked");
  document.querySelector("#startTestBtn").disabled = false;
  
  document.querySelector("#standardView").classList.remove("hidden");
  document.querySelector("#testView").classList.add("hidden");
  document.querySelector("#testScorecard").classList.add("hidden");
  
  tabSheets.classList.add("active");
  tabCompanies.classList.remove("active");
  tabTest.classList.remove("active");
  
  sheetsSection.classList.remove("hidden");
  companiesSection.classList.add("hidden");
  testSection.classList.add("hidden");
  
  state.mode = "sheets";
  state.renderLimit = ITEMS_PER_PAGE;
  render();
}

let companySearchTimeout;
companySearchInput.addEventListener("input", (event) => {
  state.companySearch = event.target.value;
  clearTimeout(companySearchTimeout);
  companySearchTimeout = setTimeout(() => {
    renderCompanies();
  }, 120);
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  state.renderLimit = ITEMS_PER_PAGE;
  render();
});

showOptimalFirstInput.addEventListener("change", (event) => {
  state.showOptimalFirst = event.target.checked;
  render();
});

// Autocomplete Event Listeners for Company Search
if (companySearchInput && companyList) {
  companySearchInput.addEventListener("focus", () => {
    companyList.classList.add("active");
    renderCompanies();
  });
}

// Close drawer button click listener
if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", () => {
    if (rightDrawer) rightDrawer.classList.remove("open");
  });
}

// Global click listener to handle click-outside for drawer and company list dropdown
document.addEventListener("click", (e) => {
  if (companySearchInput && companyList) {
    if (!companySearchInput.contains(e.target) && !companyList.contains(e.target)) {
      companyList.classList.remove("active");
    }
  }
  
  if (rightDrawer && rightDrawer.classList.contains("open")) {
    if (!rightDrawer.contains(e.target) && !e.target.closest(".company-row-item")) {
      rightDrawer.classList.remove("open");
    }
  }
});

// Init
initCompanies();
populateTestSourceDropdown();
selectSheet(state.sheetId);
