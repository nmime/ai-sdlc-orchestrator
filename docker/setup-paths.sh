#!/bin/sh
set -e
mkdir -p node_modules/@app
for lib in dist/libs/*/; do
  name=$(basename "$lib")
  if [ -d "$lib/src" ]; then
    ln -sfn "../../dist/libs/$name/src" "node_modules/@app/$name"
  fi
done
for feature in dist/libs/feature/*/; do
  name=$(basename "$feature")
  if [ -d "$feature/src" ]; then
    ln -sfn "../../../dist/libs/feature/$name/src" "node_modules/@app/feature-$name"
  fi
done
