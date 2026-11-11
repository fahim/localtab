import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, suggestFolders, prepareOrganization, commitOrganization } from '../extension/lib/organize.js';
import { parseRuntimeMessage } from '../extension/lib/validation.js';

test('cleanup preserves meaningful punctuation and falls back safely', () => {
  assert.equal(cleanTitle('(12)  API guide | GitHub', 'https://github.com/a'), 'API guide');
  assert.equal(cleanTitle('[2] Hello: world - a guide', 'https://example.com'), 'Hello: world - a guide');
  assert.equal(cleanTitle(' \n ', 'https://example.com'), 'example.com');
  assert.equal(cleanTitle('x'.repeat(400), 'https://example.com').length, 300);
});
test('suggestions classify deterministically, deduplicate and retain full URLs', () => {
  const result = suggestFolders([
    {id: 1, title: 'API shopping', url: 'https://example.com/?q=a#one'},
    {id: 2, title: 'Duplicate', url: 'https://example.com/?q=a#one'},
    {id: 3, title: 'Hello', url: 'https://www.other.com/'},
    {id: 4, title: 'Saved', url: 'https://saved.com'},
    {id: 5, title: 'Settings', url: 'chrome://settings'},
  ], ['https://saved.com/']);
  assert.equal(result.skipped, 3);
  assert.deepEqual(result.folders.map(folder => folder.name), ['Development', 'other.com']);
  assert.equal(result.folders[0].items[0].url, 'https://example.com/?q=a#one');
});
test('prepare, confirm, partial retry and repeated confirmation', async () => {
  const stored = {}, calls = [];
  const other = { id: 'other', folderType: 'other', children: [] };
  const tree = [{id: '0', children: [other]}];
  let fail = true;
  globalThis.chrome = {
    windows: {get: async () => ({ type: 'normal', incognito: false })},
    tabs: {query: async () => [1,2].map(id => ({id, title: `API guide ${id}`, url: `https://example.com/${id}`}))},
    storage: {session: {
      get: async key => key === null ? stored : {[key]: stored[key]},
      set: async value => Object.assign(stored, value),
      remove: async keys => keys.forEach(key => delete stored[key]),
    }},
    bookmarks: {
      getTree: async () => tree,
      create: async details => {
        calls.push(details);
        if (details.url?.endsWith('/2') && fail) throw new Error('Temporary failure');
        const node = { ...details, id: String(calls.length), ...(!details.url ? {children: []} : {}) };
        const find = nodes => nodes.flatMap(node => [node, ...find(node.children || [])]);
        find(tree).find(node => node.id === details.parentId).children.push(node);
        return node;
      },
    },
  };
  const draft = await prepareOrganization(1);
  assert.equal(calls.length, 0);
  const message = parseRuntimeMessage({type: 'COMMIT_ORGANIZATION', draftId: draft.id, folders: draft.folders.map(folder => ({ ...folder, items: folder.items.map(item => ({id: item.id, title: item.title})) }))});
  const outcome = await commitOrganization(message);
  assert.equal(outcome.saved, 1); assert.equal(outcome.failed.length, 1);
  fail = false;
  const retry = await commitOrganization(message);
  assert.equal(retry.saved, 1); assert.equal(retry.skipped, 1);
  assert.equal(calls.filter(call => !call.url).length, 2);
  assert.equal((await commitOrganization(message)).saved, 0);
  const invalid = structuredClone(message); invalid.folders[0].items[0].id = 'unknown';
  await assert.rejects(commitOrganization(invalid), /Unknown bookmark/);
  await assert.rejects(commitOrganization({...message, draftId: 'unknown'}), /expired/);
  stored[`organization:${draft.id}`].created = 0;
  await assert.rejects(commitOrganization(message), /expired/);
  chrome.windows.get = async () => ({type: 'normal', incognito: true});
  await assert.rejects(prepareOrganization(1), /non-incognito/);
  delete globalThis.chrome;
});
test('confirmation validates editable fields and prevents arbitrary URLs', () => {
  const message = { type: 'COMMIT_ORGANIZATION', draftId: 'draft', folders: [{id: 'folder', name: 'Name', items: [{id: 'tab', title: 'Title'}]}] };
  assert.doesNotThrow(() => parseRuntimeMessage(message));
  for (const title of ['', 'x'.repeat(301)]) {
    const bad = structuredClone(message); bad.folders[0].items[0].title = title;
    assert.throws(() => parseRuntimeMessage(bad));
  }
  const bad = structuredClone(message); bad.folders[0].items[0].url = 'https://evil.com';
  assert.throws(() => parseRuntimeMessage(bad), /Unexpected/);
  assert.throws(() => parseRuntimeMessage({...message, folders: [message.folders[0], message.folders[0]]}), /Duplicate/);
});
