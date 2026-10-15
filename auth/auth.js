/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - AUTHENTICATION CONTROLLER (auth/auth.js)
 * Handles Sign In, Registration, Session Persistence, and Role Routing
 * Enhanced with Live Validation, Password Toggles & Inline Feedback
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // Check if active session already exists; if so, skip login
  const existingSession = getSession();
  if (existingSession && existingSession.user && existingSession.accountType) {
    if (existingSession.accountType === "Admin") {
      window.location.href = "admin/index.html";
    } else {
      window.location.href = "employee/index.html";
    }
  }
});

function switchAuthTab(mode) {
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authSubtitle = document.getElementById("authSubtitle");

  hideAlert("authAlert");

  if (mode === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    authSubtitle.innerText = "Attendance, Leave & Device Resource Portal";
    document.getElementById("loginEmail").focus();
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    authSubtitle.innerText = "Register your MolāDira Employee credentials";
    document.getElementById("regFirstName").focus();
  }
}

/**
 * Show / Hide password visibility toggle
 */
function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    button.innerText = "🔒";
    button.title = "Hide password";
  } else {
    input.type = "password";
    button.innerText = "👁️";
    button.title = "Show password";
  }
}

/**
 * Live Password Strength Checker
 */
function checkPasswordStrength(password) {
  const fill = document.getElementById("pwdStrengthFill");
  const label = document.getElementById("pwdStrengthText");
  const lengthText = document.getElementById("pwdLengthText");

  if (!fill || !label || !lengthText) return;

  const len = password.length;
  lengthText.innerText = `${len} character${len === 1 ? '' : 's'}`;

  if (len === 0) {
    fill.style.width = "0%";
    fill.style.backgroundColor = "transparent";
    label.innerText = "Security strength";
    label.style.color = "var(--text-dim)";
    return;
  }

  let score = 0;
  if (len >= 6) score += 25;
  if (len >= 10) score += 25;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 25;

  fill.style.width = `${score}%`;

  if (score <= 25) {
    fill.style.backgroundColor = "var(--color-danger)";
    label.innerText = "Weak (Minimum 6 characters)";
    label.style.color = "#f87171";
  } else if (score <= 50) {
    fill.style.backgroundColor = "var(--color-warning)";
    label.innerText = "Fair (Add numbers or capitals)";
    label.style.color = "#fbbf24";
  } else if (score <= 75) {
    fill.style.backgroundColor = "var(--mms-orange)";
    label.innerText = "Good password";
    label.style.color = "var(--mms-orange)";
  } else {
    fill.style.backgroundColor = "var(--color-success)";
    label.innerText = "Strong enterprise password ✓";
    label.style.color = "#34d399";
  }

  checkPasswordMatch();
}

/**
 * Live Password Matching Verification
 */
function checkPasswordMatch() {
  const pwd = document.getElementById("regPassword") ? document.getElementById("regPassword").value : "";
  const confirmPwd = document.getElementById("regConfirmPassword") ? document.getElementById("regConfirmPassword").value : "";
  const statusEl = document.getElementById("pwdMatchStatus");

  if (!statusEl) return;

  if (!confirmPwd) {
    statusEl.innerHTML = "";
    return;
  }

  if (pwd === confirmPwd) {
    statusEl.innerHTML = `<span style="color: var(--color-success); font-weight: 600;">✓ Passwords match</span>`;
  } else {
    statusEl.innerHTML = `<span style="color: var(--color-danger); font-weight: 600;">⚠️ Passwords do not match</span>`;
  }
}

/**
 * Friendly Forgotten Password Helper
 */
function showForgotPasswordHelp(event) {
  if (event && event.preventDefault) event.preventDefault();
  showConfirmModal({
    title: "Password Assistance",
    message: "MolāDira Skills user access is managed securely by System Administrators. To reset your credentials, please contact your MMS Operations Lead or Admin to initiate a secure credentials reset from the Staff Directory.",
    confirmText: "Got it",
    cancelText: "Close",
    icon: "🔑",
    confirmType: "primary"
  });
}

/**
 * Handle Sign In
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  hideAlert("authAlert");

  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("btnLoginSubmit");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert("authAlert", "Please enter both your corporate email address and password.", "danger");
    return;
  }

  setButtonLoading(submitBtn, true, "Authenticating...");

  try {
    const res = await callApi("loginUser", { email, password });
    setButtonLoading(submitBtn, false);

    if (res.status === "success") {
      saveSession(res.user, res.accountType);

      showAlert("authAlert", `Welcome back, ${res.user.firstName}! Redirecting to ${res.accountType} portal...`, "success");
      showToast(`Signed in successfully as ${res.user.firstName} ${res.user.lastName}`, "success", "Authenticated");

      setTimeout(() => {
        if (res.accountType === "Admin") {
          window.location.href = "admin/index.html";
        } else {
          window.location.href = "employee/index.html";
        }
      }, 650);

    } else {
      showAlert("authAlert", res.message || "Invalid credentials provided.", "danger");
      showToast(res.message || "Login authentication failed.", "danger", "Access Denied");
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showAlert("authAlert", "Network/Server Connection Error: " + err.message, "danger");
    showToast("Connection issue: " + err.message, "danger", "Connection Error");
  }
}

/**
 * Handle Registration
 */
async function handleRegisterSubmit(event) {
  event.preventDefault();
  hideAlert("authAlert");

  const firstName = document.getElementById("regFirstName").value.trim();
  const lastName = document.getElementById("regLastName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;
  const submitBtn = document.getElementById("btnRegisterSubmit");

  if (!firstName || !lastName || !email || !password) {
    showAlert("authAlert", "All registration fields are required.", "danger");
    return;
  }

  if (password.length < 6) {
    showAlert("authAlert", "Password must be at least 6 characters in length.", "danger");
    return;
  }

  if (password !== confirmPassword) {
    showAlert("authAlert", "The entered passwords do not match. Please verify.", "danger");
    return;
  }

  setButtonLoading(submitBtn, true, "Creating Profile...");

  try {
    const res = await callApi("registerUser", { email, firstName, lastName, password });
    setButtonLoading(submitBtn, false);

    if (res.status === "success") {
      showAlert("authAlert", res.message || "Registration successful! You may now sign in.", "success");
      showToast("Account created successfully! Please sign in.", "success", "Welcome to MMS");

      // Auto-populate email into login form and switch tab
      document.getElementById("loginEmail").value = email;
      document.getElementById("registerForm").reset();
      checkPasswordStrength("");

      setTimeout(() => {
        switchAuthTab("login");
        document.getElementById("loginPassword").focus();
      }, 1200);

    } else {
      showAlert("authAlert", res.message || "Registration failed. Email might already exist.", "danger");
      showToast(res.message || "Registration failed.", "danger", "Registration Error");
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showAlert("authAlert", "Network/Server Connection Error: " + err.message, "danger");
  }
}
