const HIGHLIGHT_CLASS = "guc-unwanted-highlight";

injectStyles();

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!message?.type) {
    return;
  }

  if (message.type === "ping") {
    sendResponse({ ok: true });
    return;
  }

  if (!message.settings) {
    sendResponse({ error: "Missing settings payload." });
    return;
  }

  if (message.type === "scan") {
    const result = scanUnwanted(message.settings);
    sendResponse(result);
    return;
  }

  if (message.type === "markOnly") {
    markOnlyUnwanted(message.settings)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

});

function injectStyles() {
  if (document.getElementById("guc-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "guc-style";
  style.textContent = `
    tr.${HIGHLIGHT_CLASS} {
      outline: 2px solid #d93025 !important;
      outline-offset: -2px;
      background: #fce8e6 !important;
    }
  `;
  document.head.appendChild(style);
}

function getCurrentFolder() {
  const hash = window.location.hash.toLowerCase();
  if (hash.includes("#spam")) return "Spam";
  if (hash.includes("#trash")) return "Trash";
  if (hash.includes("#inbox")) return "Inbox";
  if (hash.includes("#category/promotion")) return "Promotions";
  if (hash.includes("#category/social")) return "Social";
  if (hash.includes("#category/updates")) return "Updates";
  if (hash.includes("#category/forums")) return "Forums";
  return "Other";
}

function normalizeRules(settings) {
  return {
    keywords: (settings.keywords || []).map((v) => String(v).toLowerCase().trim()),
    domains: (settings.domains || []).map((v) => String(v).toLowerCase().trim()),
  };
}

function getRows() {
  return Array.from(document.querySelectorAll("tr.zA"));
}

function parseRow(row) {
  const senderNode = row.querySelector("span[email]") || row.querySelector(".yW span");
  const subjectNode = row.querySelector("span.bog");
  const senderText = (senderNode?.getAttribute("email") || senderNode?.textContent || "").trim();
  const subjectText = (subjectNode?.textContent || "").trim();
  const rowText = row.textContent?.trim() || "";

  return {
    row,
    sender: senderText || "unknown-sender",
    subject: subjectText,
    fullText: `${senderText} ${subjectText} ${rowText}`.toLowerCase(),
    senderDomain: extractDomain(senderText),
  };
}

function extractDomain(senderText) {
  const candidate = senderText.includes("@")
    ? senderText
    : senderText.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1] || "";
  return candidate.split("@")[1]?.toLowerCase() || "";
}

function isUnwanted(messageData, rules) {
  const keywordHit = rules.keywords.some((word) => word && messageData.fullText.includes(word));
  const domainHit = rules.domains.some(
    (domain) =>
      domain &&
      (messageData.senderDomain === domain || messageData.senderDomain.endsWith(`.${domain}`))
  );
  return keywordHit || domainHit;
}

function scanUnwanted(settings) {
  const rules = normalizeRules(settings);
  const rows = getRows();
  const groupedSenders = {};
  let matchCount = 0;

  for (const row of rows) {
    row.classList.remove(HIGHLIGHT_CLASS);
    const parsed = parseRow(row);
    if (!isUnwanted(parsed, rules)) {
      continue;
    }
    row.classList.add(HIGHLIGHT_CLASS);
    matchCount += 1;
    groupedSenders[parsed.sender] = (groupedSenders[parsed.sender] || 0) + 1;
  }

  chrome.runtime.sendMessage({ type: "updateBadge", count: matchCount });

  return {
    folder: getCurrentFolder(),
    total: rows.length,
    matchCount,
    groupedSenders,
  };
}

function setCheckboxChecked(row) {
  const checkbox = row.querySelector('div[role="checkbox"]');
  if (!checkbox) {
    return false;
  }
  if (checkbox.getAttribute("aria-checked") === "true") {
    return true;
  }
  checkbox.click();
  return true;
}

async function markOnlyUnwanted(settings) {
  const rules = normalizeRules(settings);
  const rows = getRows();
  const groupedSenders = {};
  let markedCount = 0;

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!isUnwanted(parsed, rules)) {
      continue;
    }
    const selected = setCheckboxChecked(row);
    if (selected) {
      markedCount += 1;
      groupedSenders[parsed.sender] = (groupedSenders[parsed.sender] || 0) + 1;
    }
  }

  if (markedCount === 0) {
    chrome.runtime.sendMessage({ type: "updateBadge", count: 0 });
    return { folder: getCurrentFolder(), markedCount, groupedSenders };
  }

  chrome.runtime.sendMessage({ type: "updateBadge", count: markedCount });
  return { folder: getCurrentFolder(), markedCount, groupedSenders };
}
