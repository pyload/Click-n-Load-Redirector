/**
 * Click'n'Load Redirector - Options Controller
 */

// Default configuration
const DEFAULT_SETTINGS = {
  targethost: "127.0.0.1",
  targetport: 9666,
  targetproto: "http",
  sethostheader: true,
  bypasscsp: true,
  targetuser: "",
  targetpasswd: ""
};

// DOM Elements
let elHost, elPort, elProto, elSetHostHeader, elBypassCsp, elUser, elPasswd;
let elPreview, elStatus, elBtnSave, elBtnReset, elBtnTest, elTestResult, elBtnTogglePw, elAuthCard, elAuthDesc;

/**
 * Initialize elements and event listeners
 */
function init() {
  elHost = document.getElementById("targethost");
  elPort = document.getElementById("targetport");
  elProto = document.getElementById("targetproto");
  elSetHostHeader = document.getElementById("sethostheader");
  elBypassCsp = document.getElementById("bypasscsp");
  elUser = document.getElementById("targetuser");
  elPasswd = document.getElementById("targetpasswd");
  elPreview = document.getElementById("targetPreview");
  elStatus = document.getElementById("status");
  elBtnSave = document.getElementById("save");
  elBtnReset = document.getElementById("btnReset");
  elBtnTest = document.getElementById("btnTest");
  elTestResult = document.getElementById("testResult");
  elBtnTogglePw = document.getElementById("btnTogglePw");
  elAuthCard = document.getElementById("authCard");
  elAuthDesc = document.getElementById("authDesc");

  // Restore stored options
  restore_options();

  // Real-time preview and sanitization listeners
  elHost.addEventListener("input", onHostInput);
  elHost.addEventListener("paste", onHostPaste);
  elPort.addEventListener("input", updatePreview);
  elProto.addEventListener("change", () => {
    updatePreview();
    updateAuthVisibility();
  });

  // Action buttons
  elBtnSave.addEventListener("click", save_options);
  elBtnReset.addEventListener("click", reset_options);
  elBtnTest.addEventListener("click", test_connection);
  elBtnTogglePw.addEventListener("click", toggle_password_visibility);

  // Keyboard shortcuts (Ctrl+S / Cmd+S, Enter)
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save_options();
    }
  });

  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.type !== "textarea") {
        e.preventDefault();
        save_options();
      }
    });
  });
}

/**
 * Updates the live URL preview banner
 */
function updatePreview() {
  const proto = elProto.value || "http";
  const host = elHost.value.trim() || "127.0.0.1";
  const port = elPort.value || "9666";
  elPreview.textContent = `${proto}://${host}:${port}`;
}

/**
 * Enables or disables Basic Auth fields based on the selected protocol
 */
function updateAuthVisibility() {
  const isHttps = elProto.value === "https";
  elUser.disabled = !isHttps;
  elPasswd.disabled = !isHttps;

  if (isHttps) {
    elAuthDesc.textContent = "Credentials sent via HTTP Basic Authentication over secure TLS/SSL.";
    elAuthCard.style.opacity = "1";
  } else {
    elAuthDesc.textContent = "Basic Authentication is disabled when using HTTP to prevent transmitting credentials unencrypted.";
    elAuthCard.style.opacity = "0.75";
  }
}

/**
 * Clean up hostname input if user enters or pastes a full URL (e.g. http://192.168.1.100:9666)
 */
function sanitizeHostInput(value) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/^(https?):\/\/([^/:]+)(?::(\d+))?/i);

  if (urlMatch) {
    const proto = urlMatch[1].toLowerCase();
    const host = urlMatch[2];
    const port = urlMatch[3];

    elProto.value = proto;
    elHost.value = host;
    if (port) {
      elPort.value = port;
    }
    showToast("Extracted protocol, host, and port from pasted URL.");
    updatePreview();
    updateAuthVisibility();
    return true;
  }

  // Handle accidental "host:port" input
  const hostPortMatch = trimmed.match(/^([^/:]+):(\d+)$/);
  if (hostPortMatch) {
    elHost.value = hostPortMatch[1];
    elPort.value = hostPortMatch[2];
    showToast("Extracted host and port.");
    updatePreview();
    return true;
  }

  return false;
}

function onHostInput() {
  updatePreview();
}

function onHostPaste(e) {
  setTimeout(() => {
    sanitizeHostInput(elHost.value);
  }, 10);
}

/**
 * Toggles password field visibility
 */
function toggle_password_visibility() {
  if (elPasswd.type === "password") {
    elPasswd.type = "text";
    elBtnTogglePw.textContent = "🙈";
    elBtnTogglePw.title = "Hide Password";
  } else {
    elPasswd.type = "password";
    elBtnTogglePw.textContent = "👁️";
    elBtnTogglePw.title = "Show Password";
  }
}

/**
 * Display toast status message
 */
let statusTimer = null;
function showToast(message, isError = false) {
  clearTimeout(statusTimer);
  elStatus.textContent = message;
  elStatus.className = `status-toast show ${isError ? "error" : "saved"}`;

  statusTimer = setTimeout(() => {
    elStatus.className = "status-toast";
  }, 3500);
}

/**
 * Saves options to chrome.storage.sync
 */
function save_options() {
  // Validate port
  let port = parseInt(elPort.value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    port = 9666;
    elPort.value = port;
  }

  let host = elHost.value.trim();
  if (!host) {
    host = "127.0.0.1";
    elHost.value = host;
  }

  const newSettings = {
    targethost: host,
    targetport: String(port),
    targetproto: elProto.value,
    sethostheader: elSetHostHeader.checked,
    bypasscsp: elBypassCsp.checked,
    targetuser: elUser.value.trim(),
    targetpasswd: elPasswd.value
  };

  chrome.storage.sync.set({ settings: newSettings }, () => {
    showToast("✓ Settings saved successfully");

    // Attempt to reload background script context if available
    try {
      if (chrome.extension && chrome.extension.getBackgroundPage) {
        const bg = chrome.extension.getBackgroundPage();
        if (bg && bg.window && bg.window.location) {
          bg.window.location.reload();
        }
      }
    } catch (err) {
      console.warn("Background reload caught:", err);
    }
  });
}

/**
 * Restores options from chrome.storage.sync
 */
function restore_options() {
  chrome.storage.sync.get({ settings: DEFAULT_SETTINGS }, (storage) => {
    const s = Object.assign({}, DEFAULT_SETTINGS, storage.settings);

    elHost.value = s.targethost || DEFAULT_SETTINGS.targethost;
    elPort.value = parseInt(s.targetport, 10) || DEFAULT_SETTINGS.targetport;
    elProto.value = s.targetproto || DEFAULT_SETTINGS.targetproto;
    elSetHostHeader.checked = s.sethostheader !== undefined ? s.sethostheader : true;
    elBypassCsp.checked = s.bypasscsp !== undefined ? s.bypasscsp : true;
    elUser.value = s.targetuser || "";
    elPasswd.value = s.targetpasswd || "";

    updatePreview();
    updateAuthVisibility();
  });
}

/**
 * Resets settings to default values
 */
function reset_options() {
  if (confirm("Reset all settings to default values?")) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      restore_options();
      showToast("Settings reset to defaults");
    });
  }
}

/**
 * Test reachability of the target server
 */
function test_connection() {
  const proto = elProto.value || "http";
  const host = elHost.value.trim() || "127.0.0.1";
  const port = elPort.value || "9666";
  const targetUrl = `${proto}://${host}:${port}/flash/`;

  elBtnTest.disabled = true;
  elTestResult.className = "test-result loading";
  elTestResult.textContent = `Connecting to ${proto}://${host}:${port}...`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  const fetchOptions = {
    method: "GET",
    signal: controller.signal,
    cache: "no-store"
  };

  if (proto === "https" && elUser.value && elPasswd.value) {
    fetchOptions.headers = {
      Authorization: "Basic " + btoa(elUser.value + ":" + elPasswd.value)
    };
  }

  fetch(targetUrl, fetchOptions)
    .then((response) => {
      clearTimeout(timeoutId);
      elBtnTest.disabled = false;
      return response.text().then((bodyText) => {
        const snippet = bodyText ? ` (${bodyText.trim().slice(0, 40)})` : "";
        elTestResult.className = "test-result success";
        elTestResult.textContent = `✓ Successfully reached server! Response code: ${response.status}${snippet}`;
      });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      elBtnTest.disabled = false;
      elTestResult.className = "test-result error";

      if (err.name === "AbortError") {
        elTestResult.textContent = `✗ Connection timed out (4s). Check host IP, port ${port}, or firewall.`;
      } else {
        elTestResult.textContent = `✗ Connection failed: ${err.message || "Failed to reach server"}. Ensure the download manager is running and accessible.`;
      }
    });
}

document.addEventListener("DOMContentLoaded", init);
