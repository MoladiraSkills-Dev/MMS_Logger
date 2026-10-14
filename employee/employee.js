/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - EMPLOYEE PORTAL CONTROLLER (employee/employee.js)
 * Attendance Telemetry, Geolocation Tracking, and Resource History
 * ============================================================================
 */

let CURRENT_SESSION = null;

document.addEventListener("DOMContentLoaded", () => {
  CURRENT_SESSION = requireSession(null, "../index.html");
  if (!CURRENT_SESSION) return;

  // Initialize UI with Session Data
  const user = CURRENT_SESSION.user;
  document.getElementById("userDisplayName").innerText = `${user.firstName} ${user.lastName}`;
  document.getElementById("userRoleBadge").innerText = CURRENT_SESSION.accountType || "Employee";

  // Start live clock
  updateLiveClock("liveClockDisplay", "liveDateDisplay");

  // Load Employee Data
  loadEmployeeData();
});

function switchEmpTab(tabName) {
  const tabs = ['logs', 'leaves', 'devices'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${capitalize(t)}`);
    const content = document.getElementById(`tabContent${capitalize(t)}`);
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

async function loadEmployeeData() {
  if (!CURRENT_SESSION || !CURRENT_SESSION.user) return;
  const email = CURRENT_SESSION.user.email;

  try {
    const res = await callApi("getEmployeePortalData", { email });

    if (res.status === "success") {
      renderTodayShift(res.todayShift);
      renderRecentLogs(res.recentLogs || []);
      renderMyLeaves(res.leaveRequests || []);
      renderMyDevices(res.deviceRequests || []);
    } else {
      console.warn("Could not retrieve employee portal data:", res.message);
    }
  } catch (err) {
    console.error("Failed to load employee portal data:", err);
  }
}

function renderTodayShift(shift) {
  const dispIn = document.getElementById("dispActualIn");
  const dispFloorIn = document.getElementById("dispFloorIn");
  const dispOut = document.getElementById("dispActualOut");
  const dispNet = document.getElementById("dispNetHours");
  const badge = document.getElementById("shiftStatusBadge");

  if (!shift || !shift.clockIn || shift.clockIn === "--") {
    dispIn.innerText = "--:--";
    dispFloorIn.innerText = "--:--";
    dispOut.innerText = "--:--";
    dispNet.innerText = "--";
    badge.className = "badge badge-info";
    badge.innerText = "Shift Not Started";
    return;
  }

  dispIn.innerText = shift.clockIn || "--:--";
  dispFloorIn.innerText = shift.floorIn || "--:--";
  dispOut.innerText = shift.clockOut || "--:--";
  dispNet.innerText = shift.totalHours || "--";

  if (shift.status === "Completed") {
    badge.className = "badge badge-success";
    badge.innerText = "Shift Completed";
  } else if (shift.status === "In Progress") {
    badge.className = "badge badge-warning";
    badge.innerText = "Shift In Progress";
  } else {
    badge.className = "badge badge-info";
    badge.innerText = shift.status || "Logged";
  }
}

function renderRecentLogs(logs) {
  const tbody = document.getElementById("empLogsBody");
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="table-empty">No activity logs recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const isClockIn = log.action === "Clock In";
    const badgeClass = isClockIn ? "badge-success" : "badge-danger";
    const icon = isClockIn ? "📍" : "🏁";

    return `
      <tr>
        <td>
          <div class="font-bold">${log.date}</div>
          <div class="text-xs text-dim font-mono">${log.time}</div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${icon} ${log.action}</span>
        </td>
        <td>
          <div class="text-sm">${escapeHtml(log.location || "Location not resolved")}</div>
          ${log.editedBy ? `<span class="badge badge-warning text-xs mt-1">Edited by ${escapeHtml(log.editedBy)}</span>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function renderMyLeaves(leaves) {
  const tbody = document.getElementById("empLeavesBody");
  if (!tbody) return;

  if (leaves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">You have no leave applications logged.</td></tr>`;
    return;
  }

  tbody.innerHTML = leaves.map(item => {
    let statusBadge = "badge-warning";
    if (item.status === "Approved") statusBadge = "badge-success";
    if (item.status === "Rejected") statusBadge = "badge-danger";

    return `
      <tr>
        <td><strong>${escapeHtml(item.type)}</strong></td>
        <td>${item.startDate}</td>
        <td>${item.endDate}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(item.status)}</span></td>
        <td class="text-xs text-dim">${item.submittedDate || "--"}</td>
      </tr>
    `;
  }).join("");
}

function renderMyDevices(devices) {
  const tbody = document.getElementById("empDevicesBody");
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">You have no equipment checkout requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(item => {
    let statusBadge = "badge-warning";
    if (item.status === "Approved") statusBadge = "badge-success";
    if (item.status === "Rejected") statusBadge = "badge-danger";

    return `
      <tr>
        <td><strong>${escapeHtml(item.deviceDetails)}</strong></td>
        <td>${item.startDate} &rarr; ${item.endDate}</td>
        <td class="text-sm">${escapeHtml(item.reason)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(item.status)}</span></td>
        <td class="text-xs text-dim">${item.submittedDate || "--"}</td>
      </tr>
    `;
  }).join("");
}

async function handleClockAction(action) {
  hideAlert("employeeAlert");
  const user = CURRENT_SESSION.user;

  // Visual confirmation
  const confirmMsg = action === "Clock In" 
    ? "Confirm Clock In for today? Ensure you are at your designated MolāDira site."
    : "Confirm Clock Out? This will finalize your shift hours for today.";
  if (!confirm(confirmMsg)) return;

  showLoader(true, `Acquiring GPS coordinates for ${action}...`);

  try {
    // 1. Get high accuracy GPS coordinates
    const coords = await getBrowserCoordinates();
    
    // 2. Transmit to backend with LocationIQ reverse geocoding
    showLoader(true, `Transmitting ${action} telemetry & resolving address...`);

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
      const banner = document.getElementById("locationStatusText");
      if (banner && res.location) {
        banner.innerHTML = `<strong>Resolved:</strong> ${escapeHtml(res.location)} (${res.time})`;
      }

      showAlert("employeeAlert", `Successfully recorded ${action} at ${res.time}! Physical location: ${res.location}`, "success");
      
      // Refresh dashboard
      loadEmployeeData();
    } else {
      showAlert("employeeAlert", res.message || `Unable to record ${action}.`, "danger");
    }

  } catch (err) {
    showLoader(false);
    showAlert("employeeAlert", err.message || "Failed to process attendance action.", "danger");
  }
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
