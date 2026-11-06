import { getAliases, getRecentTabIds, normalizeAliasUrl } from "./storage.js";
import { parseHttpUrl } from "./validation.js";

export const CHROME_DESTINATIONS = Object.freeze({
  settings: { label: "Settings", url: "chrome://settings/", terms: ["preferences"] },
  history: { label: "History", url: "chrome://history/", terms: ["visited"] },
  downloads: { label: "Downloads", url: "chrome://downloads/", terms: ["files"] },
  extensions: { label: "Extensions", url: "chrome://extensions/", terms: ["addons", "plugins"] },
  passwords: { label: "Password Manager", url: "chrome://password-manager/passwords", terms: ["passwords"] },
  clear_data: { label: "Clear Browsing Data", url: "chrome://settings/clearBrowserData", terms: ["cache", "cookies"] },
  flags: { label: "Chrome Flags", url: "chrome://flags/", terms: ["experiments"] },
  web_store: { label: "Chrome Web Store", url: "https://chromewebstore.google.com/", terms: ["extensions", "themes"] },
});

const MAX_RESULTS = 8;

export function normalize(value = "") {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function domain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function score(item, query) {
  const needle = normalize(query);
  const label = normalize(item.label);
  const subtitle = normalize(item.subtitle);
  const terms = normalize((item.terms || []).join(" "));
  if (label === needle) return 120;
  if (label.startsWith(needle)) return 100;
  if (label.includes(needle)) return 80;
  if (subtitle.includes(needle)) return 55;
  if (terms.includes(needle)) return 40;
  return -1;
}

function tabResult(tab, aliases, section = "tabs") {
  const alias = aliases[normalizeAliasUrl(tab.url)] || "";
  return {
    kind: "tab",
    section,
    tabId: tab.id,
    label: alias || tab.title || tab.url || "Untitled tab",
    originalTitle: tab.title || "",
    alias,
    subtitle: domain(tab.url) || tab.url || "Tab",
    url: tab.url || "",
    lastAccessed: tab.lastAccessed || 0,
  };
}

export function rankIndex(index, query, filter = "all") {
  const cleanQuery = query.trim();
  const aliases = index.aliases || {};

  if (!cleanQuery) {
    const byId = new Map(index.tabs.map(tab => [tab.id, tab]));
    return index.recentTabIds.map(id => byId.get(id)).filter(Boolean).slice(0, 5)
      .map(tab => tabResult(tab, aliases, "recent"));
  }

  const candidates = [];
  if (filter === "all" || filter === "tabs") candidates.push(...index.tabs.map(tab => tabResult(tab, aliases)));
  if (filter === "all" || filter === "bookmarks") {
    candidates.push(...index.bookmarks.map(bookmark => ({
      kind: "bookmark",
      section: "bookmarks",
      bookmarkId: bookmark.id,
      label: bookmark.title || bookmark.url,
      subtitle: domain(bookmark.url) || bookmark.url,
      url: bookmark.url,
    })));
  }
  if (filter === "all") {
    candidates.push(...Object.entries(CHROME_DESTINATIONS).map(([key, destination]) => ({
      kind: "chrome",
      section: "chrome",
      key,
      label: destination.label,
      subtitle: destination.url,
      terms: destination.terms,
    })));
  }

  const ranked = candidates.map(item => ({ item, score: score(item, cleanQuery) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score || (b.item.lastAccessed || 0) - (a.item.lastAccessed || 0) || a.item.label.localeCompare(b.item.label))
    .slice(0, MAX_RESULTS)
    .map(entry => entry.item);

  if (filter === "all" || filter === "web") {
    const directUrl = parseHttpUrl(cleanQuery);
    ranked.push({
      kind: "web",
      section: "web",
      label: directUrl ? `Open ${directUrl}` : `Search Google for “${cleanQuery}”`,
      subtitle: directUrl ? domain(directUrl) : "google.com",
      url: directUrl,
      query: directUrl ? "" : cleanQuery,
    });
  }
  return ranked;
}

function flattenBookmarks(nodes, output = []) {
  for (const node of nodes) {
    if (node.url && parseHttpUrl(node.url)) output.push({ id: node.id, title: node.title || "", url: node.url });
    if (node.children) flattenBookmarks(node.children, output);
  }
  return output;
}

export async function getSearchResults(query, filter) {
  const [windows, tabs, bookmarkTree, aliases, recentTabIds] = await Promise.all([
    chrome.windows.getAll({ windowTypes: ["normal"] }),
    chrome.tabs.query({}),
    chrome.bookmarks.getTree(),
    getAliases(),
    getRecentTabIds(),
  ]);
  const normalWindowIds = new Set(windows.map(window => window.id));
  return rankIndex({
    tabs: tabs.filter(tab => normalWindowIds.has(tab.windowId) && Number.isInteger(tab.id)),
    bookmarks: flattenBookmarks(bookmarkTree),
    aliases,
    recentTabIds,
  }, query, filter);
}
