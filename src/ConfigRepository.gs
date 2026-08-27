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
  PLACEHOLDER_ADMIN: 'mpl.sisteminformasi@gmail.com',
  PLACEHOLDER_MANAGER: 'mpl.sisteminformasi@gmail.com',
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

  getSpreadsheetId: function() {
    return this.getProperty('SPREADSHEET_ID') || '1kzJI_6Er-DI1Ty7Kc6sEkl6STK0fTih4RcHh8HJf0dI';
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
    const raw = this.getProperty('PUBLIC_WEB_APP_URL');
    if (!raw || raw.includes('AKfycbzr')) {
      return 'https://script.google.com/macros/s/AKfycbyI3IYeIYyhztSgaeMjmuzMyfKt4Ty7axaEpvRSgkAFvjSI3U4DeNcaxHw7Ne6bHMav/exec';
    }
    return raw;
  },

  getInternalWebAppUrl: function() {
    const raw = this.getProperty('INTERNAL_WEB_APP_URL');
    if (!raw) {
      return 'https://script.google.com/macros/s/AKfycbxNLMyfiB0DUmQgsdT3hXyHE5L9I-biIvgtH9sH06aE4EKW7265sgkr6STCHcQtcF7p/exec';
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
   * Evaluates configured emails and returns effective non-placeholder email strings.
   * @returns {{ effectiveAdmin: string|null, effectiveManager: string|null }}
   */
  getEffectiveRoleEmails: function() {
    const adminEmail = (this.getProperty('ADMIN_EMAIL') || '').toLowerCase();
    const managerEmail = (this.getProperty('MANAGER_EMAIL') || '').toLowerCase();

    const effectiveAdmin = (adminEmail && adminEmail !== this.PLACEHOLDER_ADMIN) ? adminEmail : null;
    const effectiveManager = (managerEmail && managerEmail !== this.PLACEHOLDER_MANAGER) ? managerEmail : null;

    return { effectiveAdmin, effectiveManager };
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
        'Sektor 1 + Ciomas',
        'Sektor 2',
        'Sektor 3',
        'Sektor 4',
        'Gunung Batu'
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
          if (Array.isArray(merged.komoditasOptions) && merged.komoditasOptions.includes('Penyemaian')) {
            merged.komoditasOptions = merged.komoditasOptions
              .filter(k => k !== 'Penyemaian')
              .concat(['Pembibitan Kopi', 'Pembibitan Pala']);
            merged.komoditasOptions = Array.from(new Set(merged.komoditasOptions));
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
