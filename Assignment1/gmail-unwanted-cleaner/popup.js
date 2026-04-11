const DEFAULT_SETTINGS = {
  keywords: ["unsubscribe", "offer", "deal", "newsletter"],
  domains: [],
};

const keywordsEl = document.getElementById("keywords");
const domainsEl = document.getElementById("domains");
const statusEl = document.getElementById("status");
const groupsEl = document.getElementById("groups");
const saveBtn = document.getElementById("saveBtn");
const scanBtn = document.getElementById("scanBtn");
const markOnlyBtn = document.getElementById("markOnlyBtn");

init();

function init() {
  loadSettings();
  saveBtn.addEventListener("click", onSave);
  scanBtn.addEventListener("click", onScan);
  markOnlyBtn.addEventListener("click", onMarkOnly);
}

function normalizeList(raw) {
  return raw
    .split(/[\n,]/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function renderGroups(groupedSenders) {
  groupsEl.innerHTML = "";
  const entries = Object.entries(groupedSenders || {}).sort((a, b) => b[1] - a[1]);
  for (const [sender, count] of entries) {
    const li = document.createElement("li");
    li.textContent = `${sender}: ${count}`;
    groupsEl.appendChild(li);
  }
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#d93025" : "#202124";
}

async function getActiveGmailTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("mail.google.com")) {
    throw new Error("Open Gmail in the active tab before using this extension.");
  }
  return tab;
}

function sendMessageToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function ensureContentScriptReady(tabId) {
  try {
    await sendMessageToTab(tabId, { type: "ping" });
    return;
  } catch (error) {
    if (!String(error.message || "").includes("Receiving end does not exist")) {
      throw error;
    }
  }

  await injectContentScript(tabId);
  await sendMessageToTab(tabId, { type: "ping" });
}

async function loadSettings() {
  const { settings = DEFAULT_SETTINGS } = await chrome.storage.sync.get("settings");
  const normalized = {
    keywords: settings.keywords || DEFAULT_SETTINGS.keywords,
    domains: settings.domains || DEFAULT_SETTINGS.domains,
  };

  keywordsEl.value = normalized.keywords.join(", ");
  domainsEl.value = normalized.domains.join(", ");
}

async function onSave() {
  const settings = {
    keywords: normalizeList(keywordsEl.value),
    domains: normalizeList(domainsEl.value),
  };
  await chrome.storage.sync.set({ settings });
  setStatus("Rules saved.");
}

async function onScan() {
  try {
    await onSave();
    const tab = await getActiveGmailTab();
    await ensureContentScriptReady(tab.id);
    const { settings } = await chrome.storage.sync.get("settings");
    const response = await sendMessageToTab(tab.id, { type: "scan", settings });
    if (response?.error) {
      throw new Error(response.error);
    }

    setStatus(
      `Folder: ${response.folder}. Found ${response.matchCount}/${response.total} matches.`
    );
    renderGroups(response.groupedSenders);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function onMarkOnly() {
  try {
    await onSave();
    const tab = await getActiveGmailTab();
    await ensureContentScriptReady(tab.id);
    const { settings } = await chrome.storage.sync.get("settings");
    const response = await sendMessageToTab(tab.id, { type: "markOnly", settings });
    if (response?.error) {
      throw new Error(response.error);
    }

    setStatus(`Marked ${response.markedCount} email(s) in ${response.folder}.`);
    renderGroups(response.groupedSenders);
  } catch (error) {
    setStatus(error.message, true);
  }
}

