const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 5173);
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

// In-memory caches for maximum speed
let companiesCache = null;
const companyQuestionsCache = new Map();

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line handling potential double quotes
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    
    if (cells.length < 4) continue;
    
    results.push({
      id: cells[0].trim(),
      url: cells[1].trim(),
      title: cells[2].replace(/^"|"$/g, '').trim(),
      difficulty: cells[3].trim(),
      acceptance: cells[4] ? cells[4].trim() : "",
      frequency: cells[5] ? cells[5].trim() : ""
    });
  }
  return results;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  
  // Endpoint: Get list of companies
  if (requestedPath === "/api/companies") {
    if (companiesCache) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(companiesCache));
      return;
    }
    
    const dataDir = path.join(root, "companywise-data");
    if (!fs.existsSync(dataDir)) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify([]));
      return;
    }
    
    fs.readdir(dataDir, { withFileTypes: true }, (err, files) => {
      if (err) {
        response.writeHead(500);
        response.end("Server error");
        return;
      }
      
      companiesCache = files
        .filter(f => f.isDirectory() && !f.name.startsWith("."))
        .map(f => {
          const id = f.name;
          const name = id
            .split("-")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          return { id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
        
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(companiesCache));
    });
    return;
  }
  
  // Endpoint: Get questions for a specific company
  if (requestedPath === "/api/company") {
    const companyId = url.searchParams.get("name");
    if (!companyId) {
      response.writeHead(400);
      response.end("Missing name param");
      return;
    }
    
    if (companyQuestionsCache.has(companyId)) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(companyQuestionsCache.get(companyId)));
      return;
    }
    
    const companyDir = path.join(root, "companywise-data", companyId);
    if (!fs.existsSync(companyDir)) {
      response.writeHead(404);
      response.end("Company not found");
      return;
    }
    
    const timeFrames = [
      { file: "thirty-days.csv", label: "30 Days" },
      { file: "three-months.csv", label: "3 Months" },
      { file: "six-months.csv", label: "6 Months" },
      { file: "more-than-six-months.csv", label: "> 6 Months" },
      { file: "all.csv", label: "All time" }
    ];
    
    const questionsMap = new Map();
    
    timeFrames.forEach(tf => {
      const filePath = path.join(companyDir, tf.file);
      if (fs.existsSync(filePath)) {
        const parsed = parseCSV(filePath);
        parsed.forEach(q => {
          if (!questionsMap.has(q.id)) {
            const tags = [];
            if (q.acceptance) tags.push(`Acceptance: ${q.acceptance}`);
            if (q.frequency) tags.push(`Freq: ${q.frequency}`);
            
            questionsMap.set(q.id, {
              id: `company-${companyId}-${q.id}`,
              frontendId: parseInt(q.id),
              title: q.title,
              topic: tf.label,
              difficulty: q.difficulty,
              tags: tags,
              summary: `Acceptance rate: ${q.acceptance || "N/A"}. Frequency: ${q.frequency || "N/A"}.`,
              solutions: [
                {
                  label: "Optimal",
                  idea: `Check the "All Approaches (Walkthrough)" tab above to load the detailed walkthrough solution from GitHub.`,
                  time: "Refer to Walkthrough",
                  space: "Refer to Walkthrough"
                }
              ],
              url: q.url
            });
          }
        });
      }
    });
    
    const questions = Array.from(questionsMap.values());
    
    const timeFrameOrder = {
      "30 Days": 1,
      "3 Months": 2,
      "6 Months": 3,
      "> 6 Months": 4,
      "All time": 5
    };
    
    questions.sort((a, b) => {
      const orderA = timeFrameOrder[a.topic] || 99;
      const orderB = timeFrameOrder[b.topic] || 99;
      if (orderA !== orderB) return orderA - orderB;
      
      const freqA = parseFloat(a.tags.find(t => t.startsWith("Freq: "))?.replace("Freq: ", "") || "0");
      const freqB = parseFloat(b.tags.find(t => t.startsWith("Freq: "))?.replace("Freq: ", "") || "0");
      return freqB - freqA;
    });
    
    companyQuestionsCache.set(companyId, questions);
    
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(questions));
    return;
  }

  const filePath = path.normalize(path.join(root, requestedPath));
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "text/plain; charset=utf-8"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`LeetHelper running at http://${host}:${port}`);
});
