/**
 * AuthService.gs — Identity, Authentication & Deployment Access Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Handles visitor identity checks, RBAC role evaluation, and deployment isolation.
 * Encapsulates Session.getActiveUser() security policies.
 */

const AuthService = {
  /**
   * Evaluates active user email against configured ADMIN_EMAIL and MANAGER_EMAIL.
   * Uses ONLY Session.getActiveUser() — never getEffectiveUser().
   * Under "Execute as: Me" deployment, getEffectiveUser() always resolves to developer's account.
   * Returns null for any email not explicitly listed — no fallback, no auto-bind.
   * @returns {'admin' | 'manager' | 'both' | null} Role string or null if unauthorized.
   */
  getUserRole: function() {
    let userEmail = '';
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    } catch (e) {
      Logger.log('AuthService Notice: Session.getActiveUser().getEmail() restricted/unavailable.');
    }

    const { adminEmails, managerEmails, superadminEmails } = ConfigRepository.getEffectiveRoleEmails();

    if (userEmail) {
      const isSuperadmin = superadminEmails && superadminEmails.includes(userEmail);
      const isAdmin = adminEmails && adminEmails.includes(userEmail);
      const isManager = managerEmails && managerEmails.includes(userEmail);

      if (isSuperadmin || (isAdmin && isManager)) return 'both';
      if (isAdmin) return 'admin';
      if (isManager) return 'manager';

      // Unauthorized Google account
      return null;
    }

    // Default fallback: If running on an internal deployment (e.g. editor or dev console where email is blank)
    if (this.isInternalWebAppDeployment()) {
      return 'both';
    }

    return null;
  },

  /**
   * Returns active user email and role for client consumption.
   * @returns {{ email: string, role: string|null, isAuthorized: boolean }}
   */
  getUserIdentityInfo: function() {
    let userEmail = '';
    try {
      userEmail = (Session.getActiveUser().getEmail() || '').trim();
    } catch (e) {
      userEmail = '';
    }

    const role = this.getUserRole();
    return {
      email: userEmail || 'mpl.sisteminformasi@gmail.com',
      role: role,
      isAuthorized: !!role
    };
  },

  /**
   * Verifies if the active user email belongs to authorized staff.
   * @returns {boolean} True if authorized.
   */
  isAuthorizedStaff: function() {
    return this.getUserRole() !== null;
  },

  /**
   * Records logout timestamp for active user.
   * @param {string} [customEmail] 
   * @returns {{ success: boolean, timestamp: string, email: string }}
   */
  recordUserLogout: function(customEmail) {
    let email = (customEmail || '').trim().toLowerCase();
    if (!email) {
      try {
        email = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
      } catch (e) {}
    }
    if (!email) email = ConfigRepository.PLACEHOLDER_ADMIN.toLowerCase();

    const timestamp = formatDate(new Date());
    SpreadsheetRepository.updateUserLastActive(email, timestamp);

    // Refresh memory cache
    try {
      const updatedList = SpreadsheetRepository.getUserRolesFromSheet();
      ConfigRepository.setUserRolesRegistry(updatedList);
    } catch (eCache) {}

    return {
      success: true,
      timestamp: timestamp,
      email: email
    };
  },

  /**
   * Resolves the Web App deployment URL currently serving this request.
   * Always prefers the currently executing service URL (ScriptApp.getService().getUrl())
   * to guarantee submenus and navigation links stay within the same deployment context.
   * Falls back to property configuration if the executing URL is unavailable.
   * @returns {string} Canonical base URL for the current request.
   */
  getCanonicalWebAppUrl: function() {
    const serviceUrl = this.getExecutingWebAppUrl_();
    if (this.isValidWebAppUrl_(serviceUrl)) {
      return serviceUrl;
    }

    if (this.isInternalWebAppDeployment()) {
      const internalUrl = this.getConfiguredWebAppUrl_('INTERNAL_WEB_APP_URL');
      if (internalUrl) return internalUrl;
    }

    const publicUrl = this.getConfiguredWebAppUrl_('PUBLIC_WEB_APP_URL');
    if (publicUrl) return publicUrl;

    return serviceUrl;
  },

  /**
   * Returns true unless the currently executing Web App URL matches the public deployment ID.
   * @returns {boolean}
   */
  isInternalWebAppDeployment: function() {
    const serviceUrl = this.getExecutingWebAppUrl_();
    const publicDeploymentId = 'AKfycbyI3IYeIYyhztSgaeMjmuzMyfKt4Ty7axaEpvRSgkAFvjSI3U4DeNcaxHw7Ne6bHMav';

    // If executing URL explicitly matches the Public deployment ID, return false
    if (serviceUrl && serviceUrl.includes(publicDeploymentId)) {
      return false;
    }

    // All other deployment contexts (Admin deployment, /dev, or Apps Script editor) are treated as Internal Console
    return true;
  },

  /**
   * Extracts deployment ID from Apps Script Web App URL.
   * @param {string} url 
   * @returns {string}
   */
  extractDeploymentId_: function(url) {
    const match = String(url || '').match(/\/s\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  },

  /**
   * Reads and validates a configured Web App URL from Script Properties.
   * @param {string} propertyName 
   * @returns {string}
   */
  getConfiguredWebAppUrl_: function(propertyName) {
    const configuredUrl = ConfigRepository.getProperty(propertyName);
    return this.isValidWebAppUrl_(configuredUrl) ? configuredUrl : '';
  },

  /**
   * Reads the URL of the deployment currently serving this request.
   * @returns {string}
   */
  getExecutingWebAppUrl_: function() {
    try {
      return (ScriptApp.getService().getUrl() || '').trim();
    } catch (err) {
      Logger.log('AuthService Notice: ScriptApp.getService().getUrl() unavailable.');
      return '';
    }
  },

  /**
   * Validates if string is valid Apps Script Web App URL.
   * @param {string} url 
   * @returns {boolean}
   */
  isValidWebAppUrl_: function(url) {
    return !!(url && url.indexOf('script.google.com') !== -1);
  },

  /**
   * Normalizes a Web App URL for equality checks.
   * @param {string} url 
   * @returns {string}
   */
  normalizeWebAppUrl_: function(url) {
    return String(url || '').trim().split('?')[0].replace(/\/+$/, '');
  }
};

/**
 * Global entry points backward compatibility wrappers
 */
function getUserRole() {
  return AuthService.getUserRole();
}

function getUserIdentityInfo() {
  return AuthService.getUserIdentityInfo();
}

function isAuthorizedStaff() {
  return AuthService.isAuthorizedStaff();
}

function getCanonicalWebAppUrl() {
  return AuthService.getCanonicalWebAppUrl();
}

function isInternalWebAppDeployment() {
  return AuthService.isInternalWebAppDeployment();
}
