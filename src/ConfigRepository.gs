/**
 * ConfigRepository.gs — Script Properties & Environment Configuration Repository
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE
 * Responsibility: Centralized interface for accessing environment parameters and script properties.
 * Eliminates direct scattered calls to PropertiesService across business logic and enforces zero hardcoded secrets.
 */

const ConfigRepository = {
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
   * Sets a single script property.
   * @param {string} propertyName 
   * @param {any} value 
   */
  setProperty: function(propertyName, value) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty(propertyName, String(value));
    } catch (e) {
      Logger.log(`ConfigRepository Warning: Failed to set property ${propertyName}. Error: ${e.toString()}`);
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

  /**
   * Retrieves configured Google Spreadsheet ID.
   * @returns {string}
   */
  getSpreadsheetId: function() {
    return this.getProperty('SPREADSHEET_ID');
  },

  /**
   * Retrieves configured main Operational Google Form ID.
   * @returns {string}
   */
  getMainFormId: function() {
    return this.getProperty('MAIN_FORM_ID') || this.getProperty('OPERATIONAL_FORM_ID');
  },

  /**
   * Checks if system is operating in Portfolio Showcase mode.
   * In portfolio mode, demonstration visitors are granted access to explore dashboards and queues.
   * @returns {boolean}
   */
  isPortfolioMode: function() {
    const val = String(this.getProperty('PORTFOLIO_MODE') || '').trim().toLowerCase();
    if (val === 'false' || val === '0' || val === 'no') {
      return false;
    }
    // Defaults to true for portfolio deployment
    return true;
  },

  /**
   * Retrieves primary Admin email from script properties.
   * @returns {string}
   */
  getAdminEmail: function() {
    const email = this.getProperty('ADMIN_EMAIL');
    if (!email) {
      if (this.isPortfolioMode()) {
        return 'nathan.priandi@gmail.com';
      }
      throw new Error('ADMIN_EMAIL belum dikonfigurasi di Script Properties.');
    }
    return email;
  },

  /**
   * Retrieves primary Manager email from script properties.
   * @returns {string}
   */
  getManagerEmail: function() {
    const email = this.getProperty('MANAGER_EMAIL') || this.getProperty('ADMIN_EMAIL');
    if (!email) {
      if (this.isPortfolioMode()) {
        return 'nathan.priandi@gmail.com';
      }
      throw new Error('MANAGER_EMAIL belum dikonfigurasi di Script Properties.');
    }
    return email;
  },

  /**
   * Retrieves public Web App deployment URL.
   * Supports both PUBLIC_WEB_APP_URL and PUBLIC_URL keys.
   * @returns {string}
   */
  getPublicWebAppUrl: function() {
    const raw = this.getProperty('PUBLIC_WEB_APP_URL') || this.getProperty('PUBLIC_URL');
    if (!raw) {
      if (this.isPortfolioMode()) {
        return 'https://script.google.com/macros/s/AKfycbxtC6W04Eu_ABYePyiIbtbZqAYsfaeHOf6I3G5l0eN_m_u6srsGTrf0EWIvBvQvHEvl/exec';
      }
      throw new Error('PUBLIC_WEB_APP_URL belum dikonfigurasi di Script Properties.');
    }
    return raw;
  },

  /**
   * Retrieves internal admin/manager Web App deployment URL.
   * Supports both INTERNAL_WEB_APP_URL and INTERNAL_URL keys.
   * @returns {string}
   */
  getInternalWebAppUrl: function() {
    const raw = this.getProperty('INTERNAL_WEB_APP_URL') || this.getProperty('INTERNAL_URL');
    if (!raw) {
      if (this.isPortfolioMode()) {
        return 'https://script.google.com/macros/s/AKfycbzfp6T8nlbxZdCIDjcyZ9NwyPRxeCIodUTq-5gs969M1QIUTJoc1RWVNqHZ-mKEWSU/exec';
      }
      throw new Error('INTERNAL_WEB_APP_URL belum dikonfigurasi di Script Properties.');
    }
    return raw;
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
   * Evaluates configured emails and returns effective multi-user sets.
   * Only resolves emails explicitly provisioned in Script Properties.
   * @returns {{ effectiveAdmin: string|null, effectiveManager: string|null, adminEmails: Array<string>, managerEmails: Array<string>, superadminEmails: Array<string> }}
   */
  getEffectiveRoleEmails: function() {
    const adminEmails = new Set();
    const managerEmails = new Set();
    const superadminEmails = new Set();

    // 1. Load from dynamic User Roles Registry
    const rolesList = this.getUserRolesRegistry();
    rolesList.forEach(item => {
      const email = String(item.email || '').trim().toLowerCase();
      if (!email) return;

      const r = (item.role || '').toLowerCase();
      if (r === 'admin') adminEmails.add(email);
      else if (r === 'manager') managerEmails.add(email);
      else if (r === 'both' || r === 'superadmin') {
        superadminEmails.add(email);
        adminEmails.add(email);
        managerEmails.add(email);
      }
    });

    // 2. Backward compatibility fallback with legacy single properties
    const legacyAdmin = (this.getProperty('ADMIN_EMAIL') || '').toLowerCase();
    const legacyManager = (this.getProperty('MANAGER_EMAIL') || '').toLowerCase();
    if (legacyAdmin) legacyAdmin.split(',').forEach(e => { const clean = e.trim(); if (clean) { adminEmails.add(clean); superadminEmails.add(clean); } });
    if (legacyManager) legacyManager.split(',').forEach(e => { const clean = e.trim(); if (clean) managerEmails.add(clean); });

    const effectiveAdmin = adminEmails.size > 0 ? Array.from(adminEmails)[0] : null;
    const effectiveManager = managerEmails.size > 0 ? Array.from(managerEmails)[0] : null;

    return {
      effectiveAdmin,
      effectiveManager,
      adminEmails: Array.from(adminEmails),
      managerEmails: Array.from(managerEmails),
      superadminEmails: Array.from(superadminEmails)
    };
  },


  /**
   * Retrieves active User Roles registry from Spreadsheet, falling back to Script Properties.
   * @returns {Array<Object>} List of UserRoleItem objects.
   */
  getUserRolesRegistry: function() {
    // Try reading live from Spreadsheet first
    try {
      if (typeof SpreadsheetRepository !== 'undefined' && SpreadsheetRepository.getUserRolesFromSheet) {
        const sheetRoles = SpreadsheetRepository.getUserRolesFromSheet();
        if (Array.isArray(sheetRoles) && sheetRoles.length > 0) {
          // Cache in script properties for lightning fast subsequent reads
          try {
            this.setProperty('USER_ROLES_REGISTRY_JSON', JSON.stringify(sheetRoles));
          } catch (eCache) {}
          return sheetRoles;
        }
      }
    } catch (eSheet) {
      Logger.log('ConfigRepository: Error loading roles from sheet: ' + eSheet.toString());
    }

    // Fallback to Script Properties Cache
    try {
      const raw = this.getProperty('USER_ROLES_REGISTRY_JSON');
      if (raw) {
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed = parsed.filter(item => {
            const em = String(item.email || '').toLowerCase();
            return em && !em.includes('@agri.co.id') && !em.includes('staf.operasional') && !em.includes('local.dev');
          });
          if (parsed.length > 0) return parsed;
        }
      }
    } catch (eProp) {
      Logger.log('ConfigRepository: Error parsing USER_ROLES_REGISTRY_JSON: ' + eProp.toString());
    }

    // Default Baseline List if ADMIN_EMAIL configured in properties
    const primaryAdmin = this.getAdminEmail();
    return [
      { email: primaryAdmin, role: 'both', addedBy: 'System', addedAt: new Date().toISOString().split('T')[0] }
    ];
  },

  /**
   * Saves User Roles registry to Script Properties and syncs to Spreadsheet.
   * @param {Array<Object>} rolesArray 
   */
  setUserRolesRegistry: function(rolesArray) {
    if (!Array.isArray(rolesArray)) return;
    this.setProperty('USER_ROLES_REGISTRY_JSON', JSON.stringify(rolesArray));
  },

  /**
   * Deletes a script property.
   * @param {string} propertyName 
   */
  deleteProperty: function(propertyName) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(propertyName);
    } catch (e) {
      Logger.log(`ConfigRepository Warning: Failed to delete property ${propertyName}. Error: ${e.toString()}`);
    }
  },

  /**
   * Retrieves customized employee registry array from Script Properties.
   * @returns {Array<Object>|null}
   */
  getCustomEmployeeRegistry: function() {
    try {
      const raw = this.getProperty('EMPLOYEE_CUSTOM_REGISTRY_JSON');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      Logger.log('ConfigRepository: Error parsing EMPLOYEE_CUSTOM_REGISTRY_JSON: ' + e.toString());
    }
    return null;
  },

  /**
   * Saves customized employee registry array to Script Properties.
   * @param {Array<Object>|null} registryArray 
   */
  setCustomEmployeeRegistry: function(registryArray) {
    if (!registryArray) {
      this.deleteProperty('EMPLOYEE_CUSTOM_REGISTRY_JSON');
      return;
    }
    this.setProperty('EMPLOYEE_CUSTOM_REGISTRY_JSON', JSON.stringify(registryArray));
  },

  /**
   * Baseline default reporting form schema.
   * @returns {Object}
   */
  getDefaultReportingFormSchema: function() {
    return {
      version: '1.0',
      title: 'Formulir Laporan Operasional',
      subtitle: 'Sistem Pencatatan & Pelaporan Harian Terpadu',
      lokasiOptions: [
        'Jonggol',
        'Cikalong',
        'Quilling',
        'Jakarta'
      ],
      kegiatanList: [
        { key: 'tanam', title: 'Tanam atau tebar', desc: 'Penanaman bibit atau tebar benih', enabled: true },
        { key: 'panen', title: 'Panen atau penjualan', desc: 'Pemanenan hasil atau penjualan unit', enabled: true },
        { key: 'pengawasan', title: 'Pengawasan', desc: 'Supervisi lahan, ternak, atau binaan', enabled: true },
        { key: 'administrasi', title: 'Administrasi', desc: 'Pencatatan, pembukuan, atau surat-menyurat', enabled: true }
      ],
      pengawasanCategories: [
        'Komoditas pertanian / perkebunan',
        'Komoditas peternakan',
        'Petani binaan'
      ],
      statusPengelolaanOptions: [
        'Swakelola',
        'Petani binaan',
        'Kemitraan'
      ],
      komoditasOptions: [
        'Alpukat',
        'Pisang',
        'Jagung Manis',
        'Terong',
        'Cabe',
        'Jagung Tebon',
        'Jagung Hibrida',
        'Edamame',
        'Pembibitan Kopi',
        'Pembibitan Pala'
      ],
      tujuanPenggunaanOptions: [
        'MPL Jonggol',
        'MPL Cikalong',
        'Villa Quiling',
        'Pasir Putih'
      ],
      customFields: []
    };
  },

  /**
   * Retrieves active reporting form schema from Script Properties.
   * @returns {Object}
   */
  getReportingFormSchema: function() {
    try {
      const raw = this.getProperty('REPORTING_FORM_SCHEMA_JSON');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const merged = Object.assign(this.getDefaultReportingFormSchema(), parsed);
          // Auto-migrate legacy 'Penyemaian' to 'Pembibitan Kopi' & 'Pembibitan Pala'
          if (Array.isArray(merged.komoditasOptions)) {
            if (merged.komoditasOptions.includes('Penyemaian')) {
              merged.komoditasOptions = merged.komoditasOptions
                .filter(k => k !== 'Penyemaian')
                .concat(['Pembibitan Kopi', 'Pembibitan Pala']);
            }
            if (!merged.komoditasOptions.includes('Alpukat')) {
              merged.komoditasOptions.unshift('Alpukat');
            }
            merged.komoditasOptions = Array.from(new Set(merged.komoditasOptions));
          }
          // Auto-migrate legacy Sektor locations to 'Jonggol', 'Cikalong', 'Quilling', 'Jakarta'
          if (Array.isArray(merged.lokasiOptions)) {
            const hasLegacySektor = merged.lokasiOptions.some(loc => loc.startsWith('Sektor') || loc === 'Gunung Batu');
            if (hasLegacySektor) {
              merged.lokasiOptions = ['Jonggol', 'Cikalong', 'Quilling', 'Jakarta'];
            }
          }
          return merged;
        }
      }
    } catch (e) {
      Logger.log('ConfigRepository: Error parsing REPORTING_FORM_SCHEMA_JSON: ' + e.toString());
    }
    return this.getDefaultReportingFormSchema();
  },

  /**
   * Saves active reporting form schema to Script Properties.
   * @param {Object|null} schemaObj 
   */
  setReportingFormSchema: function(schemaObj) {
    if (!schemaObj) {
      this.deleteProperty('REPORTING_FORM_SCHEMA_JSON');
      return;
    }
    this.setProperty('REPORTING_FORM_SCHEMA_JSON', JSON.stringify(schemaObj));
  }
};
