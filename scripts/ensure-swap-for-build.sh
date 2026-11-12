#!/usr/bin/env bash
# Enable swap when missing so Vite production builds survive on small VPS (exit 137 = OOM).
# Safe to run repeatedly.
set -euo pipefail

SWAP_MB="$(awk '/SwapTotal:/ {print int($2/1024)}' /proc/meminfo)"
if [[ "$SWAP_MB" -ge 1024 ]]; then
  echo "Swap OK (~${SWAP_MB}MB)"
  exit 0
fi

SWAPFILE="${SWAPFILE:-/swapfile}"
SIZE_GB="${SWAP_SIZE_GB:-4}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "No swap (~${SWAP_MB}MB). Re-run as root or create swap manually:"
  echo "  sudo fallocate -l ${SIZE_GB}G $SWAPFILE"
  echo "  sudo chmod 600 $SWAPFILE && sudo mkswap $SWAPFILE && sudo swapon $SWAPFILE"
  exit 1
fi

if swapon --show | grep -q "$SWAPFILE"; then
  echo "Swap file already active: $SWAPFILE"
  exit 0
fi

echo "Creating ${SIZE_GB}G swap at $SWAPFILE..."
fallocate -l "${SIZE_GB}G" "$SWAPFILE" || dd if=/dev/zero of="$SWAPFILE" bs=1M count=$((SIZE_GB * 1024))
chmod 600 "$SWAPFILE"
mkswap "$SWAPFILE"
swapon "$SWAPFILE"
echo "Swap enabled: $(awk '/SwapTotal:/ {print int($2/1024)}' /proc/meminfo)MB"
