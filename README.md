# Tabby Silence Monitor

Desktop notifications when terminal output stops. Each terminal pane has its own
timer, including split panes, local shells, WSL and SSH sessions.

Version **0.2.0**, targeting **Tabby 1.0.238** on Windows 10/11.

[Source code](https://github.com/ppjablonski/tabby-silence-monitor) ·
[Report an issue](https://github.com/ppjablonski/tabby-silence-monitor/issues)

## Installation

In Tabby, open **Settings > Plugins**, search for **Silence Monitor**, install it
and restart Tabby.

For a local ZIP installation, open **Settings > Plugins > Open Plugins Directory**,
quit Tabby completely (including the tray instance), and extract the release ZIP
there. It includes the `node_modules/tabby-silence-monitor` directory. Restart
Tabby after installation or upgrade.

## Usage

1. Right-click inside a terminal pane and enable **Monitor terminal silence**.
2. After output arrives, the plugin waits for **5 seconds** without further output
   and sends one notification. New output resets the timer and rearms monitoring.
3. Click the notification to bring its Tabby window to the foreground, select the
   correct tab and focus the corresponding split pane.

Monitoring is off by default. In **Settings > Silence Monitor**, set the threshold
from **1 to 3600 seconds** or enable automatic monitoring for new panes. Existing
panes keep their individual enable/disable setting. Enabling a pane waits for new
output; disabling it cancels its timer and closes its notification.

Notifications from different panes are independent. Each pane keeps only its
latest notification; the last notification clicked determines focus. Alerts do
not take focus until clicked. Closing or reconnecting a session removes its old
notification. Changing the threshold restarts pending timers from that moment.

## Limitations and privacy

- Silence means no received output, not command completion or success. Control
  sequences and remote echo count as output; keyboard input alone does not.
- A pane may need to be shown once before monitoring starts. After initialization,
  monitoring continues in background tabs and panes.
- Nested SSH connections share the enclosing terminal's timer. Periodic output
  prevents a silence alert.
- Windows notification settings can suppress alerts. Sleep or a blocked application
  can delay them. Dismissed or expired notifications may no longer respond to clicks.
- Terminal contents are never logged, stored or transmitted. Notifications display
  the terminal title. The plugin makes no network requests.

## Uninstallation

Remove the plugin in **Settings > Plugins** and restart Tabby. For a manual
installation, quit Tabby and delete `node_modules/tabby-silence-monitor` from the
plugins directory.

## License

MIT.
