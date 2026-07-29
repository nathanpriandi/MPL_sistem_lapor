/**
 * Triggers.gs — Automated Trigger Registration & Management Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: PROVISIONING / INFRASTRUCTURE
 * Responsibility: Registers and removes Apps Script event and time-driven triggers.
 */

/**
 * Creates all required form submit and time-driven triggers.
 * Run once after running setupReportingSystem().
 */
function createTriggers() {
  Logger.log('Registering system triggers...');
  
  // Clear any pre-existing triggers to avoid duplicates
  removeTriggers();

  const dailyFormId = ConfigRepository.getDailyFormId();
  const generalFormId = ConfigRepository.getGeneralFormId();

  if (!dailyFormId || !generalFormId) {
    throw new Error('DAILY_FORM_ID or GENERAL_FORM_ID missing in ScriptProperties. Run setupReportingSystem() first.');
  }

  // 1. Form Submit Trigger for Daily Report Form
  const dailyForm = FormApp.openById(dailyFormId);
  ScriptApp.newTrigger('onDailyFormSubmit')
    .forForm(dailyForm)
    .onFormSubmit()
    .create();
  Logger.log('Created trigger: onDailyFormSubmit');

  // 2. Form Submit Trigger for General Report Form
  const generalForm = FormApp.openById(generalFormId);
  ScriptApp.newTrigger('onGeneralFormSubmit')
    .forForm(generalForm)
    .onFormSubmit()
    .create();
  Logger.log('Created trigger: onGeneralFormSubmit');

  // 3. Time-driven Daily Admin Digest Trigger (Everyday at 17:00 WIB / 5 PM)
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .create();
  Logger.log('Created trigger: sendDailyDigest (Daily at 17:00 WIB)');

  // 4. Time-driven Weekly Manager Digest Trigger (Every Monday at 08:00 WIB / 8 AM)
  ScriptApp.newTrigger('sendWeeklyManagerDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
  Logger.log('Created trigger: sendWeeklyManagerDigest (Mondays at 08:00 WIB)');

  // 5. Time-driven Monthly Data Archival Trigger (1st day of month at 01:00 AM WIB)
  ScriptApp.newTrigger('archiveOldReports')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
  Logger.log('Created trigger: archiveOldReports (Monthly on 1st at 01:00 AM WIB)');

  Logger.log('=== ALL TRIGGERS INSTALLED SUCCESSFULLY ===');
}

/**
 * Removes all project triggers. Useful for reset or maintenance.
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`Clearing ${triggers.length} existing trigger(s)...`);
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}
