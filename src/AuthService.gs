/**
 * AuthService.gs — Identity, Authentication & Deployment Access Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Handles visitor identity checks, RBAC role evaluation, and deployment isolation.
 * Encapsulates Session.getActiveUser() security policies with zero hardcoded credentials.
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

    // Anonymous or unauthenticated visitor -> always null (Never auto-grant both/admin)
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
    const primaryAdmin = ConfigRepository.getAdminEmail();

    return {
      email: userEmail || (role ? primaryAdmin : '') || '',
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
    if (!email) {
      email = (ConfigRepository.getAdminEmail() || '').toLowerCase();
    }
    if (!email) {
      email = 'user_logout';
    }

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
      return ConfigRepository.getInternalWebAppUrl();
    }

    const publicUrl = this.getConfiguredWebAppUrl_('PUBLIC_WEB_APP_URL');
    if (publicUrl) return publicUrl;
    return ConfigRepository.getPublicWebAppUrl();
  },

  /**
   * Returns true only when the currently executing Web App URL matches the internal deployment.
   * Public deployment and unidentified contexts always return false (Public Portal).
   * @returns {boolean}
   */
  isInternalWebAppDeployment: function() {
    const serviceUrl = this.getExecutingWebAppUrl_();
    if (!serviceUrl) {
      return false;
    }

    // 1. Explicit Public Deployment check: if serviceUrl matches Public Deployment ID -> strictly false
    const publicUrl = ConfigRepository.getPublicWebAppUrl();
    const publicDeploymentId = ConfigRepository.getProperty('PUBLIC_DEPLOYMENT_ID') || 
                               this.extractDeploymentId_(publicUrl) || 
                               'AKfycbyI3IYeIYyhztSgaeMjmuzMyfKt4Ty7axaEpvRSgkAFvjSI3U4DeNcaxHw7Ne6bHMav';

    if (publicDeploymentId && serviceUrl.includes(publicDeploymentId)) {
      return false;
    }

    // 2. Explicit Internal Deployment check: if serviceUrl matches Internal Deployment ID -> true
    const internalUrl = ConfigRepository.getInternalWebAppUrl();
    const internalDeploymentId = ConfigRepository.getProperty('INTERNAL_DEPLOYMENT_ID') || 
                                 this.extractDeploymentId_(internalUrl) || 
                                 'AKfycbxNLMyfiB0DUmQgsdT3hXyHE5L9I-biIvgtH9sH06aE4EKW7265sgkr6STCHcQtcF7p';

    if (internalDeploymentId && serviceUrl.includes(internalDeploymentId)) {
      return true;
    }

    // 3. Dev testing mode (/dev) is treated as internal console
    if (serviceUrl.includes('/dev')) {
      return true;
    }

    // All other contexts safely default to public portal
    return false;
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
