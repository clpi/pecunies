#!/bin/bash
# Docker-compatible CLI wrapper that strips unsupported flags for Podman compatibility
# Usage: docker-wrapper.sh <docker-subcommand> [args...]
#
# Strips: --provenance=false (Podman doesn't support this Docker BuildKit flag)
# Strips: --load (Podman always loads locally by default)

ARGS=()
SKIP_NEXT=false

for arg in "$@"; do
  if $SKIP_NEXT; then
    SKIP_NEXT=false
    continue
  fi
  case "$arg" in
    --provenance=*)
      # Strip Docker BuildKit provenance flag
      ;;
    --load)
      # Podman always loads locally; --load is Docker-specific
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

exec /Volumes/d/homebrew/bin/podman "${ARGS[@]}"