/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Google Apps Script — הדבק ב-Extensions → Apps Script בתוך הגיליון */
export const GOOGLE_SHEETS_APPS_SCRIPT = `function doPost(e) {
  try {
    // 1. קריאת נתוני ה-JSON הנכנסים ממסרגו
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 2. יצירת כותרות לטבלה באופן אוטומטי אם הגיליון ריק
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["מזהה הודעה (ID)", "נמען (dest)", "שולח (phone)", "תאריך קבלה", "הודעה (Message)", "לקוחות קשורים", "זמן סנכרון"]);
    }
    
    // משיכת נתוני ה-SMS
    var smsId = data.id || (data.sms ? data.sms.id_ : '');
    var dest = data.dest || '';
    var phone = data.phone || (data.sms ? data.sms.phone : '');
    var date = data.date || (data.sms ? data.sms.date : '');
    var message = data.message || (data.sms ? data.sms.message : '');
    var clients = data.clients ? data.clients.join(", ") : (data.assignedClients ? data.assignedClients.join(", ") : "");
    var syncTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    
    // 3. מניעת כפילויות — דילוג אם ההודעה כבר קיימת בגיליון
    if (smsId && sheet.getLastRow() > 1) {
      var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === smsId) {
          return ContentService.createTextOutput(JSON.stringify({ 
            "status": "skipped", 
            "message": "הודעה כבר קיימת בגיליון" 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    // 4. הוספת השורה לגיליון
    sheet.appendRow([smsId, dest, phone, date, message, clients, syncTime]);
    
    // 5. החזרת אישור בהצלחה
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "success", 
      "message": "הודעת SMS נוספה בהצלחה לגוגל שיטס" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      "status": "error", 
      "message": err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
