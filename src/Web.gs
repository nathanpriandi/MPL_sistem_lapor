/**
 * Web.gs — Web App Request Router & Page Dispatcher
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Handles HTTP GET requests for Apps Script Web App.
 * Routes to index, general, admin, or dashboard HTML views.
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page ? e.parameter.page : 'index').toLowerCase();
  const allowed = { 
    index: 'index', 
    general: 'general', 
    admin: 'admin', 
    dashboard: 'dashboard' 
  };
  const file = allowed[page] || 'index';

  // Access control check for internal admin and manager dashboards
  if ((file === 'admin' || file === 'dashboard') && !isAuthorizedStaff()) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family: sans-serif; padding: 2rem; color: #ef4444;">' +
      '<h2>🔒 Access Restricted / Akses Terbatas</h2>' +
      '<p>Halaman ini hanya dapat diakses oleh Admin Operasional dan Manager yang terdaftar.</p>' +
      '</div>'
    ).setTitle('Access Restricted');
  }

  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle('Sistem Pelaporan Digital — Integrated Agriculture')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Verifies if the active user email belongs to ADMIN_EMAIL or MANAGER_EMAIL.
 * @returns {boolean} True if authorized.
 */
function isAuthorizedStaff() {
  const props = PropertiesService.getScriptProperties();
  const adminEmail = (props.getProperty('ADMIN_EMAIL') || '').toLowerCase();
  const managerEmail = (props.getProperty('MANAGER_EMAIL') || '').toLowerCase();

  const userEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  
  // If running under public "Anyone" deployment without active Google email capture, deny admin access
  if (!userEmail) {
    Logger.log('Notice: Anonymous user session denied access to restricted page.');
    return false;
  }

  return userEmail === adminEmail || userEmail === managerEmail;
}
