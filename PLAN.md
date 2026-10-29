# Tabby Silence Monitor plan

Target: Windows 10/11, Scoop Tabby **1.0.238**; build entirely on Linux.

1. Research and pin compatibility (complete). Inspect official v1.0.238
   (`54869e1`) and save-output/clippy examples. Record decisions below.
2. Implement a UI-independent five-second detector and deterministic tests.
3. Attach one raw-output middleware per session, clean up on close, destruction,
   replacement and decorator detach. Test lifecycle and byte preservation.
4. Add context-menu enable/disable, settings (1–3600 s; new-session default),
   native desktop notifications and the public activity marker.
5. Build production CommonJS bundle, verify standalone ZIP contents and module
   loading, document Windows installation and manual verification. Commit milestones.

## Technical decisions

- `TerminalDecorator` observes existing `tab.session` and `sessionChanged$` for
  each terminal leaf (split panes included). WSL is a local PTY; SSH uses the same
  BaseSession pipeline; nested SSH is output of its enclosing session.
- Unlike save-output, do not subscribe to `output$`: v1.0.238 buffers it until
  first display, OSC processing can consume bytes, and local echo can appear as
  output. Insert a synchronous pass-through `SessionMiddleware` with `unshift`
  before OSC/input processing; count only nonempty `feedFromSession` chunks.
  Preserve Buffer identity, never decode/store/log bytes. No monkey patches.
- `TerminalStreamProcessor` transforms data and can echo input; it is not an
  observer extension point. Do not instantiate or replace it.
- Own one event-driven timeout per enabled, active session; rearm on output,
  stop after one notification. Cancel on disable/close/destroy/replacement/detach.
- Use current `TabContextMenuItemProvider`; `TerminalContextMenuItemProvider`
  used by save-output is deprecated. Use explicit Angular injection tokens and
  Angular 15 decorators, with host Angular/RxJS/Tabby modules externalized.
- The tag still declares built-in package versions `1.0.231-nightly.0`; npm
  package numbers alone are not evidence of host compatibility. Typecheck with
  those published declarations and verify used interfaces against the exact tag.
- Use renderer `Notification` just as Tabby's built-in notification menu does;
  `NotificationsService` is an in-app toast service. Use `displayActivity()` for
  the standard activity marker, without clearing unrelated activity markers.
- ZIP contains `tabby-silence-monitor/package.json`, `dist/index.js`, and docs.
  Extract inside Settings > Plugins > Open Plugins Directory. Loader explicitly
  scans direct child `tabby-*` packages and reads keyword/main. No npm, native
  modules, runtime dependencies or install scripts required on Windows.

## Limitations to verify on Windows

Decorators attach only once a terminal frontend initializes. A never-shown pane
may not yet be monitored; no public pre-session creation observer was identified.
Initial output before attachment cannot be observed retroactively. Nested SSH
connections cannot be separately identified inside one PTY. Remote echo and
keepalives that produce terminal bytes count as output. OS notification policy,
Scoop data-directory behavior and pane marker rendering need Windows testing.

## Sources inspected

- https://github.com/Eugeny/tabby/blob/v1.0.238/HACKING.md
- https://github.com/Eugeny/tabby/blob/v1.0.238/tabby-terminal/src/session.ts
- https://github.com/Eugeny/tabby/blob/v1.0.238/tabby-terminal/src/api/middleware.ts
- https://github.com/Eugeny/tabby/blob/v1.0.238/tabby-terminal/src/api/baseTerminalTab.component.ts
- https://github.com/Eugeny/tabby/blob/v1.0.238/tabby-core/src/tabContextMenu.ts
- https://github.com/Eugeny/tabby/blob/v1.0.238/app/src/plugins.ts
- https://github.com/Eugeny/tabby-save-output (decorator, module, build metadata)
- https://github.com/Eugeny/tabby-clippy (decorator example)
