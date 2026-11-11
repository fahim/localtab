import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../extension/palette-ui.js', import.meta.url), 'utf8');
async function setup(page, mode = 'overlay') {
  await page.setContent('<button id="underlying">Underlying app</button>');
  await page.evaluate(() => {
    window.keys = [];
    window.messages = [];
    for (const target of [window, document]) for (const capture of [true, false]) {
      for (const type of ['keydown', 'keypress', 'keyup']) target.addEventListener(type, e => keys.push([type, e.key, capture]), capture);
    }
    document.querySelector('button').focus();
    window.chrome = { runtime: { sendMessage: async message => {
      messages.push(message);
      return { ok: true, data: message.type === 'GET_INDEX' ? [{kind:'tab', section:'tabs', tabId:1, label:'Example', originalTitle:'Example', url:'https://example.com'}] : message.type === 'PREPARE_ORGANIZATION' ? {id:'draft', skipped:0, folders:[{id:'folder',name:'Reading',items:[{id:'item',title:'Article',originalTitle:'Article',url:'https://example.com'}]}]} : message.type === 'COMMIT_ORGANIZATION' ? {saved:1,skipped:0,failed:[]} : null };
    } } };
  });
  // Open shadows only in the harness to let Playwright inspect the actual UI.
  await page.evaluate(`${source.replace('export function', 'window.mountPalette = function').replaceAll('mode: "closed"', 'mode: "open"')}\nwindow.mountPalette({mode:${JSON.stringify(mode)}});`);
  return mode === 'overlay' ? page.frameLocator('iframe') : page;
}
test('overlay isolates all keyboard phases, contains focus, and restores the page', async ({page}) => {
  const ui = await setup(page);
  const search = ui.getByPlaceholder('Search tabs, bookmarks, or the web…');
  await expect(search).toBeFocused();
  await page.keyboard.type('gi');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+Tab');
  await expect(ui.getByTitle('Edit LocalTab-only alias')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => keys)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#underlying')).toBeFocused();
  expect(await page.evaluate(() => keys)).toEqual([]);
  await page.keyboard.press('e');
  expect((await page.evaluate(() => keys)).length).toBeGreaterThan(0);
  await page.evaluate(() => mountPalette({mode:'overlay'}));
  await expect(page.frameLocator('iframe').getByPlaceholder('Search tabs, bookmarks, or the web…')).toBeFocused();
  await page.evaluate(() => mountPalette({mode:'overlay'}));
  await expect(page.locator('iframe')).toHaveCount(0);
});
for (const mode of ['overlay','popup']) test(`${mode} preserves editor and organization keyboard controls`, async ({page}) => {
  const ui = await setup(page, mode);
  await ui.getByTitle('Edit LocalTab-only alias').click();
  await page.keyboard.type('New alias');
  await page.keyboard.press('Enter');
  await expect(ui.getByRole('button',{name:'Organize tabs'})).toBeVisible();
  await ui.getByRole('button',{name:'Organize tabs'}).click();
  await ui.getByLabel('Save folder Reading').focus();
  await page.keyboard.press('Space');
  await expect(ui.getByRole('button',{name:'Bookmark selected folders'})).toBeDisabled();
  await page.keyboard.press('Space');
  await ui.getByLabel('Folder name').fill('My reading');
  await ui.locator('summary').click();
  await ui.getByLabel('Bookmark title').fill('Edited title');
  await ui.getByRole('button',{name:'Bookmark selected folders'}).click();
  await expect(ui.getByText('1 saved, 0 already saved, 0 failed.')).toBeVisible();
  await ui.getByRole('button',{name:'Done',exact:true}).click();
  expect(await page.evaluate(() => messages.some(m => m.type === 'SET_ALIAS' && m.alias === 'New alias'))).toBe(true);
  if (mode === 'overlay') expect(await page.evaluate(() => keys)).toEqual([]);
});
test('overlay cold mount latency sample', async ({page}) => {
  await setup(page);
  const times = await page.evaluate(() => {
    mountPalette({mode:'overlay'});
    return Array.from({length:20}, () => { const start = performance.now(); mountPalette({mode:'overlay'}); const elapsed = performance.now()-start; mountPalette({mode:'overlay'}); return elapsed; });
  });
  console.log('Overlay mount milliseconds:', JSON.stringify(times));
});
test('editor cancellation, backdrop dismissal and Enter activation', async ({page}) => {
  const ui = await setup(page);
  await ui.getByTitle('Edit LocalTab-only alias').click();
  await page.keyboard.press('Escape');
  await expect(ui.getByPlaceholder('Search tabs, bookmarks, or the web…')).toBeFocused();
  await ui.getByRole('button',{name:'Organize tabs'}).click();
  await page.keyboard.press('Escape');
  await expect(ui.getByPlaceholder('Search tabs, bookmarks, or the web…')).toBeFocused();
  expect(await page.evaluate(() => keys)).toEqual([]);
  await ui.locator('.backdrop').click({position:{x:5,y:5}});
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.evaluate(() => mountPalette({mode:'overlay'}));
  await expect(page.frameLocator('iframe').getByText('Example',{exact:true})).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => messages.some(m => m.type === 'ACTIVATE_TAB'))).toBe(true);
});
