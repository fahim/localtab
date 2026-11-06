# LocalTab

LocalTab is a private, local-only Chrome command palette for switching tabs, searching bookmarks, opening trusted Chrome pages, and launching an explicit web search.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` directory in this repository.
4. Press `Command+K` on macOS or `Ctrl+Shift+K` elsewhere. You can change the shortcut at `chrome://extensions/shortcuts`.

Chrome 127 or newer is required. On ordinary web pages the shortcut opens an on-demand overlay. On restricted pages such as `chrome://settings`, LocalTab opens its isolated extension popup instead.

## Features

- Shows up to five recently used tabs before you type.
- Searches tabs across normal Chrome windows by title, alias, URL, or domain.
- Searches HTTP/HTTPS bookmarks.
- Opens an allowlisted set of Chrome destinations such as Settings, History, Downloads, and Extensions.
- Stores optional LocalTab-only aliases without changing a page title.
- Opens a direct HTTP/HTTPS URL or a Google search only when you select the visible web result.

## Privacy and security

Tab and bookmark searches happen inside the extension. LocalTab has no backend, analytics, AI provider, image service, remote assets, or automatic network requests. It requests temporary `activeTab` access only when you invoke it and has no persistent host permissions.

The `tabs` and `bookmarks` permissions are required for the features named above. Recent tab IDs and aliases are stored in `chrome.storage.local` in your Chrome profile. A normal web page cannot call the extension's privileged operations.

## Development

The extension uses dependency-free JavaScript ES modules and has no build step.

```sh
npm test
```

After changing extension code, click **Reload** for LocalTab on `chrome://extensions`.
