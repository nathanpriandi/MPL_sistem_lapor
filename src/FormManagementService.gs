/**
 * FormManagementService.gs — Form Provisioning & Configuration Management Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages reporting form registrations, Google Forms API provisioning, 
 * per-form dedicated Spreadsheet & Drive folder creation, metadata inspection, 
 * and form CRUD operations for internal administrators.
 */

const FormManagementService = {
  // Script Property key for storing registered forms metadata array
  REGISTERED_FORMS_KEY: 'REGISTERED_FORMS_JSON',

  /**
   * Retrieves all registered forms metadata array.
   * Guarantees default Daily and General forms are always present and provisioned.
   * @returns {Array<Object>} List of form objects.
   */
  getFormList: function() {
    let forms = [];
    try {
      const rawJson = ConfigRepository.getProperty(this.REGISTERED_FORMS_KEY);
      if (rawJson) {
        forms = JSON.parse(rawJson);
      }
    } catch (e) {
      Logger.log('FormManagementService Error parsing registered forms JSON: ' + e.toString());
      forms = [];
    }

    if (!Array.isArray(forms)) forms = [];

    const dailyId = ConfigRepository.getDailyFormId();
    const generalId = ConfigRepository.getGeneralFormId();
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';

    // Guarantee default Daily Form exists
    const hasDaily = forms.some(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily);
    if (!hasDaily) {
      forms.unshift({
        id: dailyId || 'DEFAULT_DAILY_FORM',
        title: 'Laporan Operasional Harian',
        description: 'Formulir pelaporan harian aktivitas operasional pertanian, peternakan, dan pabrik.',
        type: 'harian',
        status: 'aktif',
        editUrl: dailyId ? `https://docs.google.com/forms/d/${dailyId}/edit` : '',
        publicUrl: baseUrl ? `${baseUrl}?page=index` : '?page=index',
        createdAt: new Date().toISOString(),
        isDefault: true,
        isDefaultDaily: true
      });
    } else {
      const dForm = forms.find(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily);
      if (dForm) {
        dForm.isDefault = true;
        dForm.isDefaultDaily = true;
        if (dailyId && (dForm.id === 'DEFAULT_DAILY_FORM' || !dForm.id)) {
          dForm.id = dailyId;
        }
        if (dForm.id && dForm.id !== 'DEFAULT_DAILY_FORM') {
          dForm.editUrl = `https://docs.google.com/forms/d/${dForm.id}/edit`;
        }
        dForm.publicUrl = baseUrl ? `${baseUrl}?page=index` : '?page=index';
      }
    }

    // Guarantee default General Form exists
    const hasGeneral = forms.some(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral);
    if (!hasGeneral) {
      forms.push({
        id: generalId || 'DEFAULT_GENERAL_FORM',
        title: 'Laporan Umum & Catatan Lapangan',
        description: 'Formulir pelaporan kejadian umum, kondisi lapangan, atau insiden.',
        type: 'umum',
        status: 'aktif',
        editUrl: generalId ? `https://docs.google.com/forms/d/${generalId}/edit` : '',
        publicUrl: baseUrl ? `${baseUrl}?page=general` : '?page=general',
        createdAt: new Date().toISOString(),
        isDefault: true,
        isDefaultGeneral: true
      });
    } else {
      const gForm = forms.find(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral);
      if (gForm) {
        gForm.isDefault = true;
        gForm.isDefaultGeneral = true;
        if (generalId && (gForm.id === 'DEFAULT_GENERAL_FORM' || !gForm.id)) {
          gForm.id = generalId;
        }
        if (gForm.id && gForm.id !== 'DEFAULT_GENERAL_FORM') {
          gForm.editUrl = `https://docs.google.com/forms/d/${gForm.id}/edit`;
        }
        gForm.publicUrl = baseUrl ? `${baseUrl}?page=general` : '?page=general';
      }
    }

    // Defensively provision missing dedicated storage (sheetId / driveFolderId)
    forms.forEach(f => {
      if (!f.sheetId) {
        try {
          const storage = this.provisionDedicatedFormStorage_(f.title, f.id);
          f.sheetId = storage.sheetId;
          f.driveFolderId = storage.driveFolderId;
        } catch (e) {
          Logger.log(`FormManagementService Warning: Unable to provision storage for ${f.id}: ${e.toString()}`);
        }
      }
    });

    // Persist normalized registry defensively
    try {
      this.saveFormList_(forms);
    } catch (e) {
      Logger.log('FormManagementService Notice: Unable to persist form list: ' + e.toString());
    }

    // Enrich metadata with live attributes & sheet row counts
    return forms.map(f => {
      try {
        return this.enrichFormMetadata_(f);
      } catch (err) {
        return f;
      }
    });
  },

  /**
   * Provisions a dedicated Drive folder and dedicated Spreadsheet file for a form.
   * Creates Raw and Sensitive tabs following standardized system header structures.
   * @private
   * @param {string} title 
   * @param {string} formId 
   * @returns {{ sheetId: string, driveFolderId: string }}
   */
  provisionDedicatedFormStorage_: function(title, formId) {
    const parentFolderName = 'Reporting System Data';
    let parentFolder;
    try {
      const folderIter = DriveApp.getFoldersByName(parentFolderName);
      if (folderIter.hasNext()) {
        parentFolder = folderIter.next();
      } else {
        parentFolder = DriveApp.createFolder(parentFolderName);
      }
    } catch (e) {
      parentFolder = DriveApp.getRootFolder();
    }

    const shortId = String(formId || Date.now()).substring(0, 8);
    const formFolderName = `${title} (${shortId})`;
    const formFolder = parentFolder.createFolder(formFolderName);

    // Create dedicated Spreadsheet inside form folder
    const ssName = `${title} — Data Sheet`;
    const ss = SpreadsheetApp.create(ssName);
    const ssId = ss.getId();

    // Move created Spreadsheet file to formFolder
    try {
      const ssFile = DriveApp.getFileById(ssId);
      formFolder.addFile(ssFile);
      DriveApp.getRootFolder().removeFile(ssFile);
    } catch (e) {}

    // Initialize Raw and Sensitive sheets
    const sheets = ss.getSheets();
    const rawSheet = sheets[0];
    rawSheet.setName('Raw');

    const sensitiveSheet = ss.insertSheet('Sensitive');

    // Remove any default extra sheets if present
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembur1');
    if (defaultSheet && ss.getSheets().length > 2) {
      try { ss.deleteSheet(defaultSheet); } catch (e) {}
    }

    // Set standard headers for Raw
    rawSheet.getRange('A1:L1').setValues([[
      'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Task_Status', 
      'Yield_Kg', 'Issues', 'Severity', 'Flagged_Keywords', 'Auto_Routed', 'Reviewed'
    ]]);
    rawSheet.getRange('A1:L1').setFontWeight('bold').setBackground('#f1f5f9');
    rawSheet.setFrozenRows(1);

    // Set standard headers for Sensitive
    sensitiveSheet.getRange('A1:J1').setValues([[
      'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
      'Sensitive_Flag', 'Severity', 'Flagged_Keywords', 'Reviewed'
    ]]);
    sensitiveSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#fef2f2');
    sensitiveSheet.setFrozenRows(1);

    return {
      sheetId: ssId,
      driveFolderId: formFolder.getId()
    };
  },

  /**
   * Enriches a form record with live metadata and dedicated sheet row counts.
   * @private
   * @param {Object} formRecord 
   * @returns {Object} Enriched form object.
   */
  enrichFormMetadata_: function(formRecord) {
    if (!formRecord) return formRecord;
    const formId = formRecord.id;
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';

    let calculatedResponseCount = 0;
    if (formRecord.sheetId) {
      try {
        const ss = SpreadsheetApp.openById(formRecord.sheetId);
        const rawSheet = ss.getSheetByName('Raw') || ss.getSheets()[0];
        if (rawSheet) {
          calculatedResponseCount = Math.max(0, rawSheet.getLastRow() - 1);
        }
      } catch (e) {
        calculatedResponseCount = formRecord.responseCount || 0;
      }
    }

    let publicUrl = formRecord.publicUrl || '';
    if (formRecord.type === 'kustom') {
      publicUrl = baseUrl ? `${baseUrl}?page=dynamicform&formId=${formId}` : `?page=dynamicform&formId=${formId}`;
    } else if (formRecord.type === 'harian' || formRecord.isDefaultDaily) {
      publicUrl = baseUrl ? `${baseUrl}?page=index` : '?page=index';
    } else if (formRecord.type === 'umum' || formRecord.isDefaultGeneral) {
      publicUrl = baseUrl ? `${baseUrl}?page=general` : '?page=general';
    }

    const sheetUrl = formRecord.sheetId ? `https://docs.google.com/spreadsheets/d/${formRecord.sheetId}/edit` : '';

    if (!formId || formId === 'DEFAULT_DAILY_FORM' || formId === 'DEFAULT_GENERAL_FORM' || formRecord.type === 'kustom') {
      return Object.assign({}, formRecord, {
        publicUrl: publicUrl,
        sheetUrl: sheetUrl,
        responseCount: calculatedResponseCount,
        isAccessible: true
      });
    }

    try {
      const gForm = FormApp.openById(formId);
      return Object.assign({}, formRecord, {
        title: gForm.getTitle() || formRecord.title || 'Form Laporan',
        description: gForm.getDescription() || formRecord.description || '',
        editUrl: gForm.getEditUrl() || `https://docs.google.com/forms/d/${formId}/edit`,
        publicUrl: publicUrl,
        sheetUrl: sheetUrl,
        responseCount: calculatedResponseCount,
        isAccessible: true
      });
    } catch (err) {
      return Object.assign({}, formRecord, {
        editUrl: formRecord.editUrl || `https://docs.google.com/forms/d/${formId}/edit`,
        publicUrl: publicUrl,
        sheetUrl: sheetUrl,
        responseCount: calculatedResponseCount,
        isAccessible: false
      });
    }
  },

  /**
   * Saves updated form list array into Script Properties.
   * @private
   * @param {Array<Object>} forms 
   */
  saveFormList_: function(forms) {
    const jsonStr = JSON.stringify(forms || []);
    ConfigRepository.setProperties({
      [this.REGISTERED_FORMS_KEY]: jsonStr
    });
  },

  /**
   * Provisions a new reporting form (Google Form for harian/umum, dynamic schema for kustom),
   * sets up dedicated Spreadsheet & Drive folder storage, and registers it.
   * @param {Object} params - { title, description, formType, sites, fields }
   * @returns {Object} Created form record.
   */
  createForm: function(params) {
    const title = (params.title || 'Form Laporan Baru').trim();
    const description = (params.description || 'Formulir pelaporan operasional terintegrasi.').trim();
    const formType = (params.formType || 'kustom').toLowerCase().trim();

    Logger.log(`FormManagementService: Provisioning new form "${title}" (type: ${formType})...`);

    let newFormId = '';
    let editUrl = '';
    let publishedUrl = '';

    if (formType === 'kustom') {
      newFormId = `FORM_KUSTOM_${Date.now()}`;
      editUrl = '';
    } else {
      // Create native Google Form via FormApp API
      const gForm = FormApp.create(title);
      gForm.setDescription(description);
      try { gForm.setCollectEmail(false); } catch (e) {}
      try { gForm.setRequireLogin(false); } catch (e) {}

      gForm.addTextItem()
        .setTitle('Kode Karyawan / Employee ID')
        .setHelpText('Masukkan kode karyawan Anda (contoh: EMP-102)')
        .setRequired(true);

      const siteChoices = (params.sites && params.sites.length > 0) ? params.sites : [
        'Site A — Kebun & Lahan Pertanian', 
        'Site B — Peternakan & Kandang', 
        'Site C — Pabrik Pengolahan & Pakan', 
        'Site D — Logistik & Gudang'
      ];

      gForm.addListItem()
        .setTitle('Lokasi / Site')
        .setChoiceValues(siteChoices)
        .setRequired(true);

      gForm.addDateItem()
        .setTitle('Tanggal Laporan / Date')
        .setRequired(true);

      if (formType === 'harian') {
        gForm.addListItem()
          .setTitle('Status Tugas / Task Status')
          .setChoiceValues(['Completed', 'In Progress', 'Delayed'])
          .setRequired(true);

        gForm.addTextItem()
          .setTitle('Hasil Panen / Yield (kg)')
          .setHelpText('Isi angka total hasil panen/produksi dalam kg (jika ada)');

        gForm.addCheckboxItem()
          .setTitle('Ada Masalah? / Issues')
          .setChoiceValues(['Equipment', 'Weather', 'Shortage', 'None']);
      } else {
        gForm.addParagraphTextItem()
          .setTitle('Rincian Laporan / Details')
          .setHelpText('Jelaskan aktivitas, kendala, atau kronologi secara detail.')
          .setRequired(true);

        gForm.addCheckboxItem()
          .setTitle('Informasi Sensitif? / Sensitive Information')
          .setChoiceValues(['Ya / Yes (Laporan ini berisi data sensitif/privat)']);
      }

      newFormId = gForm.getId();
      editUrl = gForm.getEditUrl();
      publishedUrl = gForm.getPublishedUrl();
    }

    // Provision dedicated storage (Drive Folder & Spreadsheet)
    const storage = this.provisionDedicatedFormStorage_(title, newFormId);

    // If native Google Form, re-point destination to dedicated Spreadsheet
    if (formType !== 'kustom' && newFormId) {
      try {
        const gForm = FormApp.openById(newFormId);
        gForm.setDestination(FormApp.DestinationType.SPREADSHEET, storage.sheetId);
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to set form destination: ' + e.toString());
      }
    }

    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';
    
    let publicUrl = '';
    if (formType === 'kustom') {
      publicUrl = baseUrl ? `${baseUrl}?page=dynamicform&formId=${newFormId}` : `?page=dynamicform&formId=${newFormId}`;
    } else if (formType === 'harian') {
      publicUrl = baseUrl ? `${baseUrl}?page=index` : '?page=index';
    } else {
      publicUrl = baseUrl ? `${baseUrl}?page=general` : '?page=general';
    }

    const newRecord = {
      id: newFormId,
      title: title,
      description: description,
      type: formType,
      status: 'aktif',
      fields: params.fields || [],
      sheetId: storage.sheetId,
      driveFolderId: storage.driveFolderId,
      editUrl: editUrl,
      publicUrl: publicUrl,
      createdAt: new Date().toISOString(),
      isDefault: false
    };

    // Save into form registry
    const forms = this.getFormList();
    forms.push(newRecord);
    this.saveFormList_(forms);

    Logger.log(`FormManagementService: Form "${title}" created with ID: ${newFormId}`);
    return newRecord;
  },

  /**
   * Updates title, description, form ID, status, and fields schema of an existing form.
   * @param {string} originalId 
   * @param {Object} updates 
   * @returns {Object} Updated form object.
   */
  updateFormConfig: function(originalId, updates) {
    if (!originalId) throw new Error('Form ID tidak boleh kosong.');

    const forms = this.getFormList();
    const idx = forms.findIndex(f => f.id === originalId);
    if (idx === -1) throw new Error('Form tidak ditemukan dalam registri.');

    const target = forms[idx];

    if (updates.title) target.title = updates.title.trim();
    if (updates.description) target.description = updates.description.trim();
    if (updates.status) target.status = updates.status.toLowerCase().trim();
    if (updates.fields && Array.isArray(updates.fields)) target.fields = updates.fields;

    if (updates.newFormId && updates.newFormId.trim() && updates.newFormId.trim() !== target.id) {
      const newId = updates.newFormId.trim();
      target.id = newId;
      target.editUrl = `https://docs.google.com/forms/d/${newId}/edit`;

      if (target.type === 'harian' || target.isDefaultDaily) {
        ConfigRepository.setProperties({ 'DAILY_FORM_ID': newId });
      } else if (target.type === 'umum' || target.isDefaultGeneral) {
        ConfigRepository.setProperties({ 'GENERAL_FORM_ID': newId });
      }
    }

    // Sync title/description to native Google Form API if applicable
    if (target.id && target.type !== 'kustom' && target.id !== 'DEFAULT_DAILY_FORM' && target.id !== 'DEFAULT_GENERAL_FORM') {
      try {
        const gForm = FormApp.openById(target.id);
        if (updates.title) gForm.setTitle(updates.title.trim());
        if (updates.description) gForm.setDescription(updates.description.trim());
      } catch (e) {
        Logger.log(`FormManagementService Notice: Unable to sync Google Form API for ${target.id}: ${e.toString()}`);
      }
    }

    forms[idx] = target;
    this.saveFormList_(forms);

    return target;
  },

  /**
   * Deletes a form from registry.
   * Protects default Daily and General forms from accidental deletion.
   * @param {string} formId 
   * @param {boolean} deleteDriveFile 
   * @returns {boolean} True if successfully deleted.
   */
  deleteForm: function(formId, deleteDriveFile = false) {
    if (!formId) throw new Error('Form ID tidak boleh kosong.');

    let forms = this.getFormList();
    const target = forms.find(f => f.id === formId);
    if (!target) throw new Error('Form tidak ditemukan.');

    if (target.isDefault || target.isDefaultDaily || target.isDefaultGeneral || formId === 'DEFAULT_DAILY_FORM' || formId === 'DEFAULT_GENERAL_FORM') {
      throw new Error('Form utama (Default Daily / General) tidak dapat dihapus.');
    }

    // Remove from array registry
    forms = forms.filter(f => f.id !== formId);
    this.saveFormList_(forms);

    // Optionally trash Google Form file if applicable
    if (deleteDriveFile && target.type !== 'kustom' && target.id) {
      try {
        const file = DriveApp.getFileById(target.id);
        file.setTrashed(true);
      } catch (e) {
        Logger.log(`FormManagementService Warning: Could not trash file ${formId}: ${e.toString()}`);
      }
    }

    return true;
  },

  /**
   * Historical Data Migration Function.
   * Copies rows from old central spreadsheet (Daily_Raw, General_Raw, Sensitive_Restricted)
   * into newly provisioned dedicated per-form spreadsheets for Daily and General forms.
   * Preserves Report_ID and Timestamps.
   */
  migrateHistoricalDataToPerFormSheets: function() {
    Logger.log('Starting historical data migration to per-form dedicated spreadsheets...');

    const forms = this.getFormList();
    const dailyForm = forms.find(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily);
    const generalForm = forms.find(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral);

    if (!dailyForm || !dailyForm.sheetId) {
      throw new Error('Target dedicated sheet for Daily Form is missing.');
    }
    if (!generalForm || !generalForm.sheetId) {
      throw new Error('Target dedicated sheet for General Form is missing.');
    }

    const oldSsId = ConfigRepository.getSpreadsheetId();
    if (!oldSsId) {
      throw new Error('Central SPREADSHEET_ID is not configured.');
    }

    const oldSs = SpreadsheetApp.openById(oldSsId);
    const oldDailySheet = oldSs.getSheetByName('Daily_Raw');
    const oldGeneralSheet = oldSs.getSheetByName('General_Raw');
    const oldSensitiveSheet = oldSs.getSheetByName('Sensitive_Restricted');

    let migratedDailyCount = 0;
    let migratedGeneralCount = 0;
    let migratedSensitiveCount = 0;

    // 1. Migrate Daily_Raw rows
    if (oldDailySheet && oldDailySheet.getLastRow() > 1) {
      const dailyData = oldDailySheet.getRange(2, 1, oldDailySheet.getLastRow() - 1, oldDailySheet.getLastColumn()).getValues();
      const targetDailySs = SpreadsheetApp.openById(dailyForm.sheetId);
      const targetDailySheet = targetDailySs.getSheetByName('Raw') || targetDailySs.getSheets()[0];

      dailyData.forEach(row => {
        if (row[0] || row[1]) {
          targetDailySheet.appendRow(row);
          migratedDailyCount++;
        }
      });
    }

    // 2. Migrate General_Raw rows
    if (oldGeneralSheet && oldGeneralSheet.getLastRow() > 1) {
      const generalData = oldGeneralSheet.getRange(2, 1, oldGeneralSheet.getLastRow() - 1, oldGeneralSheet.getLastColumn()).getValues();
      const targetGeneralSs = SpreadsheetApp.openById(generalForm.sheetId);
      const targetGeneralSheet = targetGeneralSs.getSheetByName('Raw') || targetGeneralSs.getSheets()[0];

      generalData.forEach(row => {
        if (row[0] || row[1]) {
          targetGeneralSheet.appendRow(row);
          migratedGeneralCount++;
        }
      });
    }

    // 3. Migrate Sensitive_Restricted rows
    if (oldSensitiveSheet && oldSensitiveSheet.getLastRow() > 1) {
      const sensitiveData = oldSensitiveSheet.getRange(2, 1, oldSensitiveSheet.getLastRow() - 1, oldSensitiveSheet.getLastColumn()).getValues();
      const targetGeneralSs = SpreadsheetApp.openById(generalForm.sheetId);
      const targetGeneralSensitiveSheet = targetGeneralSs.getSheetByName('Sensitive') || targetGeneralSs.getSheets()[1];

      sensitiveData.forEach(row => {
        if (row[0] || row[1]) {
          targetGeneralSensitiveSheet.appendRow(row);
          migratedSensitiveCount++;
        }
      });
    }

    Logger.log(`Historical Migration Complete: Migrated ${migratedDailyCount} Daily rows, ${migratedGeneralCount} General rows, and ${migratedSensitiveCount} Sensitive rows.`);
    return {
      dailyCount: migratedDailyCount,
      generalCount: migratedGeneralCount,
      sensitiveCount: migratedSensitiveCount
    };
  }
};
