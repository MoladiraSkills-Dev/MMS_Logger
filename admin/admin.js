/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - ADMIN DASHBOARD CONTROLLER (admin/admin.js)
 * Full Administrative Telemetry, Shift Auditing, Approvals & Exports (v2.0)
 * Upgraded with Non-blocking Confirmation Modals, Toast Feedback & Presets
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
  document.getElementById("adminSubtitle").innerText = `Operations Lead: ${user.firstName} ${user.lastName} (${user.email})`;

  // Admin Avatar Initials
  const avatarEl = document.getElementById("adminAvatar");
  if (avatarEl) {
    const initials = (user.firstName.charAt(0) + (user.lastName ? user.lastName.charAt(0) : "")).toUpperCase();
    avatarEl.innerText = initials || "A";
  }

  // Initialize Date Filter Inputs
  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const filterLogDate = document.getElementById("filterLogDate");
  const filterDailyDate = document.getElementById("filterDailyDate");
  const filterMonthlyMonth = document.getElementById("filterMonthlyMonth");

  if (filterLogDate) filterLogDate.value = todayStr;
  if (filterDailyDate) filterDailyDate.value = todayStr;
  if (filterMonthlyMonth) filterMonthlyMonth.value = currentMonthStr;

  // Set default export range to 'thisMonth'
  setDatePreset("thisMonth");

  // Initialize Client Loggers Hub
  renderClientLoggers();

  // Support direct URL hash navigation (e.g. admin/index.html#loggers)
  const initialHash = window.location.hash.replace("#", "").toLowerCase();
  if (initialHash && ['logs', 'daily', 'weekly', 'monthly', 'leave', 'device', 'users', 'export', 'loggers'].includes(initialHash)) {
    switchAdminTab(initialHash);
  }

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash && ['logs', 'daily', 'weekly', 'monthly', 'leave', 'device', 'users', 'export', 'loggers'].includes(hash)) {
      switchAdminTab(hash);
    }
  });

  // Fetch complete admin state
  loadAdminDashboard();
});

/* ==========================================================================
   DATE RANGE PRESET CONTROLLER (Quick Timesheet Presets)
   ========================================================================== */

function setDatePreset(presetKey) {
  const startInput = document.getElementById("exportStartDate");
  const endInput = document.getElementById("exportEndDate");
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  let startStr = todayStr;
  let endStr = todayStr;

  if (presetKey === "today") {
    startStr = todayStr;
    endStr = todayStr;
  } else if (presetKey === "thisWeek") {
    // Current Monday
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    startStr = monday.toISOString().split("T")[0];
    endStr = todayStr;
  } else if (presetKey === "thisMonth") {
    // 1st of current month to today
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startStr = firstDay.toISOString().split("T")[0];
    endStr = todayStr;
  } else if (presetKey === "lastMonth") {
    // 1st of last month to last day of last month
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    startStr = firstDayLastMonth.toISOString().split("T")[0];
    endStr = lastDayLastMonth.toISOString().split("T")[0];
  }

  if (startInput) startInput.value = startStr;
  if (endInput) endInput.value = endStr;

  // Update active pill button state
  const presetButtons = document.querySelectorAll(".range-preset-btn");
  presetButtons.forEach(btn => {
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(presetKey)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/* ==========================================================================
   DASHBOARD DATA LOADER
   ========================================================================== */

async function loadAdminDashboard(showToastFeedback = false) {
  const refreshIcon = document.getElementById("refreshIcon");
  if (refreshIcon) refreshIcon.classList.add("spin-icon");

  showLoader(true, "Synchronizing MMS Administration Hub...");

  try {
    const res = await callApi("getAdminDashboardData");
    showLoader(false);
    if (refreshIcon) refreshIcon.classList.remove("spin-icon");

    if (res && res.status === "success") {
      CACHED_LOGS = res.logs || [];
      CACHED_DAILY = res.summaries || [];
      CACHED_WEEKLY = res.weeklySummaries || [];
      CACHED_MONTHLY = res.monthlySummaries || [];
      CACHED_LEAVES = res.leaveRequests || [];
      CACHED_DEVICES = res.deviceRequests || [];
      CACHED_STAFF = res.employees || [];

      // Update KPI Stat Counters & Tab Badges
      try { updateKpis(res); } catch (e) { console.error("Error updating KPIs:", e); }

      // Populate Export Staff Dropdown
      try { populateExportStaffDropdown(CACHED_STAFF); } catch (e) { console.error("Error populating staff dropdown:", e); }

      // Render Tables with active filters with isolated try/catch per section
      try { applyLogFilters(); } catch (e) { console.error("Error rendering Activity Logs:", e); }
      try { applyDailyFilters(); } catch (e) { console.error("Error rendering Daily Shifts:", e); }
      try { applyWeeklyFilters(); } catch (e) { console.error("Error rendering Weekly Summaries:", e); }
      try { applyMonthlyFilters(); } catch (e) { console.error("Error rendering Monthly Summaries:", e); }
      try { applyLeaveFilters(); } catch (e) { console.error("Error rendering Leave Requests:", e); }
      try { applyDeviceFilters(); } catch (e) { console.error("Error rendering Device Checkouts:", e); }
      try { applyStaffFilters(); } catch (e) { console.error("Error rendering Employee Directory:", e); }

      if (showToastFeedback) {
        showToast("Admin telemetry synchronized with cloud database.", "success", "Refreshed");
      }
    } else {
      const serverStatus = res ? (res.status || "Unknown") : "No response";
      const errMsg = (res && res.message)
        ? res.message
        : (serverStatus === "Operational"
            ? "Server operational handshake received instead of dataset. Please refresh or check connection."
            : `Failed to load dashboard data (Server status: ${serverStatus}).`);

      showToast(errMsg, "danger", "Sync Failed");
      showAlert("adminAlert", errMsg, "danger");
    }
  } catch (err) {
    showLoader(false);
    if (refreshIcon) refreshIcon.classList.remove("spin-icon");
    showToast("Database Connection Error: " + err.message, "danger", "Connection Error");
    showAlert("adminAlert", "Database Connection Error: " + err.message, "danger");
  }
}

function updateKpis(data) {
  const staffCount = data.employees ? data.employees.length : 0;
  const loginsToday = data.dailyStats ? (data.dailyStats.loginsToday || 0) : 0;
  const logoutsToday = data.dailyStats ? (data.dailyStats.logoutsToday || 0) : 0;
  
  // Count on-leave employees
  const onLeaveCount = data.employees ? data.employees.filter(e => e.workStatus === "On Leave").length : 0;
  
  // Count pending devices & leaves for tab notification badges
  const pendingLeaves = data.leaveRequests ? data.leaveRequests.filter(l => l.status === "Pending").length : 0;
  const pendingDevices = data.deviceRequests ? data.deviceRequests.filter(d => d.status === "Pending").length : 0;

  document.getElementById("kpiTotalStaff").innerText = staffCount;
  document.getElementById("kpiClockedIn").innerText = loginsToday;
  document.getElementById("kpiClockedOut").innerText = logoutsToday;
  document.getElementById("kpiOnLeave").innerText = onLeaveCount;
  document.getElementById("kpiPendingDevices").innerText = pendingDevices;

  // Dynamic Badges on Navigation Tabs
  const badgeLeave = document.getElementById("tabBadgeLeave");
  if (badgeLeave) {
    if (pendingLeaves > 0) {
      badgeLeave.innerText = pendingLeaves;
      badgeLeave.classList.remove("hidden");
    } else {
      badgeLeave.classList.add("hidden");
    }
  }

  const badgeDevice = document.getElementById("tabBadgeDevice");
  if (badgeDevice) {
    if (pendingDevices > 0) {
      badgeDevice.innerText = pendingDevices;
      badgeDevice.classList.remove("hidden");
    } else {
      badgeDevice.classList.add("hidden");
    }
  }
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
  const tabs = ['logs', 'daily', 'weekly', 'monthly', 'leave', 'device', 'users', 'export', 'loggers'];
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

  // Highlight top header button if on loggers
  const topHeaderBtn = document.getElementById("btnAdminClientLoggers");
  if (topHeaderBtn) {
    if (tabName === 'loggers') {
      topHeaderBtn.classList.remove("btn-secondary");
      topHeaderBtn.classList.add("btn-primary");
    } else {
      topHeaderBtn.classList.remove("btn-primary");
      topHeaderBtn.classList.add("btn-secondary");
    }
  }

  if (tabName === 'loggers') {
    renderClientLoggers();
  }

  // Smooth scroll to the active content tab if user initiated navigation
  const targetContent = document.getElementById(`contentTab${capitalize(tabName)}`);
  if (targetContent && window.scrollY > 80) {
    targetContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No activity logs found for the selected filters.</td></tr>`;
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
  const confirmed = await showConfirmModal({
    title: "Approve Leave Application",
    message: `Confirm approval for Leave Request #${reqId}? The employee's shift standing will reflect active approved leave.`,
    confirmText: "Approve Leave",
    cancelText: "Cancel",
    confirmType: "success",
    icon: "🌴"
  });

  if (!confirmed) return;
  showLoader(true, "Authorizing Leave Application...");

  try {
    const res = await callApi("adminUpdateLeaveStatus", {
      reqId: reqId,
      newStatus: "Approved",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      showToast(res.message || "Leave application approved successfully.", "success", "Leave Approved");
      loadAdminDashboard();
    } else {
      showToast(res.message || "Approval failed.", "danger", "Action Error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Connection Error: " + err.message, "danger", "Network Error");
  }
}

async function handleRejectLeave(reqId) {
  const confirmed = await showConfirmModal({
    title: "Decline Leave Application",
    message: `Are you sure you want to decline Leave Request #${reqId}?`,
    confirmText: "Decline Application",
    cancelText: "Cancel",
    confirmType: "danger",
    icon: "⚠️"
  });

  if (!confirmed) return;
  showLoader(true, "Rejecting Leave Application...");

  try {
    const res = await callApi("adminUpdateLeaveStatus", {
      reqId: reqId,
      newStatus: "Rejected",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      showToast("Leave request marked as Declined.", "info", "Leave Declined");
      loadAdminDashboard();
    } else {
      showToast(res.message || "Decline action failed.", "danger", "Action Error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Connection Error: " + err.message, "danger", "Network Error");
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
  const confirmed = await showConfirmModal({
    title: "Authorize Equipment Checkout",
    message: `Authorize checkout for Equipment Asset Request #${reqId}?`,
    confirmText: "Authorize Checkout",
    cancelText: "Cancel",
    confirmType: "success",
    icon: "💻"
  });

  if (!confirmed) return;
  showLoader(true, "Authorizing Equipment Checkout...");

  try {
    const res = await callApi("adminUpdateDeviceStatus", {
      reqId: reqId,
      newStatus: "Approved",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      showToast(res.message || "Device checkout authorized.", "success", "Equipment Authorized");
      loadAdminDashboard();
    } else {
      showToast(res.message || "Failed to authorize device checkout.", "danger", "Action Error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Connection Error: " + err.message, "danger", "Network Error");
  }
}

async function handleRejectDevice(reqId) {
  const confirmed = await showConfirmModal({
    title: "Decline Equipment Checkout",
    message: `Decline Equipment Request #${reqId}?`,
    confirmText: "Decline Checkout",
    cancelText: "Cancel",
    confirmType: "danger",
    icon: "⚠️"
  });

  if (!confirmed) return;
  showLoader(true, "Declining Equipment Checkout...");

  try {
    const res = await callApi("adminUpdateDeviceStatus", {
      reqId: reqId,
      newStatus: "Rejected",
      adminEmail: CURRENT_ADMIN.user.email
    });
    showLoader(false);

    if (res.status === "success") {
      showToast("Equipment checkout marked as Declined.", "info", "Request Declined");
      loadAdminDashboard();
    } else {
      showToast(res.message || "Failed to decline checkout.", "danger", "Action Error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Connection Error: " + err.message, "danger", "Network Error");
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
    const initials = (u.firstName.charAt(0) + (u.lastName ? u.lastName.charAt(0) : "")).toUpperCase() || "E";

    return `
      <tr>
        <td>
          <div class="user-table-cell">
            <div class="avatar-badge avatar-sm">${initials}</div>
            <div>
              <div class="user-table-name">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</div>
            </div>
          </div>
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
  const isClockIn = action === "Clock In";

  const confirmed = await showConfirmModal({
    title: `Admin ${action}`,
    message: `Record ${action} for Admin profile (${user.firstName} ${user.lastName}) with verified GPS?`,
    confirmText: `Record ${action}`,
    confirmType: isClockIn ? "success" : "danger",
    icon: isClockIn ? "📍" : "🏁"
  });

  if (!confirmed) return;

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
      showToast(`Admin ${action} logged at ${res.time} (${res.location})`, "success", `${action} Recorded`);
      loadAdminDashboard(true);
    } else {
      showToast(res.message || "Failed to record admin attendance.", "danger", "Error");
    }
  } catch (err) {
    showLoader(false);
    showToast(err.message || "Failed to log admin attendance.", "danger", "GPS Error");
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

  document.getElementById("editShiftInfo").innerHTML = `<strong>${escapeHtml(shift.firstName)} ${escapeHtml(shift.lastName)}</strong> &bull; ${escapeHtml(shift.date)}`;
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
  const saveBtn = document.getElementById("btnSaveShiftEdit");

  setButtonLoading(saveBtn, true, "Committing...");
  showLoader(true, "Updating Daily Shift & recalculating Floor Times...");

  try {
    const res = await callApi("adminUpdateDailySummary", {
      summaryId: summaryId,
      clockIn: newClockIn,
      clockOut: newClockOut,
      adminEmail: adminEmail
    });

    setButtonLoading(saveBtn, false);
    showLoader(false);

    if (res.status === "success") {
      closeEditShiftModal();
      showToast(res.message || "Daily shift updated and floor times recalculated.", "success", "Shift Committed");
      loadAdminDashboard();
    } else {
      showAlert("editShiftAlert", res.message || "Failed to update shift.", "danger");
    }
  } catch (err) {
    setButtonLoading(saveBtn, false);
    showLoader(false);
    showAlert("editShiftAlert", "Server Error: " + err.message, "danger");
  }
}

async function handleDeleteDailyShift(summaryId, dateStr, email) {
  const confirmed = await showConfirmModal({
    title: "Delete Shift Summary",
    message: `Permanently delete shift #${summaryId} for ${email} on ${dateStr}? This will also delete corresponding raw activity logs to prevent re-synchronization.`,
    confirmText: "Delete Record",
    cancelText: "Keep Record",
    confirmType: "danger",
    icon: "🗑️"
  });

  if (!confirmed) return;

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
      showToast(res.message || "Shift summary record removed.", "info", "Record Deleted");
      loadAdminDashboard();
    } else {
      showToast(res.message || "Deletion failed.", "danger", "Error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Connection Error: " + err.message, "danger", "Network Error");
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
  const saveBtn = document.getElementById("btnSaveStaffEdit");

  setButtonLoading(saveBtn, true, "Saving...");
  showLoader(true, "Updating Staff Directory Record...");

  try {
    const res = await callApi("adminUpdateUser", {
      targetEmail: targetEmail,
      firstName: firstName,
      lastName: lastName,
      status: status,
      newPassword: ""
    });

    setButtonLoading(saveBtn, false);
    showLoader(false);

    if (res.status === "success") {
      closeEditStaffModal();
      showToast("Staff profile updated successfully!", "success", "Profile Saved");
      loadAdminDashboard();
    } else {
      showAlert("editStaffAlert", res.message || "Failed to update profile.", "danger");
    }
  } catch (err) {
    setButtonLoading(saveBtn, false);
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
  const saveBtn = document.getElementById("btnSaveResetPassword");

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

  setButtonLoading(saveBtn, true, "Updating...");
  showLoader(true, "Salting and Hashing new Password...");

  try {
    const res = await callApi("adminUpdateUser", {
      targetEmail: targetEmail,
      firstName: firstName,
      lastName: lastName,
      status: status,
      newPassword: newPass
    });

    setButtonLoading(saveBtn, false);
    showLoader(false);

    if (res.status === "success") {
      closeResetPasswordModal();
      showToast(`Password successfully updated for ${targetEmail}!`, "success", "Password Reset");
    } else {
      showAlert("resetPasswordAlert", res.message || "Password update failed.", "danger");
    }
  } catch (err) {
    setButtonLoading(saveBtn, false);
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
    showToast("Please provide both Start Date and End Date for the timesheet export.", "warning", "Missing Dates");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showToast("Start Date cannot be after End Date.", "danger", "Invalid Date Range");
    return;
  }

  if (staffEmail === "ALL") {
    showToast("The 'All Employees' selection is meant for Batch ZIP Archives. Please click 'Batch Download ZIP Archive' or select an individual employee.", "warning", "Export Notice");
    return;
  }

  const formatLabel = format.toUpperCase();
  const btn = format === 'pdf' ? document.getElementById("btnExportPdf") : document.getElementById("btnExportCsv");
  setButtonLoading(btn, true, `Generating ${formatLabel}...`);
  showLoader(true, `Compiling MolāDira compliance timesheet in ${formatLabel} format...`);

  try {
    const res = await callApi("exportTimesheetData", {
      email: staffEmail,
      startDate: startDate,
      endDate: endDate,
      format: format
    });

    setButtonLoading(btn, false);
    showLoader(false);

    if (res.status === "success" && res.base64) {
      downloadBase64File(res.base64, res.filename || `Timesheet.${format}`, res.mimeType);
      showToast(`Exported ${formatLabel} successfully.`, "success", "File Downloaded");
    } else {
      showToast("Timesheet Generation Failed: " + (res.message || "Unknown server response"), "danger", "Export Error");
    }
  } catch (err) {
    setButtonLoading(btn, false);
    showLoader(false);
    showToast("Export Server Error: " + err.message, "danger", "Export Failed");
  }
}

async function triggerZipArchiveExport() {
  const staffEmail = document.getElementById("exportStaffSelect").value;
  const startDate = document.getElementById("exportStartDate").value;
  const endDate = document.getElementById("exportEndDate").value;
  const btn = document.getElementById("btnExportZip");

  if (!startDate || !endDate) {
    showToast("Please provide both Start Date and End Date for batch export.", "warning", "Missing Dates");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showToast("Start Date cannot be after End Date.", "danger", "Invalid Date Range");
    return;
  }

  setButtonLoading(btn, true, "Archiving PDFs...");
  showLoader(true, "Generating Batch PDF Timesheets and compressing to ZIP Archive on Google Drive backend (this may take up to 20 seconds)...");

  try {
    const res = await callApi("generateTimesheetsZip", {
      email: staffEmail,
      startDate: startDate,
      endDate: endDate
    });

    setButtonLoading(btn, false);
    showLoader(false);

    if (res.status === "success" && res.base64) {
      downloadBase64File(res.base64, res.filename || "Moladira_Timesheets.zip", res.mimeType || "application/zip");
      showToast("ZIP Archive generated and downloaded successfully.", "success", "Batch Export Complete");
    } else {
      showToast("ZIP Generation Failed: " + (res.message || "No timesheets could be packaged"), "danger", "Archive Error");
    }
  } catch (err) {
    setButtonLoading(btn, false);
    showLoader(false);
    showToast("ZIP Archiver Error: " + err.message, "danger", "Archive Error");
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

/* ==========================================================================
   CLIENT LOGGERS & EXTERNAL OPERATIONS HUB CONTROLLER
   ========================================================================== */

const CLIENT_LOGGERS_STORAGE_KEY = "mms_client_loggers";

const DEFAULT_CLIENT_LOGGERS = [
  {
    id: "fnb-logsheet",
    client: "First National Bank (FNB)",
    title: "FNB Logsheet System & Corporate Access",
    url: "https://script.google.com/macros/s/AKfycbxV-FEG6dHv-17k1QN_amrYJmrlaGdL7oeQgLix0pSZ57CqeN-a-LJsZa0HFP3SqOb_/exec",
    category: "Banking & Corporate",
    theme: "teal",
    icon: "🏦",
    badge: "FNB Enterprise",
    desc: "Corporate logsheet and shift attendance system for FNB contract personnel, branch audits, and timesheet compliance.",
    isDefault: true
  },
  {
    id: "fibre-field-ops",
    client: "Fibre Field Operations",
    title: "Field Agent Dispatch & Telemetry",
    url: "https://moladiraskills-dev.github.io/Fibre_Field_Ops/dashboards/agent/index.html",
    category: "Fibre & Infrastructure",
    theme: "blue",
    icon: "⚡",
    badge: "Field Ops Hub",
    desc: "Real-time field technician and agent operations dashboard for tracking site visits, fibre drop surveys, and installations.",
    isDefault: true
  },
  {
    id: "sadv-logger",
    client: "SADV (South Atlantic Distributed Ventures)",
    title: "SADV Field Operations & Admin Logger",
    url: "https://moladiraskills-dev.github.io/SADV_Logger/admin/index.html",
    category: "Fibre & Infrastructure",
    theme: "orange",
    icon: "🌐",
    badge: "SADV Admin",
    desc: "Centralized administrator and supervisor portal for SADV infrastructure rollouts, technician attendance, and contractor shifts.",
    isDefault: true
  },
  {
    id: "fibregems-crm",
    client: "FibreGems Group",
    title: "Customer Relationships & Lead Pipeline",
    url: "https://moladiraskills-dev.github.io/FibreGemsCRM/index.html",
    category: "CRM & Pipeline",
    theme: "purple",
    icon: "💎",
    badge: "Enterprise CRM",
    desc: "Enterprise client engagement portal, sales coverage tracker, lead progression pipeline, and customer relationship database.",
    isDefault: true
  },
  {
    id: "cda-logger",
    client: "CDA Solutions",
    title: "CDA Solutions - Attendance & Shift Logger",
    url: "https://moladiraskills-dev.github.io/CDA_Logger/",
    category: "Banking & Corporate",
    theme: "blue",
    icon: "💼",
    badge: "CDA Corporate",
    desc: "Corporate employee check-in, shift management, geolocation attendance tracking, and leave portal for CDA Solutions.",
    isDefault: true
  }
];

let ACTIVE_LOGGER_CATEGORY = "ALL";
let SEARCH_LOGGER_QUERY = "";

function getClientLoggers() {
  try {
    const raw = localStorage.getItem(CLIENT_LOGGERS_STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_LOGGERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CLIENT_LOGGERS;

    // Ensure all default client loggers exist in the active collection
    const existingIds = new Set(parsed.map(l => l.id));
    const merged = [...parsed];
    DEFAULT_CLIENT_LOGGERS.forEach(def => {
      if (!existingIds.has(def.id)) {
        merged.push(def);
      }
    });
    return merged;
  } catch (e) {
    console.error("Error reading client loggers from storage:", e);
    return DEFAULT_CLIENT_LOGGERS;
  }
}

function saveClientLoggers(loggers) {
  try {
    localStorage.setItem(CLIENT_LOGGERS_STORAGE_KEY, JSON.stringify(loggers));
  } catch (e) {
    console.error("Error saving client loggers to storage:", e);
  }
}

function renderClientLoggers() {
  const container = document.getElementById("clientLoggersGrid");
  const tabBadge = document.getElementById("tabBadgeLoggers");
  if (!container) return;

  const allLoggers = getClientLoggers();
  if (tabBadge) tabBadge.innerText = allLoggers.length;

  let filtered = allLoggers;

  if (ACTIVE_LOGGER_CATEGORY !== "ALL") {
    filtered = filtered.filter(l => l.category === ACTIVE_LOGGER_CATEGORY);
  }

  if (SEARCH_LOGGER_QUERY) {
    const q = SEARCH_LOGGER_QUERY.toLowerCase();
    filtered = filtered.filter(l =>
      (l.client && l.client.toLowerCase().includes(q)) ||
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.desc && l.desc.toLowerCase().includes(q)) ||
      (l.url && l.url.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border: 1px dashed var(--border-muted); border-radius: var(--radius-xl);">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.75rem;">🔍</span>
        <h3 class="text-base font-bold text-main">No Client Loggers Matched</h3>
        <p class="text-xs text-muted mt-1">Try adjusting your category filter or search query, or click "+ Add Client Logger" above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(logger => {
    const themeClass = `theme-${logger.theme || "teal"}`;
    const escapedUrl = escapeHtml(logger.url);
    const escapedClient = escapeHtml(logger.client);
    const escapedTitle = escapeHtml(logger.title);
    const escapedDesc = escapeHtml(logger.desc || "External client tracking and operations gateway.");
    const escapedCategory = escapeHtml(logger.category || "General");
    const escapedBadge = escapeHtml(logger.badge || "Client Gateway");
    const icon = logger.icon || "🏢";

    return `
      <div class="client-logger-card ${themeClass}" id="card-logger-${logger.id}">
        <div>
          <div class="client-logger-top">
            <div class="client-logger-brand">
              <div class="client-logger-icon-box">${icon}</div>
              <div class="client-logger-info">
                <span class="client-tag">${escapedCategory} &bull; ${escapedBadge}</span>
                <h3>${escapedClient}</h3>
                <div class="text-xs font-semibold text-gradient">${escapedTitle}</div>
              </div>
            </div>
            <span class="client-logger-status">
              <span class="status-dot"></span> Active Gateway
            </span>
          </div>

          <p class="client-logger-desc">${escapedDesc}</p>

          <div class="client-logger-meta">
            <span class="client-logger-url" title="${escapedUrl}">${escapedUrl}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.55rem; font-size: 0.7rem;" onclick="copyLoggerUrl('${escapedUrl}', '${escapedClient}')" title="Copy URL">
              📋 Copy
            </button>
          </div>
        </div>

        <div class="client-logger-actions">
          <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
            <span>🚀</span> Launch Portal
          </a>
          <button type="button" class="btn btn-secondary btn-sm" onclick="previewClientLogger('${logger.id}')">
            <span>👁️</span> Preview / Details
          </button>
          <button type="button" class="btn btn-secondary btn-sm" style="max-width: 44px; padding: 0.4rem 0.6rem;" onclick="openAddLoggerModal('${logger.id}')" title="Edit Logger Config">
            <span>✏️</span>
          </button>
          ${!logger.isDefault ? `
            <button type="button" class="btn btn-danger btn-sm" style="max-width: 44px; padding: 0.4rem 0.6rem;" onclick="deleteClientLogger('${logger.id}', '${escapedClient}')" title="Delete Custom Logger">
              <span>🗑️</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
}

function filterLoggersByCategory(category, pillEl) {
  ACTIVE_LOGGER_CATEGORY = category;

  const pills = document.querySelectorAll("#loggerCategoryPills .category-pill");
  pills.forEach(p => p.classList.remove("active"));
  if (pillEl) pillEl.classList.add("active");

  renderClientLoggers();
}

function handleSearchClientLoggers(val) {
  SEARCH_LOGGER_QUERY = val ? val.trim() : "";
  renderClientLoggers();
}

function copyLoggerUrl(url, clientName) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Copied ${clientName} portal link to clipboard!`, "success", "Link Copied");
    }).catch(() => {
      fallbackCopy(url, clientName);
    });
  } else {
    fallbackCopy(url, clientName);
  }
}

function fallbackCopy(text, clientName) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast(`Copied ${clientName} portal link to clipboard!`, "success", "Link Copied");
  } catch (err) {
    showToast("Failed to copy URL automatically. Please copy from text box.", "warning", "Copy Failed");
  }
  document.body.removeChild(ta);
}

function previewClientLogger(id) {
  const loggers = getClientLoggers();
  const logger = loggers.find(l => l.id === id);
  if (!logger) return;

  const modal = document.getElementById("previewLoggerModal");
  const title = document.getElementById("previewLoggerTitle");
  const subtitle = document.getElementById("previewLoggerSubtitle");
  const icon = document.getElementById("previewLoggerIcon");
  const extLink = document.getElementById("previewExternalLink");
  const iframe = document.getElementById("previewLoggerIframe");
  const loader = document.getElementById("previewLoader");

  if (title) title.innerText = `${logger.client} - ${logger.title}`;
  if (subtitle) subtitle.innerText = `Target: ${logger.url}`;
  if (icon) icon.innerText = logger.icon || "🌐";
  if (extLink) extLink.href = logger.url;

  if (loader) loader.classList.remove("hidden");
  if (iframe) iframe.src = logger.url;

  // Auto-dismiss spinner fallback if cross-origin policy suppresses iframe load event
  setTimeout(() => {
    if (loader) loader.classList.add("hidden");
  }, 1200);

  if (modal) modal.classList.remove("hidden");
}

function handleIframeLoaded() {
  const loader = document.getElementById("previewLoader");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("hidden");
    }, 400);
  }
}

function closePreviewLoggerModal() {
  const modal = document.getElementById("previewLoggerModal");
  const iframe = document.getElementById("previewLoggerIframe");
  if (iframe) iframe.src = "about:blank";
  if (modal) modal.classList.add("hidden");
}

function openAddLoggerModal(editId = null) {
  const modal = document.getElementById("editLoggerModal");
  const modalTitle = document.getElementById("editLoggerModalTitle");
  const idInput = document.getElementById("editLoggerId");
  const clientInput = document.getElementById("loggerClientName");
  const titleInput = document.getElementById("loggerTitle");
  const urlInput = document.getElementById("loggerUrl");
  const categorySelect = document.getElementById("loggerCategory");
  const themeSelect = document.getElementById("loggerTheme");
  const descInput = document.getElementById("loggerDesc");

  if (editId) {
    const loggers = getClientLoggers();
    const logger = loggers.find(l => l.id === editId);
    if (logger) {
      if (modalTitle) modalTitle.innerText = `✏️ Edit Client Logger: ${logger.client}`;
      if (idInput) idInput.value = logger.id;
      if (clientInput) clientInput.value = logger.client || "";
      if (titleInput) titleInput.value = logger.title || "";
      if (urlInput) urlInput.value = logger.url || "";
      if (categorySelect) categorySelect.value = logger.category || "Banking & Corporate";
      if (themeSelect) themeSelect.value = logger.theme || "teal";
      if (descInput) descInput.value = logger.desc || "";
    }
  } else {
    if (modalTitle) modalTitle.innerText = "🏢 Add New Client Logger";
    if (idInput) idInput.value = "";
    if (clientInput) clientInput.value = "";
    if (titleInput) titleInput.value = "";
    if (urlInput) urlInput.value = "";
    if (categorySelect) categorySelect.value = "Fibre & Infrastructure";
    if (themeSelect) themeSelect.value = "blue";
    if (descInput) descInput.value = "";
  }

  if (modal) modal.classList.remove("hidden");
}

function closeEditLoggerModal() {
  const modal = document.getElementById("editLoggerModal");
  if (modal) modal.classList.add("hidden");
}

function handleSaveClientLogger(event) {
  event.preventDefault();

  const id = document.getElementById("editLoggerId").value.trim();
  const client = document.getElementById("loggerClientName").value.trim();
  const title = document.getElementById("loggerTitle").value.trim();
  const url = document.getElementById("loggerUrl").value.trim();
  const category = document.getElementById("loggerCategory").value;
  const theme = document.getElementById("loggerTheme").value;
  const desc = document.getElementById("loggerDesc").value.trim();

  if (!client || !title || !url) {
    showToast("Please provide client name, portal title, and URL.", "warning", "Validation");
    return;
  }

  const loggers = getClientLoggers();

  // Determine icon based on category/theme
  let icon = "🏢";
  if (category.includes("Banking")) icon = "🏦";
  else if (category.includes("Fibre")) icon = "⚡";
  else if (category.includes("CRM")) icon = "💎";
  else if (category.includes("Logistics")) icon = "🚚";

  if (id) {
    // Edit existing
    const idx = loggers.findIndex(l => l.id === id);
    if (idx !== -1) {
      loggers[idx] = {
        ...loggers[idx],
        client,
        title,
        url,
        category,
        theme,
        desc,
        icon: loggers[idx].icon || icon
      };
      saveClientLoggers(loggers);
      showToast(`Updated logger configuration for ${client}.`, "success", "Saved");
    }
  } else {
    // Create new
    const newId = "logger-" + Date.now();
    const newLogger = {
      id: newId,
      client,
      title,
      url,
      category,
      theme,
      icon,
      badge: "Partner Portal",
      desc,
      isDefault: false
    };
    loggers.push(newLogger);
    saveClientLoggers(loggers);
    showToast(`Added new client logger for ${client}.`, "success", "Logger Added");
  }

  closeEditLoggerModal();
  renderClientLoggers();
}

async function deleteClientLogger(id, name) {
  const confirmed = await showConfirmModal(
    `Are you sure you want to remove the logger configuration for "${name}"?`,
    "Delete Client Logger",
    "danger"
  );

  if (!confirmed) return;

  let loggers = getClientLoggers();
  loggers = loggers.filter(l => l.id !== id);
  saveClientLoggers(loggers);

  showToast(`Client logger for ${name} has been removed.`, "success", "Deleted");
  renderClientLoggers();
}

async function resetClientLoggersToDefault() {
  const confirmed = await showConfirmModal(
    "Restore the 4 default official client portals (FNB Logsheet, Fibre Field Ops, SADV Logger, FibreGems CRM)? Custom loggers will be cleared.",
    "Restore Defaults",
    "warning"
  );

  if (!confirmed) return;

  saveClientLoggers(DEFAULT_CLIENT_LOGGERS);
  ACTIVE_LOGGER_CATEGORY = "ALL";
  SEARCH_LOGGER_QUERY = "";

  const searchInput = document.getElementById("searchClientLoggers");
  if (searchInput) searchInput.value = "";

  const pills = document.querySelectorAll("#loggerCategoryPills .category-pill");
  pills.forEach((p, i) => {
    if (i === 0) p.classList.add("active");
    else p.classList.remove("active");
  });

  showToast("Restored official client portals to factory default.", "success", "Defaults Restored");
  renderClientLoggers();
}
