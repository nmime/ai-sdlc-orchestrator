#!/bin/bash
set -e
ARTIFACT_DIR="/workspace/.artifacts"
mkdir -p "$ARTIFACT_DIR"
if [ "$#" -lt 2 ]; then
  echo "Usage: publish_artifact <type> <name> [<source_path>]"
  exit 1
fi
TYPE="$1"
NAME="$2"
SOURCE="${3:-/dev/stdin}"
DEST="$ARTIFACT_DIR/$NAME"
cp "$SOURCE" "$DEST"
echo "{\"type\": \"$TYPE\", \"name\": \"$NAME\", \"path\": \"$DEST\"}"
