/**
 * ClientAPI.gs — Server RPC Functions called by Client (google.script.run)
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Submits a new Daily Operational Report from Web App.
 * @param {Object} payload - { empId, site, date, taskStatus, yieldKg, issues }
 * @returns {Object} { success: true, reportId: string }
 */
function submitDailyReport(payload) {
  if (!payload || !payload.empId || !payload.site || !payload.date || !payload.taskStatus) {
    throw new Error('Missing required daily report fields.');
  }

  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName('Daily_Raw');

  const reportId = Utilities.getUuid();
  const now = new Date();
  const nowStr = formatDate(now);

  const rowData = [
    reportId,
    nowStr,
    payload.empId,
    payload.site,
    payload.date,
    payload.taskStatus,
    parseFloat(payload.yieldKg) || 0,
    (payload.issues || []).join(', ')
  ];

  sheet.appendRow(rowData);
  const row = sheet.getLastRow();

  const flag = evaluateFlags(rowData);

  sheet.getRange(row, 9).setValue(flag.severity);
  sheet.getRange(row, 10).setValue(flag.rank);
  sheet.getRange(row, 11).setValue(flag.category);
  sheet.getRange(row, 12).setValue('Unreviewed');

  applyRowHighlighting(sheet, row, flag.severity);

  if (flag.severity === 'urgent') {
    notifyAdminUrgent('Daily_Raw', row, rowData, flag);
  }

  return { success: true, reportId: reportId };
}

/**
 * Submits a new General Narrative & Incident Report from Web App.
 * @param {Object} payload - { empId, site, date, details, isSensitive }
 * @returns {Object} { success: true, reportId: string }
 */
function submitGeneralReport(payload) {
  if (!payload || !payload.empId || !payload.site || !payload.date || !payload.details) {
    throw new Error('Missing required general report fields.');
  }

  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);

  const reportId = Utilities.getUuid();
  const now = new Date();
  const nowStr = formatDate(now);
  const sensitiveText = payload.isSensitive ? 'Ya / Yes (Laporan ini berisi data sensitif/privat)' : 'Tidak';

  const rowData = [
    reportId,
    nowStr,
    payload.empId,
    payload.site,
    payload.date,
    payload.details,
    sensitiveText
  ];

  const flag = evaluateFlags(rowData);

  if (payload.isSensitive || isSensitiveRow(rowData)) {
    const sensitiveSheet = ss.getSheetByName('Sensitive_Restricted');
    const sensitiveRowData = [
      reportId,
      nowStr,
      payload.empId,
      payload.site,
      payload.date,
      payload.details,
      sensitiveText,
      flag.severity,
      flag.rank,
      flag.category,
      'Unreviewed (Sensitive)'
    ];

    sensitiveSheet.appendRow(sensitiveRowData);

    const adminEmail = props.getProperty('ADMIN_EMAIL');
    if (adminEmail) {
      MailApp.sendEmail({
        to: adminEmail,
        subject: '[SENSITIVE REPORT RECEIVED] New entry in Sensitive_Restricted',
        body: `Laporan sensitif baru diserahkan.\n\nReport ID: ${reportId}\nLokasi: ${payload.site}\nKode Karyawan: ${payload.empId}\nTanggal: ${payload.date}`
      });
    }

    return { success: true, reportId: reportId, isSensitive: true };
  }

  const generalSheet = ss.getSheetByName('General_Raw');
  generalSheet.appendRow(rowData);
  const row = generalSheet.getLastRow();

  generalSheet.getRange(row, 8).setValue(flag.severity);
  generalSheet.getRange(row, 9).setValue(flag.rank);
  generalSheet.getRange(row, 10).setValue(flag.category);
  generalSheet.getRange(row, 11).setValue('Unreviewed');

  applyRowHighlighting(generalSheet, row, flag.severity);

  if (flag.severity === 'urgent') {
    notifyAdminUrgent('General_Raw', row, rowData, flag);
  }

  return { success: true, reportId: reportId, isSensitive: false };
}

/**
 * Returns Admin_Queue rows for admin display.
 * @returns {Array} Array of row objects.
 */
function getAdminQueueData() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) return [];

  const ss = SpreadsheetApp.openById(ssId);
  const queueSheet = ss.getSheetByName('Admin_Queue');
  const values = queueSheet.getDataRange().getValues();

  if (!values || values.length <= 1) return [];

  const queueRows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[0] && row[0] !== '') {
      queueRows.push({
        source: row[0],
        reportId: row[1],
        timestamp: row[2],
        empId: row[3],
        site: row[4],
        date: row[5],
        detail: row[6],
        yieldOrSensitive: row[7],
        issues: row[8],
        severity: row[9],
        rank: row[10],
        category: row[11],
        reviewStatus: row[12]
      });
    }
  }

  return queueRows;
}

/**
 * Updates Review_Status of a report by matching Report_ID.
 * @param {string} reportId - Unique UUID of report.
 * @param {string} newStatus - Target status ('Unreviewed', 'In Review', 'Action Needed', 'Closed').
 * @returns {Object} { success: boolean, updated: boolean }
 */
function updateReviewStatus(reportId, newStatus) {
  if (!reportId || !newStatus) {
    throw new Error('Report ID and new status are required.');
  }

  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);

  const sheetsToSearch = [
    { name: 'Daily_Raw', statusCol: 12 },
    { name: 'General_Raw', statusCol: 11 },
    { name: 'Sensitive_Restricted', statusCol: 11 }
  ];

  for (let s = 0; s < sheetsToSearch.length; s++) {
    const info = sheetsToSearch[s];
    const sheet = ss.getSheetByName(info.name);
    if (!sheet) continue;

    const values = sheet.getDataRange().getValues();
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0]) === String(reportId)) {
        sheet.getRange(r + 1, info.statusCol).setValue(newStatus);
        Logger.log(`Updated report ${reportId} in ${info.name} row ${r + 1} to status: ${newStatus}`);
        return { success: true, reportId: reportId, sheet: info.name, updatedStatus: newStatus };
      }
    }
  }

  return { success: false, error: 'Report_ID not found in raw sheets.' };
}

/**
 * Returns aggregated stats for Executive Manager Dashboard.
 * @returns {Object} JSON stats object for dashboard rendering.
 */
function getDashboardStats() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) return null;

  const ss = SpreadsheetApp.openById(ssId);
  const dailySheet = ss.getSheetByName('Daily_Raw');
  const generalSheet = ss.getSheetByName('General_Raw');
  const sensitiveSheet = ss.getSheetByName('Sensitive_Restricted');

  const dailyValues = dailySheet.getDataRange().getValues().slice(1);
  const generalValues = generalSheet.getDataRange().getValues().slice(1);
  const sensitiveValues = sensitiveSheet.getDataRange().getValues().slice(1);

  let totalYield = 0;
  let urgentCount = 0;
  let warningCount = 0;
  let normalCount = 0;

  dailyValues.forEach(row => {
    totalYield += parseFloat(row[6]) || 0;
    const sev = String(row[8]).toLowerCase();
    if (sev === 'urgent') urgentCount++;
    else if (sev === 'warning') warningCount++;
    else normalCount++;
  });

  generalValues.forEach(row => {
    const sev = String(row[7]).toLowerCase();
    if (sev === 'urgent') urgentCount++;
    else if (sev === 'warning') warningCount++;
    else normalCount++;
  });

  sensitiveValues.forEach(row => {
    const sev = String(row[7]).toLowerCase();
    if (sev === 'urgent') urgentCount++;
    else if (sev === 'warning') warningCount++;
    else normalCount++;
  });

  const sites = [
    'Site A — Kebun & Lahan Pertanian', 
    'Site B — Peternakan & Kandang', 
    'Site C — Pabrik Pengolahan & Pakan', 
    'Site D — Logistik & Gudang'
  ];

  const allReports = dailyValues.concat(generalValues).concat(sensitiveValues);
  const siteCounts = sites.map(site => {
    return allReports.filter(row => row[3] === site || row[2] === site).length;
  });

  return {
    totalReports: allReports.length,
    totalYield: totalYield,
    urgentCount: urgentCount,
    warningCount: warningCount,
    normalCount: normalCount,
    sensitiveCount: sensitiveValues.length,
    siteCounts: siteCounts
  };
}

/**
 * Returns direct quick links for Admin/Manager workspace resources.
 * @returns {Object} { spreadsheetUrl, dailyFormEditUrl, generalFormEditUrl, publicWebAppUrl }
 */
function getAdminQuickLinks() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID') || '';
  const dailyFormId = props.getProperty('DAILY_FORM_ID') || '';
  const generalFormId = props.getProperty('GENERAL_FORM_ID') || '';
  const webAppUrl = getCanonicalWebAppUrl();

  return {
    spreadsheetUrl: ssId ? `https://docs.google.com/spreadsheets/d/${ssId}/edit` : '',
    dailyFormEditUrl: dailyFormId ? `https://docs.google.com/forms/d/${dailyFormId}/edit` : '',
    generalFormEditUrl: generalFormId ? `https://docs.google.com/forms/d/${generalFormId}/edit` : '',
    publicWebAppUrl: webAppUrl ? (webAppUrl.includes('?') ? webAppUrl : `${webAppUrl}?page=index`) : ''
  };
}

