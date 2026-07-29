/**
 * NotificationAdapter.gs — Email Notification & Messaging Infrastructure Adapter
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE
 * Responsibility: Formats and dispatches email notifications via MailApp.
 * Encapsulates message template building and email transport details.
 */

const NotificationAdapter = {
  /**
   * Sends instant email alert for urgent incidents.
   * Maintains backward compatibility for notifyAdminUrgent signature.
   * @param {string} sourceSheetName 
   * @param {number} row 
   * @param {Array} rowData 
   * @param {Object} flag 
   */
  sendUrgentAlert: function(sourceSheetName, row, rowData, flag) {
    const adminEmail = ConfigRepository.getAdminEmail();

    const site = rowData[2] || rowData[3] || 'N/A';
    const empId = rowData[1] || rowData[2] || 'N/A';
    const date = rowData[3] || rowData[4] ? formatDate(new Date(rowData[3] || rowData[4])) : 'N/A';
    const details = rowData[4] || rowData[5] || rowData.join(', ');

    const subject = `🚨 [URGENT ALERT] Incident Flagged at ${site} (${(flag.category || '').toUpperCase()})`;
    
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

    try {
      MailApp.sendEmail({
        to: adminEmail,
        subject: subject,
        body: body
      });
      Logger.log('NotificationAdapter: Urgent email sent to: ' + adminEmail);
    } catch (e) {
      Logger.log(`NotificationAdapter Error sending urgent email: ${e.toString()}`);
    }
  },

  /**
   * Sends email notification for isolated sensitive report.
   * @param {Object} info - { reportId, site, empId, date }
   */
  sendSensitiveAlert: function(info) {
    const adminEmail = ConfigRepository.getAdminEmail();
    if (!adminEmail) return;

    const subject = '[SENSITIVE REPORT RECEIVED] New entry in Sensitive_Restricted';
    const body = 
      `Laporan sensitif baru diserahkan.\n\n` +
      `Report ID: ${info.reportId}\n` +
      `Lokasi: ${info.site}\n` +
      `Kode Karyawan: ${info.empId}\n` +
      `Tanggal: ${info.date}`;

    try {
      MailApp.sendEmail({ to: adminEmail, subject: subject, body: body });
      Logger.log('NotificationAdapter: Sensitive report alert sent to: ' + adminEmail);
    } catch (e) {
      Logger.log(`NotificationAdapter Error sending sensitive alert: ${e.toString()}`);
    }
  },

  /**
   * Sends Daily Admin Digest email.
   * @param {number} totalPending 
   * @param {number} urgentCount 
   * @param {number} warningCount 
   * @param {number} normalCount 
   * @param {string} spreadsheetUrl 
   */
  sendDailyDigest: function(totalPending, urgentCount, warningCount, normalCount, spreadsheetUrl) {
    const adminEmail = ConfigRepository.getAdminEmail();
    const subject = `📋 [Daily Digest] Ringkasan Antrean Admin ${formatDate(new Date())}`;
    
    const body = 
      `RINGKASAN LAKUKAN REVIEW HARI INI (17:00 WIB)\n` +
      `--------------------------------------------------\n` +
      `Total Laporan Belum Di-review (Unreviewed Queue): ${totalPending}\n\n` +
      `- 🚨 Urgent / Critical: ${urgentCount}\n` +
      `- ⚠️ Warning / Perhatian: ${warningCount}\n` +
      `- ℹ️ Normal / Rutin: ${normalCount}\n\n` +
      `Spreadsheet URL: ${spreadsheetUrl}\n\n` +
      `Silakan selesaikan review status laporan di tab Admin_Queue.`;

    try {
      MailApp.sendEmail({ to: adminEmail, subject: subject, body: body });
      Logger.log('NotificationAdapter: Daily digest email sent to: ' + adminEmail);
    } catch (e) {
      Logger.log(`NotificationAdapter Error sending daily digest: ${e.toString()}`);
    }
  },

  /**
   * Sends Weekly Executive Summary email to Manager.
   * @param {Array} summaryStats 
   * @param {string} weekLabel 
   * @param {string} spreadsheetUrl 
   */
  sendWeeklyManagerDigest: function(summaryStats, weekLabel, spreadsheetUrl) {
    const managerEmail = ConfigRepository.getManagerEmail();
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
      `Link Spreadsheet Central: ${spreadsheetUrl}`;

    try {
      MailApp.sendEmail({ to: managerEmail, subject: subject, body: body });
      Logger.log('NotificationAdapter: Weekly manager digest sent to: ' + managerEmail);
    } catch (e) {
      Logger.log(`NotificationAdapter Error sending weekly manager digest: ${e.toString()}`);
    }
  }
};

/**
 * Backward compatibility wrapper for notifyAdminUrgent.
 */
function notifyAdminUrgent(sourceSheetName, row, rowData, flag) {
  NotificationAdapter.sendUrgentAlert(sourceSheetName, row, rowData, flag);
}
