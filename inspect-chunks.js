const fs = require("fs");
const path = require("path");

for (const file of fs.readdirSync("chunks")) {
  const filePath = path.join("chunks", file);
  const text = fs.readFileSync(filePath, "utf8");
  const strings = [...text.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2]);

  for (const value of strings) {
    if (!/(subject|sheet|problem|category|api|graphql|backend)/i.test(value)) {
      continue;
    }
    if (/^(\/|http|api|subjects|sheet|problem|category)/i.test(value) || value.includes("backend")) {
      console.log(`${file}: ${value}`);
    }
  }
}
