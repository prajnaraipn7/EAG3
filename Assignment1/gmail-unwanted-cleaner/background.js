chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "updateBadge") {
    return;
  }

  const count = Number(message.count || 0);
  const text = count > 0 ? String(Math.min(count, 999)) : "";

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
});
