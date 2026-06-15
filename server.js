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

const { spawn } = require("child_process");

// Ensure temp directory exists for running code
const tempDir = path.join(root, "temp_run");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function runProcess(command, args, stdinInput, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args);
    } catch (err) {
      let guide = "";
      if (command === "g++") {
        guide = "\n\nTip: To run C++ code, you must install a C++ compiler (e.g. MinGW-w64 via MSYS2) and add 'g++' to your system's PATH.";
      } else if (command === "javac" || command === "java") {
        guide = "\n\nTip: To run Java code, you must install the Java Development Kit (JDK) and add 'java'/'javac' to your system's PATH.";
      }
      resolve({ stdout: "", stderr: `System Error: Failed to start process '${command}'. Make sure it is installed and in your PATH.${guide}\nError: ${err.message}`, code: -1 });
      return;
    }
    
    let stdout = "";
    let stderr = "";
    
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (e) {}
      resolve({ stdout, stderr: stderr + "\nExecution Timed Out (Limit 5s)", code: null });
    }, timeoutMs);
    
    child.stdout.on("data", data => {
      stdout += data.toString();
    });
    
    child.stderr.on("data", data => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    
    child.on("error", (err) => {
      clearTimeout(timer);
      let guide = "";
      if (err.code === "ENOENT") {
        if (command === "g++") {
          guide = "\n\nTip: To run C++ code, you must install a C++ compiler (e.g. MinGW-w64 via MSYS2) and add 'g++' to your system's PATH.";
        } else if (command === "javac" || command === "java") {
          guide = "\n\nTip: To run Java code, you must install the Java Development Kit (JDK) and add 'java'/'javac' to your system's PATH.";
        }
      }
      resolve({ stdout, stderr: stderr + `\nExecution Error: ${err.message}\nMake sure '${command}' is installed and in your PATH.${guide}`, code: -1 });
    });
    
    if (stdinInput) {
      try {
        child.stdin.write(stdinInput);
      } catch (e) {
        // stdin stream might be closed or erroring, ignore
      }
    }
    try {
      child.stdin.end();
    } catch (e) {}
  });
}

async function executeCode(code, lang, input) {
  if (lang === "javascript" || lang === "js") {
    const filePath = path.join(tempDir, "Main.js");
    fs.writeFileSync(filePath, code, "utf-8");
    const res = await runProcess("node", [filePath], input);
    return res;
  }
  
  if (lang === "python" || lang === "py") {
    const filePath = path.join(tempDir, "Main.py");
    fs.writeFileSync(filePath, code, "utf-8");
    const res = await runProcess("python", [filePath], input);
    return res;
  }
  
  if (lang === "cpp") {
    const sourcePath = path.join(tempDir, "Main.cpp");
    const exeName = process.platform === "win32" ? "Main.exe" : "Main.out";
    const exePath = path.join(tempDir, exeName);
    
    fs.writeFileSync(sourcePath, code, "utf-8");
    
    if (fs.existsSync(exePath)) {
      try { fs.unlinkSync(exePath); } catch(e) {}
    }
    
    const comp = await runProcess("g++", ["-O3", sourcePath, "-o", exePath], null, 10000);
    if (comp.code !== 0) {
      return {
        stdout: comp.stdout,
        stderr: "Compilation Error:\n" + comp.stderr,
        code: comp.code
      };
    }
    
    const res = await runProcess(exePath, [], input);
    return res;
  }
  
  if (lang === "java") {
    let className = "Main";
    const match = code.match(/class\s+(\w+)/);
    if (match) {
      className = match[1];
    }
    
    const sourcePath = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(sourcePath, code, "utf-8");
    
    const comp = await runProcess("javac", [sourcePath], null, 10000);
    if (comp.code !== 0) {
      return {
        stdout: comp.stdout,
        stderr: "Compilation Error:\n" + comp.stderr,
        code: comp.code
      };
    }
    
    const res = await runProcess("java", ["-cp", tempDir, className], input);
    return res;
  }
  
  return { stdout: "", stderr: `Unsupported language: ${lang}`, code: -1 };
}

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

  // Endpoint: Run user code locally
  if (requestedPath === "/api/run" && request.method === "POST") {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
    });
    request.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { code, lang, input } = payload;
        
        if (!code || !lang) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "Missing code or lang parameter" }));
          return;
        }
        
        const result = await executeCode(code, lang, input);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      } catch (err) {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: err.message }));
      }
    });
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
