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

const state = {
  mode: "sheets", // "sheets" or "companies"
  sheetId: REVISION_SHEETS[0].id,
  topics: new Set(),
  search: "",
  showOptimalFirst: true,
  
  // Company state
  companies: [],
  companySearch: "",
  selectedCompanyId: null,
  companyQuestions: [],
  timeFilters: new Set()
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
  searchInput.value = "";
  render();
}

function showAllTopics() {
  state.topics = new Set();
  render();
}

function toggleTopic(topic) {
  if (state.topics.has(topic)) {
    state.topics.delete(topic);
  } else {
    state.topics.add(topic);
  }
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

  // Populate Topics, Company Tags, and Hints panels
  const topicsBtn = node.querySelector(".topics-btn");
  const companiesBtn = node.querySelector(".companies-btn");
  const hintsBtn = node.querySelector(".hints-btn");

  const topicsPanel = node.querySelector(".topics-panel");
  const companiesPanel = node.querySelector(".companies-panel");
  const hintsPanel = node.querySelector(".hints-panel");

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

  if (question.companyTags && question.companyTags.length) {
    companiesPanel.replaceChildren(
      ...question.companyTags.map(company => {
        const span = document.createElement("span");
        span.className = "company-tag-chip";
        span.textContent = company;
        return span;
      })
    );
  } else {
    companiesPanel.innerHTML = `<span class="muted-text">No company tags available (Premium LeetCode).</span>`;
  }

  if (question.hints && question.hints.length) {
    hintsPanel.replaceChildren(
      ...question.hints.map((hint, idx) => {
        const div = document.createElement("div");
        div.className = "hint-item";
        div.innerHTML = `<strong>Hint ${idx + 1}:</strong> <p>${hint}</p>`;
        return div;
      })
    );
  } else {
    hintsPanel.innerHTML = `<span class="muted-text">No hints available for this problem.</span>`;
  }

  // Toggle Panels (stopPropagation prevents the card from collapsing)
  topicsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = topicsPanel.classList.toggle("hidden");
    topicsBtn.classList.toggle("active", !isHidden);
    companiesBtn.classList.remove("active");
    companiesPanel.classList.add("hidden");
    hintsBtn.classList.remove("active");
    hintsPanel.classList.add("hidden");
  });

  companiesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = companiesPanel.classList.toggle("hidden");
    companiesBtn.classList.toggle("active", !isHidden);
    topicsBtn.classList.remove("active");
    topicsPanel.classList.add("hidden");
    hintsBtn.classList.remove("active");
    hintsPanel.classList.add("hidden");
  });

  hintsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = hintsPanel.classList.toggle("hidden");
    hintsBtn.classList.toggle("active", !isHidden);
    topicsBtn.classList.remove("active");
    topicsPanel.classList.add("hidden");
    companiesBtn.classList.remove("active");
    companiesPanel.classList.add("hidden");
  });

  // Render description HTML
  const contentHtml = node.querySelector(".problem-content-html");
  if (question.content) {
    contentHtml.innerHTML = question.content;
  } else {
    contentHtml.innerHTML = `<p>${question.summary}</p>`;
  }
  renderMath(contentHtml);

  // Expand/Collapse Card on Header click
  const toggleExpand = (e) => {
    if (e.target.closest("a") || e.target.closest("input") || e.target.closest(".badge-btn") || e.target.closest(".solution-tab") || e.target.closest(".copy-code-btn")) {
      return;
    }
    const isExpanded = node.classList.toggle("expanded");
    node.classList.toggle("collapsed");
    if (isExpanded) {
      addCopyButtons(node);
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
          
          panel.innerHTML = `
            <div class="walkthrough-header-row">
              <label class="cpp-toggle-label">
                <input type="checkbox" class="cpp-only-toggle" checked />
                Show C++ Only
              </label>
            </div>
            <div class="walkthrough-content">
              ${html}
            </div>
          `;

          const contentDiv = panel.querySelector(".walkthrough-content");
          const toggle = panel.querySelector(".cpp-only-toggle");

          function applyCppFilter() {
            const cppOnly = toggle.checked;
            const headers = contentDiv.querySelectorAll("h4");
            
            let hasCppHeader = false;
            headers.forEach(h4 => {
              const lang = h4.textContent.trim().toLowerCase();
              if (lang === "c++" || lang === "cpp") {
                hasCppHeader = true;
              }
            });

            let warningBox = panel.querySelector(".cpp-unavailable-warning");
            if (cppOnly && !hasCppHeader && headers.length > 0) {
              if (!warningBox) {
                warningBox = document.createElement("div");
                warningBox.className = "cpp-unavailable-warning";
                warningBox.style.cssText = "padding: 10px 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; color: #fbbf24; font-size: 0.85rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-weight: 500;";
                warningBox.innerHTML = `<span>⚠️ C++ solution is not available for this problem. Showing other languages instead.</span>`;
                contentDiv.parentNode.insertBefore(warningBox, contentDiv);
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
        <h3>${solution.label} approach</h3>
        <p>${solution.idea}</p>
        <div class="complexity">
          <span>Time: ${solution.time}</span>
          <span>Space: ${solution.space}</span>
        </div>
      `;
      addCopyButtons(panel);
      renderMath(panel);
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

  if (state.topics.size === 1) {
    questionGrid.replaceChildren(...questions.map(renderQuestion));
    return;
  }

  const groups = {};
  questions.forEach((q) => {
    if (!groups[q.topic]) {
      groups[q.topic] = [];
    }
    groups[q.topic].push(q);
  });

  const children = [];

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
  } else {
    const questions = filteredCompanyQuestions();
    renderCompanies();
    renderTimeFilters();
    renderCompanyHeader();
    renderStats(questions);
    renderQuestions(questions);
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

function renderTimeFilters() {
  const list = document.querySelector("#timeFilterList");
  const timeframes = ["30 Days", "3 Months", "6 Months", "> 6 Months"];
  
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `topic-button${state.timeFilters.size === 0 ? " active" : ""}`;
  allBtn.innerHTML = `<span>All time</span><span>${state.companyQuestions.length}</span>`;
  allBtn.addEventListener("click", () => {
    state.timeFilters = new Set();
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
    })
    .catch(err => console.error("Failed to load companies list:", err));
}

// Sidebar Tab Selectors
const tabSheets = document.querySelector("#tabSheets");
const tabCompanies = document.querySelector("#tabCompanies");
const sheetsSection = document.querySelector("#sheetsSection");
const companiesSection = document.querySelector("#companiesSection");
const companySearchInput = document.querySelector("#companySearchInput");

tabSheets.addEventListener("click", () => {
  tabSheets.classList.add("active");
  tabCompanies.classList.remove("active");
  sheetsSection.classList.remove("hidden");
  companiesSection.classList.add("hidden");
  
  state.mode = "sheets";
  state.search = "";
  searchInput.value = "";
  render();
});

tabCompanies.addEventListener("click", () => {
  tabCompanies.classList.add("active");
  tabSheets.classList.remove("active");
  companiesSection.classList.remove("hidden");
  sheetsSection.classList.add("hidden");
  
  state.mode = "companies";
  state.search = "";
  searchInput.value = "";
  
  if (state.companyQuestions.length === 0 && state.selectedCompanyId) {
    selectCompany(state.selectedCompanyId);
  } else {
    render();
  }
});

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
  render();
});

showOptimalFirstInput.addEventListener("change", (event) => {
  state.showOptimalFirst = event.target.checked;
  render();
});

// Init
initCompanies();
selectSheet(state.sheetId);
