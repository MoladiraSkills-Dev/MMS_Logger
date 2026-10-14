/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - SHARED LEAVE & DEVICE CHECKOUT (shared/js/leave_device.js)
 * Shared modal and submission logic for Employee and Admin portals
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

  if (startInput) startInput.value = todayStr;
  if (endInput) endInput.value = todayStr;

  hideAlert("leaveAlert");
  modal.classList.remove("hidden");
}

function closeLeaveModal() {
  const modal = document.getElementById("leaveModal");
  if (modal) modal.classList.add("hidden");
  const form = document.getElementById("leaveForm");
  if (form) form.reset();
  hideAlert("leaveAlert");
}

async function handleLeaveSubmit(e, onSuccessCallback) {
  if (e && e.preventDefault) e.preventDefault();

  const session = getSession();
  if (!session || !session.user) {
    alert("Session expired. Please sign in again.");
    window.location.href = "../index.html";
    return;
  }

  const leaveType = document.getElementById("leaveType") ? document.getElementById("leaveType").value : "Sick";
  const startDate = document.getElementById("leaveStartDate") ? document.getElementById("leaveStartDate").value : "";
  const endDate = document.getElementById("leaveEndDate") ? document.getElementById("leaveEndDate").value : "";

  if (!startDate || !endDate) {
    showAlert("leaveAlert", "Please specify both Start Date and End Date.", "danger");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showAlert("leaveAlert", "Start Date cannot be after End Date.", "danger");
    return;
  }

  showLoader(true, "Submitting MMS Leave Application...");

  try {
    const res = await callApi("submitLeaveRequest", {
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate
    });

    showLoader(false);

    if (res.status === "success") {
      closeLeaveModal();
      alert(`Success: ${res.message || "Leave request submitted successfully."}`);
      if (typeof onSuccessCallback === "function") {
        onSuccessCallback();
      }
    } else {
      showAlert("leaveAlert", res.message || "Failed to submit leave request.", "danger");
    }
  } catch (err) {
    showLoader(false);
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

  if (startInput) startInput.value = todayStr;
  if (endInput) endInput.value = todayStr;

  hideAlert("deviceAlert");
  modal.classList.remove("hidden");
}

function closeDeviceModal() {
  const modal = document.getElementById("deviceModal");
  if (modal) modal.classList.add("hidden");
  const form = document.getElementById("deviceForm");
  if (form) form.reset();
  hideAlert("deviceAlert");
}

async function handleDeviceSubmit(e, onSuccessCallback) {
  if (e && e.preventDefault) e.preventDefault();

  const session = getSession();
  if (!session || !session.user) {
    alert("Session expired. Please sign in again.");
    window.location.href = "../index.html";
    return;
  }

  const deviceCategory = document.getElementById("deviceCategory") ? document.getElementById("deviceCategory").value : "Laptop";
  const deviceTag = document.getElementById("deviceIdentifier") ? document.getElementById("deviceIdentifier").value.trim() : "";
  const startDate = document.getElementById("deviceStartDate") ? document.getElementById("deviceStartDate").value : "";
  const endDate = document.getElementById("deviceEndDate") ? document.getElementById("deviceEndDate").value : "";
  const reason = document.getElementById("deviceReason") ? document.getElementById("deviceReason").value.trim() : "";

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

  showLoader(true, "Registering MMS Device Checkout Request...");

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

    showLoader(false);

    if (res.status === "success") {
      closeDeviceModal();
      alert(`Success: ${res.message || "Device checkout request logged for approval."}`);
      if (typeof onSuccessCallback === "function") {
        onSuccessCallback();
      }
    } else {
      showAlert("deviceAlert", res.message || "Failed to submit device request.", "danger");
    }
  } catch (err) {
    showLoader(false);
    showAlert("deviceAlert", "Connection Error: " + err.message, "danger");
  }
}
