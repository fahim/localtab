export function mountPalette(configuration = {}) {
  const mode = configuration.mode === "popup" ? "popup" : "overlay";
  const pageDocument = globalThis.document;
  const previousFocus = pageDocument.activeElement;
  const hostId = "__localtab_palette__";
  const existing = pageDocument.getElementById(hostId);
  if (existing) {
    if (mode === "overlay") existing.__localtabClose?.();
    return;
  }

  const host = pageDocument.createElement("div");
  host.id = hostId;
  if (mode === "overlay") {
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:block";
  }
  const outerShadow = host.attachShadow({ mode: "closed" });
  let document = pageDocument;
  let shadow = outerShadow;
  if (mode === "overlay") {
    // Events inside a browsing context do not propagate to the parent page,
    // including page capture listeners registered before LocalTab opened.
    const frame = pageDocument.createElement("iframe");
    frame.title = "LocalTab command palette";
    frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:normal";
    outerShadow.append(frame);
    pageDocument.documentElement.append(host);
    document = frame.contentDocument;
    if (!document?.body) {
      host.remove();
      throw new Error("Unable to initialize the LocalTab frame.");
    }
    document.documentElement.style.background = "transparent";
    document.body.style.cssText = "margin:0;background:transparent";
    const content = document.createElement("div");
    document.body.append(content);
    shadow = content.attachShadow({ mode: "closed" });
  }
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; color-scheme: dark; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; display: flex; justify-content: center; align-items: flex-start;
      padding-top: min(18vh, 150px); background: rgba(8, 10, 16, .34); font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
    .backdrop.popup { position: relative; width: 520px; min-height: 190px; padding: 12px; background: #0e1119; }
    .panel { width: min(620px, calc(100vw - 32px)); overflow: hidden; border: 1px solid rgba(255,255,255,.12);
      border-radius: 18px; background: #151924; color: #f5f7fb; box-shadow: 0 24px 80px rgba(0,0,0,.42); }
    .popup .panel { width: 100%; box-shadow: none; }
    .search-row { display: flex; align-items: center; gap: 10px; padding: 13px 15px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg,#8576ff,#51b7ff); font: 700 13px system-ui; }
    input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: inherit; font: 500 17px/1.4 system-ui; }
    input::placeholder { color: #858da0; }
    .filters { display: flex; gap: 4px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.07); }
    button { border: 0; color: inherit; font: 600 12px system-ui; cursor: pointer; }
    .filter { padding: 6px 9px; border-radius: 8px; background: transparent; color: #959daf; }
    .filter.active { background: #282e3d; color: #fff; }
    .results { max-height: min(420px, 58vh); overflow: auto; padding: 7px; }
    .section { padding: 8px 9px 5px; color: #737c91; font: 700 10px/1 system-ui; letter-spacing: .08em; text-transform: uppercase; }
    .result { width: 100%; display: flex; align-items: center; gap: 11px; padding: 10px; border-radius: 11px; background: transparent; text-align: left; }
    .result.selected, .result:hover { background: #252b3a; }
    .glyph { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: #303749; color: #cad2e6; font: 700 11px system-ui; }
    .copy { min-width: 0; flex: 1; }
    .title, .subtitle { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title { color: #f5f7fb; font: 600 14px/1.35 system-ui; }
    .subtitle { margin-top: 2px; color: #858da0; font: 400 11px/1.3 system-ui; }
    .alias { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 8px; background: transparent; color: #858da0; font-size: 15px; }
    .alias:hover { background: #353d50; color: #fff; }
    .empty, .status { padding: 24px 16px; color: #858da0; text-align: center; font: 500 13px/1.5 system-ui; }
    .status.error { color: #ff929d; }
    [hidden] { display: none !important; }
    button:disabled { opacity: .5; cursor: default; }
    input:not([type=search]):focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid #9d93ff; outline-offset: 2px; }
    .organize { margin-left: auto; background: #282e3d; border-radius: 8px; padding: 6px 9px; }
    .folder { padding: 10px; border-bottom: 1px solid #353d50; }
    .folder-head { display: flex; align-items: center; gap: 8px; }
    .folder input[type=checkbox] { flex: none; width: 18px; height: 18px; }
    .folder input[type=text] { width: 100%; font-size: 14px; padding: 7px; border: 1px solid #3c455a; border-radius: 6px; }
    .bookmark-preview { padding: 10px 0; }
    summary { cursor: pointer; padding: 8px 0; font: 500 12px system-ui; }
    .organizer-message { white-space: pre-wrap; font: 500 12px/1.5 system-ui; padding: 8px 0; }
    .editor { padding: 16px; }
    .editor-title { margin-bottom: 10px; color: #aab3c7; font: 600 12px system-ui; }
    .editor-box { width: 100%; padding: 10px 12px; border: 1px solid #3c455a; border-radius: 10px; background: #10141e; }
    .editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .editor-actions button { padding: 8px 12px; border-radius: 9px; background: #2a3141; }
    .editor-actions .save { background: #7266ed; }
  `;

  const make = (tag, className = "", text = "") => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const backdrop = make("div", `backdrop${mode === "popup" ? " popup" : ""}`);
  const panel = make("section", "panel");
  const searchRow = make("div", "search-row");
  const mark = make("span", "mark", "T");
  const input = make("input");
  input.type = "search";
  input.placeholder = "Search tabs, bookmarks, or the web…";
  input.autocomplete = "off";
  input.spellcheck = false;
  searchRow.append(mark, input);

  const filterBar = make("nav", "filters");
  const filterLabels = { all: "All", tabs: "Tabs", bookmarks: "Bookmarks", web: "Web" };
  let activeFilter = "all";
  for (const [value, label] of Object.entries(filterLabels)) {
    const button = make("button", `filter${value === activeFilter ? " active" : ""}`, label);
    button.type = "button";
    button.dataset.filter = value;
    button.addEventListener("click", () => {
      activeFilter = value;
      for (const child of filterBar.children) child.classList.toggle("active", child.dataset.filter === value);
      selectedIndex = 0;
      refresh();
      input.focus();
    });
    filterBar.append(button);
  }

  const organize = make("button", "organize", "Organize tabs");
  organize.type = "button";
  filterBar.append(organize);
  const results = make("div", "results");
  results.setAttribute("role", "listbox");
  panel.append(searchRow, filterBar, results);
  backdrop.append(panel);
  shadow.append(style, backdrop);
  if (mode === "popup") document.body.append(host);

  let visibleResults = [];
  let selectedIndex = 0;
  let refreshSequence = 0;
  let organizing = false;

  const send = async message => {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "LocalTab could not complete that action.");
    return response.data;
  };

  const close = () => {
    if (mode === "popup") window.close();
    else {
      host.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  };

  host.__localtabClose = close;
  let closeAfterEscape = false;
  // Keep native editing and button/checkbox behavior; only constrain focus at
  // the modal boundaries. The frame itself provides keyboard isolation.
  shadow.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      const controls = [...shadow.querySelectorAll("input, button, summary, [tabindex]")]
        .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest("[hidden]"));
      const index = controls.indexOf(shadow.activeElement);
      if (controls.length && (index < 0 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0))) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    } else if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      closeAfterEscape = true;
    }
  });
  document.addEventListener("keyup", event => {
    if (event.key === "Escape" && closeAfterEscape) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, { capture: true });

  const showError = error => {
    results.replaceChildren(make("div", "status error", error?.message || "Something went wrong."));
  };

  const iconFor = item => ({ tab: "TAB", bookmark: "BM", chrome: "CH", web: "WEB" })[item.kind] || "•";
  const sectionFor = section => ({ recent: "Recent", tabs: "Open tabs", bookmarks: "Bookmarks", chrome: "Chrome", web: "Web" })[section] || section;

  const updateSelection = () => {
    [...results.querySelectorAll(".result")].forEach((row, index) => row.classList.toggle("selected", index === selectedIndex));
    results.querySelector(".result.selected")?.scrollIntoView({ block: "nearest" });
  };

  const runResult = async item => {
    try {
      if (item.kind === "tab") await send({ type: "ACTIVATE_TAB", tabId: item.tabId });
      else if (item.kind === "bookmark") await send({ type: "OPEN_URL", url: item.url, bookmarkId: item.bookmarkId });
      else if (item.kind === "chrome") await send({ type: "OPEN_CHROME_DESTINATION", key: item.key });
      else if (item.kind === "web" && item.url) await send({ type: "OPEN_URL", url: item.url });
      else if (item.kind === "web") await send({ type: "OPEN_SEARCH", query: item.query });
      close();
    } catch (error) {
      showError(error);
    }
  };

  const startAliasEditor = item => {
    ++refreshSequence;
    input.disabled = true;
    filterBar.hidden = true;
    const editor = make("div", "editor");
    editor.append(make("div", "editor-title", `Alias for ${item.originalTitle || item.label}`));
    const aliasInput = make("input", "editor-box");
    aliasInput.value = item.alias || "";
    aliasInput.maxLength = 120;
    aliasInput.placeholder = "Leave blank to remove the alias";
    const actions = make("div", "editor-actions");
    const cancel = make("button", "", "Cancel");
    const save = make("button", "save", "Save");
    actions.append(cancel, save);
    editor.append(aliasInput, actions);
    results.replaceChildren(editor);

    const finish = async shouldSave => {
      try {
        if (shouldSave) await send({ type: "SET_ALIAS", tabId: item.tabId, alias: aliasInput.value });
        input.disabled = false;
        filterBar.hidden = false;
        await refresh();
        input.focus();
      } catch (error) {
        input.disabled = false;
        filterBar.hidden = false;
        showError(error);
      }
    };
    cancel.addEventListener("click", () => finish(false));
    save.addEventListener("click", () => finish(true));
    aliasInput.addEventListener("keydown", event => {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    aliasInput.focus();
    aliasInput.select();
  };

  const startOrganization = async () => {
    organizing = true;
    ++refreshSequence;
    input.disabled = true;
    filterBar.hidden = true;
    visibleResults = [];
    results.removeAttribute("role");
    results.replaceChildren(make("div", "status", "Preparing folder suggestions…"));
    const editor = make("div", "editor");
    const note = make("div", "organizer-message");
    const actions = make("div", "editor-actions");
    const cancel = make("button", "", "Cancel");
    const save = make("button", "save", "Bookmark selected folders");
    cancel.type = save.type = "button";
    const finish = () => {
      organizing = false;
      input.disabled = false;
      filterBar.hidden = false;
      results.setAttribute("role", "listbox");
      refresh(); input.focus();
    };
    cancel.addEventListener("click", finish);
    editor.addEventListener("keydown", event => {
      if (event.key === "Escape" && !cancel.disabled) { event.preventDefault(); finish(); }
    });
    note.setAttribute("role", "status");
    actions.append(cancel, save);
    try {
      const draft = await send({ type: "PREPARE_ORGANIZATION" });
      if (!host.isConnected) return;
      editor.append(make("div", "editor-title", "Save to Other Bookmarks → LocalTab"));
      note.textContent = `${draft.skipped} tabs skipped (unsupported, duplicate, or already saved URLs).`;
      editor.append(note);
      const controls = [];
      for (const folder of draft.folders) {
        const section = make("div", "folder");
        const head = make("div", "folder-head");
        const checked = make("input"); checked.type = "checkbox"; checked.checked = true;
        checked.setAttribute("aria-label", `Save folder ${folder.name}`);
        const name = make("input"); name.type = "text"; name.value = folder.name; name.maxLength = 120;
        name.setAttribute("aria-label", "Folder name");
        head.append(checked, name);
        const details = make("details");
        details.append(make("summary", "", `${folder.items.length} bookmarks — review titles`));
        const items = folder.items.map(item => {
          const row = make("div", "bookmark-preview");
          const title = make("input"); title.type = "text"; title.value = item.title; title.maxLength = 300;
          title.setAttribute("aria-label", "Bookmark title");
          const original = make("span", "subtitle", `Original: ${item.originalTitle}`); original.title = item.originalTitle;
          const url = make("span", "subtitle", item.url); url.title = item.url;
          row.append(title, original, url); details.append(row);
          return { id: item.id, title, row };
        });
        section.append(head, details); editor.append(section);
        controls.push({ id: folder.id, checked, name, items, section });
      }
      const validate = () => {
        const selected = controls.filter(folder => folder.checked.checked);
        save.disabled = !selected.length || selected.some(folder => !folder.name.value.trim() || folder.items.some(item => !item.title.value.trim()));
      };
      editor.addEventListener("input", validate);
      editor.append(actions);
      results.replaceChildren(editor);
      if (!draft.folders.length) note.textContent += " No new bookmarks to save.";
      validate();
      save.addEventListener("click", async () => {
        const folders = controls.filter(folder => folder.checked.checked).map(folder => ({
          id: folder.id, name: folder.name.value, items: folder.items.map(item => ({ id: item.id, title: item.title.value })),
        }));
        for (const control of editor.querySelectorAll("input, button")) control.disabled = true;
        try {
          const outcome = await send({ type: "COMMIT_ORGANIZATION", draftId: draft.id, folders });
          note.textContent = `${outcome.saved} saved, ${outcome.skipped} already saved, ${outcome.failed.length} failed.`;
          if (outcome.failed.length) {
            const failures = new Set(outcome.failed.map(item => item.id));
            note.textContent += "\n" + [...new Set(outcome.failed.map(item => item.error))].join("\n");
            for (const folder of controls) {
              folder.checked.checked = folder.items.some(item => failures.has(item.id));
              folder.section.hidden = !folder.checked.checked;
              for (const item of folder.items) item.row.hidden = !failures.has(item.id);
            }
            save.textContent = "Retry failed bookmarks";
            for (const control of editor.querySelectorAll("input, button")) control.disabled = false;
            validate();
          } else { save.hidden = true; cancel.textContent = "Done"; cancel.disabled = false; }
        } catch (error) {
          note.textContent = error.message;
          for (const control of editor.querySelectorAll("input, button")) control.disabled = false;
          validate();
        }
      });
      cancel.focus();
    } catch (error) {
      note.textContent = error.message; save.hidden = true;
      editor.append(note, actions); results.replaceChildren(editor); cancel.focus();
    }
  };
  organize.addEventListener("click", startOrganization);

  const render = items => {
    results.replaceChildren();
    if (!items.length) {
      results.append(make("div", "empty", input.value.trim() ? "No local matches." : "Start typing to search."));
      return;
    }
    let currentSection = "";
    items.forEach((item, index) => {
      if (item.section !== currentSection) {
        currentSection = item.section;
        results.append(make("div", "section", sectionFor(item.section)));
      }
      const row = make("div", `result${index === selectedIndex ? " selected" : ""}`);
      row.setAttribute("role", "option");
      row.tabIndex = -1;
      const glyph = make("span", "glyph", iconFor(item));
      const copy = make("span", "copy");
      copy.append(make("span", "title", item.label), make("span", "subtitle", item.subtitle || ""));
      row.append(glyph, copy);
      if (item.kind === "tab") {
        const alias = make("button", "alias", "✎");
        alias.type = "button";
        alias.title = "Edit LocalTab-only alias";
        alias.addEventListener("click", event => {
          event.stopPropagation();
          startAliasEditor(item);
        });
        row.append(alias);
      }
      row.addEventListener("mouseenter", () => { selectedIndex = index; updateSelection(); });
      row.addEventListener("click", () => runResult(item));
      results.append(row);
    });
  };

  async function refresh() {
    if (organizing) return;
    const sequence = ++refreshSequence;
    try {
      const items = await send({ type: "GET_INDEX", query: input.value, filter: activeFilter });
      if (sequence !== refreshSequence) return;
      visibleResults = items;
      selectedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));
      render(items);
    } catch (error) {
      if (sequence === refreshSequence) showError(error);
    }
  }

  input.addEventListener("input", () => { selectedIndex = 0; refresh(); });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = visibleResults.length ? (selectedIndex + 1) % visibleResults.length : 0;
      updateSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = visibleResults.length ? (selectedIndex - 1 + visibleResults.length) % visibleResults.length : 0;
      updateSelection();
    } else if (event.key === "Enter" && visibleResults[selectedIndex]) {
      event.preventDefault();
      runResult(visibleResults[selectedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAfterEscape = true;
    }
  });
  if (mode === "overlay") {
    backdrop.addEventListener("mousedown", event => { if (event.target === backdrop) close(); });
  } else {
    send({ type: "POPUP_READY" }).catch(() => {});
  }
  refresh();
  input.focus();
}
