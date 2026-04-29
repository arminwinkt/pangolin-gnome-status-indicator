#!/usr/bin/env bash
set -euo pipefail

EXTENSION_UUID="pangolin-indicator@yetanother.at"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

echo "Disabling extension..."
gnome-extensions disable "${EXTENSION_UUID}" 2>/dev/null || true

echo "Removing ${INSTALL_DIR}..."
rm -rf "${INSTALL_DIR}"

echo "Pangolin VPN Status Indicator uninstalled."
echo "Restart GNOME Shell (Alt+F2 → r) or log out/in to complete."
