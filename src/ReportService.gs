/**
 * ReportService.gs — Application Service for Operational Report Submissions
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates validation, Kode Kegiatan generation, triage evaluation, persistence, photo attachment handling, and notifications.
 */

const ReportService = {

  /**
   * Generates formatted Kode Kegiatan reference string.
   * Format: {DIVISI_KODE}-{LOKASI_SLUG}-{YYYYMMDD}-{2DIGIT_INDEX}
   * Example: ALP-SEKTOR1-20260824-01
   * @param {string} divisi 
   * @param {string} lokasi 
   * @returns {string} Kode Kegiatan
   */
  generateKodeKegiatan: function(divisi, lokasi) {
    let divCode = 'MPL';
    const divLower = String(divisi || '').toLowerCase();
    if (divLower.includes('manajemen') || divLower === 'mnj') divCode = 'MNJ';
    else if (divLower.includes('bko') || divLower === 'bko') divCode = 'BKO';
    else if (divLower.includes('pekerja') || divLower.includes('harian') || divLower === 'pkh') divCode = 'PKH';
    else if (divLower.includes('alprof') || divLower === 'alp') divCode = 'ALP';
    else if (divLower.includes('sga') || divLower === 'sga') divCode = 'SGA';
    else if (divLower.includes('ternak') || divLower.includes('peternakan')) divCode = 'TRN';
    else if (divLower.includes('ikan') || divLower.includes('perikanan')) divCode = 'IKN';
    else if (divLower.includes('agro') || divLower.includes('pertanian') || divLower.includes('perkebunan')) divCode = 'AGR';

    const locSlug = String(lokasi || 'SEK')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6) || 'SEK1';

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const seq = String(Math.floor(Math.random() * 89) + 10);
    return `${divCode}-${locSlug}-${dateStr}-${seq}`;
  },

  /**
   * Submits a new Operational Report from Web App.
   * Enforces REQUIRED photo upload. Panen & Penjualan fields are optional.
   * @param {Object} payload 
   * @returns {{ success: boolean, reportId: string, kodeKegiatan: string }}
   */
  submitOperationalReport: function(payload) {
    if (!payload) {
      throw new Error('Payload data laporan tidak ditemukan.');
    }

    // Auto-resolve employee ID if provided
    let empId = payload.idKaryawan || payload.empId || '';
    if (empId) {
      const emp = lookupEmployee(empId);
      if (emp) {
        payload.idKaryawan = emp.id;
        payload.empId = emp.id;
        payload.namaPic = payload.namaPic || emp.name;
        payload.bidangDivisi = payload.bidangDivisi || emp.division;
      }
    } else if (payload.namaPic) {
      const emp = lookupEmployee(payload.namaPic);
      if (emp) {
        payload.idKaryawan = emp.id;
        payload.empId = emp.id;
        payload.namaPic = emp.name;
        payload.bidangDivisi = payload.bidangDivisi || emp.division;
      }
    }

    if (!payload.idKaryawan && !payload.namaPic) {
      throw new Error('ID Karyawan wajib diisi.');
    }

    // Validation for SGA Division delegation, Alprof delegation (BKO 28), & Management delegation (PKH)
    if (isSgaJunior(payload.idKaryawan)) {
      throw new Error('Pengisian formulir untuk Divisi SGA didelegasikan khusus kepada PIC: Ketut (SGA-01) atau Amas S (SGA-02). Silakan laporkan aktivitas Anda kepada PIC.');
    }
    if (isBkoSubordinate(payload.idKaryawan)) {
      throw new Error('Pengisian formulir untuk BKO 28 didelegasikan melalui tim Alprof. Silakan sampaikan catatan aktivitas Anda kepada tim Alprof.');
    }
    if (isPkhSubordinate(payload.idKaryawan)) {
      throw new Error('Pengisian formulir untuk Pekerja Harian didelegasikan melalui tim Manajemen. Silakan sampaikan catatan aktivitas Anda kepada tim Manajemen.');
    }

    if (!payload.lokasiKegiatan || !payload.jenisKegiatan) {
      throw new Error('Mohon lengkapi semua kolom wajib (Lokasi Kegiatan, Kegiatan yang Dilakukan).');
    }

    if (!payload.reportId) {
      payload.reportId = SpreadsheetRepository.generateUUID();
    }

    if (!payload.kodeKegiatan) {
      payload.kodeKegiatan = this.generateKodeKegiatan(payload.bidangDivisi, payload.lokasiKegiatan);
    }
    // Validate and process 3 mandatory photos
    const inputPhotos = [];
    if (Array.isArray(payload.photos) && payload.photos.length > 0) {
      payload.photos.forEach(p => {
        if (p && (p.base64 || p.url)) inputPhotos.push(p);
      });
    } else {
      if (payload.photoBase64 || payload.fotoUrl || payload.photoUrl) {
        inputPhotos.push({ base64: payload.photoBase64, mimeType: payload.photoMimeType || 'image/jpeg', url: payload.fotoUrl || payload.photoUrl });
      }
      if (payload.photoBase64_2 || payload.fotoUrl2 || payload.photoUrl2) {
        inputPhotos.push({ base64: payload.photoBase64_2, mimeType: payload.photoMimeType_2 || 'image/jpeg', url: payload.fotoUrl2 || payload.photoUrl2 });
      }
      if (payload.photoBase64_3 || payload.fotoUrl3 || payload.photoUrl3) {
        inputPhotos.push({ base64: payload.photoBase64_3, mimeType: payload.photoMimeType_3 || 'image/jpeg', url: payload.fotoUrl3 || payload.photoUrl3 });
      }
    }

    if (inputPhotos.length < 3) {
      throw new Error('Wajib melampirkan 3 foto bukti kegiatan (Foto 1, Foto 2, dan Foto 3).');
    }

    const uploadedUrls = [];
    const todayDateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    
    // Pre-resolve target folder ONCE for all 3 photos to avoid redundant Drive queries
    let preResolvedFolder = null;
    try {
      const folderRes = this.resolveDailyEmployeePhotoFolder_(todayDateStr, payload.idKaryawan, payload.namaPic);
      preResolvedFolder = folderRes ? folderRes.folder : null;
    } catch (eF) {
      Logger.log('ReportService: Pre-resolving folder notice: ' + eF.toString());
    }

    for (let i = 0; i < 3; i++) {
      const p = inputPhotos[i];
      if (p.base64) {
        const uploadRes = this.uploadReportAttachment(
          p.base64, 
          p.mimeType || 'image/jpeg', 
          'OPERATIONAL', 
          payload.reportId, 
          `${payload.kodeKegiatan}_Foto${i+1}`,
          payload.idKaryawan,
          payload.namaPic,
          todayDateStr,
          preResolvedFolder
        );
        if (uploadRes && uploadRes.url) {
          uploadedUrls.push(uploadRes.url);
        } else {
          Logger.log(`ReportService Notice: Drive upload fallback marker saved for photo ${i+1}: ` + (uploadRes ? uploadRes.error : 'Unknown'));
          uploadedUrls.push(`[Foto ${i+1} Terlampir - Menunggu Otorisasi Drive]`);
        }
      } else if (p.url) {
        uploadedUrls.push(extractStringUrl(p.url));
      } else {
        throw new Error(`Foto bukti kegiatan #${i+1} tidak valid.`);
      }
    }

    payload.fotoUrl = uploadedUrls[0] || '';
    payload.fotoUrl2 = uploadedUrls[1] || '';
    payload.fotoUrl3 = uploadedUrls[2] || '';
    payload.photos = uploadedUrls;

    payload.timestamp = formatDate(new Date());
    payload.kendala = typeof normalizeKendalaText === 'function' ? normalizeKendalaText(payload.kendala) : (payload.kendala || '');
    payload.upaya = payload.kendala ? (payload.upaya || '') : '';

    const report = OperationalReport(payload);
    
    // Evaluate triage (Flagged solely if Kendala is actual non-empty obstacle)
    const flag = TriageEngine.evaluate(report.kendala);

    // Save into central spreadsheet (auto-handles triage highlighting & sensitive routing)
    const result = SpreadsheetRepository.saveOperationalReport(report, flag);

    // Send notifications if urgent severity
    if (flag && flag.severity === ReportSeverity.URGENT) {
      try {
        NotificationAdapter.sendIncidentNotification(report, flag);
      } catch (e) {
        Logger.log('ReportService Notice: Incident notification dispatch failed: ' + e.toString());
      }
    }

    return result;
  },

  /**
   * Retrieves operational report by UUID across all tabs.
   * @param {string} reportId 
   * @returns {Object} Operational report data.
   */
  getOperationalReportById: function(reportId) {
    if (!reportId) return null;
    return SpreadsheetRepository.getOperationalReportById(reportId);
  },

  /**
   * Searches for autocomplete suggestion matches for activity codes based on keyword query.
   * @param {string} query 
   * @returns {Array<string>} Matching activity codes list.
   */
  searchKodeKegiatanSuggestions: function(query) {
    if (!query || query.trim().length < 2) return [];
    const reports = SpreadsheetRepository.getAdminQueueData();
    const q = query.trim().toLowerCase();
    const codesSet = new Set();
    reports.forEach(r => {
      if (r.kodeKegiatan && r.kodeKegiatan.toLowerCase().includes(q)) {
        codesSet.add(r.kodeKegiatan);
      }
    });
    return Array.from(codesSet).slice(0, 50);
  },

  /**
   * Resolves or lazily provisions the structured Google Drive photo folder:
   * Root (MPL_Dokumentasi_Foto) -> Daily Folder (YYYY-MM-DD) -> Employee Folder ([ID] - [Nama])
   * @param {string} [dateStr] - YYYY-MM-DD format
   * @param {string} [empId] - Employee ID
   * @param {string} [namaPic] - Employee Name
   * @returns {{ folder: Folder|null, folderId: string|null, rootFolderUrl: string|null }}
   */
  resolveDailyEmployeePhotoFolder_: function(dateStr, empId, namaPic) {
    if (typeof DriveApp === 'undefined') return { folder: null, folderId: null, rootFolderUrl: null };

    try {
      const now = new Date();
      const actualDateStr = dateStr || Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');
      const rootFolderName = 'MPL_Dokumentasi_Foto';
      
      // 1. Get or create Root Folder (MPL_Dokumentasi_Foto)
      let rootFolder = null;
      const rootFolderId = ConfigRepository.getProperty('DRIVE_PHOTO_FOLDER_ID');
      if (rootFolderId) {
        try {
          const candidate = DriveApp.getFolderById(rootFolderId);
          if (candidate && !candidate.isTrashed()) {
            rootFolder = candidate;
          }
        } catch (e) {
          rootFolder = null;
        }
      }

      if (!rootFolder) {
        const rootIter = DriveApp.getFoldersByName(rootFolderName);
        while (rootIter && rootIter.hasNext()) {
          const candidate = rootIter.next();
          if (!candidate.isTrashed()) {
            rootFolder = candidate;
            break;
          }
        }
        if (!rootFolder) {
          rootFolder = DriveApp.createFolder(rootFolderName);
        }
        if (rootFolder) {
          ConfigRepository.setProperty('DRIVE_PHOTO_FOLDER_ID', rootFolder.getId());
        }
      }

      if (!rootFolder) {
        Logger.log('ReportService Error: Could not obtain MPL_Dokumentasi_Foto root folder.');
        return { folder: null, folderId: null, rootFolderUrl: null };
      }

      // 2. Get or create Daily Subfolder: YYYY-MM-DD
      let dailyFolder = null;
      const dailyIter = rootFolder.getFoldersByName(actualDateStr);
      while (dailyIter && dailyIter.hasNext()) {
        const candidate = dailyIter.next();
        if (!candidate.isTrashed()) {
          dailyFolder = candidate;
          break;
        }
      }
      if (!dailyFolder) {
        dailyFolder = rootFolder.createFolder(actualDateStr);
      }

      if (!dailyFolder) dailyFolder = rootFolder;

      // 3. Get or create Employee Subfolder: [ID] - [Nama]
      const cleanEmpId = String(empId || 'Umum').trim();
      const cleanName = String(namaPic || '').trim();
      const empFolderName = cleanName ? `${cleanEmpId} - ${cleanName}` : cleanEmpId;

      let empFolder = null;
      const empIter = dailyFolder.getFoldersByName(empFolderName);
      while (empIter && empIter.hasNext()) {
        const candidate = empIter.next();
        if (!candidate.isTrashed()) {
          empFolder = candidate;
          break;
        }
      }
      if (!empFolder) {
        empFolder = dailyFolder.createFolder(empFolderName);
      }

      const target = empFolder || dailyFolder || rootFolder;
      return {
        folder: target,
        folderId: target.getId(),
        rootFolderUrl: rootFolder.getUrl()
      };
    } catch (e) {
      Logger.log('ReportService: Error in resolveDailyEmployeePhotoFolder_: ' + e.toString());
      try {
        const rootIter = DriveApp.getFoldersByName('MPL_Dokumentasi_Foto');
        if (rootIter && rootIter.hasNext()) {
          const rf = rootIter.next();
          return { folder: rf, folderId: rf.getId(), rootFolderUrl: rf.getUrl() };
        }
      } catch (eRoot) {}
      return { folder: null, folderId: null, rootFolderUrl: null };
    }
  },

  /**
   * Uploads base64 encoded photo attachment into structured employee/daily Drive folder.
   * @param {string} base64Data 
   * @param {string} mimeType 
   * @param {string} formId 
   * @param {string} reportId 
   * @param {string} kodeKegiatan 
   * @param {string} [empId]
   * @param {string} [namaPic]
   * @param {string} [dateStr]
   * @param {Folder} [resolvedFolder] - Optional pre-resolved folder instance
   * @returns {{ url: string, fileId: string, error: string|null }} Structured upload result.
   */
  uploadReportAttachment: function(base64Data, mimeType, formId, reportId, kodeKegiatan, empId, namaPic, dateStr, resolvedFolder) {
    if (!base64Data) return { url: '', fileId: '', error: 'Tidak ada data foto yang dikirim.' };
    
    // Use pre-resolved folder or resolve on demand
    let targetFolder = resolvedFolder || null;
    let targetFolderId = null;
    if (!targetFolder) {
      try {
        const folderRes = this.resolveDailyEmployeePhotoFolder_(dateStr, empId, namaPic);
        targetFolder = folderRes.folder;
        targetFolderId = folderRes.folderId;
      } catch (eF) {
        Logger.log('ReportService: Folder resolution notice: ' + eF.toString());
      }
    } else {
      try { targetFolderId = targetFolder.getId(); } catch (eId) {}
    }

    const safeFilename = `${kodeKegiatan || 'Foto'}_${Date.now()}.jpg`;

    // 1. Primary path: Native DriveApp API
    try {
      if (typeof DriveApp !== 'undefined') {
        let cleanBase64 = String(base64Data);
        if (cleanBase64.indexOf(',') !== -1) {
          cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'image/jpeg', safeFilename);
        let file = null;
        if (targetFolder) {
          try { 
            file = targetFolder.createFile(blob); 
          } catch (eCreate) {
            Logger.log('ReportService: targetFolder.createFile error: ' + eCreate.toString());
          }
        }
        
        // Fallback: If targetFolder failed, save inside MPL_Dokumentasi_Foto root folder, NOT Drive root
        if (!file) {
          try {
            const rootIter = DriveApp.getFoldersByName('MPL_Dokumentasi_Foto');
            if (rootIter && rootIter.hasNext()) {
              file = rootIter.next().createFile(blob);
            }
          } catch (eRootF) {
            Logger.log('ReportService: Fallback to MPL_Dokumentasi_Foto failed: ' + eRootF.toString());
          }
        }

        if (file) {
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (err) {}
          const fileUrl = file.getUrl();
          const fileId = file.getId();
          return { url: fileUrl, fileId: fileId, error: null };
        }
      }
    } catch (eDriveApp) {
      Logger.log('ReportService Notice: Native DriveApp permission fallback triggered: ' + eDriveApp.toString());
    }

    // 2. Secondary Fallback path: Direct Google Drive REST API v3 via UrlFetchApp & ScriptApp.getOAuthToken()
    try {
      const restRes = this.uploadReportAttachmentViaRestApi_(base64Data, mimeType, safeFilename, targetFolderId);
      if (restRes && restRes.url) {
        return restRes;
      }
    } catch (eRest) {
      Logger.log('ReportService Error: Both DriveApp and REST API photo upload failed: ' + eRest.toString());
      return { url: '', fileId: '', error: 'Drive API: ' + (eRest.message || eRest.toString()) };
    }

    return { url: '', fileId: '', error: 'Gagal membuat file foto di Google Drive.' };
  },

  /**
   * Directly uploads base64 photo via Google Drive API v3 REST endpoint into specific parent folder using OAuth Token.
   * @private
   */
  uploadReportAttachmentViaRestApi_: function(base64Data, mimeType, filename, parentFolderId) {
    let cleanBase64 = String(base64Data);
    if (cleanBase64.indexOf(',') !== -1) {
      cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const token = ScriptApp.getOAuthToken();
    const metadata = {
      name: filename || `Photo_${Date.now()}.jpg`,
      mimeType: mimeType || 'image/jpeg'
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + (mimeType || 'image/jpeg') + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      cleanBase64 +
      close_delim;

    const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      payload: multipartRequestBody,
      muteHttpExceptions: true
    });

    const resJson = JSON.parse(response.getContentText());
    if (resJson && resJson.id) {
      const fileId = resJson.id;
      const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

      // Set public view permissions via Drive API v3
      try {
        UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          }),
          muteHttpExceptions: true
        });
      } catch (errPerm) {}

      return { url: fileUrl, fileId: fileId, error: null };
    }

    return { url: '', fileId: '', error: (resJson && resJson.error && resJson.error.message) ? resJson.error.message : 'Unknown REST API error' };
  },

  /**
   * Submits a dynamic custom form response into form's tab inside integrated spreadsheet.
   */
  submitDynamicFormResponse: function(formId, payload) {
    if (!formId || !payload) throw new Error('Form ID dan payload data wajib diisi.');

    const forms = FormManagementService.getFormList();
    const form = forms.find(f => f.id === formId);
    if (!form) throw new Error('Form tidak ditemukan.');

    const reportId = Utilities.getUuid();
    const nowStr = formatDate(new Date());
    const empId = payload.empId || payload.kode_karyawan || 'EMP-DYNAMIC';
    const site = payload.site || payload.lokasi || 'Site A';
    const date = payload.date || payload.tanggal || formatDate(new Date());

    let photoUrl = '';
    const photoKey = Object.keys(payload).find(k => ['foto', 'photo', 'foto_lampiran', 'attachment'].includes(k.toLowerCase()));
    if (photoKey) {
      photoUrl = String(payload[photoKey] || '');
    }

    const textPieces = [];
    Object.keys(payload).forEach(k => {
      const lowerKey = k.toLowerCase();
      if (!['empId', 'site', 'date', 'kode_karyawan', 'lokasi', 'tanggal', 'foto', 'photo', 'foto_lampiran', 'attachment'].includes(lowerKey)) {
        textPieces.push(`${k}: ${payload[k]}`);
      }
    });
    const details = textPieces.join(' | ');

    const rawKendala = payload.kendala || payload.Kendala || payload.kendalaKegiatan || payload.kendala_kegiatan || '';
    const kendalaVal = typeof normalizeKendalaText === 'function' ? normalizeKendalaText(rawKendala) : String(rawKendala).trim();
    const upayaVal = kendalaVal ? String(payload.upaya || '').trim() : '';
    const flag = TriageEngine.evaluate(kendalaVal);
    const targetSsId = ConfigRepository.getSpreadsheetId();
    if (!targetSsId) throw new Error('Sheet data form belum terkonfigurasi.');

    const ss = SpreadsheetApp.openById(targetSsId);
    const targetSheet = FormManagementService.resolveFormTab_(ss, form);

    const rowData = [
      reportId, '', '', nowStr, empId, site, site, details, '', '', '',
      '', 0, 0, date, 0, '', 0, '', '', 0,
      0, 0, 0, '', '', kendalaVal, upayaVal, photoUrl,
      flag.severity, ReviewStatus.UNVERIFIED
    ];

    const sanitizedRowData = rowData.map(val => {
      return (typeof SecurityService !== 'undefined' && SecurityService.InputSanitizer)
        ? SecurityService.InputSanitizer.sanitizeForSpreadsheet(val)
        : val;
    });

    targetSheet.appendRow(sanitizedRowData);
    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(form.title || 'Form Kustom', targetSheet.getLastRow(), rowData, flag);
    }

    return { success: true, reportId: reportId };
  },

  /**
   * Processes native Google Form submit event for Operational Form.
   * @param {Object} e - Event object.
   */
  processFormSubmit: function(e) {
    try {
      if (!e || !e.range) return;
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing Native Form Submit at row: ' + row);

      const reportId = SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Native Google Form submit evaluate by header name
      const headerMap = SpreadsheetRepository.getHeaderMap_(sheet);
      const kendalaVal = String(SpreadsheetRepository.getCellValue_(rowData, headerMap, 'Kendala', 20) || '').trim();
      const flag = TriageEngine.evaluate(kendalaVal);

      // Auto-resolve ID Karyawan to Nama PIC & Bidang Divisi if needed
      const rawIdKaryawan = String(SpreadsheetRepository.getCellValue_(rowData, headerMap, 'ID_Karyawan') || 
                                   SpreadsheetRepository.getCellValue_(rowData, headerMap, 'ID Karyawan') || 
                                   SpreadsheetRepository.getCellValue_(rowData, headerMap, 'Kode Karyawan') || '').trim();
      if (rawIdKaryawan) {
        const emp = lookupEmployee(rawIdKaryawan);
        if (emp) {
          const picCol = headerMap['nama_pic'] || headerMap['nama'];
          const divCol = headerMap['bidang_divisi'] || headerMap['divisi'];
          if (picCol && !sheet.getRange(row, picCol + 1).getValue()) {
            sheet.getRange(row, picCol + 1).setValue(emp.name);
          }
          if (divCol && !sheet.getRange(row, divCol + 1).getValue()) {
            sheet.getRange(row, divCol + 1).setValue(emp.division);
          }
        }
      }

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert('Laporan Operasional (Native Form)', row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processFormSubmit: ' + err.toString());
    }
  }
};
