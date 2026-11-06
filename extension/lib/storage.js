export const MAX_RECENT_TABS = 25;
export const MAX_ALIAS_LENGTH = 120;
const MAX_ALIASES = 500;

export function normalizeAliasUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export async function getRecentTabIds() {
  const { recentTabIds = [] } = await chrome.storage.local.get("recentTabIds");
  return recentTabIds.filter(Number.isInteger).slice(0, MAX_RECENT_TABS);
}

export async function rememberRecentTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  const current = await getRecentTabIds();
  const recentTabIds = [tabId, ...current.filter(id => id !== tabId)].slice(0, MAX_RECENT_TABS);
  await chrome.storage.local.set({ recentTabIds });
}

export async function removeRecentTab(tabId) {
  const current = await getRecentTabIds();
  await chrome.storage.local.set({ recentTabIds: current.filter(id => id !== tabId) });
}

export async function getAliases() {
  const { tabAliasesByUrl = {} } = await chrome.storage.local.get("tabAliasesByUrl");
  if (!tabAliasesByUrl || typeof tabAliasesByUrl !== "object" || Array.isArray(tabAliasesByUrl)) return {};

  return Object.fromEntries(
    Object.entries(tabAliasesByUrl)
      .filter(([key, value]) => normalizeAliasUrl(key) && typeof value === "string")
      .map(([key, value]) => [normalizeAliasUrl(key), value.slice(0, MAX_ALIAS_LENGTH)])
      .slice(-MAX_ALIASES),
  );
}

export async function setAliasForUrl(url, alias) {
  const key = normalizeAliasUrl(url);
  if (!key) throw new Error("This tab cannot be assigned an alias.");

  const aliases = await getAliases();
  const cleaned = alias.trim().slice(0, MAX_ALIAS_LENGTH);
  delete aliases[key];
  if (cleaned) aliases[key] = cleaned;

  const bounded = Object.fromEntries(Object.entries(aliases).slice(-MAX_ALIASES));
  await chrome.storage.local.set({ tabAliasesByUrl: bounded });
  return cleaned;
}
