# MolāDira Skills (MMS) Logger & Resource Portal

**MolāDira Skills (MMS)** Geolocation Attendance, Shift Telemetry, Leave Management, and Device Checkout System.

> 📖 **Comprehensive System Documentation:** For complete architectural specifications, 19-method API gateway directory, shift rounding formulas, database schemas, and BCEA compliance logic, consult [**`DOCUMENTATION.md`**](./DOCUMENTATION.md).

---

## 🏗️ Architecture & Security Model

This system implements a decoupled architecture for maximum security:

- **Frontend:** Static, lightweight multi-page web application (HTML5, Vanilla CSS, Vanilla JS) hosted on **GitHub Pages**.
- **Backend API:** Google Apps Script (`Code.gs`) deployed as a Web App executing as the script owner (Access: "Anyone").
- **Database:** Google Sheets storing all records with hashed passwords and salted security.
- **Privacy & Security:** LocationIQ API keys, Google Sheet database keys, and user password hashes remain securely stored in `Code.gs`. The frontend communicates exclusively via POST API requests with `URLSearchParams` payload to eliminate CORS preflight overhead.

---

## 📁 Repository Directory Structure

```plaintext
MMS_Logger/
├── DOCUMENTATION.md             # Master Architecture, Telemetry & Operations Manual
├── index.html                   # Authentication Portal (Sign In & Registration)
├── auth/
│   └── auth.js                  # Authentication logic & role-based routing
├── shared/
│   ├── css/
│   │   └── base.css             # MMS Design System (Deep Slate & Neon Gradients)
│   └── js/
│       ├── api.js               # Decoupled API Client & Session Helpers
│       └── leave_device.js      # Shared Leave Application & Device Checkout Modals
├── employee/
│   ├── index.html               # Employee Portal (with Live Shift Timeline & Guide)
│   ├── employee.css             # Employee Portal Styling
│   └── employee.js              # Clock In/Out GPS Telemetry & Shift Tracking
├── admin/
│   ├── index.html               # Admin Operations Hub (with System Docs & Gateways)
│   ├── admin.css                # Admin Dashboard Styling
│   └── admin.js                 # Shift Auditing, Leave/Device Approvals, Exports
├── Code.gs                      # Complete Google Apps Script Backend (with ⚡ Menu)
└── .github/
    └── workflows/
        └── static.yml           # Automated GitHub Pages Deployment
```

---

## 🚀 Deployment Instructions

### 1. Initialize Google Sheet Backend
1. Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet (e.g., `MMS_Logger_Database`).
2. Navigate to **Extensions** &rarr; **Apps Script**.
3. Clear the default `myFunction()` code in `Code.gs` and paste the entire contents of [`Code.gs`](./Code.gs).
4. Run `setupDatabase()` once from the toolbar to automatically generate all 8 structured database tables with MMS dark theme formatting.
5. In the top right, click **Deploy** &rarr; **New deployment**.
   - **Type:** Web app
   - **Description:** MMS Production API
   - **Execute as:** Me (`your-email@moladiraskills.co.za`)
   - **Who has access:** Anyone
6. Authorize the permissions when prompted and copy the generated **Web App URL** ending in `/exec`.

### 2. Configure Frontend Client
1. Open [`shared/js/api.js`](./shared/js/api.js).
2. Set the `APPS_SCRIPT_WEB_APP_URL` constant:
   ```javascript
   const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/YOUR_DEPLOYED_ID/exec";
   ```

### 3. Deploy Frontend on GitHub Pages
1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** &rarr; **Pages**.
3. Under **Build and deployment** &rarr; **Source**, select **GitHub Actions** (the included `.github/workflows/static.yml` will automatically build and publish).
4. Access the published portal URL.

### 4. Admin Account Setup
1. On the landing page (`index.html`), register an account with your corporate email.
2. In your Google Sheet, open the **Users** tab and change that user's **Account Type** from `Employee` to `Admin`.
3. Sign in to access the full **Admin Operations Hub**.

---

## 🌟 Key Features

- **Smart Floor Times & Rounding:**
  - Standard shift anchors: 08:00 – 17:00 (Mon–Fri), 08:00 – 13:00 (Sat).
  - Clock-in before 08:00 AM locks to exactly 08:00.
  - Clock-in after 08:00 AM rounds to the nearest 5-minute interval.
  - Automatic 1-hour lunch deduction for weekday shifts exceeding 5 hours.
  - Overtime locked to 0 on standard shifts; exact overtime/early departure unlocked only on manual Admin edit (`isAdminEdit = true`).
- **Auto-Failsafes:**
  - Auto-closes unfinished shifts from previous days at standard shift end time.
  - Auto-logs in at 08:00 AM if an employee clocks out without a morning clock-in.
- **Resource Management:**
  - Leave Requests with approval workflows (`SL`, `AL`, `FL`).
  - Device Checkouts with equipment category, asset tag, dates, and approval workflows.
- **Compliance Timesheet Exports:**
  - Official PDF timesheets with signature lines and BCEA compliance totals.
  - Raw CSV export.
  - One-click Batch ZIP archive packaging all employee PDF timesheets simultaneously.
