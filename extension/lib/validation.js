import { MAX_ALIAS_LENGTH } from "./storage.js";

const MAX_QUERY_LENGTH = 500;
const FILTERS = new Set(["all", "tabs", "bookmarks", "web"]);
const MESSAGE_TYPES = new Set([
  "PREPARE_ORGANIZATION", "COMMIT_ORGANIZATION", "GET_INDEX", "ACTIVATE_TAB", "OPEN_URL", "OPEN_SEARCH",
  "OPEN_CHROME_DESTINATION", "SET_ALIAS", "POPUP_READY",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(`Unexpected message field: ${extras[0]}.`);
}

function boundedString(value, max, field, allowEmpty = false) {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!allowEmpty && !cleaned) throw new Error(`${field} is required.`);
  if (cleaned.length > max) throw new Error(`${field} is too long.`);
  return cleaned;
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a valid integer.`);
  return value;
}

export function parseHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function parseRuntimeMessage(message) {
  if (!isRecord(message) || !MESSAGE_TYPES.has(message.type)) throw new Error("Unknown message type.");

  switch (message.type) {
    case "PREPARE_ORGANIZATION":
      onlyKeys(message, ["type"]);
      return { type: message.type };
    case "COMMIT_ORGANIZATION": {
      onlyKeys(message, ["type", "draftId", "folders"]);
      if (!Array.isArray(message.folders) || !message.folders.length || message.folders.length > 1000) throw new Error("Invalid folders.");
      const folders = message.folders.map(folder => {
        if (!isRecord(folder)) throw new Error("Invalid folder.");
        onlyKeys(folder, ["id", "name", "items"]);
        if (!Array.isArray(folder.items) || folder.items.length > 10000) throw new Error("Invalid bookmarks.");
        return { id: boundedString(folder.id, 128, "folder id"), name: boundedString(folder.name, 120, "folder name"), items: folder.items.map(item => {
          if (!isRecord(item)) throw new Error("Invalid bookmark.");
          onlyKeys(item, ["id", "title"]);
          return { id: boundedString(item.id, 128, "bookmark id"), title: boundedString(item.title, 300, "bookmark title") };
        }) };
      });
      if (new Set(folders.map(folder => folder.id)).size !== folders.length) throw new Error("Duplicate folders.");
      return { type: message.type, draftId: boundedString(message.draftId, 128, "draftId"), folders };
    }
    case "GET_INDEX": {
      onlyKeys(message, ["type", "query", "filter"]);
      const query = typeof message.query === "string" ? message.query.trim() : "";
      if (query.length > MAX_QUERY_LENGTH) throw new Error("Query is too long.");
      return { type: message.type, query, filter: FILTERS.has(message.filter) ? message.filter : "all" };
    }
    case "ACTIVATE_TAB":
      onlyKeys(message, ["type", "tabId"]);
      return { type: message.type, tabId: integer(message.tabId, "tabId") };
    case "OPEN_URL": {
      onlyKeys(message, ["type", "url", "bookmarkId"]);
      const url = parseHttpUrl(message.url);
      if (!url) throw new Error("Only HTTP and HTTPS URLs can be opened.");
      const bookmarkId = message.bookmarkId === undefined
        ? ""
        : boundedString(message.bookmarkId, 128, "bookmarkId");
      return { type: message.type, url, bookmarkId };
    }
    case "OPEN_SEARCH":
      onlyKeys(message, ["type", "query"]);
      return { type: message.type, query: boundedString(message.query, MAX_QUERY_LENGTH, "query") };
    case "OPEN_CHROME_DESTINATION":
      onlyKeys(message, ["type", "key"]);
      return { type: message.type, key: boundedString(message.key, 64, "key") };
    case "SET_ALIAS":
      onlyKeys(message, ["type", "tabId", "alias"]);
      return {
        type: message.type,
        tabId: integer(message.tabId, "tabId"),
        alias: boundedString(message.alias ?? "", MAX_ALIAS_LENGTH, "alias", true),
      };
    case "POPUP_READY":
      onlyKeys(message, ["type"]);
      return { type: message.type };
    default:
      throw new Error("Unknown message type.");
  }
}
