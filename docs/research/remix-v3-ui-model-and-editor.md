# Remix v3 UI model and rebuilding the resume editor without `@lexical/react`

Research for issue #177 (map #174; feeds #181 and #184). Researched 2026-10-12 against
primary sources only: remix.run guides/API/blog, the `remix-run/remix` repository,
lexical.dev docs, the `facebook/lexical` repository, tailwindcss.com docs, plus bun.sh,
react.dev and the Zod release notes where a claim belonged to those projects. Every claim
is cited; things that could not be confirmed are listed at the end.

Versions checked: `remix@3.0.0` (GitHub release tag published 2026-10-01, alongside
`component@1.0.0`, `assets@1.0.0`, `data-schema@1.0.0`, `test@1.0.0`, `spa@1.0.0`;
`@remix-run/ui` is at `ui@0.12.1`) — https://github.com/remix-run/remix/releases.
Lexical `v0.52.0` (published 2026-09-28) — https://github.com/facebook/lexical/releases.
SCC today pins `lexical`/`@lexical/react`/`@lexical/rich-text` `^0.25.0`, `react-router`
`^8.0.1`, `zod` `^3.25.76`, `tailwindcss` `^4.3.1` (`packages/frontend/package.json`).

## Summary

1. **Component model.** A Remix v3 component is a setup function that receives a `handle`
   and returns a render function; state is plain variables in setup scope; nothing re-renders
   until `handle.update()`; events attach through the `mix` prop with `on(type, handler)`;
   `ref((node, signal) => ...)` runs once when the element is inserted and gives an
   `AbortSignal` that fires on removal; `handle.queueTask` runs after commit; `handle.signal`
   aborts on disconnect. Mounting a third-party DOM library is `ref()` + abort-signal cleanup
   (or a `createMixin` with `insert`/`remove` events). JSX is configured with
   `jsxImportSource: "remix/component"`. The runtime is Shopify-licensed and carries a
   "Adapted from Preact" header only in its DOM typings; the blog says it "starts from a fork
   of Preact", but the published package has no `preact` dependency.
2. **Lexical without `@lexical/react`: yes.** `lexical`, `@lexical/rich-text`,
   `@lexical/history`, `@lexical/utils`, `@lexical/html`, `@lexical/extension`,
   `@lexical/selection`, `@lexical/clipboard` and `@lexical/tailwind` declare no React
   dependency; only `@lexical/react` and `@lexical/devtools-core` peer-depend on React. The
   framework-free path is `createEditor({ namespace, theme, nodes, onError })` +
   `editor.setRootElement(contenteditable)` + `registerRichText(editor)` +
   `registerHistory(editor, createEmptyHistoryState(), delay)` (or the newer
   `buildEditorFromExtensions` API). SCC's `theme.ts` and `CustomParagraphNode` plug in
   unchanged. (Note: Lexical's own word "headless" means *no DOM at all*, which is not what
   SCC needs.)
3. **Alternatives.** The PDF/DOCX formatters need *nothing* from the editor: `exportToPDF`
   and `exportToWord` ignore their `_editor` argument and build output from `User`. So the
   cheapest port is a read-only preview component plus the two export buttons; rich editing
   (Lexical vanilla, or plain `contenteditable`) only matters once edits are meant to
   round-trip into exports, which requires a shared document model first.
4. **Forms and validation.** Remix v3 uses native `<form method="post">`, the
   `formData()` middleware (`context.formData`), and `remix/data-schema`'s
   `parseSafe(schema, formData)`; `parse`/`parseSafe` accept any Standard Schema v1 schema,
   which Zod has implemented since 3.24.0, so SCC's Zod schemas plug in. Field errors flow
   back as `issues: { message, path? }[]` rendered with
   `context.render(<Page issues={...} />, { status: 400 })` — the direct analogue of
   `data({ errors }, { status: 400 })`; `FormErrors` is a one-line fold over `issue.path[0]`.
5. **Tailwind 4.** Remix v3 is bundlerless (dev is `node --watch --import remix/node-tsx
   server.ts`; the asset server compiles TS/JS/CSS with oxc + lightningcss and exposes no
   PostCSS/Vite hook; the word "tailwind" does not occur in the Remix repo). Tailwind must be
   built separately with `@tailwindcss/cli -i ... -o ... --watch` into an `app/**/public/**`
   CSS file that the asset server serves via `getHref()`. Remix's `css()` rules live in an
   `rmx` cascade layer, so layer order against Tailwind's layers has to be declared.
6. **Testing.** First-party is `remix/test` (own runner, `remix test`) with
   `render()` from `remix/component/test`, which mounts into a real `document` and is
   documented as in-browser (Playwright). For `bun test`, the drop-in replacement for
   `renderToStaticMarkup` is `renderToString(node)` from `remix/component/server` (returns
   `Promise<string>`); DOM-level `render()` under `bun test` would need happy-dom and is
   unverified.

Issue #171 (experience-entry focus loss) is a React keyed-reconciliation bug, not an editor
bug: the textarea row is keyed by its own current value (`key={experience}`), so every
keystroke changes the key and React recreates the DOM node. Details in section 7.

## 1. Remix v3 component authoring

### Components, state, updates

- "A component is a function that receives a `handle` and returns another function that
  renders JSX. The outer function is setup: it runs once when the component is created, so
  normal JavaScript variables declared there can hold local state. The returned function is
  render: it runs on the first render and every update afterward."
  — https://guides.remix.run/start-here.md
- "Updates are explicit: changing a variable does not render anything until the component
  requests an update." `handle.props` is a stable object whose values are replaced before
  each render; destructuring in setup captures only the initial value.
  — https://guides.remix.run/rendering-ui.md
- `handle.update()` returns a promise that resolves to an `AbortSignal`; calling it during
  setup warns and is skipped, calling it during render throws.
  — https://guides.remix.run/interactivity.md,
  https://github.com/remix-run/remix/blob/main/packages/component/docs/handle.md
- Canonical counter (verbatim from the interactivity guide):

  ```tsx
  import { on } from "remix/component";
  import type { Handle } from "remix/component";

  function Counter(handle: Handle<{ initialCount: number }>) {
    let count = handle.props.initialCount;

    return () => (
      <button
        mix={on("click", () => {
          count++;
          handle.update();
        })}
        type="button"
      >
        Count: {count}
      </button>
    );
  }
  ```
  — https://guides.remix.run/interactivity.md

- Other handle members: `handle.queueTask(task)` runs during the commit after the next
  update (task receives a signal that aborts on re-render or disconnect); `handle.signal`
  aborts when the component is disconnected; `handle.id` is a stable per-instance id for
  `htmlFor`/ARIA; `handle.context.set/get`; `handle.frames.top` / `handle.frames.get(name)`.
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/handle.md
- Keys: "Matching keys let Remix move existing DOM and component instances instead of
  pairing state with the wrong item." Use stable ids, not indexes or render-time randoms.
  — https://guides.remix.run/interactivity.md

### Events

- Events attach through the `mix` prop: `on(type, handler)`. The handler receives
  `(event, signal)`; the signal "is aborted when handler is re-entered or component removed".
  `mix` accepts a single mixin or an array (`mix={[counterStyles, on("click", ...)]}`).
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/events.md,
  https://guides.remix.run/rendering-ui.md
- Core mixins exported from `remix/component`: `on`, `ref`, `attrs`, `link`, `css`, plus
  `createMixin`, `createRoot`, `clientEntry`, `run`, `Frame`, `Fragment`,
  `TypedEventTarget`, `navigate`, `unsafeHTML`.
  — https://github.com/remix-run/remix/blob/main/packages/component/src/index.ts
- Global listeners (`window`, `document`): schedule in `handle.queueTask()` and pass
  `{ signal: handle.signal }` to `addEventListener`.
  — https://guides.remix.run/interactivity.md

### Lifecycle and DOM references (the `ref` + effect equivalent)

- "`ref(...)` receives the inserted DOM node and a signal that aborts when that node is
  removed. Tie observers and element-owned listeners to that signal" and "The ref callback
  runs when the element is inserted, not on every component update." Verbatim example:

  ```tsx
  import { ref } from "remix/component";
  import type { Handle } from "remix/component";

  function MeasuredPanel(handle: Handle) {
    let width = 0;

    return () => (
      <div
        mix={ref((node, signal) => {
          let observer = new ResizeObserver((entries) => {
            let entry = entries[0];
            if (!entry) return;
            width = Math.round(entry.contentRect.width);
            handle.update();
          });

          observer.observe(node);
          signal.addEventListener("abort", () => observer.disconnect());
        })}
      >
        Panel width: {width}px
      </div>
    );
  }
  ```
  — https://guides.remix.run/interactivity.md
- For richer lifecycle, `createMixin` exposes `handle.addEventListener` for `insert`,
  `beforeUpdate`, `commit`, `beforeRemove` (with `event.persistNode(cb)` to defer removal),
  `reclaimed`, and `remove`; mixin setup also runs during SSR, "so DOM access belongs in
  lifecycle listeners or queued tasks". `MixinHandle` has `element`, `update()`,
  `queueTask()`, `signal`, `context`, `frame`, `id`.
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/mixins.md
- Third-party SDK pattern: initialise once in setup scope, tear down via
  `handle.signal.addEventListener('abort', ...)`. Focus after a render:
  `await handle.update(); input.focus()`.
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/patterns.md,
  https://guides.remix.run/interactivity.md
- Controlled vs uncontrolled inputs: "Only control an input's value when something besides
  the user's interaction with that input can also control its state."
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/patterns.md

### Mounting, hydration, client-only roots

- `clientEntry(import.meta.url, Component)` marks the smallest interactive component; its
  props must be serialisable (no functions or class instances). `run({ loadModule })` boots
  the browser runtime and hydrates entries; `await app.ready()`.
  — https://guides.remix.run/interactivity.md,
  https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md
- Client-only mount (verbatim): `let root = createRoot(container); root.render(<SupportWidget />);`
  with `root.flush()` and `root.dispose()`.
  — https://guides.remix.run/interactivity.md
- SPA mode (relevant because SCC runs `ssr: false`): `remix/spa` exports `render()`
  middleware and `run(router, { fallback })`; route handlers return `render(<h1>Home</h1>)`;
  "the router remains an ordinary fetch router".
  — https://github.com/remix-run/remix/blob/main/packages/spa/README.md
- Protecting client-owned DOM across **frame reloads** only: `data-rmx-preserve-dom` (keeps
  the element's current attributes and children; "Initial rendering and hydration are
  unchanged") and `data-rmx-preserve-attrs`. Example in README is a third-party
  `<pagefind-ui data-rmx-key="search" data-rmx-preserve-dom>`.
  — https://github.com/remix-run/remix/blob/main/packages/component/README.md,
  https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md

### JSX and build configuration

- The official template's `tsconfig.json` uses `"jsx": "react-jsx"` and
  `"jsxImportSource": "remix/component"`; `remix` exports `./component/jsx-runtime` and
  `./component/jsx-dev-runtime`.
  — https://github.com/remix-run/remix/blob/main/template/tsconfig.json,
  https://github.com/remix-run/remix/blob/main/packages/remix/package.json
- Host props accept both `class` and `className` (`HostProps` in
  `packages/component/src/runtime/dom.ts`, lines ~1206-1208), so Tailwind class strings
  carry over.
  — https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/dom.ts
- Dev/start scripts in the template: `"dev": "NODE_ENV=development node --watch --import
  remix/node-tsx server.ts"`, `"start": "... node --import remix/node-tsx server.ts"`,
  `"test": "NODE_ENV=test remix test"`; engines `node >= 24.3.0`; the only runtime
  dependency is `remix`.
  — https://github.com/remix-run/remix/blob/main/template/package.json

### Relation to React / Preact

- "no critical dependencies, not even React" and the component model "starts from a fork of
  Preact" (blog, 2025-05-28). — https://remix.run/blog/wake-up-remix
- In the shipped package: `@remix-run/component` has a single dependency
  (`@types/dom-navigation`) and no `preact`/`react`; the LICENSE is MIT, Shopify Inc.; the
  only Preact attribution found by code search is the header of `src/runtime/dom.ts`
  ("Adapted from Preact: ... src/dom.d.ts"), i.e. the DOM prop typings.
  — https://github.com/remix-run/remix/blob/main/packages/component/package.json,
  https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/dom.ts
- Release status: RC on 2026-08-31 ("we are done adding features to Remix 3 before the
  official release"); `remix@3.0.0` tag published 2026-10-01.
  — https://remix.run/blog/remix-3-release-candidate,
  https://github.com/remix-run/remix/releases

## 2. Lexical without `@lexical/react`

### Terminology

Lexical's own "headless" (`@lexical/headless`) means an editor with *no DOM at all* for
servers and tests ("The DOM is only needed to show an editor on screen"; "An editor that has
no root element skips reconciliation and DOM selection entirely").
— https://lexical.dev/docs/concepts/headless,
https://lexical.dev/docs/packages/lexical-headless
What SCC needs is the *vanilla / framework-free* editor: a normal `LexicalEditor` attached to
a `contenteditable` with `setRootElement`. "The core is framework-agnostic, and
`@lexical/react` provides React bindings." — https://lexical.dev/docs/intro

### Which packages are React-bound

Checked `package.json` of each package on `facebook/lexical` `main` (v0.52.0):

| Package | React in `dependencies`/`peerDependencies`? | Source |
|---|---|---|
| `lexical` | No (`react` only in `keywords`) | https://github.com/facebook/lexical/blob/main/packages/lexical/package.json |
| `@lexical/rich-text` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-rich-text/package.json |
| `@lexical/history` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-history/package.json |
| `@lexical/utils` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-utils/package.json |
| `@lexical/html` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-html/package.json |
| `@lexical/extension` | No (depends on `@preact/signals-core`) | https://github.com/facebook/lexical/blob/main/packages/lexical-extension/package.json |
| `@lexical/selection`, `@lexical/clipboard` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-selection/package.json, https://github.com/facebook/lexical/blob/main/packages/lexical-clipboard/package.json |
| `@lexical/tailwind` | No | https://github.com/facebook/lexical/blob/main/packages/lexical-tailwind/package.json |
| `@lexical/react` | **Yes**: peer `react >=18.x`, `react-dom >=18.x` | https://github.com/facebook/lexical/blob/main/packages/lexical-react/package.json |
| `@lexical/devtools-core` | **Yes**: peer `react`, `react-dom` | https://github.com/facebook/lexical/blob/main/packages/lexical-devtools-core/package.json |

A GitHub code search for `"react"` in `package.json` files under `packages/` returned only
`lexical` (keywords), `lexical-yjs` (checked: no React dependency), `lexical-devtools-core`,
`lexical-playground`, `lexical-devtools`, `lexical-website`, `lexical-react`.

### The framework-free API

- `createEditor(editorConfig?: CreateEditorArgs): LexicalEditor` with
  `CreateEditorArgs { namespace?, nodes?, onError?, onWarn?, editable?, theme?: EditorThemeClasses, html?, editorState?, dom?, ... }`;
  `LexicalEditor.setRootElement(nextRootElement: null | HTMLElement)`,
  `registerUpdateListener`, `registerCommand`, `focus(callbackFn?, options?)`,
  `setEditable`.
  — https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEditor.ts
  (`createEditor` at ~line 987, `CreateEditorArgs` ~500, `setRootElement` ~1694,
  `focus` ~1967)
- `registerRichText(editor, ...)` and `HeadingNode`/`QuoteNode` live in
  `@lexical/rich-text`; `registerHistory(editor, historyState, delay, ...)`,
  `createEmptyHistoryState()` and `HistoryExtension` live in `@lexical/history`.
  — https://github.com/facebook/lexical/blob/main/packages/lexical-rich-text/src/index.ts,
  https://github.com/facebook/lexical/blob/main/packages/lexical-history/src/index.ts,
  https://lexical.dev/docs/packages/lexical-history
- Newer extension API (vanilla): `defineExtension({ dependencies: [RichTextExtension,
  ClipboardDOMImportExtension, configExtension(HistoryExtension, {delay: 300})], theme, ... })`,
  `buildEditorFromExtensions(AppExtension)`, then
  `editor.setRootElement(document.getElementById('lexical-editor'))`; `editor.dispose()`
  on teardown; "the same extensions work with or without React".
  — https://lexical.dev/docs/getting-started/quick-start,
  https://lexical.dev/docs/getting-started/creating-plugin
- Migration guide: "Generally speaking, the only thing that needs to change is how you create
  the editor"; the minimal-change vanilla example still calls `registerRichText` and
  `registerHistory`. — https://lexical.dev/docs/extensions/migration
- Theme: "passing a customizable theming object that maps CSS class names to the editor on
  creation" (vanilla: in the `createEditor()` config; extensions: on the root extension).
  `@lexical/tailwind` ships `TailwindExtension` which "Configures the lexical theme
  (EditorThemeClasses) with tailwind defaults" (e.g. `heading.h1: 'text-[24px] ...'`,
  `text.bold: 'font-bold'`).
  — https://lexical.dev/docs/getting-started/theming,
  https://lexical.dev/docs/api/modules/lexical_tailwind,
  https://github.com/facebook/lexical/blob/main/packages/lexical-tailwind/src/index.ts
- Custom paragraph: SCC's `CustomParagraphNode` is a `ParagraphNode` subclass registered
  *alongside* `ParagraphNode` (`nodes: [HeadingNode, CustomParagraphNode]`), which is exactly
  what `CreateEditorArgs.nodes` takes. If every paragraph should become the custom one, use
  node replacement (`{ replace: ParagraphNode, with: () => $createCustomParagraphNode(), withKlass: CustomParagraphNode }`).
  — https://lexical.dev/docs/concepts/node-replacement
- Export: `$generateHtmlFromNodes(editor, selection | null)` and
  `$generateNodesFromDOM(editor, dom)` in `@lexical/html` (need a DOM; in headless mode use
  JSDOM or `withDOM` from `@lexical/headless/dom`); `editorState.toJSON()` serialises the
  document tree. — https://lexical.dev/docs/packages/lexical-html,
  https://lexical.dev/docs/concepts/editor-state

### Mapping SCC's `Editor.tsx` to the framework-free API

`packages/frontend/app/components/Editor.tsx` uses seven `@lexical/react` pieces. Each has a
non-React equivalent:

| In `Editor.tsx` today | Framework-free equivalent |
|---|---|
| `<LexicalComposer initialConfig={{ namespace, theme, onError, nodes }}>` | `createEditor({ namespace, theme, onError, nodes })` (or `buildEditorFromExtensions`) in setup scope |
| `<ContentEditable aria-placeholder placeholder>` | `<div contenteditable="true" role="textbox" mix={ref((node, signal) => { editor.setRootElement(node); signal.addEventListener('abort', () => editor.setRootElement(null)) })} />` |
| `<RichTextPlugin ErrorBoundary={LexicalErrorBoundary}>` | `registerRichText(editor)` / `RichTextExtension`; `onError` in config |
| `<HistoryPlugin />` | `registerHistory(editor, createEmptyHistoryState(), 300)` / `HistoryExtension` |
| `<AutoFocusPlugin />` | `editor.focus()` after `setRootElement` |
| `UserDataPlugin` (`useEffect` → `editor.update(...)`) | `editor.update(() => populateEditorWithUserData($getRoot(), user))` right after creation |
| `EditorRefPlugin` (`editorRef.current = editor`) | the `editor` variable in setup scope |

`populateEditorWithUserData`, `theme.ts`, `CustomParagraphNode.ts` and the formatters have
no React import and need no change (verified by reading the files).

Remix-side cautions (from the Remix docs, not Lexical):

- Create the editor in setup scope, but only call `setRootElement`/`focus` inside `ref()` or
  `queueTask` — setup also runs on the server in SSR mode (`mixins.md`); in SCC's SPA mode
  (`ssr: false`) setup runs only in the browser (interactivity guide: "For a client-only
  root, setup already runs only in the browser").
- The host element must be keyed/stable and its children must never be described in JSX,
  because Lexical owns that subtree. There is no documented component-level "do not
  reconcile my children" flag: `data-rmx-preserve-dom` is documented only for frame
  reloads. See "Single biggest blocker".
- Asset serving: the template's `createAssetServer` has `allowPackages: ['remix']`, so
  `lexical`, `@lexical/*`, `docx`, `jspdf`, `file-saver`, `dompurify` would need adding to
  `allowPackages` for the bundlerless asset server to serve them.
  — https://github.com/remix-run/remix/blob/main/template/app/assets.ts,
  https://github.com/remix-run/remix/blob/main/packages/assets/README.md

## 3. Alternatives and what the formatters need

What the exporters actually consume (read from the repo):

- `exportToPDF(_editor, userData, ...)` and `exportToWord(_editor, userData)` in
  `packages/frontend/app/utils/editor/functions.ts` take the editor as `_editor` and never
  read it; `addUserInfo/addSummary/addSkills/addExperience/addEducation`
  (`utils/editor/pdf/addParts.ts`) and `generateDocxElements`
  (`utils/editor/word/addParts.ts`) take only `User`. The editor is populated one-way by
  `populateEditorWithUserData(root, user)`. Edits made in the editor today do not reach the
  PDF/DOCX. (Route: `packages/frontend/app/routes/builder/resume.tsx` passes `user` from
  `clientLoader`.)

Consequences and options:

| Option | What it needs | Notes |
|---|---|---|
| **A. Read-only preview + export buttons** (smallest port) | A Remix component that renders the same h1/h2/h3/p structure from `User` with the same Tailwind classes as `theme.ts` | Behaviour-equivalent to today for export; no editor library at all; unblocks the Remix migration independently of the editor question |
| **B. Lexical vanilla** (section 2) | `lexical`, `@lexical/rich-text`, `@lexical/history`, (`@lexical/extension`, `@lexical/clipboard`) | Keeps the existing nodes/theme; needs the DOM-ownership mitigation below; still does not feed exports until a document model exists |
| **C. Plain `contenteditable` + minimal toolbar** | `document.execCommand`-free approach would mean hand-rolling selection/formatting | Lexical is already the "plain contenteditable with correct selection handling"; rewriting that is more work than B, not less |
| **D. Textarea(s) + formatting at export** | Nothing new; data stays in `User` | The builder pages already *are* this (summary textarea, experience textareas); the resume page then becomes Option A |

If editing must round-trip into exports: define a small block model (sections of
`{ type: 'h1'|'h2'|'h3'|'p', text, align?, bullet? }`) and derive both `populateEditorWithUserData`
and the two formatters from it; the editor side can produce it from `editor.getEditorState().toJSON()`
(https://lexical.dev/docs/concepts/editor-state) or `$generateHtmlFromNodes`
(https://lexical.dev/docs/packages/lexical-html). That model is a prerequisite for B, C or D
to be more than cosmetic.

## 4. Forms and validation

- Forms are native: `<form method="post" action={routes.albums.edit.action.href(...)}>`;
  the router registers `formData()` from `remix/middleware/form-data`, which exposes
  `context.formData` to controller actions. Routes are `createController(routes.x, { actions })`.
  — https://guides.remix.run/data-and-validation.md,
  https://guides.remix.run/forms-and-mutations.md
- Validation: `remix/data-schema` (`f.object({ title: f.field(albumText) })`,
  `f.fields(...)` for repeated names, `s.parseSafe(schema, context.formData)` → `{ success, value }`
  or `{ success: false, issues }`, each issue `{ message, path? }`). "Standard Schema v1
  compatible"; "`parse` and `parseSafe` accept any Standard Schema v1 schema" — Zod,
  Valibot, ArkType are named.
  — https://github.com/remix-run/remix/blob/main/packages/data-schema/README.md,
  https://guides.remix.run/data-and-validation.md
- Zod: v3.24.0 "is the first version of Zod to implement the Standard Schema spec"; SCC's
  `zod ^3.25.76` therefore qualifies. — https://github.com/colinhacks/zod/releases/tag/v3.24.0,
  https://zod.dev/library-authors
- Error flow (verbatim, forms guide):

  ```tsx
  async action(context) {
    let parsed = s.parseSafe(albumForm, context.formData);
    if (!parsed.success) {
      // ...
      return context.render(
        <AlbumEditPage album={album} values={values} issues={parsed.issues} />,
        { status: 400 },
      );
    }
    // ...
    return redirect(routes.albums.show.href({ albumId: context.params.albumId }), 303);
  }
  ```
  and in the page: `let issue = issues.find((issue) => issue.path?.[0] === name);` rendered as
  `{issue && <p id={errorId}>{issue.message}</p>}` with `aria-invalid`/`aria-describedby`.
  "The failure branch renders directly with status `400`."
  — https://guides.remix.run/forms-and-mutations.md
- Mapping to SCC: today `clientAction` returns `data({ errors: error.flatten().fieldErrors as FormErrors }, { status: 400 })`
  and views read `useActionData().errors` (`routes/builder/summary.tsx`,
  `routes/builder/experienceEntry.tsx`; `FormErrors = { [key: string]: string[] | undefined }`
  in `components/Input.tsx`). In Remix v3 the same shape is one fold:
  `issues.reduce((acc, i) => { const k = String(i.path?.[0] ?? '_form'); (acc[k] ??= []).push(i.message); return acc }, {} as FormErrors)`,
  passed as a prop to the page via `context.render(..., { status: 400 })` — no hook, no
  `useActionData`. The dynamic `experience-${index}` fields map to `f.fields(...)`.
- Browser-runtime behaviour: "Remix handles the form submission as a navigation. It renders
  validation responses into the page and follows redirects after a successful save"; for
  pending UI, listen to the frame's `reloadStart`/`reloadComplete` with `handle.signal`, or
  intercept with `fetch()` + `navigate(...)` when inline error UI is needed.
  — https://guides.remix.run/forms-and-mutations.md, https://guides.remix.run/interactivity.md

## 5. Styling: Tailwind 4 with Remix v3's build/dev story

Remix side:

- "Remix APIs do not depend on bundlers, type generation, or static analysis"; the guide
  calls it a "bundlerless setup". — https://guides.remix.run/start-here.md
- Dev is `node --watch --import remix/node-tsx server.ts` (template `package.json`); the
  asset server "compiles browser scripts and styles on demand", rewrites relative CSS
  `@import`/`url()`, supports HMR, `target` lowering, `scripts.loaders` (JavaScript only) and
  `files.transforms` (leaf files; "CSS is excluded from `files.extensions`"). No PostCSS, Vite
  or Tailwind hook is documented.
  — https://github.com/remix-run/remix/blob/main/template/package.json,
  https://github.com/remix-run/remix/blob/main/packages/assets/README.md
- Its CSS tooling dependency is `lightningcss ^1.32.0` (plus oxc for JS); no `postcss`,
  no `esbuild`. — https://github.com/remix-run/remix/blob/main/packages/assets/package.json
- A GitHub code search for `tailwind` in `remix-run/remix` returns 0 results.
- Global stylesheets go in the `Document`'s explicit `<head>`; "Use `getHref()` for styles and
  files"; files must match `allowFiles` (template: `['app/routes.ts', 'app/**/public/**']`).
  — https://guides.remix.run/rendering-ui.md, https://guides.remix.run/files-and-assets.md,
  https://github.com/remix-run/remix/blob/main/template/app/assets.ts
- Cascade layers: "Generated `css(...)` rules are emitted in native CSS cascade layers under
  the stable parent layer `rmx`"; "Unlayered author CSS outranks normal layered CSS"; the
  guide's app declares `@layer base, rmx, app;`.
  — https://github.com/remix-run/remix/blob/main/packages/component/docs/styling.md,
  https://guides.remix.run/rendering-ui.md

Tailwind side:

- Install options are exactly: Using Vite, Using PostCSS, Tailwind CLI, Framework Guides,
  Play CDN; "if your framework isn't listed, you can use the Tailwind CLI, the Vite plugin,
  or the PostCSS plugin instead". Remix is not in the framework list (React Router is).
  — https://tailwindcss.com/docs/installation/framework-guides
- CLI: `npm install tailwindcss @tailwindcss/cli`; `@import "tailwindcss";`;
  `npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch`; "Tailwind CSS works
  by scanning all of your HTML files, JavaScript components, and any other templates for
  class names, generating the corresponding styles and then writing them to a static CSS
  file." — https://tailwindcss.com/docs/installation/tailwind-cli
- Vite plugin (what SCC uses now via `@tailwindcss/vite` in `vite.config.ts`) and PostCSS
  plugin both presuppose a bundler/PostCSS pipeline Remix v3 does not run.
  — https://tailwindcss.com/docs/installation/using-vite,
  https://tailwindcss.com/docs/installation/using-postcss

Conclusion: Tailwind 4 works *beside* Remix v3, not *inside* its dev story. Run
`@tailwindcss/cli --watch` as a second process writing to e.g. `app/actions/public/app.css`,
link it from the `Document` head via `assets.getHref(...)`, and declare layer order so
utilities beat `rmx` where intended. `theme.ts`'s class strings are scanned like any source
file. Unverified: whether a `<link rel="stylesheet">` through `getHref()` is the intended
mechanism (the README has no stylesheet example) and how Tailwind's own `@layer theme, base,
components, utilities` interacts with `rmx`.

## 6. Testing components in Remix v3

- `remix/test`: "A test framework for JavaScript and TypeScript projects" with its own runner
  (`remix test`, `runRemixTest()` from `remix/test/cli`), `describe/it`, hooks, `t.mock`,
  `t.useFakeTimers()`, `t.serve` (Playwright E2E) and "In-browser component testing, paired
  with `render` from `remix/component/test`". The README does not mention Bun, Vitest or
  `node:test` as hosts. Verbatim component test:

  ```tsx
  import * as assert from 'remix/assert'
  import { describe, it } from 'remix/test'
  import { render } from 'remix/component/test'
  import { Counter } from './counter.tsx'

  describe('Counter', () => {
    it('increments on click', async (t) => {
      let { $, act, cleanup } = render(<Counter />)
      t.after(cleanup)

      assert.equal($('[data-count]')?.textContent, '0')
      await act(() => $('[data-action="increment"]')?.click())
      assert.equal($('[data-count]')?.textContent, '1')
    })
  })
  ```
  — https://github.com/remix-run/remix/blob/main/packages/test/README.md
- `render(node, opts)` in `packages/component/src/runtime/render.ts` creates a `div` with
  `document.createElement`, appends it to `document.body`, and returns
  `{ container, $, $$, act, cleanup }`; it needs a `document`.
  — https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/render.ts
- String rendering: `export async function renderToString(node: RemixNode): Promise<string>`
  and `renderToStream(...)` in `remix/component/server`.
  — https://github.com/remix-run/remix/blob/main/packages/component/src/server/stream.ts
  (line ~1793), export map in https://github.com/remix-run/remix/blob/main/packages/remix/package.json
- Mapping to SCC: `components/ButtonLink.test.tsx` uses `renderToStaticMarkup(<MemoryRouter>...)`
  under `bun:test`. The like-for-like replacement is `await renderToString(<ButtonLink .../>)`
  (no router wrapper needed unless the component calls `link(...)`). For DOM/interaction tests
  under `bun test`, Bun documents happy-dom via `@happy-dom/global-registrator` preloaded in
  `bunfig.toml` (`[test] preload = ["./happydom.ts"]`), after which `document` exists
  — https://bun.sh/docs/test/dom — but whether `remix/component/test`'s `render` works under
  happy-dom (vs. the documented Playwright browser) is unverified.

## 7. Issue #171: cursor focus loss on `/experience-entry`

`packages/frontend/app/routes/builder/experienceEntry.tsx` renders each editable row as

```tsx
userExperience.map((experience, index) => (
  <div key={experience} className="flex items-center gap-2 mb-2">
    ...
    <textarea name={`experience-${index}`} value={experience}
      onChange={(e) => { const n = [...userExperience]; n[index] = e.target.value; setUserExperience(n); }} />
  </div>
))
```

The row's `key` is the textarea's own value, so every keystroke changes the key. React's
documented behaviour: "when that `key` changes, React will re-create the ... DOM node from
scratch" and "React will also re-create the DOM elements instead of reusing them"
— https://react.dev/learn/preserving-and-resetting-state. The new textarea is not focused,
which is exactly the reported "cursor loses focus and I have to keep clicking". This page
does not use Lexical at all (only `components/Editor.tsx` and `routes/builder/resume.tsx`
import it), so #171 is a React keyed-reconciliation bug; the fix is a stable key (index or an
id). The same rule applies in Remix v3 ("Use a stable ID, not an array index that changes ...
or a random value created during render" — https://guides.remix.run/interactivity.md), so the
port must not carry the pattern over.

## Single biggest blocker for the editor

**DOM ownership of the `contenteditable` subtree inside Remix's reconciler.** Lexical is not
the blocker: `lexical`, `@lexical/rich-text`, `@lexical/history`, `@lexical/utils` (and the
rest of the table in section 2) are React-free, `createEditor` + `setRootElement` +
`registerRichText`/`registerHistory` is a documented API, and SCC's theme, custom node and
populate function carry over unchanged. The blocker is on the Remix side: Lexical mutates the
children of its root element on every edit, Remix re-runs a component's render function on
every `handle.update()` and reconciles the host elements it rendered, and the only documented
"leave my live DOM alone" mechanism (`data-rmx-preserve-dom`) is specified for frame reloads,
not for ordinary component updates
(https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md). Nothing in
the component docs states what the reconciler does with foreign children of a host element it
rendered with no children.

Mitigation that stays inside documented behaviour: render a wrapper `<div mix={ref((node, signal) => ...)} />`,
create the actual `contenteditable` element imperatively inside the ref callback
(`node.appendChild(document.createElement('div'))`), hand *that* element to
`editor.setRootElement`, and tear down on `signal` abort. The wrapper is the only thing Remix
knows about, keep it keyed and prop-stable, and keep toolbar/export state in a sibling
component so the editor's component never needs `handle.update()`. Validate this with a
spike before committing to Option B; if it fails, fall back to Option A (read-only preview),
which is export-equivalent today.

## Open questions / unverified

- Whether Remix's reconciler preserves or clears children that a third-party library
  inserted under a host element that was rendered childless, across `handle.update()`.
  Not stated in any Remix doc read; the mitigation above avoids the question but is untested.
- Whether `remix/component/test`'s `render()` runs under `bun test` + happy-dom. Docs call it
  "in-browser" (Playwright). `renderToString` is the safe string-level replacement.
- Whether `renderToString` from `remix/component/server` requires any DOM globals (it is the
  SSR path, so presumably not, but not confirmed by a statement).
- How the unbundled asset server handles large CJS-style browser packages (`jspdf`, `docx`,
  `file-saver`) via `allowPackages`/import maps. The RC post says npm packages are served, but
  no compatibility list exists.
- Exact Remix 3 stability guarantees post-3.0.0: the RC post says the team wants to begin
  "binding ourselves to SemVer"; no stable-release blog post was found on
  https://remix.run/blog as of 2026-10-12, only the `remix@3.0.0` GitHub release tag.
- Whether the extension API (`buildEditorFromExtensions`, `RichTextExtension`,
  `HistoryExtension`) exists in SCC's pinned Lexical 0.25.0; the migration guide gives no
  version. The `registerRichText`/`registerHistory`/`createEditor` path exists in both 0.52.0
  source and the pre-extension "Before" examples, so plan on that API unless Lexical is
  bumped.
- Whether the "forked Preact" origin is anything more than the DOM typings header: the
  published runtime has no `preact` dependency and no other attribution found by code search.
- Stylesheet linking via `assets.getHref()` and Tailwind-vs-`rmx` layer interaction (section 5).
- `@remix-run/ui` (0.12.x) is "unstable and versioned independently" and has no rich-text or
  form/field primitive (primitives: accordion, anchor, combobox, listbox, menu, popover,
  select, tabs, toggle) — https://github.com/remix-run/remix/blob/main/packages/ui/README.md.
