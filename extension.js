import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

const PANGOLIN_BINARY = 'pangolin';
const STATUS_POLL_INTERVAL = 30;

const PangolinToggle = GObject.registerClass(
class PangolinToggle extends QuickSettings.QuickMenuToggle {
    _init(extension) {
        super._init({
            title: 'Pangolin VPN',
            iconName: 'network-vpn-symbolic',
            toggleMode: true,
        });

        this._extension = extension;
        this._connected = false;
        this._statusDetails = null;

        this.menu.setHeader('network-vpn-symbolic', 'Pangolin VPN', 'Disconnected');

        this._statusSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._statusSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addAction('Open Logs', () => {
            this._spawnCommand(['gnome-terminal', '--', 'pangolin', 'logs']);
        });

        this.connect('clicked', () => this._onToggle());
    }

    _onToggle() {
        if (this._connected) {
            this._disconnect();
        } else {
            this._connect();
        }
    }

    _connect() {
        this._setStatusConnecting();
        this._spawnCommand([PANGOLIN_BINARY, 'up', '--silent'], (success) => {
            if (!success) {
                this._spawnCommand(
                    ['gnome-terminal', '--', PANGOLIN_BINARY, 'up'],
                    () => this._pollStatus()
                );
            } else {
                this._pollStatus();
            }
        });
    }

    _disconnect() {
        this._setStatusConnecting();
        this._spawnCommand([PANGOLIN_BINARY, 'down'], () => {
            this._pollStatus();
        });
    }

    _setStatusConnecting() {
        this._connected = false;
        this.checked = false;
        this.menu.setHeader('network-vpn-acquiring-symbolic', 'Pangolin VPN', 'Connecting...');
        this._updateStatusSection(null);
    }

    updateStatus(connected, details) {
        this._connected = connected;
        this._statusDetails = details;
        this.checked = connected;

        if (connected) {
            this.menu.setHeader('network-vpn-symbolic', 'Pangolin VPN', 'Connected');
        } else {
            this.menu.setHeader('network-vpn-no-route-symbolic', 'Pangolin VPN', 'Disconnected');
        }

        this._updateStatusSection(details);
    }

    _updateStatusSection(details) {
        this._statusSection.removeAll();

        if (details) {
            for (const [key, value] of Object.entries(details)) {
                if (value && typeof value === 'string') {
                    const item = new PopupMenu.PopupMenuItem(`${key}: ${value}`, {
                        reactive: false,
                    });
                    this._statusSection.addMenuItem(item);
                }
            }
        }
    }

    _spawnCommand(argv, callback) {
        try {
            const [, pid] = GLib.spawn_async(
                null,
                argv,
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, waitStatus) => {
                GLib.spawn_close_pid(pid);
                let success = false;
                try { success = GLib.spawn_check_exit_status(waitStatus); } catch {}
                if (callback) callback(success);
            });
        } catch (e) {
            log(`Pangolin extension: command failed: ${e.message}`);
            if (callback) callback(false);
        }
    }
});

const PangolinIndicator = GObject.registerClass(
class PangolinIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();

        this._extension = extension;
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'network-vpn-no-route-symbolic';

        this._toggle = new PangolinToggle(extension);
        this.quickSettingsItems.push(this._toggle);

        this._pollSource = null;
        this._startPolling();
    }

    _startPolling() {
        this._pollStatus();

        this._pollSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            STATUS_POLL_INTERVAL,
            () => {
                this._pollStatus();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _pollStatus() {
        try {
            const [, stdout, , exitStatus] = GLib.spawn_command_line_sync(
                `${PANGOLIN_BINARY} status --json`
            );

            const decoder = new TextDecoder();
            const output = decoder.decode(stdout).trim();

            if (!output || exitStatus !== 0) {
                this._updateFromStatus(false, null);
                return;
            }

            if (output.includes('No client is currently running')) {
                this._updateFromStatus(false, null);
                return;
            }

            try {
                const data = JSON.parse(output);
                this._updateFromStatus(true, data);
            } catch {
                if (output.toLowerCase().includes('running') ||
                    output.toLowerCase().includes('connected')) {
                    this._updateFromStatus(true, null);
                } else {
                    this._updateFromStatus(false, null);
                }
            }
        } catch (e) {
            this._updateFromStatus(false, null);
        }
    }

    _updateFromStatus(connected, details) {
        if (connected) {
            this._indicator.icon_name = 'network-vpn-symbolic';
            this._indicator.visible = true;
        } else {
            this._indicator.visible = false;
        }

        this._toggle.updateStatus(connected, details);
    }

    destroy() {
        if (this._pollSource) {
            GLib.source_remove(this._pollSource);
            this._pollSource = null;
        }

        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class PangolinStatusExtension extends Extension {
    enable() {
        this._indicator = new PangolinIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
