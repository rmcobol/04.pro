# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A todo list app built with plain HTML/CSS/JavaScript — no framework, no bundler, no package manager. Three files: `index.html`, `style.css`, `app.js`.

## Development

There is no build step. Open `index.html` directly in a browser to run the app, or serve the directory with any static file server (e.g. `npx serve .`) if `file://` restrictions cause issues. There are no lint or test commands configured.

## Architecture

`app.js` follows a single-source-of-truth + full re-render pattern:

- All state lives in module-level variables: `todos` (array of `{id, text, category, completed, createdAt}`), `nextId`, `currentFilter`, `editingId`, `deleteConfirmId`.
- `render()` is the only function that touches the DOM for the list/progress bar. It rebuilds `#todo-list` from `todos` (filtered by `currentFilter`) and recomputes the progress bar/text from scratch every time. There is no diffing or reactivity — **any state mutation must be followed by an explicit `render()` call** or the UI will be stale.
- Per-item UI state (edit mode, delete confirmation) is tracked globally via `editingId` / `deleteConfirmId` rather than per-DOM-node flags, since the whole list is torn down and rebuilt on every render.
- Events are handled via delegation on the `#todo-list` container (single `click`/`change`/`keydown` listener each), dispatching on `data-action` attributes (`edit`, `delete`, `confirm-delete`, `cancel-delete`, `save-edit`, `cancel-edit`) and `li.dataset.id`, rather than binding listeners to individual items.
- Categories (`업무`/`개인`/`공부`) are hardcoded in two places that must stay in sync: the `<select>` options in `index.html` (add form + inline edit template in `app.js`) and the `CATEGORIES` array in `app.js`. Category tag colors are keyed off `[data-category="..."]` attribute selectors in `style.css`.
- Delete uses a two-step confirm (click once to arm, click again to actually delete) rendered inline in place of the normal action buttons, rather than a browser `confirm()` dialog.
- Persistence: `todos` is saved to `localStorage` under the key `"todo-list"` via `saveTodos()`, called after every mutation (add, edit, delete, toggle). `loadTodos()` restores it on startup, before the first `render()`. `isStorageAvailable()` probes storage once at load with a throwaway write; if storage is unavailable or a read/write later throws (e.g. private browsing), `saveTodos()`/`loadTodos()` fail silently into in-memory-only mode and surface the `#storage-warning` banner instead of throwing.
- Auto-categorization: `CATEGORY_KEYWORDS` maps each category to a keyword list; `classifyCategory(text)` returns the first category (in `CATEGORIES` order) whose keyword appears in the text, or `null`. It runs on every `input` event on both the add form's `#todo-input` and, via delegation, any `.edit-input` in the list, live-updating the corresponding category `<select>`. Each form has its own "manually changed" flag (`categoryManuallyChanged` / `editCategoryManuallyChanged`) set on the select's `change` event — once set, auto-classification stops overriding that form until it's reset (input cleared, todo added, or a new edit session started), so it never fights a deliberate user choice.

## Layout

`style.css` is mobile-first: base styles target narrow viewports, with a `@media (min-width: 600px)` block switching the app from full-bleed to a centered card (max-width 640px, shadow, rounded corners).
