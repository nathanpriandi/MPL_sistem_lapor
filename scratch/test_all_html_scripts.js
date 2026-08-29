const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcDir = path.join(__dirname, '..', 'src');

function getFileContent(filename) {
  return fs.readFileSync(path.join(srcDir, filename), 'utf8');
}

const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));

console.log('Found HTML files:', htmlFiles);

for (const file of htmlFiles) {
  const content = getFileContent(file);
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(content)) !== null) {
    count++;
    const code = match[1];
    if (!code.trim()) continue; // skip external src only tags
    try {
      new vm.Script(code, { filename: `${file}_script_${count}` });
      console.log(`[PASS] ${file} script #${count} (${code.length} bytes)`);
    } catch (e) {
      console.error(`[FAIL] ${file} script #${count}:`, e.message);
      // find line
      const errLine = e.stack.split('\n')[0];
      console.error('Stack:', e.stack);
    }
  }
}
