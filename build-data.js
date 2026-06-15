const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_FILE = path.join(__dirname, "data.js");
const CACHE_DIR = path.join(__dirname, "leetcode-cache");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper to fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeetHelperCrawler"
      }
    };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// Slugify fallback
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Extract slug from LeetCode URL
function extractSlug(url, title) {
  if (!url) return slugify(title);
  const match = url.match(/problems\/([^\/]+)/);
  return match ? match[1].trim() : slugify(title);
}

const SDE_TOPIC_MAP = {
  'arrayI': 'Day 1: Arrays',
  'arrayII': 'Day 2: Arrays',
  'arrayIII': 'Day 3: Arrays',
  'arrayIV': 'Day 4: Arrays',
  'linkedlistI': 'Day 5: Linked List',
  'linkedlistII': 'Day 6: Linked List',
  'linkedlistIII': 'Day 7: Linked List',
  'greedy': 'Day 8: Greedy Algorithm',
  'recursion': 'Day 9: Recursion',
  'recursionandbacktracing': 'Day 10: Recursion and Backtracking',
  'binarysearch': 'Day 11: Binary Search',
  'heap': 'Day 12: Heaps',
  'stackandqueueI': 'Day 13: Stack and Queue',
  'stackandqueueII': 'Day 14: Stack and Queue',
  'stringI': 'Day 15: String',
  'stringII': 'Day 16: String',
  'binarytreeI': 'Day 17: Binary Tree',
  'binarytreeII': 'Day 18: Binary Tree',
  'binarytreeIII': 'Day 19: Binary Tree',
  'binarysearchtreeI': 'Day 20: Binary Search Tree',
  'binarysearchtreeII': 'Day 21: Binary Search Tree',
  'binarytreemisc': 'Day 22: Binary Tree Miscellaneous',
  'graphI': 'Day 23: Graph',
  'graphII': 'Day 24: Graph',
  'dynamicprogrammingI': 'Day 25: Dynamic Programming',
  'dynamicprogrammingII': 'Day 26: Dynamic Programming',
  'trie': 'Day 27: Trie'
};

const SDE_LEETCODE_SLUGS = {
  "Word Break (print all ways)": "word-break-ii",
  "Allocate Minimum Number of Pages": "split-array-largest-sum",
  "Aggressive Cows": "magnetic-force-between-two-balls",
  "Maximum Sum Combination": "find-k-pairs-with-smallest-sums",
  "Rabin Karp": "find-the-index-of-the-first-occurrence-in-a-string",
  "KMP algo / LPS(pi) array": "find-the-index-of-the-first-occurrence-in-a-string",
  "Minimum characters needed to be inserted in the beginning to make it palindromic": "shortest-palindrome",
  "Morris Preorder Traversal": "binary-tree-preorder-traversal",
  "Boundary Traversal of Binary Tree": "boundary-of-binary-tree",
  "Check if Binary Tree is the mirror of itself or not": "symmetric-tree",
  "Find the inorder predecessor/successor of a given Key in BST.": "inorder-successor-in-bst",
  "Topological Sort BFS": "course-schedule-ii",
  "Topological Sort DFS": "course-schedule-ii",
  "Dijkstra’s Algorithm": "network-delay-time",
  "Floyd Warshall Algorithm": "find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance",
  "MST using Prim’s Algo": "min-cost-to-connect-all-points",
  "MST using Kruskal’s Algo": "min-cost-to-connect-all-points",
  "Egg Dropping": "super-egg-drop",
  "Word Break": "word-break",
  "Palindrome Partitioning (MCM Variation)": "palindrome-partitioning-ii",
  "Maximum profit in Job scheduling": "maximum-profit-in-job-scheduling",
  "Implement Trie – 2 (Prefix Tree)": "implement-trie-ii-prefix-tree",
  "Longest String with All Prefixes": "longest-word-with-all-prefixes",
  "Number of Distinct Substrings in a String": "number-of-distinct-substrings-in-a-string",
  "Power Set": "subsets"
};

// Load existing questions to keep human-written solutions
function getExistingQuestions() {
  if (!fs.existsSync(DATA_FILE)) {
    return { neetcode: new Map(), striver: new Map(), striverSde: new Map() };
  }
  const content = fs.readFileSync(DATA_FILE, "utf8");
  const tempModuleContent = content.replace(/const REVISION_SHEETS\s*=/, "module.exports =");
  
  let sheets = [];
  try {
    const tempFile = path.join(__dirname, "temp-data-load.js");
    fs.writeFileSync(tempFile, tempModuleContent);
    sheets = require(tempFile);
    fs.unlinkSync(tempFile);
  } catch (e) {
    console.warn("Could not parse existing data.js, starting fresh.", e);
  }

  const neetcodeMap = new Map();
  const striverMap = new Map();
  const striverSdeMap = new Map();

  sheets.forEach((sheet) => {
    if (sheet.id === "neetcode-150") {
      sheet.questions.forEach((q) => neetcodeMap.set(slugify(q.title), q));
    } else if (sheet.id === "striver-a2z") {
      sheet.questions.forEach((q) => striverMap.set(slugify(q.title), q));
    } else if (sheet.id === "striver-sde-sheet") {
      sheet.questions.forEach((q) => striverSdeMap.set(slugify(q.title), q));
    }
  });

  return { neetcode: neetcodeMap, striver: striverMap, striverSde: striverSdeMap };
}

async function main() {
  console.log("Reading existing questions from data.js...");
  const { neetcode: existingNc, striver: existingStriver, striverSde: existingSde } = getExistingQuestions();

  console.log("Fetching sheet metadata from online sources...");
  const ncRaw = await fetchJson("https://raw.githubusercontent.com/krmanik/Anki-NeetCode/main/neetcode-150-list.json");
  const striverRaw = await fetchJson("https://raw.githubusercontent.com/hitarth-gg/CP/main/striver-a2z.json");
  const sdeRaw = await fetchJson("https://raw.githubusercontent.com/abhiiishek07/180DSA/master/src/Data/AllQuestionsList.json");

  // Collect all unique slugs to fetch details
  const uniqueSlugs = new Set();
  const problemSlugsMap = new Map(); // maps question key to Resolved Slug

  // Process NeetCode metadata
  for (const topic in ncRaw) {
    for (const qTitle in ncRaw[topic]) {
      const qInfo = ncRaw[topic][qTitle];
      const slug = extractSlug(qInfo.url, qTitle);
      uniqueSlugs.add(slug);
      problemSlugsMap.set(`nc:${topic}:${qTitle}`, slug);
    }
  }

  // Process Striver metadata
  striverRaw.forEach((step) => {
    step.sub_steps.forEach((subStep) => {
      subStep.topics.forEach((q) => {
        const practiceUrl = q.lc_link || q.plus_link || q.post_link || "";
        const slug = extractSlug(practiceUrl, q.question_title);
        uniqueSlugs.add(slug);
        problemSlugsMap.set(`striver:${step.step_title}:${q.question_title}`, slug);
      });
    });
  });

  // Process Striver SDE metadata
  for (const rawTopic in sdeRaw) {
    const topic = SDE_TOPIC_MAP[rawTopic] || rawTopic;
    sdeRaw[rawTopic].forEach((q) => {
      let slug = "";
      if (SDE_LEETCODE_SLUGS[q.Question]) {
        slug = SDE_LEETCODE_SLUGS[q.Question];
      } else {
        slug = extractSlug(q.Question_link, q.Question);
      }
      uniqueSlugs.add(slug);
      problemSlugsMap.set(`sde:${topic}:${q.Question}`, slug);
    });
  }

  console.log(`Found ${uniqueSlugs.size} unique LeetCode problem slugs across sheets.`);
  
  // Parallel fetch setup
  const problemDetails = new Map();
  const slugsList = [...uniqueSlugs];
  let processed = 0;
  const CONCURRENCY_LIMIT = 8;

  async function worker() {
    while (slugsList.length > 0) {
      const slug = slugsList.shift();
      if (!slug) continue;
      
      const cacheFile = path.join(CACHE_DIR, `${slug}.json`);
      let details = null;

      if (fs.existsSync(cacheFile)) {
        try {
          details = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        } catch (e) {
          // ignore cache read error
        }
      }

      if (!details) {
        try {
          details = await fetchJson(`https://leetcode-api-pied.vercel.app/problem/${slug}`);
          fs.writeFileSync(cacheFile, JSON.stringify(details, null, 2), "utf8");
          // small politeness delay
          await new Promise((r) => setTimeout(r, 50));
        } catch (err) {
          // Fallback placeholder structure
          details = {
            content: "<p>Problem description not available offline. Please visit the Practice link for details.</p>",
            topicTags: [],
            companyTags: null,
            hints: []
          };
        }
      }

      problemDetails.set(slug, details);
      processed++;
      if (processed % 20 === 0 || processed === uniqueSlugs.size) {
        console.log(`Progress: [${processed}/${uniqueSlugs.size}] problems crawled and cached...`);
      }
    }
  }

  console.log(`Starting parallel crawl with pool size of ${CONCURRENCY_LIMIT}...`);
  const workers = Array(CONCURRENCY_LIMIT).fill(null).map(() => worker());
  await Promise.all(workers);

  // Compile NeetCode 150 questions
  const neetcodeQuestions = [];
  for (const topic in ncRaw) {
    for (const qTitle in ncRaw[topic]) {
      const qInfo = ncRaw[topic][qTitle];
      const slug = problemSlugsMap.get(`nc:${topic}:${qTitle}`);
      const details = problemDetails.get(slug) || {};
      const existing = existingNc.get(slugify(qTitle));

      const difficulty = qInfo.difficulty || "Easy";
      const topicTags = details.topicTags ? details.topicTags.map(t => t.name) : [];
      const companyTags = details.companyTags ? details.companyTags.map(c => c.name) : [];
      const hints = details.hints || [];
      const htmlContent = details.content || "<p>Detailed description not available.</p>";

      if (existing) {
        // Merge details
        existing.url = qInfo.url;
        existing.nurl = qInfo.nurl;
        existing.content = htmlContent;
        existing.topicTags = topicTags;
        existing.companyTags = companyTags;
        existing.hints = hints;
        existing.frontendId = details.questionFrontendId || null;
        existing.officialTitle = details.title || null;
        neetcodeQuestions.push(existing);
      } else {
        neetcodeQuestions.push({
          id: slugify(qTitle),
          title: qTitle,
          topic: topic,
          difficulty: difficulty,
          tags: topicTags.length ? topicTags : [topic.toLowerCase().replace("&", "and").replace(/\s+/g, "-")],
          summary: `Solve this problem using optimal patterns.`,
          constraints: [],
          solutions: [
            {
              label: "Optimal",
              idea: "Refer to the LeetCode resources and solution notes.",
              time: "Refer to solution",
              space: "Refer to solution"
            }
          ],
          url: qInfo.url,
          nurl: qInfo.nurl,
          content: htmlContent,
          topicTags: topicTags,
          companyTags: companyTags,
          hints: hints,
          frontendId: details.questionFrontendId || null,
          officialTitle: details.title || null
        });
      }
    }
  }

  // Compile Striver A2Z questions
  const striverQuestions = [];
  striverRaw.forEach((step) => {
    const topic = step.step_title;
    step.sub_steps.forEach((subStep) => {
      subStep.topics.forEach((q) => {
        const practiceUrl = q.lc_link || q.plus_link || q.post_link || "";
        const slug = problemSlugsMap.get(`striver:${step.step_title}:${q.question_title}`);
        const details = problemDetails.get(slug) || {};
        const existing = existingStriver.get(slugify(q.question_title));

        let diff = "Easy";
        if (q.difficulty === 1) diff = "Medium";
        if (q.difficulty === 2) diff = "Hard";

        const topicTags = details.topicTags ? details.topicTags.map(t => t.name) : [];
        const companyTags = details.companyTags ? details.companyTags.map(c => c.name) : [];
        const hints = details.hints || [];
        const htmlContent = details.content || "<p>Detailed description not available.</p>";

        if (existing) {
          existing.url = practiceUrl;
          existing.yt_link = q.yt_link || "";
          existing.post_link = q.post_link || "";
          existing.plus_link = q.plus_link || "";
          existing.content = htmlContent;
          existing.topicTags = topicTags;
          existing.companyTags = companyTags;
          existing.hints = hints;
          existing.frontendId = details.questionFrontendId || null;
          existing.officialTitle = details.title || null;
          striverQuestions.push(existing);
        } else {
          striverQuestions.push({
            id: slugify(q.question_title),
            title: q.question_title,
            topic: topic,
            difficulty: diff,
            tags: topicTags.length ? topicTags : [subStep.sub_step_title.toLowerCase().trim()],
            summary: `Practice this problem. Learn and revise the core step-by-step algorithms.`,
            constraints: [],
            solutions: [
              {
                label: "Optimal",
                idea: "Refer to TakeUForward post / video explanation below for implementation details.",
                time: "Refer to solution",
                space: "Refer to solution"
              }
            ],
            url: practiceUrl,
            yt_link: q.yt_link || "",
            post_link: q.post_link || "",
            plus_link: q.plus_link || "",
            content: htmlContent,
            topicTags: topicTags,
            companyTags: companyTags,
            hints: hints,
            frontendId: details.questionFrontendId || null,
            officialTitle: details.title || null
          });
        }
      });
    });
  });

  // Compile Striver SDE questions
  const striverSdeQuestions = [];
  for (const rawTopic in sdeRaw) {
    const topic = SDE_TOPIC_MAP[rawTopic] || rawTopic;
    sdeRaw[rawTopic].forEach((q) => {
      const slug = problemSlugsMap.get(`sde:${topic}:${q.Question}`);
      const details = problemDetails.get(slug) || {};
      const existing = existingSde.get(slugify(q.Question));

      const topicTags = details.topicTags ? details.topicTags.map(t => t.name) : [];
      const companyTags = details.companyTags ? details.companyTags.map(c => c.name) : [];
      const hints = details.hints || [];
      const htmlContent = details.content || "<p>Detailed description not available.</p>";
      const difficulty = details.difficulty || "Medium";

      if (existing) {
        existing.url = q.Question_link || "";
        existing.yt_link = q.Solution_link || "";
        existing.content = htmlContent;
        existing.topicTags = topicTags;
        existing.companyTags = companyTags;
        existing.hints = hints;
        existing.frontendId = details.questionFrontendId || null;
        existing.officialTitle = details.title || null;
        striverSdeQuestions.push(existing);
      } else {
        striverSdeQuestions.push({
          id: slugify(q.Question),
          title: q.Question,
          topic: topic,
          difficulty: difficulty,
          tags: topicTags.length ? topicTags : [rawTopic],
          summary: `Solve this SDE sheet problem.`,
          constraints: [],
          solutions: [
            {
              label: "Optimal",
              idea: "Refer to the resources and video solution below.",
              time: "Refer to solution",
              space: "Refer to solution"
            }
          ],
          url: q.Question_link || "",
          yt_link: q.Solution_link || "",
          content: htmlContent,
          topicTags: topicTags,
          companyTags: companyTags,
          hints: hints,
          frontendId: details.questionFrontendId || null,
          officialTitle: details.title || null
        });
      }
    });
  }

  const finalSheets = [
    {
      id: "neetcode-150",
      name: "NeetCode 150",
      description: "Pattern-first interview prep across arrays, graphs, DP, and more.",
      questions: neetcodeQuestions
    },
    {
      id: "striver-a2z",
      name: "Striver A2Z",
      description: "Structured basics-to-advanced path for DSA revision.",
      questions: striverQuestions
    },
    {
      id: "striver-sde-sheet",
      name: "Striver SDE Sheet",
      description: "Curated 180+ problems for key coding interview preparation.",
      questions: striverSdeQuestions
    }
  ];

  console.log(`Compiled sheet: NeetCode 150 has ${neetcodeQuestions.length} questions`);
  console.log(`Compiled sheet: Striver A2Z has ${striverQuestions.length} questions`);
  console.log(`Compiled sheet: Striver SDE Sheet has ${striverSdeQuestions.length} questions`);

  const outputJs = `const REVISION_SHEETS = ${JSON.stringify(finalSheets, null, 2)};\n`;
  fs.writeFileSync(DATA_FILE, outputJs, "utf8");
  console.log("Successfully wrote compiled questions and HTML descriptions to data.js!");
}

main().catch((err) => {
  console.error("Compilation failed:", err);
  process.exit(1);
});
