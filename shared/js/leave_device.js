/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - SHARED LEAVE & DEVICE CHECKOUT (shared/js/leave_device.js)
 * Shared modal and submission logic for Employee and Admin portals (v2.0)
 * Includes Smart Duration Calculators, Date Clamping, and Toast Feedback
 * ============================================================================
 */

/* ==========================================================================
   LEAVE REQUEST MODAL & CONTROLS
   ========================================================================== */

function openLeaveModal() {
  const modal = document.getElementById("leaveModal");
  if (!modal) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const startInput = document.getElementById("leaveStartDate");
  const endInput = document.getElementById("leaveEndDate");

  if (startInput) {
    startInput.value = todayStr;
    startInput.onchange = onLeaveDateChange;
  }
  if (endInput) {
    endInput.value = todayStr;
    endInput.min = todayStr;
    endInput.onchange = onLeaveDateChange;
  }

  hideAlert("leaveAlert");
  updateLeaveDurationSummary();
  modal.classList.remove("hidden");
}

function closeLeaveModal() {
  const modal = document.getElementById("leaveModal");
  if (modal) modal.classList.add("hidden");
  const form = document.getElementById("leaveForm");
  if (form) form.reset();
  hideAlert("leaveAlert");
}

function onLeaveDateChange() {
  const startInput = document.getElementById("leaveStartDate");
  const endInput = document.getElementById("leaveEndDate");
  if (startInput && endInput) {
    endInput.min = startInput.value;
    if (endInput.value < startInput.value) {
      endInput.value = startInput.value;
    }
  }
  updateLeaveDurationSummary();
}

function updateLeaveDurationSummary() {
  const startInput = document.getElementById("leaveStartDate");
  const endInput = document.getElementById("leaveEndDate");
  let summaryEl = document.getElementById("leaveDurationSummary");

  if (!summaryEl && startInput && startInput.parentElement) {
    summaryEl = document.createElement("div");
    summaryEl.id = "leaveDurationSummary";
    summaryEl.className = "text-xs font-bold text-gradient mt-2";
    const parentGrid = startInput.closest(".grid");
    if (parentGrid && parentGrid.parentElement) {
      parentGrid.parentElement.insertBefore(summaryEl, parentGrid.nextSibling);
    }
  }

  if (!summaryEl || !startInput || !endInput || !startInput.value || !endInput.value) return;

  const d1 = new Date(startInput.value);
  const d2 = new Date(endInput.value);

  if (d1 > d2) {
    summaryEl.innerHTML = `<span style="color: var(--color-danger);">⚠️ Start Date cannot be after End Date</span>`;
    return;
  }

  let workingDays = 0;
  let cur = new Date(d1);
  while (cur <= d2) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // Monday to Friday
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  summaryEl.innerHTML = `⏱️ Estimated Working Days: <strong>${workingDays} day${workingDays === 1 ? '' : 's'}</strong> (Mon–Fri)`;
}

async function handleLeaveSubmit(e, onSuccessCallback) {
  if (e && e.preventDefault) e.preventDefault();

  const session = getSession();
  if (!session || !session.user) {
    showToast("Your session has expired. Please sign in again.", "danger", "Session Expired");
    window.location.href = "../index.html";
    return;
  }

  const leaveType = document.getElementById("leaveType") ? document.getElementById("leaveType").value : "Sick";
  const startDate = document.getElementById("leaveStartDate") ? document.getElementById("leaveStartDate").value : "";
  const endDate = document.getElementById("leaveEndDate") ? document.getElementById("leaveEndDate").value : "";
  const submitBtn = document.getElementById("btnSubmitLeave");

  if (!startDate || !endDate) {
    showAlert("leaveAlert", "Please specify both Start Date and End Date.", "danger");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showAlert("leaveAlert", "Start Date cannot be after End Date.", "danger");
    return;
  }

  setButtonLoading(submitBtn, true, "Submitting...");

  try {
    const res = await callApi("submitLeaveRequest", {
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate
    });

    setButtonLoading(submitBtn, false);

    if (res.status === "success") {
      closeLeaveModal();
      showToast(res.message || "Your leave application has been submitted for approval.", "success", "Leave Application Submitted");
      if (typeof onSuccessCallback === "function") {
        onSuccessCallback();
      }
    } else {
      showAlert("leaveAlert", res.message || "Failed to submit leave request.", "danger");
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showAlert("leaveAlert", "Connection Error: " + err.message, "danger");
  }
}

/* ==========================================================================
   DEVICE CHECKOUT MODAL & CONTROLS
   ========================================================================== */

function openDeviceModal() {
  const modal = document.getElementById("deviceModal");
  if (!modal) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const startInput = document.getElementById("deviceStartDate");
  const endInput = document.getElementById("deviceEndDate");

  if (startInput) {
    startInput.value = todayStr;
    startInput.onchange = onDeviceDateChange;
  }
  if (endInput) {
    endInput.value = todayStr;
    endInput.min = todayStr;
    endInput.onchange = onDeviceDateChange;
  }

  hideAlert("deviceAlert");
  updateDeviceDurationSummary();
  modal.classList.remove("hidden");
}

function closeDeviceModal() {
  const modal = document.getElementById("deviceModal");
  if (modal) modal.classList.add("hidden");
  const form = document.getElementById("deviceForm");
  if (form) form.reset();
  hideAlert("deviceAlert");
}

function onDeviceDateChange() {
  const startInput = document.getElementById("deviceStartDate");
  const endInput = document.getElementById("deviceEndDate");
  if (startInput && endInput) {
    endInput.min = startInput.value;
    if (endInput.value < startInput.value) {
      endInput.value = startInput.value;
    }
  }
  updateDeviceDurationSummary();
}

function updateDeviceDurationSummary() {
  const startInput = document.getElementById("deviceStartDate");
  const endInput = document.getElementById("deviceEndDate");
  let summaryEl = document.getElementById("deviceDurationSummary");

  if (!summaryEl && startInput && startInput.parentElement) {
    summaryEl = document.createElement("div");
    summaryEl.id = "deviceDurationSummary";
    summaryEl.className = "text-xs font-bold text-gradient mt-2";
    const parentGrid = startInput.closest(".grid");
    if (parentGrid && parentGrid.parentElement) {
      parentGrid.parentElement.insertBefore(summaryEl, parentGrid.nextSibling);
    }
  }

  if (!summaryEl || !startInput || !endInput || !startInput.value || !endInput.value) return;

  const d1 = new Date(startInput.value);
  const d2 = new Date(endInput.value);

  if (d1 > d2) {
    summaryEl.innerHTML = `<span style="color: var(--color-danger);">⚠️ Checkout Date cannot be after Return Date</span>`;
    return;
  }

  const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  summaryEl.innerHTML = `📦 Assignment Duration: <strong>${diffDays} calendar day${diffDays === 1 ? '' : 's'}</strong>`;
}

async function handleDeviceSubmit(e, onSuccessCallback) {
  if (e && e.preventDefault) e.preventDefault();

  const session = getSession();
  if (!session || !session.user) {
    showToast("Your session has expired. Please sign in again.", "danger", "Session Expired");
    window.location.href = "../index.html";
    return;
  }

  const deviceCategory = document.getElementById("deviceCategory") ? document.getElementById("deviceCategory").value : "Laptop";
  const deviceTag = document.getElementById("deviceIdentifier") ? document.getElementById("deviceIdentifier").value.trim() : "";
  const startDate = document.getElementById("deviceStartDate") ? document.getElementById("deviceStartDate").value : "";
  const endDate = document.getElementById("deviceEndDate") ? document.getElementById("deviceEndDate").value : "";
  const reason = document.getElementById("deviceReason") ? document.getElementById("deviceReason").value.trim() : "";
  const submitBtn = document.getElementById("btnSubmitDevice");

  if (!deviceTag) {
    showAlert("deviceAlert", "Please specify the device asset tag or serial/model number.", "danger");
    return;
  }

  if (!startDate || !endDate) {
    showAlert("deviceAlert", "Please specify checkout Start and Return dates.", "danger");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showAlert("deviceAlert", "Start Date cannot be after Expected Return Date.", "danger");
    return;
  }

  if (!reason) {
    showAlert("deviceAlert", "Please enter the operational business reason for checkout.", "danger");
    return;
  }

  const fullDeviceDetails = `${deviceCategory} - ${deviceTag}`;

  setButtonLoading(submitBtn, true, "Submitting...");

  try {
    const res = await callApi("submitDeviceRequest", {
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      deviceDetails: fullDeviceDetails,
      startDate: startDate,
      endDate: endDate,
      reason: reason
    });

    setButtonLoading(submitBtn, false);

    if (res.status === "success") {
      closeDeviceModal();
      showToast(res.message || "Device checkout request logged for admin approval.", "success", "Equipment Request Submitted");
      if (typeof onSuccessCallback === "function") {
        onSuccessCallback();
      }
    } else {
      showAlert("deviceAlert", res.message || "Failed to submit device request.", "danger");
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showAlert("deviceAlert", "Connection Error: " + err.message, "danger");
  }
}
