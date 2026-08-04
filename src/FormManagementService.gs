/**
 * FormManagementService.gs — Form Provisioning & Configuration Management Service
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages reporting form registrations, Google Forms API provisioning, 
 * metadata inspection, and form CRUD operations for internal administrators.
 */

const FormManagementService = {
  // Script Property key for storing registered forms metadata array
  REGISTERED_FORMS_KEY: 'REGISTERED_FORMS_JSON',

  /**
   * Retrieves all registered forms metadata array.
   * Guarantees default Daily and General forms are always present.
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
        if (generalId && (gForm.id === 'DEFAULT_GENERAL_FORM' || !gForm.id)) {
          gForm.id = generalId;
        }
        if (gForm.id && gForm.id !== 'DEFAULT_GENERAL_FORM') {
          gForm.editUrl = `https://docs.google.com/forms/d/${gForm.id}/edit`;
        }
        gForm.publicUrl = baseUrl ? `${baseUrl}?page=general` : '?page=general';
      }
    }

    // Persist normalized registry defensively
    try {
      this.saveFormList_(forms);
    } catch (e) {
      Logger.log('FormManagementService Notice: Unable to persist form list: ' + e.toString());
    }

    // Enrich metadata with live Google Forms API attributes safely
    return forms.map(f => {
      try {
        return this.enrichFormMetadata_(f);
      } catch (err) {
        return f;
      }
    });
  },

  /**
   * Enriches a form record with live metadata from Google Forms API if accessible.
   * @private
   * @param {Object} formRecord 
   * @returns {Object} Enriched form object.
   */
  enrichFormMetadata_: function(formRecord) {
    if (!formRecord) return formRecord;
    const formId = formRecord.id;

    if (!formId || formId === 'DEFAULT_DAILY_FORM' || formId === 'DEFAULT_GENERAL_FORM') {
      return Object.assign({}, formRecord, {
        responseCount: formRecord.responseCount || 0,
        isAccessible: false
      });
    }

    try {
      const gForm = FormApp.openById(formId);
      let responseCount = 0;
      try {
        responseCount = gForm.getResponses().length;
      } catch (e) {
        responseCount = 0;
      }

      return Object.assign({}, formRecord, {
        title: gForm.getTitle() || formRecord.title || 'Form Laporan',
        description: gForm.getDescription() || formRecord.description || '',
        editUrl: gForm.getEditUrl() || `https://docs.google.com/forms/d/${formId}/edit`,
        publishedUrl: gForm.getPublishedUrl() || formRecord.publicUrl || '',
        responseCount: responseCount,
        isAccessible: true
      });
    } catch (err) {
      Logger.log(`FormManagementService Notice: Unable to inspect Google Form ${formId}: ${err.toString()}`);
      return Object.assign({}, formRecord, {
        editUrl: formRecord.editUrl || `https://docs.google.com/forms/d/${formId}/edit`,
        responseCount: formRecord.responseCount || 0,
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
   * Provisions a new Google Form, sets up standard intake fields, links destination, and registers it.
   * @param {Object} params - { title, description, formType, sites }
   * @returns {Object} Created form record.
   */
  createForm: function(params) {
    const title = (params.title || 'Form Laporan Baru').trim();
    const description = (params.description || 'Formulir pelaporan operasional terintegrasi.').trim();
    const formType = (params.formType || 'kustom').toLowerCase().trim();
    const ssId = ConfigRepository.getSpreadsheetId();

    Logger.log(`FormManagementService: Provisioning new Google Form "${title}"...`);

    // 1. Create Google Form via FormApp API
    const gForm = FormApp.create(title);
    gForm.setDescription(description);
    try { gForm.setCollectEmail(false); } catch (e) {}
    try { gForm.setRequireLogin(false); } catch (e) {}

    // 2. Attach standard required reporting items
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

    // 3. Link Form destination to Central Spreadsheet if available
    if (ssId) {
      try {
        gForm.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
      } catch (e) {
        Logger.log('FormManagementService Notice: Unable to set form spreadsheet destination: ' + e.toString());
      }
    }

    const newFormId = gForm.getId();
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    const baseUrl = publicWebAppUrl ? publicWebAppUrl.split('?')[0] : '';

    const newRecord = {
      id: newFormId,
      title: title,
      description: description,
      type: formType,
      status: 'aktif',
      editUrl: gForm.getEditUrl(),
      publicUrl: baseUrl ? `${baseUrl}?page=${formType === 'harian' ? 'index' : 'general'}` : gForm.getPublishedUrl(),
      createdAt: new Date().toISOString(),
      isDefault: false
    };

    // 4. Save into form registry
    const forms = this.getFormList();
    forms.push(newRecord);
    this.saveFormList_(forms);

    Logger.log(`FormManagementService: Form "${title}" created successfully with ID: ${newFormId}`);
    return newRecord;
  },

  /**
   * Updates title, description, form ID, and status of an existing form.
   * Syncs changes directly to Google Form API.
   * @param {string} originalId 
   * @param {Object} updates - { title, description, newFormId, status }
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

    if (updates.newFormId && updates.newFormId.trim() && updates.newFormId.trim() !== target.id) {
      const newId = updates.newFormId.trim();
      target.id = newId;
      target.editUrl = `https://docs.google.com/forms/d/${newId}/edit`;

      // Update script properties if editing a default form
      if (target.type === 'harian' || target.isDefaultDaily) {
        ConfigRepository.setProperties({ 'DAILY_FORM_ID': newId });
      } else if (target.type === 'umum' || target.isDefaultGeneral) {
        ConfigRepository.setProperties({ 'GENERAL_FORM_ID': newId });
      }
    }

    // Sync to Google Form API if accessible
    if (target.id && target.id !== 'DEFAULT_DAILY_FORM' && target.id !== 'DEFAULT_GENERAL_FORM') {
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
   * Deletes a form from registry and optionally trashes its Google Form file in Drive.
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

    // Optionally trash Google Form file via DriveApp
    if (deleteDriveFile && formId !== 'DEFAULT_DAILY_FORM' && formId !== 'DEFAULT_GENERAL_FORM') {
      try {
        const file = DriveApp.getFileById(formId);
        file.setTrashed(true);
        Logger.log(`FormManagementService: Google Form file ${formId} moved to trash.`);
      } catch (e) {
        Logger.log(`FormManagementService Warning: Could not trash file ${formId}: ${e.toString()}`);
      }
    }

    return true;
  }
};
