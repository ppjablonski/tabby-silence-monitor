# Tabby Silence Monitor

Version **0.1.0** — targets **Tabby 1.0.238**, Windows 10/11, including a per-user
Scoop installation. Built entirely on Linux; Windows needs no Node.js, npm,
compiler, or dependency installation.

Notifies once when a monitored terminal receives no output for **5 seconds**
after activity. Each terminal pane has an independent timer. New output resets
and rearms it. Local shells, WSL, SSH and nested SSH use the same output pipeline.
This detects output inactivity only; a notification does not mean a command has
finished or succeeded.

## Install on Windows

1. Obtain `release/tabby-silence-monitor-0.1.0-windows.zip` from this build.
   Optionally compare its SHA-256 with the adjacent `.zip.sha256` file using
   PowerShell `Get-FileHash .\tabby-silence-monitor-0.1.0-windows.zip`.
2. In Tabby, go to **Settings > Plugins > Open Plugins Directory**. Use that
   actual directory: Scoop/portable installs can keep data outside `%APPDATA%`.
3. Completely quit Tabby, including any tray instance.
4. Extract the ZIP **inside the opened plugins directory**. The resulting layout
   must be:

   ```text
   <plugins directory>\
     node_modules\
       tabby-silence-monitor\
         package.json
         dist\index.js
         README.md
         PLAN.md
         WINDOWS-TESTS.md
         LICENSE
   ```

   The ZIP already includes `node_modules`; avoid adding another level. Do not copy only `dist`, extract into Scoop's
   application binaries, or run npm on Windows. Tabby's loader scans `plugins/node_modules` for child
   `tabby-*` package directories, reads the `tabby-plugin` keyword and loads `main`.
5. Start Tabby. Confirm **Silence Monitor** appears in Settings.
6. Right-click inside the desired terminal pane and enable **Monitor terminal
   silence**. Monitoring is off by default.

The artifact is verified on Linux for contents, module loading with host API
substitutes, and absence of bundled runtime dependencies. Installation and desktop
notification delivery on Windows remain subject to the manual checks below.

## Use and configure

- **Settings > Silence Monitor**: threshold from 1 to 3600 seconds; default 5.
- Enable **Automatically monitor newly initialized terminal panes** to monitor
  future panes. It does not change monitoring in existing panes.
- The terminal context-menu checkbox enables/disables only that pane. Enabling
  waits for the next output; disabling cancels the pending notification.
- After the first nonempty output chunk, every received chunk, including control
  sequences, resets the timer. Keyboard input alone does not reset it. Remote
  echo of typed characters is received output and does reset it.
- A desktop notification includes the terminal title and a pane number scoped to
  the current window. The standard tab activity marker is also requested.
- A continuous silence period produces one notification. Further output rearms
  monitoring. Reconnecting replaces the old session timer and waits for new output;
  the pane's enable/disable choice is preserved.
- Changing the threshold restarts pending timers from the settings change. It
  never starts a timer for an idle pane or rearms an already notified period.
  Reopening Tabby resets per-pane choices to the automatic-monitoring default.

## Uninstall or upgrade

Quit Tabby completely. Delete only `node_modules/tabby-silence-monitor`
inside the plugins directory, then restart Tabby. Upgrading uses the same procedure,
followed by extracting the new package. Optional: remove the `silenceMonitor`
section from Tabby's configuration after uninstalling; it otherwise stays inert.

## Limitations

- Compatibility was researched against the exact **v1.0.238** source tag. Other
  Tabby versions are unverified. Its Angular 15/RxJS 7 and Tabby modules must be
  supplied by the host; none are bundled or separately installed on Windows.
- Public terminal decorators attach when the frontend initializes. A pane never
  shown may not yet be monitored; bytes before attachment cannot be observed.
  Once attached, switching panes/tabs does not stop monitoring.
- Nested SSH is part of the enclosing PTY: it has one timer, not a separate timer
  for each nested connection. Periodic received output prevents a silence alert.
- Tabby's public activity marker is shared with ordinary output activity. Its
  visibility, especially on focused panes and split headers, depends on Tabby.
- Windows notification permissions, Do Not Disturb/Focus Assist, and Tabby's OS
  notification registration can affect delivery. There is no retry or duplicate
  fallback notification; the activity marker is still requested.
- Timers follow Electron's event loop. Sleep, suspension or a blocked renderer
  can delay notification delivery. Output from after resume rearms normally.
- No terminal contents are logged, stored or transmitted. Notifications do show
  terminal titles in the desktop notification system. There is no runtime network
  communication, command parsing, process inspection or native code.
- **Windows integration has not been tested here.** See [WINDOWS-TESTS.md](WINDOWS-TESTS.md).

## Develop on Linux

Requires Node.js 18.20+ and npm, Python 3 for ZIP creation. No native build toolchain.

```sh
npm ci
npm test
npm run package
```

The lockfile pins all development dependencies. `.npmrc` skips dependency install
scripts and legacy peer resolution avoids pulling unrelated Tabby peer packages.
Angular and Tabby dependencies are for host API typechecking only; webpack keeps
the runtime imports external. `npm run build` typechecks and produces a production
CommonJS bundle. `npm run package` builds, creates the ZIP and SHA-256 checksum,
checks its exact contents, extracts it into a temporary directory and smoke-loads
its entry point with simulated host APIs. No npm or GitHub publishing occurs.

Tests use deterministic timers, the actual v1.0.238 middleware-stack source as a
test-only MIT fixture, RxJS 7, and host substitutes for Angular/Tabby UI services.
They do not run Electron or prove Windows notification delivery. See
[PLAN.md](PLAN.md) for source links, API decisions and dependency audit limitations.
