# Windows manual verification — 0.1.0 / Tabby 1.0.238

Status: **not run**. Record date, Windows version, Tabby version, artifact SHA-256,
actual plugin directory and pass/fail observations. Do not record terminal contents
or connection details in the repository.

## Install and controls

- Install the ZIP using README instructions on the Scoop installation without
  Node.js. Restart; confirm Settings > Silence Monitor and terminal context menu.
- With automatic monitoring off, new panes should not notify until enabled.
- Enable a pane, allow existing output to settle, wait over five seconds: one
  notification with the correct terminal title and pane number. Wait another
  15 seconds: no repeat. Check the tab/pane activity marker where visible.
- Generate output; disable within five seconds: no alert. Enable again: wait for
  fresh output before a new alert. Closing with a pending timer must not notify.
- Set threshold to 1 and 10 seconds; check timing. Reject 0, 3601 and blank input.
  Restore 5. Change while pending; timing restarts from that change.
- Turn automatic monitoring on. Open a new pane and check its checkbox. Existing
  disabled panes stay disabled. Turn automatic monitoring off and repeat.

## Session scenarios

Use an idle shell with no periodic status output. In a WSL/Linux remote shell,
`printf 'activity\n'; sleep 8` produces an alert after approximately five seconds;
the shell's later prompt is fresh output and can cause another alert five seconds
later. This is expected. To hold silence longer, use `sleep 30`.

1. **WSL:** enable monitoring in a WSL terminal, produce output, then leave it
   silent. Confirm one alert, unchanged terminal display, and normal typing.
2. **SSH:** repeat in a native Tabby SSH profile. Disconnect before timeout: no
   late alert. Reconnect; verify one new timer and no duplicates.
3. **Nested SSH/jump host:** connect normally to an authorized jump host and from
   there to another host using SSH. Repeat activity/silence. Verify the enclosing
   pane title identifies the notification. There is one timer for this PTY.
4. **Two split panes:** enable both. Produce output at least two seconds apart.
   Confirm independent notification times and pane numbers. Keep one active more
   frequently than five seconds: only the quiet pane alerts. Disable/close one;
   verify the other still works.
5. **Background tab:** initialize/show a monitored terminal, produce output and
   switch tabs before five seconds. Confirm desktop alert and background tab
   activity indication. Repeat with the Tabby window minimized. Separately check
   and record behavior for a never-shown terminal (documented limitation).
6. **Repeated cycles:** output, five seconds silence, 15 seconds more silence,
   output again; exactly one alert per cycle. Repeat at least three times. ANSI
   control-only output must reset the timer. Continuous output must not alert.

## Input, resources and packaging

- Start a program with local echo disabled (`stty -echo` in a disposable WSL shell;
  restore using `stty echo`). While otherwise silent, type without pressing Enter:
  input must not postpone an already pending alert. Received remote echo normally
  counts as output, so an ordinary shell is unsuitable for this check.
- Repeatedly open, enable, produce output, close and reconnect panes. Check for
  late notifications/errors and sustained renderer memory growth (allow GC).
- Repeat with Windows notifications allowed and with Do Not Disturb enabled;
  record suppression behavior. No duplicate fallback alerts are expected.
- Fully quit, uninstall only the plugin folder, restart: menu/settings disappear.
  Reinstall the same ZIP: controls return without installing dependencies.
