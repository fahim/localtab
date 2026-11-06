import test from "node:test";
import assert from "node:assert/strict";
import { parseHttpUrl, parseRuntimeMessage } from "../extension/lib/validation.js";

test("only HTTP and HTTPS URLs are accepted", () => {
  assert.equal(parseHttpUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(parseHttpUrl("http://localhost:8000"), "http://localhost:8000/");
  for (const value of ["javascript:alert(1)", "data:text/html,hi", "file:///tmp/a", "chrome://settings", "not a url"]) {
    assert.equal(parseHttpUrl(value), "");
  }
});

test("runtime messages are allowlisted and normalized", () => {
  assert.deepEqual(parseRuntimeMessage({ type: "GET_INDEX", query: "  docs  ", filter: "tabs" }), {
    type: "GET_INDEX", query: "docs", filter: "tabs",
  });
  assert.deepEqual(parseRuntimeMessage({ type: "GET_INDEX", filter: "unknown" }), {
    type: "GET_INDEX", query: "", filter: "all",
  });
  assert.throws(() => parseRuntimeMessage({ type: "DELETE_EVERYTHING" }), /Unknown message/);
  assert.throws(() => parseRuntimeMessage({ type: "ACTIVATE_TAB", tabId: -1 }), /valid integer/);
  assert.throws(() => parseRuntimeMessage({ type: "OPEN_URL", url: "javascript:alert(1)" }), /HTTP and HTTPS/);
  assert.throws(() => parseRuntimeMessage({ type: "POPUP_READY", admin: true }), /Unexpected message field/);
});

test("bookmark open messages preserve only a bounded bookmark identifier", () => {
  assert.deepEqual(parseRuntimeMessage({ type: "OPEN_URL", url: "https://example.com", bookmarkId: "42" }), {
    type: "OPEN_URL", url: "https://example.com/", bookmarkId: "42",
  });
  assert.throws(() => parseRuntimeMessage({ type: "OPEN_URL", url: "https://example.com", extra: true }), /Unexpected message field/);
});

test("alias and query sizes are bounded", () => {
  assert.throws(() => parseRuntimeMessage({ type: "SET_ALIAS", tabId: 1, alias: "a".repeat(121) }), /too long/);
  assert.throws(() => parseRuntimeMessage({ type: "OPEN_SEARCH", query: "q".repeat(501) }), /too long/);
  assert.deepEqual(parseRuntimeMessage({ type: "SET_ALIAS", tabId: 1, alias: "" }), {
    type: "SET_ALIAS", tabId: 1, alias: "",
  });
});
