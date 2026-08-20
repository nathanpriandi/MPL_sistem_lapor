/**
 * ConfigRepository.gs — Script Properties & Environment Configuration Repository
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE
 * Responsibility: Centralized interface for accessing environment parameters and script properties.
 * Eliminates direct scattered calls to PropertiesService across business logic.
 */

const ConfigRepository = {
  // Default system fallback constants
  PLACEHOLDER_ADMIN: 'admin.operasional@perusahaan-agri.co.id',
  PLACEHOLDER_MANAGER: 'manager.operasional@perusahaan-agri.co.id',
  DEFAULT_RETENTION_DAYS: 90,

  /**
   * Reads raw script property string.
   * @param {string} propertyName 
   * @returns {string} Trimmed property string or empty string.
   */
  getProperty: function(propertyName) {
    try {
      const props = PropertiesService.getScriptProperties();
      return (props.getProperty(propertyName) || '').trim();
    } catch (e) {
      Logger.log(`ConfigRepository Warning: Failed to read property ${propertyName}. Error: ${e.toString()}`);
      return '';
    }
  },

  /**
   * Sets multiple properties in bulk.
   * @param {Object} propertiesObj 
   */
  setProperties: function(propertiesObj) {
    const props = PropertiesService.getScriptProperties();
    props.setProperties(propertiesObj);
  },

  getSpreadsheetId: function() {
    return this.getProperty('SPREADSHEET_ID');
  },

  getMainFormId: function() {
    return this.getProperty('MAIN_FORM_ID') || this.getProperty('OPERATIONAL_FORM_ID');
  },

  getAdminEmail: function() {
    return this.getProperty('ADMIN_EMAIL') || this.PLACEHOLDER_ADMIN;
  },

  getManagerEmail: function() {
    return this.getProperty('MANAGER_EMAIL') || this.PLACEHOLDER_MANAGER;
  },

  getPublicWebAppUrl: function() {
    return this.getProperty('PUBLIC_WEB_APP_URL');
  },

  getInternalWebAppUrl: function() {
    return this.getProperty('INTERNAL_WEB_APP_URL');
  },

  /**
   * Returns configured retention period in days.
   * @returns {number} Days (default 90).
   */
  getRetentionDays: function() {
    const val = parseInt(this.getProperty('RETENTION_DAYS'), 10);
    return (val && !isNaN(val) && val > 0) ? val : this.DEFAULT_RETENTION_DAYS;
  },

  /**
   * Evaluates configured emails and returns effective non-placeholder email strings.
   * @returns {{ effectiveAdmin: string|null, effectiveManager: string|null }}
   */
  getEffectiveRoleEmails: function() {
    const adminEmail = (this.getProperty('ADMIN_EMAIL') || '').toLowerCase();
    const managerEmail = (this.getProperty('MANAGER_EMAIL') || '').toLowerCase();

    const effectiveAdmin = (adminEmail && adminEmail !== this.PLACEHOLDER_ADMIN) ? adminEmail : null;
    const effectiveManager = (managerEmail && managerEmail !== this.PLACEHOLDER_MANAGER) ? managerEmail : null;

    return { effectiveAdmin, effectiveManager };
  }
};
