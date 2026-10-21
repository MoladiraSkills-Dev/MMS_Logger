/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - EMPLOYEE PORTAL CONTROLLER (employee/employee.js)
 * Attendance Telemetry, Geolocation Tracking, Shift Progress & History (v2.0)
 * ============================================================================
 */

let CURRENT_SESSION = null;
let SHIFT_PROGRESS_INTERVAL = null;
let CURRENT_TODAY_SHIFT = null;
let CACHED_EMPLOYEE_LOCATION = null;

document.addEventListener("DOMContentLoaded", () => {
  CURRENT_SESSION = requireSession(null, "../index.html");
  if (!CURRENT_SESSION) return;

  // Initialize UI with Session Data
  const user = CURRENT_SESSION.user;
  document.getElementById("userDisplayName").innerText = `${user.firstName} ${user.lastName}`;
  document.getElementById("userRoleBadge").innerText = CURRENT_SESSION.accountType || "Employee";

  // Initials Avatar
  const avatarEl = document.getElementById("userAvatar");
  if (avatarEl) {
    const initials = (user.firstName.charAt(0) + (user.lastName ? user.lastName.charAt(0) : "")).toUpperCase();
    avatarEl.innerText = initials || "M";
  }

  // Start live clock
  updateLiveClock("liveClockDisplay", "liveDateDisplay");

  // Load Employee Data
  loadEmployeeData();

  // Shift timeline ticker
  updateShiftProgressTimeline();
  if (SHIFT_PROGRESS_INTERVAL) clearInterval(SHIFT_PROGRESS_INTERVAL);
  SHIFT_PROGRESS_INTERVAL = setInterval(updateShiftProgressTimeline, 60000);

  // Proactively check & verify location telemetry on load
  initLocationStatus();
});

function switchEmpTab(tabName) {
  const tabs = ['leaves', 'devices'];
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

    if (res && res.status === "success") {
      CURRENT_TODAY_SHIFT = res.todayShift || null;
      try { renderTodayShift(res.todayShift); } catch (e) { console.error("Error rendering today shift:", e); }
      try { renderMyLeaves(res.leaveRequests || []); } catch (e) { console.error("Error rendering leaves:", e); }
      try { renderMyDevices(res.deviceRequests || []); } catch (e) { console.error("Error rendering devices:", e); }
      try { updateTactileButtonStates(res.todayShift); } catch (e) { console.error("Error updating button states:", e); }
      try { updateShiftProgressTimeline(res.todayShift); } catch (e) { console.error("Error updating shift progress:", e); }
    } else {
      const serverStatus = res ? (res.status || "Unknown") : "No response";
      const errMsg = (res && res.message) ? res.message : `Could not load telemetry (Status: ${serverStatus})`;
      console.warn("Could not retrieve employee portal data:", errMsg);
      showToast(errMsg, "warning", "Sync Issue");
    }
  } catch (err) {
    console.error("Failed to load employee portal data:", err);
    showToast("Connection issue: " + err.message, "danger", "Database Error");
  }
}

function updateTactileButtonStates(shift) {
  const btnIn = document.getElementById("btnClockIn");
  const badgeIn = document.getElementById("clockInStatusBadge");
  const subIn = document.getElementById("clockInSubtext");

  const btnOut = document.getElementById("btnClockOut");
  const badgeOut = document.getElementById("clockOutStatusBadge");
  const subOut = document.getElementById("clockOutSubtext");

  if (!btnIn || !btnOut) return;

  const isCompleted = shift && shift.status === "Completed";
  const isInProgress = shift && shift.status === "In Progress" && shift.clockIn && shift.clockIn !== "--";

  if (isCompleted) {
    // Both completed
    btnIn.disabled = true;
    btnIn.title = "Shift already completed today";
    if (badgeIn) {
      badgeIn.classList.remove("hidden");
      badgeIn.innerText = `✓ Shift Completed (${shift.clockIn})`;
    }
    if (subIn) subIn.innerText = "Shift finalized for today";

    btnOut.disabled = true;
    btnOut.title = "Shift already completed today";
    if (badgeOut) {
      badgeOut.classList.remove("hidden");
      badgeOut.innerText = `✓ Shift Completed (${shift.clockOut})`;
    }
    if (subOut) subOut.innerText = "Shift finalized for today";
  } else if (isInProgress) {
    // Clock In done, Clock Out active and allowed
    btnIn.disabled = true;
    btnIn.title = "Already clocked in today";
    if (badgeIn) {
      badgeIn.classList.remove("hidden");
      badgeIn.innerText = `✓ Clocked In at ${shift.clockIn}`;
    }
    if (subIn) subIn.innerText = `Shift active since ${shift.floorIn || shift.clockIn}`;

    btnOut.disabled = false;
    btnOut.title = "Conclude your shift for today";
    if (badgeOut) badgeOut.classList.add("hidden");
    if (subOut) subOut.innerText = "Conclude daily shift & GPS";
  } else {
    // Shift not started: User HAS NOT clocked in today -> Clock Out strictly disabled
    btnIn.disabled = false;
    btnIn.title = "Clock in to start your shift";
    if (badgeIn) badgeIn.classList.add("hidden");
    if (subIn) subIn.innerText = "Record shift start & GPS";

    btnOut.disabled = true;
    btnOut.title = "You cannot clock out because you have not clocked in for today yet";
    if (badgeOut) {
      badgeOut.classList.remove("hidden");
      badgeOut.innerText = "Clock-In Required";
    }
    if (subOut) subOut.innerText = "Clock in first to enable clock out";
  }
}

function updateShiftProgressTimeline(shift) {
  const fill = document.getElementById("shiftProgressFill");
  const pct = document.getElementById("shiftProgressPct");
  const label = document.getElementById("shiftProgressLabel");

  if (!fill || !pct || !label) return;

  const now = new Date();
  const currentHour = now.getHours() + (now.getMinutes() / 60);

  // Standard shift: 08:00 to 17:00 (9 hours span)
  const shiftStart = 8.0;
  const shiftEnd = 17.0;
  const totalShiftSpan = shiftEnd - shiftStart;

  if (currentHour < shiftStart) {
    fill.style.width = "0%";
    pct.innerText = "0%";
    label.innerText = "Shift starts at 08:00 AM";
  } else if (currentHour >= shiftEnd) {
    fill.style.width = "100%";
    pct.innerText = "100%";
    label.innerText = "Standard Workday Concluded (17:00)";
  } else {
    const elapsed = currentHour - shiftStart;
    const percentage = Math.min(100, Math.max(0, Math.round((elapsed / totalShiftSpan) * 100)));
    fill.style.width = `${percentage}%`;
    pct.innerText = `${percentage}%`;
    label.innerText = `Workday In Progress (${percentage}% completed)`;
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
  dispNet.innerText = shift.totalHours ? `${shift.totalHours} hrs` : "--";

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
        <td>${escapeHtml(item.startDate)}</td>
        <td>${escapeHtml(item.endDate)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(item.status)}</span></td>
        <td class="text-xs text-dim">${escapeHtml(item.submittedDate || "--")}</td>
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
        <td>${escapeHtml(item.startDate)} &rarr; ${escapeHtml(item.endDate)}</td>
        <td class="text-sm">${escapeHtml(item.reason)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(item.status)}</span></td>
        <td class="text-xs text-dim">${escapeHtml(item.submittedDate || "--")}</td>
      </tr>
    `;
  }).join("");
}

async function handleClockAction(action) {
  hideAlert("employeeAlert");
  const user = CURRENT_SESSION.user;

  // Strict guard: Do not allow Clock Out unless clocked in today
  if (action === "Clock Out") {
    const hasClockedIn = CURRENT_TODAY_SHIFT && 
                         CURRENT_TODAY_SHIFT.status === "In Progress" && 
                         CURRENT_TODAY_SHIFT.clockIn && 
                         CURRENT_TODAY_SHIFT.clockIn !== "--";
    if (!hasClockedIn) {
      showToast("Action Blocked: You cannot clock out because you have not clocked in for today yet. Please clock in first.", "warning", "Clock-In Required");
      showAlert("employeeAlert", "Action Blocked: You cannot clock out because you have not clocked in for today yet. Please clock in first.", "warning");
      return;
    }
  }

  // Custom Seamless Confirmation Modal (replaces browser confirm)
  const isClockIn = action === "Clock In";
  const confirmed = await showConfirmModal({
    title: `Confirm ${action}`,
    message: isClockIn
      ? "Confirm shift start? Your precise GPS coordinates will be captured and verified against designated MolāDira site parameters."
      : "Confirm shift conclusion? This will finalize your shift hours and lock your daily attendance record.",
    confirmText: isClockIn ? "Clock In Now" : "Clock Out Now",
    cancelText: "Cancel",
    confirmType: isClockIn ? "success" : "danger",
    icon: isClockIn ? "📍" : "🏁"
  });

  if (!confirmed) return;

  showLoader(true, `Acquiring GPS coordinates for ${action}...`);

  try {
    // 1. Get location coordinates (use recently verified coordinates if under 90s, or acquire fresh)
    let coords = null;
    if (CACHED_EMPLOYEE_LOCATION && (Date.now() - CACHED_EMPLOYEE_LOCATION.timestamp < 90000)) {
      coords = CACHED_EMPLOYEE_LOCATION;
    } else {
      coords = await getBrowserCoordinates({ allowIpFallback: true });
      CACHED_EMPLOYEE_LOCATION = { ...coords, timestamp: Date.now() };
    }
    
    // 2. Transmit to backend with verified physical location
    showLoader(true, `Resolving physical location & recording ${action}...`);

    let resolvedLoc = "";
    try {
      resolvedLoc = await reverseGeocodeCoordinates(coords.lat, coords.lon);
    } catch (e) {}

    const res = await callApi("processActivityLog", {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      action: action,
      lat: coords.lat,
      lon: coords.lon,
      resolvedLocation: resolvedLoc
    });

    showLoader(false);

    if (res.status === "success") {
      const rawLoc = res.location || "";
      const cleanLoc = (rawLoc.includes("Unreachable") || rawLoc.includes("Limits Exceeded"))
        ? `GPS Coordinates (${coords.lat}, ${coords.lon})`
        : rawLoc;

      const banner = document.getElementById("locationStatusText");
      if (banner && cleanLoc) {
        banner.innerHTML = `<strong>GPS Locked:</strong> ${escapeHtml(cleanLoc)} (${res.time})`;
      }

      showToast(`Successfully recorded ${action} at ${res.time}!`, "success", `${action} Recorded`);
      showAlert("employeeAlert", `Successfully recorded ${action} at ${res.time}! Physical location: ${cleanLoc}`, "success");
      
      // Refresh dashboard
      loadEmployeeData();
    } else {
      showToast(res.message || `Unable to record ${action}.`, "danger", "Action Blocked");
      showAlert("employeeAlert", res.message || `Unable to record ${action}.`, "danger");
    }

  } catch (err) {
    showLoader(false);
    showToast(err.message || "Failed to process attendance action.", "danger", "GPS / Network Error");
    showAlert("employeeAlert", err.message || "Failed to process attendance action.", "danger");
  }
}

/**
 * Proactively verifies browser location permissions and acquires live telemetry coordinates.
 */
async function initLocationStatus(isManual = false) {
  const banner = document.getElementById("locationStatusText");
  const coordsEl = document.getElementById("locationCoordsText");
  const dot = document.getElementById("locationIndicatorDot");
  const pulse = document.getElementById("locationIndicatorPulse");
  const refreshBtn = document.getElementById("btnRefreshLocation");

  if (!banner) return;

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("spinning");
  }

  if (dot) dot.className = "location-indicator-dot dot-loading";
  if (pulse) pulse.className = "location-indicator-pulse pulse-loading";
  banner.innerHTML = "Acquiring location telemetry...";
  if (coordsEl) coordsEl.classList.add("hidden");

  try {
    const coords = await getBrowserCoordinates({ allowIpFallback: true });
    CACHED_EMPLOYEE_LOCATION = { ...coords, timestamp: Date.now() };

    const isIp = coords.isFallback;
    if (dot) dot.className = `location-indicator-dot ${isIp ? 'dot-warning' : 'dot-success'}`;
    if (pulse) pulse.className = `location-indicator-pulse ${isIp ? 'pulse-warning' : 'pulse-success'}`;

    const sourceName = coords.source || (isIp ? "IP Network Geolocation" : "High-Accuracy GPS");
    const acc = coords.accuracy ? ` (±${coords.accuracy}m)` : "";
    banner.innerHTML = `<strong>Location Ready:</strong> ${escapeHtml(sourceName)}${acc}`;

    if (coordsEl) {
      coordsEl.classList.remove("hidden");
      const placeHint = coords.locationHint ? ` • ${escapeHtml(coords.locationHint)}` : "";
      coordsEl.innerText = `${coords.lat}, ${coords.lon}${placeHint}`;
    }

    if (isManual) {
      showToast(`Location verified successfully via ${sourceName}!`, "success", "GPS Signal Active");
    }
    return coords;
  } catch (err) {
    if (dot) dot.className = "location-indicator-dot dot-danger";
    if (pulse) pulse.className = "location-indicator-pulse pulse-danger";

    banner.innerHTML = `<strong>Location Warning:</strong> ${escapeHtml(err.message || "Could not detect location.")}`;
    if (coordsEl) {
      coordsEl.classList.remove("hidden");
      coordsEl.innerText = "Click to allow location permission in your browser or enable device GPS.";
    }

    if (isManual) {
      showToast(err.message || "Failed to acquire location telemetry.", "danger", "Location Error");
    }
    return null;
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("spinning");
    }
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
