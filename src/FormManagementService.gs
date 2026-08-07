/**
 * FormManagementService.gs — Form Provisioning & Configuration Management Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages reporting form registrations, Google Forms API provisioning, 
 * integrated single-spreadsheet tab management (tab-per-form), per-form photo Drive folder creation,
 * exact tab URL redirection (#gid), and form CRUD operations for internal administrators.
 */

const FormManagementService = {
  // Script Property key for storing registered forms metadata array
  REGISTERED_FORMS_KEY: 'REGISTERED_FORMS_JSON',

  /**
   * Resolves target worksheet tab for a form within the integrated spreadsheet.
   * Priority: 1. Matched by stored tabGid, 2. Matched by form title, 3. Fallback to generic names or first sheet.
   * @param {Spreadsheet} ss 
   * @param {Object} form 
   * @returns {Sheet}
   */
  resolveFormTab_: function(ss, form) {
    if (!ss) return null;
    const formTitle = (form.title || '').trim();
    const sheets = ss.getSheets();

    // 1. Match by stored tabGid if present
    if (form && form.tabGid !== undefined && form.tabGid !== null) {
      const matchedByGid = sheets.find(s => String(s.getSheetId()) === String(form.tabGid));
      if (matchedByGid) return matchedByGid;
    }

    // 2. Match by exact Form Title
    if (formTitle) {
      const matchedByTitle = ss.getSheetByName(formTitle);
      if (matchedByTitle) return matchedByTitle;
    }

    // 3. Fallback match for default forms or template names
    if (form.type === 'operasional' || form.isDefault || form.isDefaultMain) {
      const opSheet = ss.getSheetByName('Laporan_Operasional_Raw') || ss.getSheetByName('Laporan Operasional (Kegiatan, Panen & Penjualan)');
      if (opSheet) return opSheet;
    }

    return ss.getSheetByName('Raw') || sheets[0];
  },

  /**
   * Retrieves all registered forms metadata array.
   * Auto-provisions tabs in integrated spreadsheet if missing, and enriches metadata.
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

    // Purge legacy prototype forms (Daily / General)
    const originalLength = forms.length;
    forms = forms.filter(f => {
      if (!f) return false;
      const fId = String(f.id || '');
      const fType = String(f.type || '').toLowerCase();
      const fTitle = String(f.title || '').toLowerCase();
      if (fId === 'DEFAULT_DAILY_FORM' || fId === 'DEFAULT_GENERAL_FORM') return false;
      if (fType === 'harian' || fType === 'umum') return false;
      if (fTitle.includes('laporan operasional harian') || fTitle.includes('laporan umum & catatan lapangan') || fTitle.includes('daily report') || fTitle.includes('general report')) return false;
      return true;
    });

    const mainFormId = ConfigRepository.getMainFormId();
    const mainSsId = ConfigRepository.getSpreadsheetId();
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';

    // Seed default main form if missing
    const hasMainForm = forms.some(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.id === mainFormId);
    if (!hasMainForm) {
      forms.unshift({
        id: mainFormId || 'DEFAULT_MAIN_FORM',
        title: 'Laporan Operasional (Kegiatan, Panen & Penjualan)',
        description: 'Formulir harian operasional pertanian, peternakan, perikanan, panen, dan penjualan.',
        type: 'operasional',
        status: 'aktif',
        editUrl: mainFormId ? `https://docs.google.com/forms/d/${mainFormId}/edit` : '',
        publicUrl: baseUrl ? `${baseUrl}?page=index` : '?page=index',
        createdAt: new Date().toISOString(),
        isDefault: true,
        isDefaultMain: true
      });
    }

    if (forms.length !== originalLength || isInitialRun) {
      try {
        this.saveFormList_(forms);
      } catch (e) {}
    }

    // Auto-provision tab in integrated spreadsheet for forms that lack tabGid
    let registryNeedsSaving = false;
    forms.forEach(f => {
      f.sheetId = mainSsId; // All forms share single integrated spreadsheet ID

      if (f.tabGid === undefined || f.tabGid === null) {
        try {
          const tabStorage = this.provisionFormTab_(f.title, f.id);
          f.tabGid = tabStorage.tabGid;
          registryNeedsSaving = true;
        } catch (e) {
          Logger.log(`FormManagementService Warning: Unable to provision tab for ${f.id}: ${e.toString()}`);
        }
      }

      // Re-point Google Form destination to integrated Spreadsheet if not yet repointed
      if (f.type !== 'kustom' && f.id && !f.destinationRepointedV2 && f.id !== 'DEFAULT_MAIN_FORM') {
        try {
          const gForm = FormApp.openById(f.id);
          gForm.setDestination(FormApp.DestinationType.SPREADSHEET, mainSsId);
          f.destinationRepointedV2 = true;
          registryNeedsSaving = true;
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
   * Provisions a dedicated tab for a form inside the single integrated spreadsheet.
   * Also ensures a single shared Sensitive tab exists.
   * @private
   * @param {string} title 
   * @param {string} formId 
   * @returns {{ sheetId: string, tabGid: number }}
   */
  provisionFormTab_: function(title, formId) {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) throw new Error('SPREADSHEET_ID tidak dikonfigurasi.');

    const ss = SpreadsheetApp.openById(mainSsId);
    const cleanTitle = (title || 'Form Laporan').trim();
    const shortId = String(formId || Date.now()).substring(0, 8);

    // Determine unique tab name
    let tabName = cleanTitle;
    const existingSheet = ss.getSheetByName(tabName);
    if (existingSheet) {
      // Check if existing sheet is a generic template sheet or exact match
      const existingGid = existingSheet.getSheetId();
      return { sheetId: mainSsId, tabGid: existingGid };
    }

    // Insert new sheet tab for this form
    const rawSheet = ss.insertSheet(tabName);
    const tabGid = rawSheet.getSheetId();

    // Ensure single shared Sensitive tab exists in integrated spreadsheet
    let sensitiveSheet = ss.getSheetByName('Sensitive');
    if (!sensitiveSheet) {
      sensitiveSheet = ss.insertSheet('Sensitive');
      sensitiveSheet.getRange('A1:K1').setValues([[
        'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
        'Sensitive_Flag', 'Foto_Lampiran', 'Severity', 'Flagged_Keywords', 'Reviewed'
      ]]);
      sensitiveSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fef2f2');
      sensitiveSheet.setFrozenRows(1);
    }

    // Set standard headers for operational form tab (26 columns schema)
    const opHeaders = [
      'Report_ID', 'Kode_Kegiatan', 'Kode_Kegiatan_Ref', 'Timestamp', 'Nama_PIC', 'Bidang_Divisi', 
      'Lokasi_Kegiatan', 'Jenis_Kegiatan', 'Target_Kegiatan', 'Luas_Area_Ha', 'Jumlah_Populasi', 
      'Tgl_Tanam', 'Tgl_CheckIn_Tebar', 'Tgl_Perkiraan_Panen', 'Tgl_Panen', 'Jumlah_Panen', 
      'Tgl_Penjualan', 'Harga_Jual', 'Jumlah_Penjualan_Unit', 'Nilai_Penjualan_Rp', 'Kendala', 
      'Upaya', 'Foto_URL', 'Severity', 'Flagged_Keywords', 'Reviewed'
    ];
    rawSheet.getRange(1, 1, 1, opHeaders.length).setValues([opHeaders]);
    rawSheet.getRange(1, 1, 1, opHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    rawSheet.setFrozenRows(1);

    return {
      sheetId: mainSsId,
      tabGid: tabGid
    };
  },

  /**
   * Provisions/retrieves per-form photo Drive folder lazily (Approach 5a).
   * @param {string} title 
   * @param {string} formId 
   * @returns {Folder}
   */
  provisionPhotoFolder_: function(title, formId) {
    const parentFolderName = 'Reporting System Photos';
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
    const subFolderName = `${cleanTitle} Photos (${shortId})`;

    try {
      const subIter = parentFolder.getFoldersByName(subFolderName);
      if (subIter.hasNext()) return subIter.next();
      return parentFolder.createFolder(subFolderName);
    } catch (e) {
      return parentFolder;
    }
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

    formRecord.sheetId = mainSsId;

    let sheetUrl = '';
    let calculatedResponseCount = 0;

    if (mainSsId) {
      try {
        const ss = SpreadsheetApp.openById(mainSsId);
        const rawSheet = this.resolveFormTab_(ss, formRecord);
                       
        if (rawSheet) {
          calculatedResponseCount = Math.max(0, rawSheet.getLastRow() - 1);
          const gid = rawSheet.getSheetId();
          formRecord.tabGid = gid;
          sheetUrl = `https://docs.google.com/spreadsheets/d/${mainSsId}/edit#gid=${gid}`;
        } else {
          sheetUrl = `https://docs.google.com/spreadsheets/d/${mainSsId}/edit`;
        }
      } catch (e) {
        calculatedResponseCount = formRecord.responseCount || 0;
        sheetUrl = `https://docs.google.com/spreadsheets/d/${mainSsId}/edit`;
      }
    }

    let publicUrl = formRecord.publicUrl || '';
    if (formRecord.type === 'kustom') {
      publicUrl = baseUrl ? `${baseUrl}?page=dynamicform&formId=${formId}` : `?page=dynamicform&formId=${formId}`;
    } else {
      publicUrl = baseUrl ? `${baseUrl}?page=index` : '?page=index';
    }

    const enriched = Object.assign({}, formRecord, {
      sheetId: mainSsId,
      publicUrl: publicUrl,
      sheetUrl: sheetUrl,
      responseCount: calculatedResponseCount,
      isAccessible: true
    });

    if (formId && formId !== 'DEFAULT_MAIN_FORM' && formRecord.type !== 'kustom') {
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
      target = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault);
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
   * sets up dedicated tab in integrated Spreadsheet, and registers it.
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

    // Provision tab in integrated Spreadsheet
    const tabStorage = this.provisionFormTab_(title, newFormId);
    const mainSsId = ConfigRepository.getSpreadsheetId();

    // If native Google Form, re-point destination to integrated Spreadsheet & register trigger
    if (formType !== 'kustom' && newFormId) {
      try {
        const gForm = FormApp.openById(newFormId);
        gForm.setDestination(FormApp.DestinationType.SPREADSHEET, mainSsId);
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to set form destination: ' + e.toString());
      }

      try {
        ScriptApp.newTrigger('onFormSubmit')
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
      sheetId: mainSsId,
      tabGid: tabStorage.tabGid,
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
   * Renames spreadsheet tab if title changed.
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

    // Sync tab name in integrated spreadsheet if title changed
    if (updates.title) {
      try {
        const mainSsId = ConfigRepository.getSpreadsheetId();
        const ss = SpreadsheetApp.openById(mainSsId);
        const cleanNewTitle = updates.title.trim();
        const sheet = this.resolveFormTab_(ss, target);
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

      if (target.type === 'operasional' || target.isDefaultMain) {
        ConfigRepository.setProperties({ 'MAIN_FORM_ID': newId });
      }
    }

    // Sync title/description to native Google Form API if applicable
    if (target.id && target.type !== 'kustom' && target.id !== 'DEFAULT_MAIN_FORM') {
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

    // Optionally trash Google Form file if requested
    if (deleteDriveFile) {
      if (target.id && target.type !== 'kustom' && target.id !== 'DEFAULT_MAIN_FORM') {
        try {
          const file = DriveApp.getFileById(target.id);
          file.setTrashed(true);
        } catch (e) {
          Logger.log(`FormManagementService Warning: Could not trash form file ${target.id}: ${e.toString()}`);
        }
      }
    }

    return true;
  }
};
