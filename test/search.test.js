import test from "node:test";
import assert from "node:assert/strict";
import { rankIndex } from "../extension/lib/search.js";
import { normalizeAliasUrl } from "../extension/lib/storage.js";

const index = {
  tabs: [
    { id: 1, title: "Project documentation", url: "https://docs.example.com/guide", lastAccessed: 10 },
    { id: 2, title: "Inbox", url: "https://mail.example.com/", lastAccessed: 20 },
  ],
  bookmarks: [{ id: "b1", title: "Example Docs", url: "https://example.com/docs" }],
  aliases: { "https://mail.example.com/": "Work mail" },
  recentTabIds: [2, 99, 1],
};

test("empty searches return existing recent tabs in stored order", () => {
  const results = rankIndex(index, "", "all");
  assert.deepEqual(results.map(result => result.tabId), [2, 1]);
  assert.equal(results[0].label, "Work mail");
  assert.ok(results.every(result => result.section === "recent"));
});

test("search ranking is deterministic and includes an explicit web result", () => {
  const results = rankIndex(index, "docs", "all");
  assert.equal(results[0].label, "Example Docs");
  assert.equal(results.at(-1).kind, "web");
  assert.equal(results.at(-1).query, "docs");
});

test("filters restrict local result types", () => {
  assert.ok(rankIndex(index, "example", "tabs").every(result => result.kind === "tab"));
  assert.ok(rankIndex(index, "example", "bookmarks").every(result => result.kind === "bookmark"));
  assert.deepEqual(rankIndex(index, "example", "web").map(result => result.kind), ["web"]);
});

test("direct HTTP URLs become explicit open results", () => {
  const result = rankIndex(index, "https://example.org/a", "web")[0];
  assert.equal(result.url, "https://example.org/a");
  assert.equal(result.query, "");
});

test("alias URL normalization drops fragments but keeps query strings", () => {
  assert.equal(normalizeAliasUrl("https://example.com/a?q=1#section"), "https://example.com/a?q=1");
  assert.equal(normalizeAliasUrl("not a url"), "");
});
