/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - SHARED API CLIENT & UTILITIES (shared/js/api.js)
 * Decoupled Google Apps Script Web App Client (v2.0 Seamless Overhaul)
 * ============================================================================
 */

// Central Google Apps Script Web App exec URL
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzZoMqcaFaap1EnJYxh2uhSb-qCuRe39E0CDijI6Yv1TYOxm0JajRZv-6UDidTP_B1R/exec";

const SESSION_STORAGE_KEY = "mms_logger_session";

/**
 * Core Asynchronous Fetch Client
 * Uses POST + application/x-www-form-urlencoded with URLSearchParams('payload')
 * to seamlessly avoid CORS preflight failures on Google Apps Script Web Apps.
 */
async function callApi(method, args = {}) {
  if (!APPS_SCRIPT_WEB_APP_URL || APPS_SCRIPT_WEB_APP_URL.includes("CHANGE_ME")) {
    console.warn("MMS Logger: APPS_SCRIPT_WEB_APP_URL is not configured yet in shared/js/api.js");
  }

  const payload = JSON.stringify({ method, args });
  const params = new URLSearchParams();
  params.append("payload", payload);

  try {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`MMS API Call [${method}] Error:`, error);
    throw error;
  }
}

/**
 * google.script.run emulation shim
 * Allows chaining .withSuccessHandler(fn).withFailureHandler(fn).methodName(...args)
 */
const google = {
  script: {
    run: (function () {
      let successFn = () => { };
      let failureFn = (err) => console.error("Unhandled API error:", err);

      const proxyTarget = {
        withSuccessHandler: function (fn) {
          successFn = fn;
          return proxy;
        },
        withFailureHandler: function (fn) {
          failureFn = fn;
          return proxy;
        }
      };

      const proxy = new Proxy(proxyTarget, {
        get(target, prop) {
          if (prop in target) return target[prop];

          return function (...args) {
            let apiArgs = {};

            // Map method argument signatures
            switch (prop) {
              case "registerUser":
                apiArgs = { email: args[0], firstName: args[1], lastName: args[2], password: args[3] };
                break;
              case "loginUser":
                apiArgs = { email: args[0], password: args[1] };
                break;
              case "processActivityLog":
                apiArgs = { email: args[0], firstName: args[1], lastName: args[2], action: args[3], lat: args[4], lon: args[5] };
                break;
              case "getEmployeePortalData":
                apiArgs = { email: args[0] };
                break;
              case "getAdminDashboardData":
                apiArgs = {};
                break;
              case "adminUpdateDailySummary":
                apiArgs = { summaryId: args[0], clockIn: args[1], clockOut: args[2], adminEmail: args[3] };
                break;
              case "adminDeleteDailySummary":
                apiArgs = { summaryId: args[0], dateStr: args[1], email: args[2], adminEmail: args[3] };
                break;
              case "adminUpdateUser":
                apiArgs = { targetEmail: args[0], firstName: args[1], lastName: args[2], status: args[3], newPassword: args[4] };
                break;
              case "submitLeaveRequest":
                apiArgs = { email: args[0], firstName: args[1], lastName: args[2], leaveType: args[3], startDate: args[4], endDate: args[5] };
                break;
              case "adminUpdateLeaveStatus":
                apiArgs = { reqId: args[0], newStatus: args[1], adminEmail: args[2] };
                break;
              case "submitDeviceRequest":
                apiArgs = { email: args[0], firstName: args[1], lastName: args[2], deviceDetails: args[3], startDate: args[4], endDate: args[5], reason: args[6] };
                break;
              case "adminUpdateDeviceStatus":
                apiArgs = { reqId: args[0], newStatus: args[1], adminEmail: args[2] };
                break;
              case "exportTimesheetData":
                apiArgs = { email: args[0], startDate: args[1], endDate: args[2], format: args[3] };
                break;
              case "generateTimesheetsZip":
                apiArgs = { email: args[0], startDate: args[1], endDate: args[2] };
                break;
              default:
                apiArgs = typeof args[0] === "object" ? args[0] : { args };
                break;
            }

            const currentSuccess = successFn;
            const currentFailure = failureFn;
            // Reset handlers for next invocation
            successFn = () => { };
            failureFn = (err) => console.error(err);

            callApi(prop, apiArgs)
              .then((result) => currentSuccess(result))
              .catch((err) => currentFailure(err));
          };
        }
      });

      return proxy;
    })()
  }
};

/* ==========================================================================
   SESSION & AUTH STORAGE HELPERS
   ========================================================================== */

function saveSession(user, accountType) {
  const sessionData = {
    user: user,
    accountType: accountType,
    loginTimestamp: new Date().toISOString()
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function requireSession(requiredRole = null, loginUrl = "../index.html") {
  const session = getSession();
  if (!session || !session.user) {
    window.location.href = loginUrl;
    return null;
  }

  if (requiredRole && session.accountType !== requiredRole) {
    if (session.accountType === "Admin") {
      window.location.href = "../admin/index.html";
    } else {
      window.location.href = "../employee/index.html";
    }
    return null;
  }

  return session;
}

function logout(redirectUrl = "../index.html") {
  clearSession();
  window.location.href = redirectUrl;
}

/* ==========================================================================
   GLOBAL UI LOADERS, INLINE BUTTON SPINNERS & ALERTS
   ========================================================================== */

function showLoader(show, message = "Processing MMS telemetry...") {
  let spinner = document.getElementById("globalSpinner");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "globalSpinner";
    spinner.className = "spinner-backdrop hidden";
    spinner.innerHTML = `
      <div class="spinner-disc"></div>
      <div class="spinner-message" id="spinnerMsg">Processing MMS request...</div>
    `;
    document.body.appendChild(spinner);
  }

  const msgEl = document.getElementById("spinnerMsg");
  if (msgEl) msgEl.innerText = message;

  if (show) {
    spinner.classList.remove("hidden");
  } else {
    spinner.classList.add("hidden");
  }
}

/**
 * Seamless button loading state controller
 */
function setButtonLoading(button, isLoading, loadingText = "Processing...") {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = true;
    button.innerHTML = `<span class="btn-spinner"></span> <span>${loadingText}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }
}

function showAlert(containerId, message, type = "info") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const alertClass = type === "success" ? "alert-success" : (type === "danger" ? "alert-danger" : (type === "warning" ? "alert-warning" : "alert-info"));
  let icon = "ℹ️";
  if (type === "success") icon = "✓";
  if (type === "danger") icon = "⚠️";
  if (type === "warning") icon = "⚡";

  container.className = `alert ${alertClass}`;
  container.innerHTML = `<span><strong>${icon}</strong> ${message}</span>`;
  container.classList.remove("hidden");
}

function hideAlert(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add("hidden");
    container.innerHTML = "";
  }
}

/* ==========================================================================
   MODERN FLOATING TOAST SYSTEM (Non-blocking, elegant notifications)
   ========================================================================== */

function getOrCreateToastContainer() {
  let container = document.getElementById("mmsToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "mmsToastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "info", title = "", duration = 4200) {
  const container = getOrCreateToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  let defaultTitle = "MMS Notification";
  let icon = "ℹ️";
  if (type === "success") {
    defaultTitle = "Success";
    icon = "✓";
  } else if (type === "danger") {
    defaultTitle = "Action Required";
    icon = "⚠️";
  } else if (type === "warning") {
    defaultTitle = "Notice";
    icon = "⚡";
  }

  const finalTitle = title || defaultTitle;

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtmlShared(finalTitle)}</div>
      <div class="toast-message">${escapeHtmlShared(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  const dismiss = () => {
    toast.classList.add("toast-leaving");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  };

  closeBtn.addEventListener("click", dismiss);
  container.appendChild(toast);

  const timeoutId = setTimeout(dismiss, duration);
  toast.addEventListener("mouseenter", () => clearTimeout(timeoutId));
}

/* ==========================================================================
   SEAMLESS CUSTOM CONFIRM MODAL (Replaces intrusive window.confirm)
   ========================================================================== */

function showConfirmModal({
  title = "Confirm Action",
  message = "Are you sure you wish to proceed?",
  confirmText = "Proceed",
  cancelText = "Cancel",
  confirmType = "primary", // primary, danger, success
  icon = "❓"
} = {}) {
  return new Promise((resolve) => {
    // Remove existing if any
    const existing = document.getElementById("mmsConfirmModal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "mmsConfirmModal";
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    let confirmBtnClass = "btn-primary";
    let iconBg = "background: var(--grad-mms-subtle); color: var(--mms-pink); border: 1px solid var(--border-glow);";

    if (confirmType === "danger") {
      confirmBtnClass = "btn-danger";
      iconBg = "background: var(--color-danger-bg); color: var(--color-danger); border: 1px solid var(--color-danger-border);";
    } else if (confirmType === "success") {
      confirmBtnClass = "btn-success";
      iconBg = "background: var(--color-success-bg); color: var(--color-success); border: 1px solid var(--color-success-border);";
    }

    backdrop.innerHTML = `
      <div class="modal-dialog confirm-dialog">
        <div class="modal-body" style="padding: 2rem 1.75rem;">
          <div class="confirm-icon-badge" style="${iconBg}">
            ${icon}
          </div>
          <h3 class="modal-title justify-center text-center mb-2" style="font-size: 1.35rem;">
            ${escapeHtmlShared(title)}
          </h3>
          <p class="text-sm text-center mb-6" style="color: var(--text-muted); line-height: 1.55;">
            ${escapeHtmlShared(message)}
          </p>
          <div class="flex items-center justify-center gap-3">
            <button type="button" class="btn btn-secondary flex-1" id="btnConfirmCancel">
              ${escapeHtmlShared(cancelText)}
            </button>
            <button type="button" class="btn ${confirmBtnClass} flex-1" id="btnConfirmOk">
              ${escapeHtmlShared(confirmText)}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cleanup = (result) => {
      backdrop.classList.add("hidden");
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };

    document.getElementById("btnConfirmOk").addEventListener("click", () => cleanup(true));
    document.getElementById("btnConfirmCancel").addEventListener("click", () => cleanup(false));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

/* ==========================================================================
   GEOLOCATION CAPTURE HELPER
   ========================================================================== */

function getBrowserCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser. Please enable GPS permissions."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
          accuracy: position.coords.accuracy ? Math.round(position.coords.accuracy) : null
        });
      },
      (error) => {
        let msg = "Could not acquire GPS coordinates.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Location permission denied. Please allow location access in your browser / device settings to log shift attendance.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "GPS signal is currently unavailable on this device. Please check device location settings.";
            break;
          case error.TIMEOUT:
            msg = "GPS location request timed out. Please verify device sensor has an unobstructed signal and retry.";
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 16000,
        maximumAge: 0
      }
    );
  });
}

/* ==========================================================================
   DATE & TIME DISPLAY HELPERS
   ========================================================================== */

function updateLiveClock(timeElementId, dateElementId) {
  const timeEl = document.getElementById(timeElementId);
  const dateEl = document.getElementById(dateElementId);

  function tick() {
    const now = new Date();
    if (timeEl) {
      timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }
    if (dateEl) {
      timeEl.setAttribute("datetime", now.toISOString());
      dateEl.innerText = now.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  tick();
  return setInterval(tick, 1000);
}

function escapeHtmlShared(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* Online / Offline status monitoring */
window.addEventListener("online", () => {
  showToast("Your internet connection has been restored.", "success", "Back Online");
});

window.addEventListener("offline", () => {
  showToast("You are currently offline. Cloud sync will pause until connection returns.", "warning", "Connection Lost");
});
