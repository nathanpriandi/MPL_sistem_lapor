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
  const isInternalDeployment = isInternalWebAppDeployment();
  const templateUserRole = isInternalDeployment ? userRole : null;

  let file = allowed[pageParam];

  // Default landing page when no explicit ?page= parameter is provided.
  // doGet() cannot distinguish which deployment (Public Access vs Admin & Manager) served the request,
  // so a role-based default here incorrectly redirects authenticated admin/manager identities away from
  // the public form even when they're legitimately testing or using it via the Public Access URL.
  // The internal console must only ever be reached via an explicit ?page=admin or ?page=dashboard link.
  if (!file) {
    file = 'index';
  }

  // Access control: strict per-role RBAC (Option A — as documented in ADMIN_MANUAL.md)
  // admin  → Admin Queue only
  // manager → Manager Dashboard only
  // both   → both pages allowed
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
  const webAppUrl = getCanonicalWebAppUrl();

  template.webAppUrl = webAppUrl;
  template.userRole = templateUserRole;
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
 * Uses the executing deployment URL when Apps Script exposes it. If unavailable,
 * falls back to the explicit deployment URL properties. PUBLIC_WEB_APP_URL is
 * preferred because an inconclusive deployment check is treated as public.
 * @returns {string} Canonical base URL.
 */
function getCanonicalWebAppUrl() {
  const serviceUrl = getExecutingWebAppUrl_();

  if (isValidWebAppUrl_(serviceUrl)) {
    return serviceUrl;
  }

  const publicUrl = getConfiguredWebAppUrl_('PUBLIC_WEB_APP_URL');
  if (publicUrl) {
    return publicUrl;
  }

  const internalUrl = getConfiguredWebAppUrl_('INTERNAL_WEB_APP_URL');
  if (internalUrl) {
    return internalUrl;
  }

  return serviceUrl;
}

/**
 * Returns true only when the currently executing Web App URL matches the
 * explicitly configured internal deployment URL.
 * Compares deployment IDs if available to tolerate /u/N/ profile segment differences.
 * If either side is missing/invalid, the check is intentionally false.
 * @returns {boolean}
 */
function isInternalWebAppDeployment() {
  const serviceUrl = getExecutingWebAppUrl_();
  const internalUrl = getConfiguredWebAppUrl_('INTERNAL_WEB_APP_URL');

  if (!isValidWebAppUrl_(serviceUrl) || !internalUrl) {
    return false;
  }

  const serviceId = extractDeploymentId_(serviceUrl);
  const internalId = extractDeploymentId_(internalUrl);

  if (serviceId && internalId) {
    return serviceId === internalId;
  }

  return normalizeWebAppUrl_(serviceUrl) === normalizeWebAppUrl_(internalUrl);
}

/**
 * Extracts deployment ID from Apps Script Web App URL.
 * Handles standard URLs and URLs containing /u/N/ profile path segments.
 * @param {string} url
 * @returns {string}
 */
function extractDeploymentId_(url) {
  const match = String(url || '').match(/\/s\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

/**
 * Returns deployment diagnostics for Admin/Manager troubleshooting.
 * Privileged operation — requires authenticated Admin or Manager role.
 * @returns {Object} Diagnostic details.
 */
function getDeploymentDiagnostics() {
  const role = getUserRole();
  if (!role) {
    throw new Error('Akses ditolak: Hanya Admin/Manager yang dapat mengakses diagnosa.');
  }

  const serviceUrl = getExecutingWebAppUrl_();
  const publicUrl = getConfiguredWebAppUrl_('PUBLIC_WEB_APP_URL');
  const internalUrl = getConfiguredWebAppUrl_('INTERNAL_WEB_APP_URL');

  return {
    executingUrl: serviceUrl,
    configuredPublicUrl: publicUrl,
    configuredInternalUrl: internalUrl,
    executingDeploymentId: extractDeploymentId_(serviceUrl),
    publicDeploymentId: extractDeploymentId_(publicUrl),
    internalDeploymentId: extractDeploymentId_(internalUrl),
    isInternalDeployment: isInternalWebAppDeployment(),
    userRole: role
  };
}

/**
 * Reads and validates a configured Web App URL from Script Properties.
 * @param {string} propertyName
 * @returns {string}
 */
function getConfiguredWebAppUrl_(propertyName) {
  const props = PropertiesService.getScriptProperties();
  const configuredUrl = (props.getProperty(propertyName) || '').trim();

  return isValidWebAppUrl_(configuredUrl) ? configuredUrl : '';
}

/**
 * Reads the URL of the deployment currently serving this request.
 * @returns {string}
 */
function getExecutingWebAppUrl_() {
  try {
    return (ScriptApp.getService().getUrl() || '').trim();
  } catch (err) {
    Logger.log('Notice: ScriptApp.getService().getUrl() unavailable.');
    return '';
  }
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isValidWebAppUrl_(url) {
  return !!(url && url.indexOf('script.google.com') !== -1);
}

/**
 * Normalizes a Web App URL for equality checks.
 * @param {string} url
 * @returns {string}
 */
function normalizeWebAppUrl_(url) {
  return String(url || '').trim().split('?')[0].replace(/\/+$/, '');
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
 * Usage in HTML: <?!= include('style'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Injects client configuration variables into a script tag preceding app.html contents.
 * Evaluates dynamically per request to ensure valid client variables.
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
  return template.evaluate().getContent();
}

/**
 * Evaluates active user email against script properties ADMIN_EMAIL and MANAGER_EMAIL.
 * Uses ONLY Session.getActiveUser() — never getEffectiveUser().
 * Under an "Execute as: Me" deployment, getEffectiveUser() always resolves to the developer's
 * own account, not the visitor's, so it must never be used as a visitor identity source.
 * Returns null for any email not explicitly listed — no fallback, no auto-bind.
 * Requires ADMIN_EMAIL and/or MANAGER_EMAIL to be set in Script Properties to real email addresses.
 * @returns {'admin' | 'manager' | 'both' | null} Role string or null if unauthorized.
 */
function getUserRole() {
  const props = PropertiesService.getScriptProperties();
  const adminEmail = (props.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
  const managerEmail = (props.getProperty('MANAGER_EMAIL') || '').trim().toLowerCase();

  // Only use getActiveUser() — it returns the *visitor's* identity.
  // getEffectiveUser() returns the script owner's identity under "Execute as: Me" and must NOT
  // be used as a fallback, or every anonymous public visitor would resolve to the developer.
  let userEmail = '';
  try {
    userEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    Logger.log('Notice: Session.getActiveUser().getEmail() restricted/unavailable.');
  }

  // No identifiable visitor → deny
  if (!userEmail) return null;

  // SECURITY: If Script Properties still hold placeholder defaults or are empty, treat as
  // unconfigured — deny access rather than granting admin to whoever happens to visit first.
  // Action required: set ADMIN_EMAIL and MANAGER_EMAIL in Apps Script → Project Settings → Script Properties.
  const PLACEHOLDER_ADMIN = 'admin.operasional@perusahaan-agri.co.id';
  const PLACEHOLDER_MANAGER = 'manager.operasional@perusahaan-agri.co.id';

  const effectiveAdmin = (adminEmail && adminEmail !== PLACEHOLDER_ADMIN) ? adminEmail : null;
  const effectiveManager = (managerEmail && managerEmail !== PLACEHOLDER_MANAGER) ? managerEmail : null;

  // If neither role is configured, deny all access
  if (!effectiveAdmin && !effectiveManager) return null;

  const isAdmin = effectiveAdmin && userEmail === effectiveAdmin;
  const isManager = effectiveManager && userEmail === effectiveManager;

  if (isAdmin && isManager) return 'both';
  if (isAdmin) return 'admin';
  if (isManager) return 'manager';

  // Unrecognized identity — deny by default
  return null;
}

/**
 * Returns active user email and role for client consumption.
 * Uses only Session.getActiveUser() — never getEffectiveUser() (see getUserRole() for rationale).
 * @returns {Object} { email: string, role: string|null, isAuthorized: boolean }
 */
function getUserIdentityInfo() {
  let userEmail = '';
  try {
    userEmail = (Session.getActiveUser().getEmail() || '').trim();
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
