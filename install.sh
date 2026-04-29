#!/usr/bin/env bash
set -euo pipefail

EXTENSION_UUID="pangolin-indicator@yetanother.at"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

echo "Installing Pangolin VPN Status Indicator..."

mkdir -p "${INSTALL_DIR}"

cp metadata.json "${INSTALL_DIR}/"
cp extension.js "${INSTALL_DIR}/"
cp stylesheet.css "${INSTALL_DIR}/"

echo "Installed to ${INSTALL_DIR}"
echo ""
echo "To enable:"
echo "  1. Log out and log back in (or restart GNOME Shell: Alt+F2 → r)"
echo "  2. Run: gnome-extensions enable ${EXTENSION_UUID}"
echo ""
echo "Or use the Extensions app to toggle it on."

if command -v gnome-extensions &>/dev/null; then
    echo ""
    echo "Enabling extension..."
    gnome-extensions enable "${EXTENSION_UUID}" 2>/dev/null && echo "Extension enabled!" || echo "You may need to restart GNOME Shell first."
fi
