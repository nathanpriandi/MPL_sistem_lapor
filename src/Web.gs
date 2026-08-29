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
 * Routes to index (operational form), dynamicform, admin queue, manager dashboard, or form management views.
 * @param {Object} e - HTTP GET Event object.
 * @returns {HtmlOutput} Evaluated HTML response.
 */
function doGet(e) {
  let pageParam = (e && e.parameter && e.parameter.page ? e.parameter.page : '').toLowerCase().trim();
  const allowed = { 
    index: 'index', 
    dynamicform: 'dynamicform',
    admin: 'admin', 
    dashboard: 'dashboard',
    forms: 'forms',
    employees: 'employees',
    roles: 'roles',
    camera: 'camera'
  };

  const userRole = AuthService.getUserRole();
  const isInternalDeployment = AuthService.isInternalWebAppDeployment();
  const templateUserRole = isInternalDeployment ? userRole : null;

  let file = allowed[pageParam];

  // Default landing page when no explicit ?page= parameter is provided.
  // On Admin Deployment (isInternalDeployment === true), defaults to 'admin' or 'dashboard'.
  // On Public Deployment, defaults to 'index' (Daily Operational Form).
  if (!file) {
    if (isInternalDeployment) {
      file = (userRole === 'manager') ? 'dashboard' : 'admin';
    } else {
      file = 'index';
    }
  }

  // Access control: strict per-role RBAC for internal console pages
  if ((file === 'admin' || file === 'dashboard' || file === 'forms' || file === 'employees' || file === 'roles') && !isInternalDeployment) {
    return renderAccessRestricted(
      'Akses Internal Console Tidak Tersedia di Deployment Ini',
      'Halaman Internal Console hanya tersedia melalui Deployment Admin internal.'
    );
  }

  if (file === 'admin' || file === 'dashboard' || file === 'forms' || file === 'employees' || file === 'roles') {
    if (!userRole) {
      return renderAccessRestricted(
        '🔒 Akses Internal Console Terbatas',
        'Akun Google Anda belum terdaftar dalam sistem. Silakan hubungi Superadmin di <code>mpl.sisteminformasi@gmail.com</code> untuk mendaftarkan hak akses akun Anda.'
      );
    }

    // 1. Hak Akses & Role (?page=roles) -> STRICTLY SUPERADMIN ONLY
    if (file === 'roles' && userRole !== 'both') {
      return renderAccessRestricted(
        '🔒 Akses Ditolak — Khusus Superadmin',
        'Halaman <strong>Manajemen Hak Akses & Role</strong> hanya dapat diakses oleh <strong>Superadmin</strong> sistem.'
      );
    }

    // 2. Manager Role -> STRICTLY MANAGER DASHBOARD ONLY
    if (userRole === 'manager' && (file === 'admin' || file === 'forms' || file === 'employees' || file === 'roles')) {
      return renderAccessRestricted(
        '🔒 Akses Ditolak — Hak Akses Tidak Memadai',
        'Peran Anda (<strong>Manager Eksekutif</strong>) hanya memiliki izin untuk mengakses <strong>Dashboard Manajer</strong>. Silakan hubungi Superadmin jika Anda membutuhkan wewenang lain.'
      );
    }

    // 3. Admin Role -> STRICTLY ADMIN MODULES ONLY (Antrean Admin, Karyawan, Form)
    if (userRole === 'admin' && (file === 'dashboard' || file === 'roles')) {
      return renderAccessRestricted(
        '🔒 Akses Ditolak — Hak Akses Tidak Memadai',
        'Peran Anda (<strong>Admin Operasional</strong>) hanya memiliki izin untuk mengakses modul operasional (<strong>Antrean Admin</strong>, <strong>Pengaturan Karyawan</strong>, dan <strong>Pengaturan Form</strong>).'
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

  const pageTitleMap = {
    'index': 'Sistem Lapor MPL | Laporan Operasional',
    'dynamicform': 'Sistem Lapor MPL | Laporan Operasional',
    'dashboard': 'Sistem Lapor MPL | Dashboard Manajer',
    'admin': 'Sistem Lapor MPL | Antrean Admin',
    'forms': 'Sistem Lapor MPL | Pengaturan Form',
    'employees': 'Sistem Lapor MPL | Pengaturan Karyawan',
    'roles': 'Sistem Lapor MPL | Hak Akses & Role',
    'camera': 'Sistem Lapor MPL | Kamera Lapangan'
  };
  const finalTitle = pageTitleMap[file] || 'Sistem Lapor MPL';

  return template.evaluate()
    .setTitle(finalTitle)
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
  let userEmail = '';
  try {
    userEmail = (Session.getActiveUser().getEmail() || '').trim();
  } catch (e) {}

  const webAppUrl = AuthService.getCanonicalWebAppUrl();
  const backAction = webAppUrl ? `window.top.location.href='${webAppUrl}?page=index'` : `window.history.back()`;

  let emailBanner = '';
  if (userEmail) {
    emailBanner = `<div style="margin-bottom: 1.25rem; padding: 0.65rem 0.85rem; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; font-size: 0.85rem; color: #92400E; text-align: left;">
      <div style="font-weight: 600;">Akun Google Terdeteksi:</div>
      <div style="font-family: monospace; word-break: break-all; margin-top: 2px;">${userEmail}</div>
    </div>`;
  }

  const screenTitle = title ? `Sistem Lapor MPL | ${title}` : 'Sistem Lapor MPL | Akses Terbatas';

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F8FAFC; color: #0F172A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }' +
    '.card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 2.25rem; max-width: 480px; width: 100%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); text-align: center; }' +
    '.brand-logo { margin-bottom: 1.25rem; color: #0F6B3A; }' +
    '.icon-wrap { width: 56px; height: 56px; margin: 0 auto 1.25rem; background: #FEF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #B91C1C; }' +
    'h2 { font-size: 1.35rem; color: #0F172A; margin-bottom: 0.75rem; font-weight: 700; }' +
    'p { color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }' +
    '.btn { display: inline-block; background: #0F6B3A; color: #FFFFFF; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; transition: background 0.15s; }' +
    '.btn:hover { background: #0B542D; }' +
    '</style></head><body>' +
    '<div class="card">' +
    '<div class="icon-wrap"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>' +
    '<h2>' + (title || 'Akses Terbatas') + '</h2>' +
    emailBanner +
    '<p>' + reason + '</p>' +
    '<button onclick="' + backAction + '" class="btn">Kembali ke Form Laporan</button>' +
    '</div></body></html>'
  ).setTitle(screenTitle);
}

/**
 * Helper to include external HTML components (CSS/JS).
 * Usage in HTML: <?!= include('style'); ?>
 * @param {string} filename 
 * @returns {string}
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    Logger.log('include error for ' + filename + ': ' + err.toString());
    return '';
  }
}

/**
 * Injects client configuration variables into a script tag preceding app.html contents.
 * @param {string} webAppUrl 
 * @returns {string}
 */
function includeApp(webAppUrl) {
  const scriptTag = '<script>\n' +
    '  window.SERVER_WEB_APP_URL = ' + JSON.stringify(webAppUrl || '') + ';\n' +
    '</script>\n';
  try {
    return scriptTag + HtmlService.createHtmlOutputFromFile('app').getContent();
  } catch (err) {
    Logger.log('includeApp error: ' + err.toString());
    return scriptTag;
  }
}

/**
 * Evaluates the shared header partial with page-level template variables.
 * @param {'admin' | 'manager' | 'both' | null} userRole 
 * @param {string} currentPage 
 * @param {string} webAppUrl 
 * @returns {string}
 */
function includeHeader(userRole, currentPage, webAppUrl) {
  try {
    const template = HtmlService.createTemplateFromFile('header');
    template.userRole = userRole || null;
    template.currentPage = currentPage || 'index';
    template.webAppUrl = webAppUrl || AuthService.getCanonicalWebAppUrl();

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
  } catch (err) {
    Logger.log('includeHeader error: ' + err.toString());
    return '';
  }
}

/**
 * Evaluates the shared sidebar partial for internal console pages.
 * @param {'admin' | 'manager' | 'both' | null} userRole 
 * @param {string} currentPage 
 * @param {string} webAppUrl 
 * @returns {string}
 */
function includeSidebar(userRole, currentPage, webAppUrl) {
  try {
    const template = HtmlService.createTemplateFromFile('sidebar');
    template.userRole = userRole || '';
    template.currentPage = currentPage || '';
    template.webAppUrl = webAppUrl || AuthService.getCanonicalWebAppUrl();

    let userEmail = '';
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim();
    } catch (e) {
      userEmail = '';
    }
    template.userEmail = userEmail;

    return template.evaluate().getContent();
  } catch (err) {
    Logger.log('includeSidebar error: ' + err.toString());
    return '';
  }
}

