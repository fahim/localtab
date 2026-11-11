import { parseHttpUrl } from './validation.js';

const topics = [
  ['Development', ['api', 'javascript', 'typescript', 'python', 'programming', 'developer', 'documentation', 'github', 'stackoverflow']],
  ['Shopping', ['shop', 'shopping', 'buy', 'price', 'amazon', 'ebay', 'etsy']],
  ['Travel', ['travel', 'flight', 'flights', 'hotel', 'hotels', 'booking', 'airbnb']],
  ['Recipes', ['recipe', 'recipes', 'cooking', 'allrecipes']],
  ['Reading', ['article', 'articles', 'news', 'blog', 'essay', 'wikipedia', 'medium']],
];
export function cleanTitle(title, url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const site = host.split('.')[0].toLowerCase();
  let text = String(title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:\(\d+\)|\[\d+\])\s*/, '');
  const parts = text.split(/\s+[|–—-]\s+/);
  if (parts.length > 1) {
    const suffix = parts.at(-1).toLowerCase().replace(/\s/g, '');
    if (suffix === site || suffix === host) { parts.pop(); text = parts.join(' - '); }
  }
  return (text.trim() || host).slice(0, 300);
}
export function suggestFolders(tabs, existingUrls = []) {
  const seen = new Set(existingUrls.map(parseHttpUrl).filter(Boolean));
  const folders = new Map();
  let skipped = 0;
  for (const tab of tabs) {
    const url = parseHttpUrl(tab.url);
    if (!url || seen.has(url)) { skipped++; continue; }
    seen.add(url);
    const title = cleanTitle(tab.title, url);
    const host = new URL(url).hostname.replace(/^www\./, '');
    const words = new Set(`${title} ${host}`.toLowerCase().split(/[^\p{L}\p{N}]+/u));
    let name = host, best = 0;
    for (const [topic, terms] of topics) {
      const score = terms.filter(term => words.has(term)).length;
      if (score > best) { name = topic; best = score; }
    }
    if (!folders.has(name)) folders.set(name, { id: `folder-${folders.size}`, name, items: [] });
    folders.get(name).items.push({ id: `tab-${tab.id}`, title, originalTitle: tab.title || '', url });
  }
  return { folders: [...folders.values()].sort((a,b) => a.name.localeCompare(b.name)), skipped };
}
function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}
export async function prepareOrganization(windowId) {
  const window = await chrome.windows.get(windowId);
  if (window.incognito || window.type !== 'normal') throw new Error('Use a normal, non-incognito window.');
  const [tabs, tree] = await Promise.all([chrome.tabs.query({ windowId }), chrome.bookmarks.getTree()]);
  const draft = { ...suggestFolders(tabs, flatten(tree).map(node => node.url).filter(Boolean)), id: crypto.randomUUID(), created: Date.now() };
  await chrome.storage.session.set({ [`organization:${draft.id}`]: draft });
  // Prune expired previews without retaining browsing data indefinitely.
  const stored = await chrome.storage.session.get(null);
  const expired = Object.keys(stored).filter(key => key.startsWith('organization:') && Date.now() - stored[key].created > 1800000);
  if (expired.length) await chrome.storage.session.remove(expired);
  return draft;
}
let saving = false;
export async function commitOrganization(message) {
  if (saving) throw new Error('A bookmark save is already in progress.');
  saving = true;
  try {
    const key = `organization:${message.draftId}`;
    const stored = await chrome.storage.session.get(key);
    const draft = stored[key];
    if (!draft || Date.now() - draft.created > 1800000) {
      await chrome.storage.session.remove([key]);
      throw new Error('Preview expired. Organize tabs again.');
    }
    const selected = message.folders.map(selection => {
      const folder = draft.folders.find(value => value.id === selection.id);
      if (!folder) throw new Error('Unknown folder.');
      if (selection.items.length !== folder.items.length || new Set(selection.items.map(item => item.id)).size !== folder.items.length) throw new Error('Invalid bookmark selection.');
      return { name: selection.name, items: selection.items.map(edit => {
        const item = folder.items.find(value => value.id === edit.id);
        if (!item) throw new Error('Unknown bookmark.');
        return { ...item, title: edit.title };
      }) };
    });
    const tree = await chrome.bookmarks.getTree();
    const nodes = flatten(tree);
    const seen = new Set(nodes.filter(node => node.url).map(node => parseHttpUrl(node.url)));
    // Older Chrome versions have no folderType. Omitting parentId uses Other Bookmarks.
    const other = nodes.find(node => node.folderType === 'other' && !node.unmodifiable) || nodes.find(node => node.id === '2' && !node.unmodifiable);
    let parent = other?.children?.find(node => !node.url && node.title === 'LocalTab' && !node.unmodifiable);
    const destinations = new Map();
    let saved = 0, skipped = 0;
    const failed = [];
    for (const folder of selected) {
      for (const item of folder.items) {
        if (seen.has(item.url)) { skipped++; continue; }
        try {
          if (!parent) parent = await chrome.bookmarks.create({ ...(other ? { parentId: other.id } : {}), title: 'LocalTab' });
          let destination = destinations.get(folder.name) || parent.children?.find(node => !node.url && node.title === folder.name && !node.unmodifiable);
          if (!destination) destination = await chrome.bookmarks.create({ parentId: parent.id, title: folder.name });
          destinations.set(folder.name, destination);
          await chrome.bookmarks.create({ parentId: destination.id, title: item.title, url: item.url });
          seen.add(item.url); saved++;
        } catch (error) { failed.push({ id: item.id, error: error.message || 'Save failed.' }); }
      }
    }
    return { saved, skipped, failed };
  } finally { saving = false; }
}
