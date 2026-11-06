import { mountPalette } from "./palette-ui.js";
import { CHROME_DESTINATIONS, getSearchResults } from "./lib/search.js";
import { rememberRecentTab, removeRecentTab, setAliasForUrl } from "./lib/storage.js";
import { parseHttpUrl, parseRuntimeMessage } from "./lib/validation.js";

async function openPalette(tab) {
  if (!Number.isInteger(tab?.id)) return;
  try {
    await chrome.action.setPopup({ tabId: tab.id, popup: "" });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mountPalette,
      args: [{ mode: "overlay" }],
    });
  } catch {
    await chrome.action.setPopup({ tabId: tab.id, popup: "popup.html" });
    await chrome.action.openPopup({ windowId: tab.windowId });
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function handleMessage(rawMessage) {
  const message = parseRuntimeMessage(rawMessage);
  switch (message.type) {
    case "GET_INDEX":
      return getSearchResults(message.query, message.filter);
    case "ACTIVATE_TAB": {
      const tab = await chrome.tabs.get(message.tabId);
      if (!Number.isInteger(tab.windowId)) throw new Error("That tab is no longer available.");
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tab.id, { active: true });
      return null;
    }
    case "OPEN_URL": {
      let url = message.url;
      if (message.bookmarkId) {
        const [bookmark] = await chrome.bookmarks.get(message.bookmarkId);
        url = parseHttpUrl(bookmark?.url);
        if (!url) throw new Error("That bookmark is no longer available.");
      }
      await chrome.tabs.create({ url, active: true });
      return null;
    }
    case "OPEN_SEARCH": {
      const url = new URL("https://www.google.com/search");
      url.searchParams.set("q", message.query);
      await chrome.tabs.create({ url: url.href, active: true });
      return null;
    }
    case "OPEN_CHROME_DESTINATION": {
      const destination = CHROME_DESTINATIONS[message.key];
      if (!destination) throw new Error("That Chrome destination is not allowed.");
      await chrome.tabs.create({ url: destination.url, active: true });
      return null;
    }
    case "SET_ALIAS": {
      const tab = await chrome.tabs.get(message.tabId);
      if (!tab.url) throw new Error("That tab cannot be assigned an alias.");
      return setAliasForUrl(tab.url, message.alias);
    }
    case "POPUP_READY": {
      const tab = await activeTab();
      if (Number.isInteger(tab?.id)) await chrome.action.setPopup({ tabId: tab.id, popup: "" });
      return null;
    }
    default:
      throw new Error("Unknown message type.");
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove("client_id");
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  rememberRecentTab(tabId).catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
  removeRecentTab(tabId).catch(() => {});
});

chrome.action.onClicked.addListener(tab => {
  openPalette(tab).catch(error => console.error("Unable to open LocalTab:", error));
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== "open-command-bar") return;
  const tab = await activeTab();
  await openPalette(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Untrusted message sender." });
    return false;
  }
  handleMessage(message)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({ ok: false, error: error?.message || "Request failed." }));
  return true;
});
