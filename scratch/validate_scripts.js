const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcDir = path.join(__dirname, '..', 'src');

function getFileContent(filename) {
  return fs.readFileSync(path.join(srcDir, filename), 'utf8');
}

function include(name) {
  return getFileContent(name + '.html');
}

function includeApp(url) {
  const scriptTag = '<script>\n  window.SERVER_WEB_APP_URL = ' + JSON.stringify(url || '') + ';\n</script>\n';
  return scriptTag + getFileContent('app.html');
}

function includeSidebar(userRole, currentPage, webAppUrl) {
  let content = getFileContent('sidebar.html');
  content = content.replace(/<\?!= include\('brand'\); \?>/g, include('brand'));
  content = content.replace(/<\?[\s\S]*?\?>/g, '');
  return content;
}

function includeHeader(userRole, currentPage, webAppUrl) {
  let content = getFileContent('header.html');
  content = content.replace(/<\?!= include\('brand'\); \?>/g, include('brand'));
  content = content.replace(/<\?[\s\S]*?\?>/g, '');
  return content;
}

const pages = ['admin', 'dashboard', 'index', 'dynamicform', 'forms', 'employees', 'roles', 'camera'];

let hasError = false;

for (const page of pages) {
  let html = getFileContent(page + '.html');
  html = html.replace(/<\?!= include\('style'\); \?>/g, include('style'));
  html = html.replace(/<\?!= include\('brand'\); \?>/g, include('brand'));
  html = html.replace(/<\?!= includeSidebar\(userRole, currentPage, webAppUrl\); \?>/g, includeSidebar('both', page, 'https://script.google.com/macros/s/AKfycb/exec'));
  html = html.replace(/<\?!= includeHeader\(userRole, currentPage, webAppUrl\); \?>/g, includeHeader('both', page, 'https://script.google.com/macros/s/AKfycb/exec'));
  html = html.replace(/<\?!= includeApp\(webAppUrl\); \?>/g, includeApp('https://script.google.com/macros/s/AKfycb/exec'));

  // Remaining template tags
  html = html.replace(/<\?[\s\S]*?\?>/g, '');

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let sIdx = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    sIdx++;
    const code = match[1];
    try {
      new vm.Script(code, { filename: `${page}_script_${sIdx}.js` });
    } catch (e) {
      hasError = true;
      console.error(`ERROR in ${page}.html (script #${sIdx}): ${e.message}`);
      const lines = code.split('\n');
      console.error('First 15 lines of failed script:');
      console.error(lines.slice(0, 15).join('\n'));
    }
  }
}

if (!hasError) {
  console.log('All inline scripts in all HTML files are valid JS!');
}
