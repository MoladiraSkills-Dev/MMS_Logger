/**
 * ============================================================================
 * MOLĀDIRA SKILLS (MMS) - AUTHENTICATION CONTROLLER (auth/auth.js)
 * Handles Sign In, Registration, Session Persistence, and Role Routing
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
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    authSubtitle.innerText = "Register your MolāDira Employee credentials";
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  hideAlert("authAlert");

  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("btnLoginSubmit");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert("authAlert", "Please enter both your email address and password.", "danger");
    return;
  }

  submitBtn.disabled = true;
  showLoader(true, "Authenticating with MMS Security Server...");

  try {
    const res = await callApi("loginUser", { email, password });
    showLoader(false);
    submitBtn.disabled = false;

    if (res.status === "success") {
      saveSession(res.user, res.accountType);

      showAlert("authAlert", `Welcome back, ${res.user.firstName}! Redirecting...`, "success");

      setTimeout(() => {
        if (res.accountType === "Admin") {
          window.location.href = "admin/index.html";
        } else {
          window.location.href = "employee/index.html";
        }
      }, 700);

    } else {
      showAlert("authAlert", res.message || "Invalid credentials provided.", "danger");
    }
  } catch (err) {
    showLoader(false);
    submitBtn.disabled = false;
    showAlert("authAlert", "Network/Server Connection Error: " + err.message, "danger");
  }
}

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

  submitBtn.disabled = true;
  showLoader(true, "Creating MolāDira Profile in Secure Directory...");

  try {
    const res = await callApi("registerUser", { email, firstName, lastName, password });
    showLoader(false);
    submitBtn.disabled = false;

    if (res.status === "success") {
      showAlert("authAlert", res.message || "Registration successful! You may now sign in.", "success");
      
      // Auto-populate email into login form and switch tab
      document.getElementById("loginEmail").value = email;
      document.getElementById("registerForm").reset();

      setTimeout(() => {
        switchAuthTab("login");
      }, 1500);

    } else {
      showAlert("authAlert", res.message || "Registration failed. Email might already exist.", "danger");
    }
  } catch (err) {
    showLoader(false);
    submitBtn.disabled = false;
    showAlert("authAlert", "Network/Server Connection Error: " + err.message, "danger");
  }
}
