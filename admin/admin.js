/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - ADMIN DASHBOARD CONTROLLER (admin/admin.js)
 * Full Administrative Telemetry, Shift Auditing, Approvals & Exports
 * ============================================================================
 */

let CURRENT_ADMIN = null;

// Cached State Collections
let CACHED_LOGS = [];
let CACHED_DAILY = [];
let CACHED_WEEKLY = [];
let CACHED_MONTHLY = [];
let CACHED_LEAVES = [];
let CACHED_DEVICES = [];
let CACHED_STAFF = [];

document.addEventListener("DOMContentLoaded", () => {
  CURRENT_ADMIN = requireSession("Admin", "../index.html");
  if (!CURRENT_ADMIN) return;

  // Initialize UI with Admin info
  const user = CURRENT_ADMIN.user;
  document.getElementById("adminSubtitle").innerText = `Logged in as Admin: ${user.firstName} ${user.lastName} (${user.email})`;

  // Initialize Date Filter Inputs
  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const filterLogDate = document.getElementById("filterLogDate");
  const filterDailyDate = document.getElementById("filterDailyDate");
  const filterMonthlyMonth = document.getElementById("filterMonthlyMonth");
  const exportStartDate = document.getElementById("exportStartDate");
  const exportEndDate = document.getElementById("exportEndDate");

  if (filterLogDate) filterLogDate.value = todayStr;
  if (filterDailyDate) filterDailyDate.value = todayStr;
  if (filterMonthlyMonth) filterMonthlyMonth.value = currentMonthStr;

  // Set default export range to current month (1st to today)
  if (exportStartDate) exportStartDate.value = `${currentMonthStr}-01`;
  if (exportEndDate) exportEndDate.value = todayStr;

  // Fetch complete admin state
  loadAdminDashboard();
});

/* ==========================================================================
   DASHBOARD DATA LOADER
   ========================================================================== */

async function loadAdminDashboard(showToast = false) {
  showLoader(true, "Synchronizing MMS Administration Hub...");

  try {
    const res = await callApi("getAdminDashboardData");
    showLoader(false);

    if (res.status === "success") {
      CACHED_LOGS = res.logs || [];
      CACHED_DAILY = res.summaries || [];
      CACHED_WEEKLY = res.weeklySummaries || [];
      CACHED_MONTHLY = res.monthlySummaries || [];
      CACHED_LEAVES = res.leaveRequests || [];
      CACHED_DEVICES = res.deviceRequests || [];
      CACHED_STAFF = res.employees || [];

      // Update KPI Stat Counters
      updateKpis(res);

      // Populate Export Staff Dropdown
      populateExportStaffDropdown(CACHED_STAFF);

      // Render Tables with active filters
      applyLogFilters();
      applyDailyFilters();
      applyWeeklyFilters();
      applyMonthlyFilters();
      applyLeaveFilters();
      applyDeviceFilters();
      applyStaffFilters();

      if (showToast) {
        showAlert("adminAlert", "Admin dashboard data refreshed successfully.", "success");
        setTimeout(() => hideAlert("adminAlert"), 3500);
      }
    } else {
      showAlert("adminAlert", res.message || "Failed to load dashboard data.", "danger");
    }
  } catch (err) {
    showLoader(false);
    showAlert("adminAlert", "Database Connection Error: " + err.message, "danger");
  }
}

function updateKpis(data) {
  const staffCount = data.employees ? data.employees.length : 0;
  const loginsToday = data.dailyStats ? (data.dailyStats.loginsToday || 0) : 0;
  const logoutsToday = data.dailyStats ? (data.dailyStats.logoutsToday || 0) : 0;
  
  // Count on-leave employees
  const onLeaveCount = data.employees ? data.employees.filter(e => e.workStatus === "On Leave").length : 0;
  
  // Count pending devices
  const pendingDevices = data.deviceRequests ? data.deviceRequests.filter(d => d.status === "Pending").length : 0;

  document.getElementById("kpiTotalStaff").innerText = staffCount;
  document.getElementById("kpiClockedIn").innerText = loginsToday;
  document.getElementById("kpiClockedOut").innerText = logoutsToday;
  document.getElementById("kpiOnLeave").innerText = onLeaveCount;
  document.getElementById("kpiPendingDevices").innerText = pendingDevices;
}

function populateExportStaffDropdown(staffList) {
  const select = document.getElementById("exportStaffSelect");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="ALL">All Employees (Batch ZIP Archive)</option>`;

  staffList.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.email;
    opt.textContent = `${emp.firstName} ${emp.lastName} (${emp.email})`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

/* ==========================================================================
   NAVIGATION TAB CONTROLLER
   ========================================================================== */

function switchAdminTab(tabName) {
  const tabs = ['logs', 'daily', 'weekly', 'monthly', 'leave', 'device', 'users', 'export'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${capitalize(t)}`);
    const content = document.getElementById(`contentTab${capitalize(t)}`);
    if (t === tabName) {
      if (btn) btn.classList.add("active");
      if (content) content.classList.remove("hidden");
    } else {
      if (btn) btn.classList.remove("active");
      if (content) content.classList.add("hidden");
    }
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ==========================================================================
   TAB 1: ACTIVITY LOGS FILTERING & RENDERING
   ========================================================================== */

function applyLogFilters() {
  const dateVal = document.getElementById("filterLogDate").value;
  const actionVal = document.getElementById("filterLogAction").value;
  const query = document.getElementById("filterLogSearch").value.trim().toLowerCase();

  let filtered = CACHED_LOGS;

  if (dateVal) {
    filtered = filtered.filter(l => l.date === dateVal);
  }

  if (actionVal && actionVal !== "ALL") {
    filtered = filtered.filter(l => l.action === actionVal);
  }

  if (query) {
    filtered = filtered.filter(l => 
      (l.firstName && l.firstName.toLowerCase().includes(query)) ||
      (l.lastName && l.lastName.toLowerCase().includes(query)) ||
      (l.email && l.email.toLowerCase().includes(query)) ||
      (l.location && l.location.toLowerCase().includes(query))
    );
  }

  renderLogsTable(filtered);
}

function renderLogsTable(logs) {
  const tbody = document.getElementById("adminLogsBody");
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No activity telemetry found matching filter criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const isClockIn = l.action === "Clock In";
    const badgeClass = isClockIn ? "badge-success" : "badge-danger";
    const icon = isClockIn ? "📍" : "🏁";

    return `
      <tr>
        <td class="font-mono text-xs text-dim">${escapeHtml(l.id)}</td>
        <td>
          <div class="font-bold">${escapeHtml(l.firstName)} ${escapeHtml(l.lastName)}</div>
          <div class="text-xs text-dim">${escapeHtml(l.email)}</div>
        </td>
        <td>
          <div class="font-bold">${escapeHtml(l.date)}</div>
          <div class="font-mono text-xs text-dim">${escapeHtml(l.time)}</div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${icon} ${escapeHtml(l.action)}</span>
        </td>
        <td class="text-sm">
          <div>${escapeHtml(l.location || "Location not resolved")}</div>
          <div class="text-xs text-dim font-mono">GPS: ${l.lat}, ${l.lon}</div>
        </td>
        <td>
          ${l.editedBy 
            ? `<span class="badge badge-warning text-xs">Edited by ${escapeHtml(l.editedBy)}</span>` 
            : `<span class="badge badge-info text-xs">Sensor Telemetry</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   TAB 2: DAILY SUMMARIES FILTERING & RENDERING
   ========================================================================== */

function applyDailyFilters() {
  const dateVal = document.getElementById("filterDailyDate").value;
  const statusVal = document.getElementById("filterDailyStatus").value;
  const query = document.getElementById("filterDailySearch").value.trim().toLowerCase();

  let filtered = CACHED_DAILY;

  if (dateVal) {
    filtered = filtered.filter(d => d.date === dateVal);
  }

  if (statusVal && statusVal !== "ALL") {
    filtered = filtered.filter(d => d.status === statusVal);
  }

  if (query) {
    filtered = filtered.filter(d => 
      (d.firstName && d.firstName.toLowerCase().includes(query)) ||
      (d.lastName && d.lastName.toLowerCase().includes(query)) ||
      (d.email && d.email.toLowerCase().includes(query))
    );
  }

  renderDailyTable(filtered);
}

function renderDailyTable(summaries) {
  const tbody = document.getElementById("adminDailyBody");
  if (!tbody) return;

  if (summaries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">No daily shift summaries found matching filter criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = summaries.map(s => {
    let statusBadge = "badge-info";
    if (s.status === "Completed") statusBadge = "badge-success";
    if (s.status === "In Progress") statusBadge = "badge-warning";
    if (s.status === "No Clock In") statusBadge = "badge-danger";

    return `
      <tr>
        <td class="font-mono text-xs text-dim">${escapeHtml(s.summaryId)}</td>
        <td>
          <div class="font-bold">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</div>
          <div class="text-xs text-dim">${escapeHtml(s.email)}</div>
        </td>
        <td class="font-bold">${escapeHtml(s.date)}</td>
        <td class="font-mono text-sm">${escapeHtml(s.clockIn)} &rarr; ${escapeHtml(s.clockOut)}</td>
        <td class="font-mono text-sm" style="color: var(--mms-orange);">${escapeHtml(s.floorIn)} &rarr; ${escapeHtml(s.floorOut)}</td>
        <td class="font-bold">${escapeHtml(s.totalHours)}</td>
        <td class="text-sm font-mono">${escapeHtml(s.overtime || "0 mins")}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(s.status)}</span></td>
        <td>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-action-icon btn-action-edit" onclick="openEditShiftModal('${escapeHtml(s.summaryId)}')">
              <span>✏️</span> Edit
            </button>
            <button type="button" class="btn-action-icon btn-action-delete" onclick="handleDeleteDailyShift('${escapeHtml(s.summaryId)}', '${escapeHtml(s.date)}', '${escapeHtml(s.email)}')">
              <span>🗑️</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   TAB 3: WEEKLY SUMMARIES FILTERING & RENDERING
   ========================================================================== */

function applyWeeklyFilters() {
  const query = document.getElementById("filterWeeklySearch").value.trim().toLowerCase();

  let filtered = CACHED_WEEKLY;

  if (query) {
    filtered = filtered.filter(w => 
      (w.firstName && w.firstName.toLowerCase().includes(query)) ||
      (w.lastName && w.lastName.toLowerCase().includes(query)) ||
      (w.email && w.email.toLowerCase().includes(query)) ||
      (w.weekKey && w.weekKey.toLowerCase().includes(query))
    );
  }

  renderWeeklyTable(filtered);
}

function renderWeeklyTable(weekly) {
  const tbody = document.getElementById("adminWeeklyBody");
  if (!tbody) return;

  if (weekly.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No weekly summary calculations recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = weekly.map(w => {
    let compBadge = "badge-info";
    if (w.complianceStatus.includes("Compliant") || w.complianceStatus.includes("Target Met")) compBadge = "badge-success";
    if (w.complianceStatus.includes("MAX CAP") || w.complianceStatus.includes("ALERT")) compBadge = "badge-danger";

    return `
      <tr>
        <td class="font-bold">${escapeHtml(w.firstName)} ${escapeHtml(w.lastName)}</td>
        <td class="text-xs text-dim">${escapeHtml(w.email)}</td>
        <td class="font-mono font-bold" style="color: var(--mms-pink);">${escapeHtml(w.weekKey)}</td>
        <td class="font-bold">${escapeHtml(w.totalHours)}</td>
        <td class="font-mono text-sm">${escapeHtml(w.totalOvertime)}</td>
        <td class="text-center font-bold">${escapeHtml(w.daysWorked)}</td>
        <td><span class="badge ${compBadge}">${escapeHtml(w.complianceStatus)}</span></td>
        <td class="text-xs text-dim">${escapeHtml(w.lastUpdated || "--")}</td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   TAB 4: MONTHLY SUMMARIES FILTERING & RENDERING
   ========================================================================== */

function applyMonthlyFilters() {
  const monthVal = document.getElementById("filterMonthlyMonth").value;
  const query = document.getElementById("filterMonthlySearch").value.trim().toLowerCase();

  let filtered = CACHED_MONTHLY;

  if (monthVal) {
    filtered = filtered.filter(m => m.month === monthVal);
  }

  if (query) {
    filtered = filtered.filter(m => 
      (m.firstName && m.firstName.toLowerCase().includes(query)) ||
      (m.lastName && m.lastName.toLowerCase().includes(query)) ||
      (m.email && m.email.toLowerCase().includes(query))
    );
  }

  renderMonthlyTable(filtered);
}

function renderMonthlyTable(monthly) {
  const tbody = document.getElementById("adminMonthlyBody");
  if (!tbody) return;

  if (monthly.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No monthly summaries generated for the chosen month.</td></tr>`;
    return;
  }

  tbody.innerHTML = monthly.map(m => {
    return `
      <tr>
        <td class="font-bold">${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</td>
        <td class="text-xs text-dim">${escapeHtml(m.email)}</td>
        <td class="font-mono font-bold" style="color: var(--mms-orange);">${escapeHtml(m.month)}</td>
        <td class="font-bold text-main">${escapeHtml(m.totalHours)}</td>
        <td class="font-mono text-sm">${escapeHtml(m.totalOvertime)}</td>
        <td class="text-center font-bold">${escapeHtml(m.daysWorked)}</td>
        <td class="text-xs text-dim">${escapeHtml(m.lastUpdated || "--")}</td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   TAB 5: LEAVE MANAGEMENT FILTERING & RENDERING
   ========================================================================== */

function applyLeaveFilters() {
  const statusVal = document.getElementById("filterLeaveStatus").value;

  let filtered = CACHED_LEAVES;

  if (statusVal && statusVal !== "ALL") {
    filtered = filtered.filter(l => l.status === statusVal);
  }

  renderLeaveTable(filtered);
}

function renderLeaveTable(leaves) {
  const tbody = document.getElementById("adminLeaveBody");
  if (!tbody) return;

  if (leaves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No leave applications matching selected status.</td></tr>`;
    return;
  }

  tbody.innerHTML = leaves.map(l => {
    let statusBadge = "badge-warning";
    if (l.status === "Approved") statusBadge = "badge-success";
    if (l.status === "Rejected") statusBadge = "badge-danger";

    const isPending = l.status === "Pending";

    return `
      <tr>
        <td class="font-mono text-xs text-dim">${escapeHtml(l.reqId)}</td>
        <td>
          <div class="font-bold">${escapeHtml(l.firstName)} ${escapeHtml(l.lastName)}</div>
          <div class="text-xs text-dim">${escapeHtml(l.email)}</div>
        </td>
        <td><strong style="color: var(--mms-orange);">${escapeHtml(l.type)}</strong></td>
        <td>${escapeHtml(l.startDate)} &rarr; ${escapeHtml(l.endDate)}</td>
        <td class="text-xs text-dim">${escapeHtml(l.submittedDate || "--")}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(l.status)}</span></td>
        <td>
          ${isPending ? `
            <div class="flex items-center gap-1">
              <button type="button" class="btn-action-icon btn-action-approve" onclick="handleApproveLeave('${escapeHtml(l.reqId)}')">
                <span>✓</span> Approve
              </button>
              <button type="button" class="btn-action-icon btn-action-reject" onclick="handleRejectLeave('${escapeHtml(l.reqId)}')">
                <span>✕</span> Reject
              </button>
            </div>
          ` : `<span class="text-xs text-dim">Decision Finalized</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

async function handleApproveLeave(reqId) {
  if (!confirm(`Approve leave request #${reqId}? This will mark employee on-leave during the shift dates.`)) return;
  showLoader(true, "Authorizing Leave Application...");

  try {
    const res = await callApi("adminUpdateLeaveStatus", {
      reqId: reqId,
      newStatus: "Approved",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      alert("Success: " + res.message);
      loadAdminDashboard();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert("Connection Error: " + err.message);
  }
}

async function handleRejectLeave(reqId) {
  if (!confirm(`Reject leave request #${reqId}?`)) return;
  showLoader(true, "Rejecting Leave Application...");

  try {
    const res = await callApi("adminUpdateLeaveStatus", {
      reqId: reqId,
      newStatus: "Rejected",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      alert("Leave marked as Rejected.");
      loadAdminDashboard();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert("Connection Error: " + err.message);
  }
}

/* ==========================================================================
   TAB 6: DEVICE CHECKOUTS FILTERING & RENDERING
   ========================================================================== */

function applyDeviceFilters() {
  const statusVal = document.getElementById("filterDeviceStatus").value;

  let filtered = CACHED_DEVICES;

  if (statusVal && statusVal !== "ALL") {
    filtered = filtered.filter(d => d.status === statusVal);
  }

  renderDeviceTable(filtered);
}

function renderDeviceTable(devices) {
  const tbody = document.getElementById("adminDeviceBody");
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No device checkout requests matching selected status.</td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(d => {
    let statusBadge = "badge-warning";
    if (d.status === "Approved") statusBadge = "badge-success";
    if (d.status === "Rejected") statusBadge = "badge-danger";

    const isPending = d.status === "Pending";

    return `
      <tr>
        <td class="font-mono text-xs text-dim">${escapeHtml(d.reqId)}</td>
        <td>
          <div class="font-bold">${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}</div>
          <div class="text-xs text-dim">${escapeHtml(d.email)}</div>
        </td>
        <td><strong style="color: var(--mms-pink);">${escapeHtml(d.deviceDetails)}</strong></td>
        <td>${escapeHtml(d.startDate)} &rarr; ${escapeHtml(d.endDate)}</td>
        <td class="text-sm">${escapeHtml(d.reason)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(d.status)}</span></td>
        <td>
          ${isPending ? `
            <div class="flex items-center gap-1">
              <button type="button" class="btn-action-icon btn-action-approve" onclick="handleApproveDevice('${escapeHtml(d.reqId)}')">
                <span>✓</span> Authorize
              </button>
              <button type="button" class="btn-action-icon btn-action-reject" onclick="handleRejectDevice('${escapeHtml(d.reqId)}')">
                <span>✕</span> Decline
              </button>
            </div>
          ` : `<span class="text-xs text-dim">Review Complete</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

async function handleApproveDevice(reqId) {
  if (!confirm(`Authorize checkout for device request #${reqId}?`)) return;
  showLoader(true, "Authorizing Equipment Checkout...");

  try {
    const res = await callApi("adminUpdateDeviceStatus", {
      reqId: reqId,
      newStatus: "Approved",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      alert("Success: " + res.message);
      loadAdminDashboard();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert("Connection Error: " + err.message);
  }
}

async function handleRejectDevice(reqId) {
  if (!confirm(`Decline device checkout request #${reqId}?`)) return;
  showLoader(true, "Declining Equipment Checkout...");

  try {
    const res = await callApi("adminUpdateDeviceStatus", {
      reqId: reqId,
      newStatus: "Rejected",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      alert("Equipment checkout marked as Declined.");
      loadAdminDashboard();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert("Connection Error: " + err.message);
  }
}

/* ==========================================================================
   TAB 7: STAFF DIRECTORY FILTERING & CONTROLS
   ========================================================================== */

function applyStaffFilters() {
  const statusVal = document.getElementById("filterStaffStatus").value;
  const query = document.getElementById("filterStaffSearch").value.trim().toLowerCase();

  let filtered = CACHED_STAFF;

  if (statusVal && statusVal !== "ALL") {
    filtered = filtered.filter(u => u.accountStanding === statusVal);
  }

  if (query) {
    filtered = filtered.filter(u => 
      (u.firstName && u.firstName.toLowerCase().includes(query)) ||
      (u.lastName && u.lastName.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    );
  }

  renderStaffTable(filtered);
}

function renderStaffTable(staff) {
  const tbody = document.getElementById("adminUsersBody");
  if (!tbody) return;

  if (staff.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No employees found in directory.</td></tr>`;
    return;
  }

  tbody.innerHTML = staff.map(u => {
    const isBlocked = u.accountStanding === "Blocked";
    const standingBadge = isBlocked ? "badge-danger" : "badge-success";
    const roleBadge = u.accountType === "Admin" ? "badge-gradient" : "badge-info";
    const workBadge = u.workStatus === "On Leave" ? "badge-warning" : "badge-success";

    return `
      <tr>
        <td>
          <div class="font-bold">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</div>
        </td>
        <td class="font-mono text-sm">${escapeHtml(u.email)}</td>
        <td><span class="badge ${roleBadge}">${escapeHtml(u.accountType)}</span></td>
        <td><span class="badge ${standingBadge}">${escapeHtml(u.accountStanding)}</span></td>
        <td><span class="badge ${workBadge}">${escapeHtml(u.workStatus)}</span></td>
        <td>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-action-icon btn-action-edit" onclick="openEditStaffModal('${escapeHtml(u.email)}')">
              <span>✏️</span> Edit Profile
            </button>
            <button type="button" class="btn-action-icon btn-secondary" onclick="openResetPasswordModal('${escapeHtml(u.email)}', '${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}')">
              <span>🔑</span> Reset Pass
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   ADMIN SELF-ATTENDANCE PANEL CONTROLS
   ========================================================================== */

function toggleAdminAttendancePanel() {
  const panel = document.getElementById("adminAttendancePanel");
  if (!panel) return;
  panel.classList.toggle("hidden");
}

async function handleAdminSelfClock(action) {
  const user = CURRENT_ADMIN.user;

  if (!confirm(`Log ${action} for Admin profile (${user.firstName} ${user.lastName})?`)) return;

  showLoader(true, `Capturing Admin GPS coordinates for ${action}...`);

  try {
    const coords = await getBrowserCoordinates();

    showLoader(true, `Transmitting Admin ${action} to MolāDira database...`);

    const res = await callApi("processActivityLog", {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      action: action,
      lat: coords.lat,
      lon: coords.lon
    });

    showLoader(false);

    if (res.status === "success") {
      alert(`Success: Admin ${action} recorded at ${res.time} (${res.location})`);
      loadAdminDashboard(true);
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert(err.message || "Failed to log admin attendance.");
  }
}

/* ==========================================================================
   MODAL: EDIT SHIFT CONTROLS
   ========================================================================== */

function openEditShiftModal(summaryId) {
  const shift = CACHED_DAILY.find(s => s.summaryId === summaryId);
  if (!shift) return;

  document.getElementById("editShiftId").value = shift.summaryId;
  document.getElementById("editShiftEmail").value = shift.email;
  document.getElementById("editShiftDate").value = shift.date;

  document.getElementById("editShiftInfo").innerText = `${shift.firstName} ${shift.lastName} &bull; ${shift.date}`;
  document.getElementById("editClockIn").value = shift.clockIn !== "--" ? shift.clockIn : "08:00:00";
  document.getElementById("editClockOut").value = shift.clockOut !== "--" ? shift.clockOut : "17:00:00";

  hideAlert("editShiftAlert");
  document.getElementById("editShiftModal").classList.remove("hidden");
}

function closeEditShiftModal() {
  document.getElementById("editShiftModal").classList.add("hidden");
  hideAlert("editShiftAlert");
}

async function handleEditShiftSubmit(event) {
  event.preventDefault();

  const summaryId = document.getElementById("editShiftId").value;
  const newClockIn = document.getElementById("editClockIn").value;
  const newClockOut = document.getElementById("editClockOut").value;
  const adminEmail = CURRENT_ADMIN.user.email;

  showLoader(true, "Updating Daily Shift & recalculating Floor Times...");

  try {
    const res = await callApi("adminUpdateDailySummary", {
      summaryId: summaryId,
      clockIn: newClockIn,
      clockOut: newClockOut,
      adminEmail: adminEmail
    });

    showLoader(false);

    if (res.status === "success") {
      closeEditShiftModal();
      alert("Success: " + res.message);
      loadAdminDashboard();
    } else {
      showAlert("editShiftAlert", res.message || "Failed to update shift.", "danger");
    }
  } catch (err) {
    showLoader(false);
    showAlert("editShiftAlert", "Server Error: " + err.message, "danger");
  }
}

async function handleDeleteDailyShift(summaryId, dateStr, email) {
  if (!confirm(`Permanently delete shift #${summaryId} for ${email} on ${dateStr}? This will also delete corresponding raw activity logs to prevent re-synchronization.`)) {
    return;
  }

  showLoader(true, "Deleting Shift and underlying telemetry logs...");

  try {
    const res = await callApi("adminDeleteDailySummary", {
      summaryId: summaryId,
      dateStr: dateStr,
      email: email,
      adminEmail: CURRENT_ADMIN.user.email
    });

    showLoader(false);

    if (res.status === "success") {
      alert(res.message);
      loadAdminDashboard();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showLoader(false);
    alert("Connection Error: " + err.message);
  }
}

/* ==========================================================================
   MODAL: EDIT STAFF PROFILE & PASSWORD RESET
   ========================================================================== */

function openEditStaffModal(email) {
  const staff = CACHED_STAFF.find(u => u.email === email);
  if (!staff) return;

  document.getElementById("editStaffEmail").value = staff.email;
  document.getElementById("editStaffEmailDisplay").value = staff.email;
  document.getElementById("editStaffFirstName").value = staff.firstName;
  document.getElementById("editStaffLastName").value = staff.lastName;
  document.getElementById("editStaffStanding").value = staff.accountStanding || "Verified";

  hideAlert("editStaffAlert");
  document.getElementById("editStaffModal").classList.remove("hidden");
}

function closeEditStaffModal() {
  document.getElementById("editStaffModal").classList.add("hidden");
  hideAlert("editStaffAlert");
}

async function handleEditStaffSubmit(event) {
  event.preventDefault();

  const targetEmail = document.getElementById("editStaffEmail").value;
  const firstName = document.getElementById("editStaffFirstName").value.trim();
  const lastName = document.getElementById("editStaffLastName").value.trim();
  const status = document.getElementById("editStaffStanding").value;

  showLoader(true, "Updating Staff Directory Record...");

  try {
    const res = await callApi("adminUpdateUser", {
      targetEmail: targetEmail,
      firstName: firstName,
      lastName: lastName,
      status: status,
      newPassword: ""
    });

    showLoader(false);

    if (res.status === "success") {
      closeEditStaffModal();
      alert("Profile updated successfully!");
      loadAdminDashboard();
    } else {
      showAlert("editStaffAlert", res.message || "Failed to update profile.", "danger");
    }
  } catch (err) {
    showLoader(false);
    showAlert("editStaffAlert", "Error: " + err.message, "danger");
  }
}

function openResetPasswordModal(email, name) {
  document.getElementById("resetPasswordEmail").value = email;
  document.getElementById("resetPasswordUserLabel").innerText = `${name} (${email})`;
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";

  hideAlert("resetPasswordAlert");
  document.getElementById("resetPasswordModal").classList.remove("hidden");
}

function closeResetPasswordModal() {
  document.getElementById("resetPasswordModal").classList.add("hidden");
  hideAlert("resetPasswordAlert");
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();

  const targetEmail = document.getElementById("resetPasswordEmail").value;
  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmNewPassword").value;

  if (newPass.length < 6) {
    showAlert("resetPasswordAlert", "Password must be at least 6 characters.", "danger");
    return;
  }

  if (newPass !== confirmPass) {
    showAlert("resetPasswordAlert", "Passwords do not match.", "danger");
    return;
  }

  const staff = CACHED_STAFF.find(u => u.email === targetEmail);
  const firstName = staff ? staff.firstName : "";
  const lastName = staff ? staff.lastName : "";
  const status = staff ? staff.accountStanding : "Verified";

  showLoader(true, "Salting and Hashing new Password...");

  try {
    const res = await callApi("adminUpdateUser", {
      targetEmail: targetEmail,
      firstName: firstName,
      lastName: lastName,
      status: status,
      newPassword: newPass
    });

    showLoader(false);

    if (res.status === "success") {
      closeResetPasswordModal();
      alert(`Password successfully updated for ${targetEmail}!`);
    } else {
      showAlert("resetPasswordAlert", res.message || "Password update failed.", "danger");
    }
  } catch (err) {
    showLoader(false);
    showAlert("resetPasswordAlert", "Error: " + err.message, "danger");
  }
}

/* ==========================================================================
   TAB 8: TIMESHEET EXPORTS HUB (PDF, CSV & BATCH ZIP)
   ========================================================================== */

async function triggerTimesheetExport(format) {
  const staffEmail = document.getElementById("exportStaffSelect").value;
  const startDate = document.getElementById("exportStartDate").value;
  const endDate = document.getElementById("exportEndDate").value;

  if (!startDate || !endDate) {
    alert("Please provide both Start Date and End Date for the timesheet export.");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    alert("Start Date cannot be after End Date.");
    return;
  }

  if (staffEmail === "ALL") {
    alert("The 'All Employees' selection is meant for Batch ZIP Archives. Please click 'Batch Download ZIP Archive' or select an individual employee.");
    return;
  }

  const formatLabel = format.toUpperCase();
  showLoader(true, `Compiling MolāDira compliance timesheet in ${formatLabel} format...`);

  try {
    const res = await callApi("exportTimesheetData", {
      email: staffEmail,
      startDate: startDate,
      endDate: endDate,
      format: format
    });

    showLoader(false);

    if (res.status === "success" && res.base64) {
      downloadBase64File(res.base64, res.filename || `Timesheet.${format}`, res.mimeType);
    } else {
      alert("Timesheet Generation Failed: " + (res.message || "Unknown server response"));
    }
  } catch (err) {
    showLoader(false);
    alert("Export Server Error: " + err.message);
  }
}

async function triggerZipArchiveExport() {
  const staffEmail = document.getElementById("exportStaffSelect").value;
  const startDate = document.getElementById("exportStartDate").value;
  const endDate = document.getElementById("exportEndDate").value;

  if (!startDate || !endDate) {
    alert("Please provide both Start Date and End Date for batch export.");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    alert("Start Date cannot be after End Date.");
    return;
  }

  showLoader(true, "Generating Batch PDF Timesheets and compressing to ZIP Archive on Google Drive backend (this may take up to 20 seconds)...");

  try {
    const res = await callApi("generateTimesheetsZip", {
      email: staffEmail,
      startDate: startDate,
      endDate: endDate
    });

    showLoader(false);

    if (res.status === "success" && res.base64) {
      downloadBase64File(res.base64, res.filename || "Moladira_Timesheets.zip", res.mimeType || "application/zip");
    } else {
      alert("ZIP Generation Failed: " + (res.message || "No timesheets could be packaged"));
    }
  } catch (err) {
    showLoader(false);
    alert("ZIP Archiver Error: " + err.message);
  }
}

function downloadBase64File(base64Data, filename, mimeType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
