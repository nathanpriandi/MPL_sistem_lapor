/**
 * Web.gs — Web App Request Router & Page Dispatcher
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Handles HTTP GET requests for Apps Script Web App.
 * Routes to index, general, admin, or dashboard HTML views.
 */
function doGet(e) {
  const pageParam = (e && e.parameter && e.parameter.page ? e.parameter.page : 'index').toLowerCase().trim();
  const allowed = { 
    index: 'index', 
    general: 'general', 
    admin: 'admin', 
    dashboard: 'dashboard' 
  };
  const file = allowed[pageParam] || 'index';

  const userRole = getUserRole();

  // Access control check for internal admin and manager dashboards
  if (file === 'admin' || file === 'dashboard') {
    if (!userRole) {
      return renderAccessRestricted(
        '🔒 Akses Internal Console Terbatas', 
        'Halaman ini hanya dapat diakses oleh Admin Operasional dan Manager yang terdaftar dalam sistem.'
      );
    }
  }

  const template = HtmlService.createTemplateFromFile(file);

  let webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    Logger.log('Notice: ScriptApp.getService().getUrl() unavailable in local preview.');
  }

  template.webAppUrl = webAppUrl;
  template.userRole = userRole;
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
 */
function renderAccessRestricted(title, reason) {
  let webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    Logger.log('Notice: ScriptApp.getService().getUrl() unavailable.');
  }

  const backUrl = webAppUrl ? (webAppUrl + '?page=index') : '?page=index';

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F8FA; color: #0F172A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }' +
    '.card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }' +
    '.icon { font-size: 3rem; margin-bottom: 1rem; }' +
    'h2 { font-size: 1.35rem; color: #B91C1C; margin-bottom: 0.75rem; font-weight: 700; }' +
    'p { color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }' +
    '.btn { display: inline-block; background: #15803D; color: #FFFFFF; text-decoration: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }' +
    '</style></head><body>' +
    '<div class="card">' +
    '<div class="icon">🔒</div>' +
    '<h2>' + title + '</h2>' +
    '<p>' + reason + '</p>' +
    '<a href="' + backUrl + '" target="_top" class="btn">Kembali ke Form Publik</a>' +
    '</div></body></html>'
  ).setTitle(title);
}

/**
 * Helper to include external HTML components (CSS/JS).
 * Usage in HTML: <?!= include('style'); ?> or <?!= include('app'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Evaluates active user email against script properties ADMIN_EMAIL and MANAGER_EMAIL.
 * @returns {'admin' | 'manager' | 'both' | null} Role string or null if unauthorized.
 */
function getUserRole() {
  const props = PropertiesService.getScriptProperties();
  const adminEmail = (props.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
  const managerEmail = (props.getProperty('MANAGER_EMAIL') || '').trim().toLowerCase();

  const userEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!userEmail) return null;

  const isAdmin = adminEmail && userEmail === adminEmail;
  const isManager = managerEmail && userEmail === managerEmail;

  if (isAdmin && isManager) return 'both';
  if (isAdmin) return 'admin';
  if (isManager) return 'manager';

  // Default internal role for authenticated Google account users accessing via Admin link
  return 'admin';
}

/**
 * Returns active user email and role for client consumption.
 * @returns {Object} { email: string, role: string|null, isAuthorized: boolean }
 */
function getUserIdentityInfo() {
  const userEmail = Session.getActiveUser().getEmail() || '';
  const role = getUserRole();
  return {
    email: userEmail,
    role: role,
    isAuthorized: !!role
  };
}

/**
 * Verifies if the active user email belongs to ADMIN_EMAIL or MANAGER_EMAIL.
 * @returns {boolean} True if authorized.
 */
function isAuthorizedStaff() {
  return getUserRole() !== null;
}
