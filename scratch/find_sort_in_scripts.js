const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

['admin.html', 'dashboard.html', 'index.html', 'dynamicform.html', 'forms.html', 'employees.html', 'roles.html', 'brand.html', 'header.html', 'sidebar.html', 'style.html', 'app.html', 'camera.html'].forEach(file => {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Check raw script blocks
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let sIndex = 0;
  while ((match = scriptRegex.exec(content)) !== null) {
    sIndex++;
    const code = match[1];
    const lines = code.split('\n');
    lines.forEach((line, lineIdx) => {
      if (/\bsort/i.test(line)) {
        console.log(`[${file} s#${sIndex}:${lineIdx + 1}] ${line.trim()}`);
      }
    });
  }
});
