const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));

const standardGlobals = new Set([
  'window', 'document', 'console', 'localStorage', 'sessionStorage', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'fetch', 'alert', 'confirm', 'prompt', 'encodeURIComponent',
  'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Date', 'Math', 'Array',
  'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'JSON', 'Promise', 'Set', 'Map',
  'Blob', 'URL', 'Event', 'CustomEvent', 'FormData', 'FileReader', 'Image', 'Audio', 'navigator',
  'location', 'history', 'screen', 'performance', 'crypto', 'Chart', 'google', 'Session', 'HtmlService',
  'PropertiesService', 'SpreadsheetApp', 'DriveApp', 'UrlFetchApp', 'ScriptApp', 'Utilities', 'Logger'
]);

// Extract declared functions in app.html
const appContent = fs.readFileSync(path.join(srcDir, 'app.html'), 'utf8');
const globalAppFunctions = new Set();
const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
let m;
while ((m = fnRegex.exec(appContent)) !== null) {
  globalAppFunctions.add(m[1] || m[2]);
}

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let idx = 0;
  
  const declaredFunctions = new Set([...globalAppFunctions]);
  const declaredVars = new Set();
  const calledFunctions = new Set();

  while ((match = scriptRegex.exec(content)) !== null) {
    idx++;
    const code = match[1];
    if (!code.trim()) continue;

    // Find declarations
    let declMatch;
    const declRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+))/g;
    while ((declMatch = declRegex.exec(code)) !== null) {
      if (declMatch[1]) declaredFunctions.add(declMatch[1]);
      if (declMatch[2]) declaredVars.add(declMatch[2]);
    }

    // Find calls: identifier followed by (
    let callMatch;
    const callRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    while ((callMatch = callRegex.exec(code)) !== null) {
      const name = callMatch[1];
      // filter out keywords
      if (!['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'delete', 'new', 'async', 'await'].includes(name)) {
        calledFunctions.add(name);
      }
    }
  }

  const missing = [];
  for (const fn of calledFunctions) {
    if (!declaredFunctions.has(fn) && !declaredVars.has(fn) && !standardGlobals.has(fn)) {
      missing.push(fn);
    }
  }

  if (missing.length > 0) {
    console.log(`[!] ${file} has potentially missing called functions:`, missing);
  } else {
    console.log(`[PASS] ${file} - all direct function calls are resolved.`);
  }
}
