const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

fs.readdirSync(srcDir).forEach(file => {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check if line contains the exact word 'sort' (not sortable, not sorts)
    const match = line.match(/\bsort\b/);
    if (match) {
      console.log(`${file}:${idx + 1} -> ${line.trim()}`);
    }
  });
});
