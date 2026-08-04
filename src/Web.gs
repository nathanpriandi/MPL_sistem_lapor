/**
 * Web.gs — Web App Request Router & Page Delivery Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / ADAPTERS
 * Responsibility: Handles HTTP GET requests (doGet), page routing, and template inclusions.
 * Delegates authentication, RBAC, and business logic to AuthService & AdminService.
 */

/**
 * Handles HTTP GET requests for Apps Script Web App.
 * Routes to index, general, admin, or dashboard HTML views.
 * @param {Object} e - HTTP GET Event object.
 * @returns {HtmlOutput} Evaluated HTML response.
 */
function doGet(e) {
  const pageParam = (e && e.parameter && e.parameter.page ? e.parameter.page : '').toLowerCase().trim();
  const allowed = { 
    index: 'index', 
    general: 'general', 
    admin: 'admin', 
    dashboard: 'dashboard' 
  };

  const userRole = AuthService.getUserRole();
  const isInternalDeployment = AuthService.isInternalWebAppDeployment();
  const templateUserRole = isInternalDeployment ? userRole : null;

  let file = allowed[pageParam];

  // Default landing page when no explicit ?page= parameter is provided.
  // On Deployment B (Internal Console), defaults to role-appropriate view (dashboard for manager, admin for admin/both).
  // On Deployment A (Public Portal), ALWAYS defaults to 'index' (Daily Form) for all visitors, preventing false access blocks.
  if (!file) {
    if (isInternalDeployment && userRole === 'manager') {
      file = 'dashboard';
    } else if (isInternalDeployment && userRole) {
      file = 'admin';
    } else {
      file = 'index';
    }
  }

  // Access control: strict per-role RBAC for internal console pages
  if ((file === 'admin' || file === 'dashboard') && !isInternalDeployment) {
    return renderAccessRestricted(
      'Akses Internal Console Tidak Tersedia di Deployment Ini',
      'Halaman Admin Queue dan Manager Dashboard hanya tersedia melalui Deployment B (Internal Operations Console). ' +
      'Gunakan tautan internal resmi yang memiliki akses Google account.'
    );
  }

  if (file === 'admin' || file === 'dashboard') {
    if (!userRole) {
      return renderAccessRestricted(
        '🔒 Akses Internal Console Terbatas',
        'Halaman ini hanya dapat diakses oleh Admin Operasional dan Manager yang terdaftar dalam sistem.'
      );
    }
    if (file === 'admin' && userRole === 'manager') {
      return renderAccessRestricted(
        '🔒 Akses Ditolak — Hak Akses Tidak Memadai',
        'Peran Anda (Manager) hanya dapat mengakses halaman <strong>Manager Dashboard</strong>. ' +
        'Silakan hubungi Admin Operasional jika Anda membutuhkan akses ke Antrean Triage Admin.'
      );
    }
    if (file === 'dashboard' && userRole === 'admin') {
      return renderAccessRestricted(
        '🔒 Akses Ditolak — Hak Akses Tidak Memadai',
        'Peran Anda (Admin Operasional) hanya dapat mengakses halaman <strong>Admin Queue</strong>. ' +
        'Silakan hubungi Manager jika Anda membutuhkan akses ke Manager Dashboard.'
      );
    }
  }

  const template = HtmlService.createTemplateFromFile(file);
  const webAppUrl = AuthService.getCanonicalWebAppUrl();

  let userEmail = '';
  if (templateUserRole) {
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim();
    } catch (e) {
      userEmail = '';
    }
  }

  template.webAppUrl = webAppUrl;
  template.userRole = templateUserRole;
  template.userEmail = userEmail;
  template.currentPage = file;
  template.urgentKeywordsJson = JSON.stringify(typeof URGENT_KEYWORDS !== 'undefined' ? URGENT_KEYWORDS : []);
  template.warningKeywordsJson = JSON.stringify(typeof WARNING_KEYWORDS !== 'undefined' ? WARNING_KEYWORDS : []);

  return template.evaluate()
    .setTitle('Sistem Pelaporan Digital — Integrated Agriculture')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to render structured Access Restricted response.
 * @param {string} title 
 * @param {string} reason 
 * @returns {HtmlOutput}
 */
function renderAccessRestricted(title, reason) {
  const webAppUrl = AuthService.getCanonicalWebAppUrl();
  const backAction = webAppUrl ? `window.top.location.href='${webAppUrl}?page=index'` : `window.history.back()`;

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F8FA; color: #0F172A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }' +
    '.card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }' +
    '.icon { font-size: 3rem; margin-bottom: 1rem; }' +
    'h2 { font-size: 1.35rem; color: #B91C1C; margin-bottom: 0.75rem; font-weight: 700; }' +
    'p { color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }' +
    '.btn { display: inline-block; background: #15803D; color: #FFFFFF; text-decoration: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; }' +
    '</style></head><body>' +
    '<div class="card">' +
    '<div class="icon">🔒</div>' +
    '<h2>' + title + '</h2>' +
    '<p>' + reason + '</p>' +
    '<button onclick="' + backAction + '" class="btn">Kembali ke Form Publik</button>' +
    '</div></body></html>'
  ).setTitle(title);
}

/**
 * Helper to include external HTML components (CSS/JS).
 * Usage in HTML: <?!= include('style'); ?>
 * @param {string} filename 
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Injects client configuration variables into a script tag preceding app.html contents.
 * @param {string} webAppUrl 
 * @param {string} urgentKeywordsJson 
 * @param {string} warningKeywordsJson 
 * @returns {string}
 */
function includeApp(webAppUrl, urgentKeywordsJson, warningKeywordsJson) {
  const scriptTag = '<script>\n' +
    '  window.SERVER_WEB_APP_URL = ' + JSON.stringify(webAppUrl || '') + ';\n' +
    '  window.SERVER_URGENT_KEYWORDS = ' + (urgentKeywordsJson || '[]') + ';\n' +
    '  window.SERVER_WARNING_KEYWORDS = ' + (warningKeywordsJson || '[]') + ';\n' +
    '</script>\n';
  return scriptTag + HtmlService.createHtmlOutputFromFile('app').getContent();
}

/**
 * Evaluates the shared header partial with page-level template variables.
 * @param {'admin' | 'manager' | 'both' | null} userRole 
 * @param {string} currentPage 
 * @param {string} webAppUrl 
 * @returns {string}
 */
function includeHeader(userRole, currentPage, webAppUrl) {
  const template = HtmlService.createTemplateFromFile('header');
  template.userRole = userRole;
  template.currentPage = currentPage;
  template.webAppUrl = webAppUrl;

  let userEmail = '';
  if (userRole) {
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim();
    } catch (e) {
      userEmail = '';
    }
  }
  template.userEmail = userEmail;

  return template.evaluate().getContent();
}

/**
 * Evaluates the shared sidebar partial for internal console pages.
 * @param {'admin' | 'manager' | 'both' | null} userRole 
 * @param {string} currentPage 
 * @param {string} webAppUrl 
 * @returns {string}
 */
function includeSidebar(userRole, currentPage, webAppUrl) {
  const template = HtmlService.createTemplateFromFile('sidebar');
  template.userRole = userRole;
  template.currentPage = currentPage;
  template.webAppUrl = webAppUrl;

  let userEmail = '';
  if (userRole) {
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim();
    } catch (e) {
      userEmail = '';
    }
  }
  template.userEmail = userEmail;

  return template.evaluate().getContent();
}

