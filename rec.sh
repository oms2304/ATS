#!/usr/bin/env bash
# tree.sh — recursively list folders and files with indentation
# Usage: ./tree.sh [directory]   (defaults to current directory)

set -euo pipefail

# Directories to skip (add more as needed)
SKIP_REGEX='^(\.git|node_modules|\.venv|__pycache__|dist|build)$'

walk() {
    local dir="$1"
    local indent="$2"

    # Loop over entries; sorted, includes dotfiles, safe for spaces
    local entry name
    for entry in "$dir"/*; do
        # Handle the case where a glob matches nothing
        [ -e "$entry" ] || continue
        name="$(basename "$entry")"

        if [ -d "$entry" ]; then
            # Skip noise directories
            if [[ "$name" =~ $SKIP_REGEX ]]; then
                printf '%s%s/  (skipped)\n' "$indent" "$name"
                continue
            fi
            printf '%s%s/\n' "$indent" "$name"
            walk "$entry" "$indent    "   # recurse with deeper indent
        else
            printf '%s%s\n' "$indent" "$name"
        fi
    done
}

ROOT="${1:-.}"

if [ ! -d "$ROOT" ]; then
    echo "Error: '$ROOT' is not a directory" >&2
    exit 1
fi

printf '%s\n' "$ROOT"
walk "$ROOT" "    "
