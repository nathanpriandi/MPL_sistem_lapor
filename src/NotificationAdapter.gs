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
   * Formats comprehensive multi-division metrics, revenue, overdue harvests, and open obstacles.
   * @param {Object} stats - Dashboard stats object from SpreadsheetRepository.getDashboardStatsData()
   * @param {string} periodLabel - Period label string (e.g., "Agustus 2026")
   * @param {string} [webAppUrl] - Web App access URL
   */
  sendWeeklyManagerDigest: function(stats, periodLabel, webAppUrl) {
    const managerEmail = ConfigRepository.getManagerEmail();
    const period = periodLabel || formatDate(new Date());
    const subject = `📈 [Executive Digest] Rekapitulasi Operasional Agribisnis — ${period}`;
    
    const divAgro = (stats && stats.divisiBreakdown && stats.divisiBreakdown['Agro (Pertanian/Perkebunan)']) || { panenVolume: 0, activityCount: 0, nilaiPenjualanRp: 0 };
    const divTernak = (stats && stats.divisiBreakdown && stats.divisiBreakdown['Ternak (Peternakan)']) || { panenVolume: 0, activityCount: 0, nilaiPenjualanRp: 0 };
    const divIkan = (stats && stats.divisiBreakdown && stats.divisiBreakdown['Ikan (Perikanan)']) || { panenVolume: 0, activityCount: 0, nilaiPenjualanRp: 0 };

    const distinctActivities = (stats && stats.distinctActivityCount) || 0;
    const totalReports = (stats && stats.totalReports) || 0;
    const totalSales = (stats && stats.totalNilaiPenjualanRp) || 0;
    const salesTrend = (stats && stats.salesTrendPercent !== null && stats.salesTrendPercent !== undefined) 
      ? `${stats.salesTrendPercent > 0 ? '+' : ''}${stats.salesTrendPercent}% vs bulan lalu` 
      : 'Bulan berjalan';
    const activeWaiting = (stats && stats.totalActiveKegiatan) || 0;

    const body = 
      `RINGKASAN EKSEKUTIF OPERASIONAL AGRIBISNIS\n` +
      `Periode: ${period}\n` +
      `==================================================\n\n` +
      `📊 1. METRIK UTAMA OPERASIONAL:\n` +
      `   - Total Aktivitas Berjalan : ${distinctActivities} kegiatan (${totalReports} total laporan masuk)\n` +
      `   - Total Nilai Penjualan    : Rp ${totalSales.toLocaleString('id-ID')} (${salesTrend})\n` +
      `   - Kegiatan Menunggu Panen  : ${activeWaiting} aktivitas aktif\n\n` +
      `🌱 2. HASIL PANEN & PERFORMA PER DIVISI:\n` +
      `   - Agro (Pertanian)  : ${divAgro.panenVolume.toLocaleString('id-ID')} Kg | ${divAgro.activityCount} aktivitas | Rp ${divAgro.nilaiPenjualanRp.toLocaleString('id-ID')}\n` +
      `   - Ternak (Kandang)  : ${divTernak.panenVolume.toLocaleString('id-ID')} Ekor/Unit | ${divTernak.activityCount} aktivitas | Rp ${divTernak.nilaiPenjualanRp.toLocaleString('id-ID')}\n` +
      `   - Ikan (Perikanan)  : ${divIkan.panenVolume.toLocaleString('id-ID')} Kg | ${divIkan.activityCount} aktivitas | Rp ${divIkan.nilaiPenjualanRp.toLocaleString('id-ID')}\n\n` +
      `==================================================\n` +
      `Buka Dashboard Manajer untuk visualisasi interaktif dan grafik tren mingguan:\n` +
      `${webAppUrl || ConfigRepository.getPublicWebAppUrl() || 'Aplikasi Sistem Pelaporan Digital'}`;

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
