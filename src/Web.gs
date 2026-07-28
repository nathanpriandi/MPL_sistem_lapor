/**
 * Web.gs — Web App Request Router & Page Dispatcher
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Handles HTTP GET requests for Apps Script Web App.
 * Routes to index, general, admin, or dashboard HTML views.
 */
function doGet(e) {
  const pageParam = (e && e.parameter && e.parameter.page ? e.parameter.page : '').toLowerCase().trim();
  const allowed = { 
    index: 'index', 
    general: 'general', 
    admin: 'admin', 
    dashboard: 'dashboard' 
  };

  const userRole = getUserRole();

  let file = allowed[pageParam];

  // Default landing page when no explicit ?page= parameter is provided.
  // Must be role-aware: defaulting any authenticated user to 'admin' locks out managers.
  if (!file) {
    if (userRole === 'manager') {
      file = 'dashboard'; // Managers land on Manager Dashboard
    } else if (userRole) {
      file = 'admin'; // Admin and 'both' roles land on Admin Queue
    } else {
      file = 'index'; // Public / Field staff land on Daily Form
    }
  }

  // Access control: strict per-role RBAC (Option A — as documented in ADMIN_MANUAL.md)
  // admin  → Admin Queue only
  // manager → Manager Dashboard only
  // both   → both pages allowed
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
  const webAppUrl = getCanonicalWebAppUrl();

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
 * Safely resolves the canonical Web App deployment URL.
 * Falls back to WEB_APP_URL script property if getService().getUrl() is empty or invalid.
 * @returns {string} Canonical base URL.
 */
function getCanonicalWebAppUrl() {
  const props = PropertiesService.getScriptProperties();
  const configuredUrl = (props.getProperty('WEB_APP_URL') || '').trim();

  let serviceUrl = '';
  try {
    serviceUrl = (ScriptApp.getService().getUrl() || '').trim();
  } catch (err) {
    Logger.log('Notice: ScriptApp.getService().getUrl() unavailable.');
  }

  if (serviceUrl && serviceUrl.includes('script.google.com')) {
    return serviceUrl;
  }
  if (configuredUrl && configuredUrl.includes('script.google.com')) {
    return configuredUrl;
  }
  return serviceUrl;
}

/**
 * Helper to render structured Access Restricted response.
 */
function renderAccessRestricted(title, reason) {
  const webAppUrl = getCanonicalWebAppUrl();
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
 * Usage in HTML: <?!= include('style'); ?> or <?!= include('app'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Evaluates active user email against script properties ADMIN_EMAIL and MANAGER_EMAIL.
 * Returns null for any email not explicitly listed — no fallback, no auto-bind.
 * Requires ADMIN_EMAIL and/or MANAGER_EMAIL to be set in Script Properties to real email addresses.
 * @returns {'admin' | 'manager' | 'both' | null} Role string or null if unauthorized.
 */
function getUserRole() {
  const props = PropertiesService.getScriptProperties();
  let adminEmail = (props.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
  let managerEmail = (props.getProperty('MANAGER_EMAIL') || '').trim().toLowerCase();

  let activeEmail = '';
  try {
    activeEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    Logger.log('Notice: Session.getActiveUser().getEmail() restricted/unavailable.');
  }

  let effectiveEmail = '';
  try {
    effectiveEmail = (Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    Logger.log('Notice: Session.getEffectiveUser().getEmail() restricted/unavailable.');
  }

  const userEmail = activeEmail || effectiveEmail;
  if (!userEmail) return null;

  // SECURITY: Do NOT auto-bind or overwrite ADMIN_EMAIL / MANAGER_EMAIL with the visiting user's address.
  // If Script Properties still hold placeholder defaults or are empty, treat as unconfigured —
  // deny access rather than granting admin to whoever happens to visit first.
  // Action required: set ADMIN_EMAIL and MANAGER_EMAIL in Apps Script → Project Settings → Script Properties.
  const PLACEHOLDER_ADMIN = 'admin.operasional@perusahaan-agri.co.id';
  const PLACEHOLDER_MANAGER = 'manager.operasional@perusahaan-agri.co.id';

  const effectiveAdmin = (adminEmail && adminEmail !== PLACEHOLDER_ADMIN) ? adminEmail : null;
  const effectiveManager = (managerEmail && managerEmail !== PLACEHOLDER_MANAGER) ? managerEmail : null;

  // If neither role is configured, deny all access
  if (!effectiveAdmin && !effectiveManager) return null;

  const isAdmin = effectiveAdmin && (userEmail === effectiveAdmin || activeEmail === effectiveAdmin || effectiveEmail === effectiveAdmin);
  const isManager = effectiveManager && (userEmail === effectiveManager || activeEmail === effectiveManager || effectiveEmail === effectiveManager);

  if (isAdmin && isManager) return 'both';
  if (isAdmin) return 'admin';
  if (isManager) return 'manager';

  // Return null for unrecognized identity — deny access by default
  return null;
}

/**
 * Returns active user email and role for client consumption.
 * @returns {Object} { email: string, role: string|null, isAuthorized: boolean }
 */
function getUserIdentityInfo() {
  let userEmail = '';
  try {
    userEmail = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
  } catch (e) {
    userEmail = '';
  }

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
