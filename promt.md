System Role & Objective
You are an expert full-stack developer specializing in Google Apps Script (Backend/API) and modern vanilla JavaScript + CSS (Frontend). Build a comprehensive Geolocation Attendance, Leave, and Device Management System for MolÄDira Skills (MMS).

Architecture Constraint (Decoupled Deployment for Security)
Frontend: A static multi-page web app (HTML/JS/CSS) hosted externally on GitHub Pages. It talks to the backend ONLY through asynchronous fetch() POST requests.

Backend: A Google Apps Script (Code.gs) deployed as a Web App executing as the script owner (Access: "Anyone"). It uses a doPost(e) function to route incoming API requests and returns JSON.

Security: All API keys (LocationIQ), Google Sheet references, hashing logic, and database operations MUST remain hidden in Code.gs. The frontend only knows the Web App URL (set once in shared/js/api.js).

Step 1: Database Initialization Script
Provide a standalone Apps Script function setupDatabase() (see the end of this file) that is run once to create all Google Sheets and columns. The schema must be exactly:

Users: [Email, First Name, Last Name, Password Hash, Salt, Account Type, Status, Verification Token]

Activity_Logs: [Log ID, Email, First Name, Last Name, Date, Time, Action, Latitude, Longitude, Resolved Location Name, Edited By]

Daily_Summaries: [First Name, Last Name, Summary ID, Date, Email, Clock In Time, Clock Out Time, Clock-In Floor Time, Clock-Out Floor Time, Total Hours worked, Status, Worked Overtime]

Weekly_Summaries: [First Name, Last Name, Email, Week Identifier, Total Hours Worked, Total Overtime, Days Worked, Compliance Status, Last Updated]

Monthly_Summaries: [First Name, Last Name, Email, Month, Total Hours Worked, Total Overtime, Days Worked, Last Updated]

Leave_Requests: [Request ID, Email, First Name, Last Name, Leave Type, Start Date, End Date, Status, Submitted Date]

Device_Requests: [Request ID, Email, First Name, Last Name, Device Details, Start Date, End Date, Reason, Status, Submitted Date]

Admin_Settings: [Admin Email, Role Description, Created Date]

Step 2: Core Business Logic (Backend, Code.gs)
Custom Authentication: Validate against the Users sheet using SHA-256 hashing with a unique salt per user. Account Type is Employee or Admin; Status Blocked denies login.

Geolocation Logging: On Clock In/Out accept GPS coordinates, reverse-geocode them via LocationIQ, and store the physical address. Prevent duplicate actions of the same type on the same day.

Smart Floor Times & Rounding Engine (Crucial):

Clock-In Floor Time: If a user clocks in before 08:00 AM, lock to exactly 08:00. If they clock in after 08:00 AM, dynamically round their time to the nearest 5 minutes (e.g., 08:47 becomes 08:50).

Clock-Out Floor Time: Standard end time is 17:00 Mon-Fri, and 13:00 Saturday.

Deduct exactly 1 hour for lunch when standard work minutes exceed 5 hours (no lunch deduction on Saturday).

Overtime Lockdown: Normal clock-outs must lock overtime to 0 mins. Overtime and exact early leaves are ONLY calculated if an Admin explicitly edits the shift via the dashboard (passing an isAdminEdit = true flag), which overrides the standard 08:00 / 17:00 anchors.

Auto-Failsafes: If a shift is "In Progress" from a previous day, auto-log them out at the standard end time. If a user clocks out without a clock-in today, auto-log them in at 08:00 AM first.

Exports (PDF/CSV/ZIP):

PDF/CSV Start and End times MUST come from the Floor Time columns.

On the PDF, abbreviate leave types (Sick Leave = "SL", Annual = "AL", Family = "FL").

Mask Overtime on the PDF unless the shift was officially admin-edited. If it was edited, round the overtime mathematically to the nearest whole hour (no decimals).

Provide a ZIP archiver function to batch download all employee PDFs simultaneously.

API Routing: Use a central handleApiRequest function. CRITICAL: Handle CORS by reading data from e.parameter.payload inside doPost(e). Do NOT rely on e.postData.contents. Return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON).

Step 3: Frontend Requirements (GitHub Pages)
Folder structure (Separate Admin and Employee code)
Plaintext
index.html              â† login / register page only
auth/auth.js            â† login/register logic; redirects by role
shared/
  css/base.css          â† design tokens, layout, buttons, inputs, alerts, badges, modal, utilities
  js/api.js             â† API client, google.script.run shim, session helpers, spinner/alert helpers
  js/leave_device.js    â† leave & device checkout modal logic shared by both portals
employee/
  index.html, employee.css, employee.js   â† clock in/out, leave request, device checkout
admin/
  index.html, admin.css, admin.js         â† tabs, tables, filters, exports, staff + leave + device management
Rules for this structure:

Role-specific CSS/JS/HTML stays inside its own folder. Pages load ../shared/css/base.css first.

auth.js saves to sessionStorage and redirects: Admin â†’ admin/index.html, everyone else â†’ employee/index.html.

Each portal calls requireSession(role, loginUrl) on load. Logout clears sessionStorage and returns to index.html.

UI & Styling Requirements
Design System (MMS Brand): Use pure vanilla CSS with CSS variables. Do NOT use Tailwind CSS, but perfectly replicate the deep-dark MolÄDira Skills aesthetic: Deep slate backgrounds (#020617), dark floating cards (#0f172a), and vibrant neon gradients (Orange #f97316 via Pink #d946ef to Purple #a855f7) for primary buttons, active tabs, and logo accents.

Mobile Responsiveness: Use flexible CSS Grid/Flexbox layouts that stack perfectly on mobile screens.

Employee Portal: Clock In / Out buttons, Request Leave button, Checkout Device button.

Admin Dashboard: Own clock in/out panel + leave/device requests. Tabs: Activity Logs (with login/out counters), Daily Summaries (with Edit/Delete shift buttons), Weekly, Monthly, Leave (approve/reject), Device Checkouts (approve/reject), Staff Profiles, Export Timesheet.

API Communication: Use fetch() with method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } and a URLSearchParams body containing payload (JSON). A small shim in shared/js/api.js should expose a .withSuccessHandler().method() style wrapping fetch to keep the frontend clean.

Step 4: Deployment Checklist
Create a Google Sheet, open Apps Script, paste Code.gs, run setupDatabase() once.

Deploy as Web App (Execute as: Me, Access: Anyone) and copy the URL into APPS_SCRIPT_WEB_APP_URL in shared/js/api.js.

Add the LocationIQ API key directly to Code.gs.

Push the static frontend folders to GitHub Pages.

Register a user, then manually set their Account Type to Admin in the Google Sheet.

ðŸ› ï¸ Database Initialization Script
(Paste into a blank Code.gs file in a new Google Sheet and hit Run once.)

JavaScript
/**
 * Run this function ONCE in a new Google Sheet to instantly 
 * build the entire Database Architecture for the MMS Logger.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = {
    "Users": ["Email", "First Name", "Last Name", "Password Hash", "Salt", "Account Type", "Status", "Verification Token"],
    "Activity_Logs": ["Log ID", "Email", "First Name", "Last Name", "Date", "Time", "Action", "Latitude", "Longitude", "Resolved Location Name", "Edited By"],
    "Daily_Summaries": ["First Name", "Last Name", "Summary ID", "Date", "Email", "Clock In Time", "Clock Out Time", "Clock-In Floor Time", "Clock-Out Floor Time", "Total Hours worked", "Status", "Worked Overtime"],
    "Weekly_Summaries": ["First Name", "Last Name", "Email", "Week Identifier", "Total Hours Worked", "Total Overtime", "Days Worked", "Compliance Status", "Last Updated"],
    "Monthly_Summaries": ["First Name", "Last Name", "Email", "Month", "Total Hours Worked", "Total Overtime", "Days Worked", "Last Updated"],
    "Leave_Requests": ["Request ID", "Email", "First Name", "Last Name", "Leave Type", "Start Date", "End Date", "Status", "Submitted Date"],
    "Device_Requests": ["Request ID", "Email", "First Name", "Last Name", "Device Details", "Start Date", "End Date", "Reason", "Status", "Submitted Date"],
    "Admin_Settings": ["Admin Email", "Role Description", "Created Date"]
  };

  for (const [sheetName, headers] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0f172a"); // Dark MMS slate header
    headerRange.setFontColor("#f8fafc");  // Light text
    headerRange.setBorder(true, true, true, true, false, false);
    
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  return "Database Setup Complete! All 8 tables have been generated with formatting.";
}
