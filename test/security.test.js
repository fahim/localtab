import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const extensionRoot = new URL("../extension/", import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "icons") files.push(...await sourceFiles(path));
    else if (/\.(js|html|json)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("manifest has no persistent host or content access", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionRoot), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "tabs", "bookmarks", "storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.externally_connectable, undefined);
});

test("extension contains no active network client or unsafe HTML/message sinks", async () => {
  const files = await sourceFiles(extensionRoot.pathname);
  const source = (await Promise.all(files.map(file => readFile(file, "utf8")))).join("\n");
  for (const forbidden of ["fetch(", "XMLHttpRequest", ".innerHTML", "postMessage(", "eval(", "tabi-api-10z9", "remove.bg", "generativelanguage.googleapis.com"]) {
    assert.equal(source.includes(forbidden), false, `found forbidden source: ${forbidden}`);
  }
});
