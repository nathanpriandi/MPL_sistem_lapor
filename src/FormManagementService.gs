/**
 * FormManagementService.gs — Form Provisioning & Configuration Management Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages reporting form registrations, Google Forms API provisioning, 
 * per-form dedicated Spreadsheet & Drive folder creation, metadata inspection, 
 * photo attachment support, exact tab URL redirection (#gid), and form CRUD operations for internal administrators.
 */

const FormManagementService = {
  // Script Property key for storing registered forms metadata array
  REGISTERED_FORMS_KEY: 'REGISTERED_FORMS_JSON',

  /**
   * Retrieves all registered forms metadata array.
   * Auto-provisions storage if missing or pointing to stale main spreadsheet, and enriches metadata.
   * @returns {Array<Object>} List of form objects.
   */
  getFormList: function() {
    let forms = [];
    let isInitialRun = false;
    try {
      const rawJson = ConfigRepository.getProperty(this.REGISTERED_FORMS_KEY);
      if (rawJson) {
        forms = JSON.parse(rawJson);
      } else {
        isInitialRun = true;
      }
    } catch (e) {
      Logger.log('FormManagementService Error parsing registered forms JSON: ' + e.toString());
      forms = [];
      isInitialRun = true;
    }

    if (!Array.isArray(forms)) forms = [];

    const dailyId = ConfigRepository.getDailyFormId();
    const generalId = ConfigRepository.getGeneralFormId();
    const mainSsId = ConfigRepository.getSpreadsheetId();
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';

    // Seed default forms ONLY on initial system setup (when script property is empty)
    if (isInitialRun && forms.length === 0) {
      forms.push({
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
    }

    // Auto-provision dedicated Spreadsheet for forms that lack one or point to the central sheet
    let registryNeedsSaving = false;
    forms.forEach(f => {
      if (!f.sheetId || f.sheetId === mainSsId || f.sheetId === 'DEFAULT_SPREADSHEET') {
        try {
          const storage = this.provisionDedicatedFormStorage_(f.title, f.id);
          f.sheetId = storage.sheetId;
          f.driveFolderId = storage.driveFolderId;
          registryNeedsSaving = true;
        } catch (e) {
          Logger.log(`FormManagementService Warning: Unable to provision dedicated storage for ${f.id}: ${e.toString()}`);
        }
      }

      // Ensure dedicated Spreadsheet permissions allow direct view access
      if (f.sheetId && f.sheetId !== mainSsId) {
        try {
          const ssFile = DriveApp.getFileById(f.sheetId);
          ssFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) {}
      }

      // Re-point Google Form destination to dedicated Spreadsheet if not yet repointed
      if (f.type !== 'kustom' && f.id && f.sheetId && f.sheetId !== mainSsId && !f.destinationRepointed && f.id !== 'DEFAULT_DAILY_FORM' && f.id !== 'DEFAULT_GENERAL_FORM') {
        try {
          const gForm = FormApp.openById(f.id);
          gForm.setDestination(FormApp.DestinationType.SPREADSHEET, f.sheetId);
          f.destinationRepointed = true;
          registryNeedsSaving = true;

          // Normalize auto-created Google Forms response tab name to Form Title
          Utilities.sleep(1000);
          const ss = SpreadsheetApp.openById(f.sheetId);
          const responseSheet = ss.getSheets().find(s => s.getName().includes('Form Responses') || s.getName().includes('Jawaban Formulir'));
          if (responseSheet) {
            const formTitle = (f.title || 'Raw').trim();
            const rawSheet = ss.getSheetByName(formTitle) || ss.getSheetByName('Raw');
            if (rawSheet && rawSheet.getLastRow() <= 1) {
              try { ss.deleteSheet(rawSheet); } catch (err) {}
            }
            responseSheet.setName(formTitle);
          }
        } catch (err) {
          Logger.log(`FormManagementService Notice: Unable to re-point destination for ${f.id}: ${err.toString()}`);
        }
      }
    });

    // Persist updated registry if changes were made
    if (registryNeedsSaving || isInitialRun) {
      try {
        this.saveFormList_(forms);
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to persist form list: ' + e.toString());
      }
    }

    // Enrich metadata with live attributes, direct tab GID URLs, & sheet row counts
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
   * Tab 1 is named after the Form's title (e.g. Laporan Operasional Harian).
   * Dedicated spreadsheet contains ONLY tabs for this form, with Photo support.
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
    const cleanTitle = (title || 'Form Laporan').trim();
    const formFolderName = `${cleanTitle} (${shortId})`;
    let formFolder;
    try {
      formFolder = parentFolder.createFolder(formFolderName);
    } catch (e) {
      formFolder = parentFolder;
    }

    // Create dedicated Spreadsheet inside form folder
    const ssName = `${cleanTitle} — Dedicated Data Sheet`;
    const ss = SpreadsheetApp.create(ssName);
    const ssId = ss.getId();

    // Set permissions and move created Spreadsheet file to formFolder using moveTo
    try {
      const ssFile = DriveApp.getFileById(ssId);
      try { ssFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (sErr) {}
      if (formFolder && formFolder.getId() !== parentFolder.getId()) {
        try {
          ssFile.moveTo(formFolder);
        } catch (movErr) {
          try { formFolder.addFile(ssFile); } catch (e2) {}
        }
      }
    } catch (e) {}

    // Initialize dedicated primary response sheet named after the form
    const sheets = ss.getSheets();
    const rawSheet = sheets[0];
    rawSheet.setName(cleanTitle);

    const sensitiveSheet = ss.insertSheet('Sensitive');

    // Remove default extra sheet if present
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembur1');
    if (defaultSheet && ss.getSheets().length > 2) {
      try { ss.deleteSheet(defaultSheet); } catch (e) {}
    }

    // Set standard headers for primary response sheet (with Foto_Lampiran column for photo uploads)
    rawSheet.getRange('A1:L1').setValues([[
      'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Task_Status_Or_Details', 
      'Yield_Kg', 'Issues', 'Foto_Lampiran', 'Severity', 'Flagged_Keywords', 'Reviewed'
    ]]);
    rawSheet.getRange('A1:L1').setFontWeight('bold').setBackground('#f1f5f9');
    rawSheet.setFrozenRows(1);

    // Set standard headers for Sensitive (with Foto_Lampiran column for photo uploads)
    sensitiveSheet.getRange('A1:K1').setValues([[
      'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
      'Sensitive_Flag', 'Foto_Lampiran', 'Severity', 'Flagged_Keywords', 'Reviewed'
    ]]);
    sensitiveSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fef2f2');
    sensitiveSheet.setFrozenRows(1);

    return {
      sheetId: ssId,
      driveFolderId: formFolder ? formFolder.getId() : ''
    };
  },

  /**
   * Enriches a form record with live metadata, exact sheet tab GID URL, and row counts.
   * Automatically renames response tab to match form title.
   * @private
   * @param {Object} formRecord 
   * @returns {Object} Enriched form object.
   */
  enrichFormMetadata_: function(formRecord) {
    if (!formRecord) return formRecord;
    const formId = formRecord.id;
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';
    const mainSsId = ConfigRepository.getSpreadsheetId();

    let effectiveSheetId = formRecord.sheetId || '';
    if (!effectiveSheetId || effectiveSheetId === mainSsId) {
      try {
        const storage = this.provisionDedicatedFormStorage_(formRecord.title || 'Form Laporan', formId);
        effectiveSheetId = storage.sheetId;
        formRecord.sheetId = storage.sheetId;
        formRecord.driveFolderId = storage.driveFolderId;
      } catch (e) {
        effectiveSheetId = mainSsId || '';
      }
    }

    let sheetUrl = '';
    let calculatedResponseCount = 0;

    if (effectiveSheetId) {
      try {
        const ss = SpreadsheetApp.openById(effectiveSheetId);
        const cleanTitle = (formRecord.title || '').trim();
        
        // Find or rename primary response sheet to match current form title
        let rawSheet = (cleanTitle ? ss.getSheetByName(cleanTitle) : null) || 
                       ss.getSheetByName('Daily_Raw') || 
                       ss.getSheetByName('General_Raw') || 
                       ss.getSheetByName('Raw') || 
                       ss.getSheets()[0];
                       
        if (rawSheet) {
          if (cleanTitle && rawSheet.getName() !== cleanTitle && rawSheet.getName() !== 'Sensitive') {
            try { rawSheet.setName(cleanTitle); } catch (e) {}
          }
          calculatedResponseCount = Math.max(0, rawSheet.getLastRow() - 1);
          const gid = rawSheet.getSheetId();
          sheetUrl = `https://docs.google.com/spreadsheets/d/${effectiveSheetId}/edit#gid=${gid}`;
        } else {
          sheetUrl = `https://docs.google.com/spreadsheets/d/${effectiveSheetId}/edit`;
        }
      } catch (e) {
        calculatedResponseCount = formRecord.responseCount || 0;
        sheetUrl = `https://docs.google.com/spreadsheets/d/${effectiveSheetId}/edit`;
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

    const enriched = Object.assign({}, formRecord, {
      sheetId: effectiveSheetId,
      publicUrl: publicUrl,
      sheetUrl: sheetUrl,
      responseCount: calculatedResponseCount,
      isAccessible: true
    });

    if (formId && formId !== 'DEFAULT_DAILY_FORM' && formId !== 'DEFAULT_GENERAL_FORM' && formRecord.type !== 'kustom') {
      try {
        const gForm = FormApp.openById(formId);
        enriched.title = gForm.getTitle() || formRecord.title || 'Form Laporan';
        enriched.description = gForm.getDescription() || formRecord.description || '';
        enriched.editUrl = gForm.getEditUrl() || `https://docs.google.com/forms/d/${formId}/edit`;
      } catch (err) {
        enriched.editUrl = formRecord.editUrl || `https://docs.google.com/forms/d/${formId}/edit`;
      }
    }

    return enriched;
  },

  /**
   * Retrieves or provisions exact dedicated tab URL (#gid) for a specific form.
   * @param {string} formId 
   * @returns {string} Spreadsheet edit URL with #gid anchor.
   */
  getFormSheetUrl: function(formId) {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    const forms = this.getFormList();

    let target = forms.find(f => f.id === formId);
    if (!target) {
      if (formId === 'DEFAULT_DAILY_FORM' || formId.toLowerCase().includes('daily')) {
        target = forms.find(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily);
      } else if (formId === 'DEFAULT_GENERAL_FORM' || formId.toLowerCase().includes('general')) {
        target = forms.find(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral);
      }
    }

    if (target) {
      try {
        const enriched = this.enrichFormMetadata_(target);
        if (enriched.sheetUrl) return enriched.sheetUrl;
      } catch (e) {}
    }

    return mainSsId ? `https://docs.google.com/spreadsheets/d/${mainSsId}/edit` : '';
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
    }

    // Provision dedicated storage (Drive Folder & Spreadsheet)
    const storage = this.provisionDedicatedFormStorage_(title, newFormId);

    // If native Google Form, re-point destination to dedicated Spreadsheet & register trigger
    if (formType !== 'kustom' && newFormId) {
      try {
        const gForm = FormApp.openById(newFormId);
        gForm.setDestination(FormApp.DestinationType.SPREADSHEET, storage.sheetId);
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to set form destination: ' + e.toString());
      }

      try {
        const handlerName = (formType === 'harian') ? 'onDailyFormSubmit' : 'onGeneralFormSubmit';
        ScriptApp.newTrigger(handlerName)
          .forForm(FormApp.openById(newFormId))
          .onFormSubmit()
          .create();
      } catch (e) {
        Logger.log(`FormManagementService Notice: Unable to register trigger for ${newFormId}: ${e.toString()}`);
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
   * Renames spreadsheet primary response tab if title changed.
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
    const oldTitle = (target.title || '').trim();

    if (updates.title) target.title = updates.title.trim();
    if (updates.description) target.description = updates.description.trim();
    if (updates.status) target.status = updates.status.toLowerCase().trim();
    if (updates.fields && Array.isArray(updates.fields)) target.fields = updates.fields;

    // Sync tab name in dedicated spreadsheet if title changed
    if (updates.title && target.sheetId) {
      try {
        const ss = SpreadsheetApp.openById(target.sheetId);
        const cleanNewTitle = updates.title.trim();
        const sheet = (oldTitle ? ss.getSheetByName(oldTitle) : null) || ss.getSheetByName('Raw') || ss.getSheets()[0];
        if (sheet && sheet.getName() !== 'Sensitive') {
          sheet.setName(cleanNewTitle);
        }
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to rename sheet tab on title update: ' + e.toString());
      }
    }

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
   * Deletes any form registration from registry (including Daily and General forms if requested by admin).
   * Optionally trashes Drive files if requested.
   * @param {string} formId 
   * @param {boolean} deleteDriveFile 
   * @returns {boolean} True if successfully deleted.
   */
  deleteForm: function(formId, deleteDriveFile = false) {
    if (!formId) throw new Error('Form ID tidak boleh kosong.');

    let forms = this.getFormList();
    const target = forms.find(f => f.id === formId);
    if (!target) throw new Error('Form tidak ditemukan.');

    // Remove from array registry
    forms = forms.filter(f => f.id !== formId);
    this.saveFormList_(forms);

    // Optionally trash Google Form file and dedicated Spreadsheet file if requested
    if (deleteDriveFile) {
      if (target.id && target.type !== 'kustom' && target.id !== 'DEFAULT_DAILY_FORM' && target.id !== 'DEFAULT_GENERAL_FORM') {
        try {
          const file = DriveApp.getFileById(target.id);
          file.setTrashed(true);
        } catch (e) {
          Logger.log(`FormManagementService Warning: Could not trash form file ${target.id}: ${e.toString()}`);
        }
      }
      if (target.sheetId) {
        try {
          const sheetFile = DriveApp.getFileById(target.sheetId);
          sheetFile.setTrashed(true);
        } catch (e) {
          Logger.log(`FormManagementService Warning: Could not trash sheet file ${target.sheetId}: ${e.toString()}`);
        }
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
      const targetDailySheet = targetDailySs.getSheetByName(dailyForm.title) || targetDailySs.getSheetByName('Raw') || targetDailySs.getSheets()[0];

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
      const targetGeneralSheet = targetGeneralSs.getSheetByName(generalForm.title) || targetGeneralSs.getSheetByName('Raw') || targetGeneralSs.getSheets()[0];

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
