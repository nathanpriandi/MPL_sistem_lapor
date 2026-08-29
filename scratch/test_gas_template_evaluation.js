const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcDir = path.join(__dirname, '..', 'src');

function getFileContent(filename) {
  return fs.readFileSync(path.join(srcDir, filename), 'utf8');
}

// Simulate GAS include
function include(name) {
  return getFileContent(name + '.html');
}

function includeSidebar(role, page, url) {
  let content = getFileContent('sidebar.html');
  content = content.replace(/<\?[!=]?[\s\S]*?\?>/g, '');
  return content;
}

function includeHeader(role, page, url) {
  let content = getFileContent('header.html');
  content = content.replace(/<\?[!=]?\s*include\('brand'\);\s*\?>/g, include('brand'));
  content = content.replace(/<\?[!=]?[\s\S]*?\?>/g, '');
  return content;
}

function includeApp(url) {
  return getFileContent('app.html');
}

const pages = ['admin', 'dashboard', 'index', 'dynamicform', 'forms', 'employees', 'roles', 'camera'];

pages.forEach(page => {
  let html = getFileContent(page + '.html');
  // Expand includes
  html = html.replace(/<\?[!=]?\s*include\('style'\);\s*\?>/g, `<style>${include('style')}</style>`);
  html = html.replace(/<\?[!=]?\s*include\('brand'\);\s*\?>/g, include('brand'));
  html = html.replace(/<\?[!=]?\s*includeSidebar\([\s\S]*?\);\s*\?>/g, includeSidebar('both', page, 'https://script.google.com/macros/s/xxx/exec'));
  html = html.replace(/<\?[!=]?\s*includeHeader\([\s\S]*?\);\s*\?>/g, includeHeader('both', page, 'https://script.google.com/macros/s/xxx/exec'));
  html = html.replace(/<\?[!=]?\s*includeApp\([\s\S]*?\);\s*\?>/g, `<script>${includeApp('https://script.google.com/macros/s/xxx/exec')}</script>`);
  
  // Replace remaining GAS tags
  html = html.replace(/<\?[!=]?[\s\S]*?\?>/g, '');

  console.log(`=== Testing full page evaluation for: ${page} ===`);
  
  // Extract all <script> tags from the combined HTML
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let idx = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    idx++;
    const scriptCode = match[1];
    try {
      new vm.Script(scriptCode, { filename: `${page}::combined_script_${idx}` });
      console.log(`  [PASS] script #${idx} (${scriptCode.length} chars)`);
    } catch (err) {
      console.error(`  [FAIL] script #${idx} in ${page}:`, err.message);
      console.error(err.stack);
    }
  }
});
console.log('All pages full evaluation complete.');
