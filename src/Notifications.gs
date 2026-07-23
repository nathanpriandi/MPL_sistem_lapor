/**
 * Notifications.gs — Email Alerts & Periodic Digest Generators
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Sends instant email notification for urgent issues.
 */
function notifyAdminUrgent(sourceSheetName, row, rowData, flag) {
  const props = PropertiesService.getScriptProperties();
  const adminEmail = props.getProperty('ADMIN_EMAIL') || 'admin.operasional@perusahaan-agri.co.id';

  const site = rowData[2] || 'N/A';
  const empId = rowData[1] || 'N/A';
  const date = rowData[3] ? formatDate(new Date(rowData[3])) : 'N/A';
  const details = rowData[4] || rowData[5] || rowData.join(', ');

  const subject = `🚨 [URGENT ALERT] Incident Flagged at ${site} (${flag.category.toUpperCase()})`;
  
  const body = 
    `PEMBERITAHUAN DARURAT (URGENT INCIDENT ALERT)\n` +
    `--------------------------------------------------\n` +
    `Sumber: ${sourceSheetName} (Baris ${row})\n` +
    `Lokasi / Site: ${site}\n` +
    `Kode Karyawan: ${empId}\n` +
    `Tanggal: ${date}\n` +
    `Kategori: ${flag.category}\n` +
    `Tingkat Keparahan: URGENT / HIGH\n\n` +
    `Rincian / Isi Laporan:\n` +
    `${details}\n\n` +
    `--------------------------------------------------\n` +
    `Harap segera periksa tab Admin_Queue pada Spreadsheet Sistem Pelaporan Digital.`;

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    body: body
  });
  
  Logger.log('Urgent notification sent to: ' + adminEmail);
}

/**
 * Daily Admin Digest — Scheduled every day at 17:00 WIB.
 */
function sendDailyDigest() {
  Logger.log('Running sendDailyDigest...');
  const props = PropertiesService.getScriptProperties();
  const adminEmail = props.getProperty('ADMIN_EMAIL') || 'admin.operasional@perusahaan-agri.co.id';
  const ssId = props.getProperty('SPREADSHEET_ID');

  if (!ssId) {
    Logger.log('Error: SPREADSHEET_ID not set.');
    return;
  }

  const ss = SpreadsheetApp.openById(ssId);
  const queueSheet = ss.getSheetByName('Admin_Queue');
  const values = queueSheet.getDataRange().getValues();

  let totalPending = 0;
  let urgentCount = 0;
  let warningCount = 0;
  let normalCount = 0;

  // Skip header (row 0)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[0] && row[0] !== '') { // Valid row from QUERY
      totalPending++;
      const severity = String(row[8]).toLowerCase();
      if (severity === 'urgent') urgentCount++;
      else if (severity === 'warning') warningCount++;
      else normalCount++;
    }
  }

  const subject = `📋 [Daily Digest] Ringkasan Antrean Admin ${formatDate(new Date())}`;
  const body = 
    `RINGKASAN LAKUKAN REVIEW HARI INI (17:00 WIB)\n` +
    `--------------------------------------------------\n` +
    `Total Laporan Belum Di-review (Unreviewed Queue): ${totalPending}\n\n` +
    `- 🚨 Urgent / Critical: ${urgentCount}\n` +
    `- ⚠️ Warning / Perhatian: ${warningCount}\n` +
    `- ℹ️ Normal / Rutin: ${normalCount}\n\n` +
    `Spreadsheet URL: ${ss.getUrl()}\n\n` +
    `Silakan selesaikan review status laporan di tab Admin_Queue.`;

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    body: body
  });

  Logger.log('Daily digest email sent.');
}

/**
 * Weekly Manager Digest — Scheduled every Monday at 08:00 WIB.
 * Aggregates summary into Weekly_Summary tab and sends email digest to Manager.
 */
function sendWeeklyManagerDigest() {
  Logger.log('Running sendWeeklyManagerDigest...');
  const props = PropertiesService.getScriptProperties();
  const managerEmail = props.getProperty('MANAGER_EMAIL') || 'manager.operasional@perusahaan-agri.co.id';
  const ssId = props.getProperty('SPREADSHEET_ID');

  if (!ssId) {
    Logger.log('Error: SPREADSHEET_ID not set.');
    return;
  }

  const ss = SpreadsheetApp.openById(ssId);
  
  // Aggregate statistics for past 7 days into Weekly_Summary
  const summaryStats = aggregateWeeklyData(ss);

  // Send summary email to Manager
  const weekLabel = getISOWeekLabel(new Date());
  const subject = `📈 [Weekly Executive Summary] Laporan Operasional Minggu ${weekLabel}`;
  
  let body = 
    `RINGKASAN EKSEKUTIF MINGGUAN OPERASIONAL AGRIBISNIS\n` +
    `Minggu: ${weekLabel}\n` +
    `--------------------------------------------------\n\n` +
    `REKAPITULASI DUA MINGGU TERAKHIR / SITE:\n\n`;

  summaryStats.forEach(stat => {
    body += 
      `📍 Site: ${stat.site}\n` +
      `   - Total Laporan Harian: ${stat.dailyCount}\n` +
      `   - Total Laporan Catatan Umum: ${stat.generalCount}\n` +
      `   - Total Insiden Urgent: ${stat.urgentCount}\n` +
      `   - Total Peringatan Warning: ${stat.warningCount}\n` +
      `   - Total Hasil Panen / Produksi: ${stat.totalYield.toLocaleString('id-ID')} kg\n\n`;
  });

  body += 
    `--------------------------------------------------\n` +
    `Dashboard Looker Studio dapat diakses untuk visualisasi interaktif.\n` +
    `Link Spreadsheet Central: ${ss.getUrl()}`;

  MailApp.sendEmail({
    to: managerEmail,
    subject: subject,
    body: body
  });

  Logger.log('Weekly manager digest email sent.');
}
