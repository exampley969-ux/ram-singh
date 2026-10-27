#!/bin/sh
# Copies only the files the site serves into ./dist (no tests, tools, SQL, docs).
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/fonts dist/.well-known
cp index.html privacy.html terms.html profile.jpg dist/
for f in $(grep -ohE 'src="[^":]+\.js"' index.html | sed 's/src="//;s/"//'); do cp "$f" dist/; done
cp fonts/* dist/fonts/
cp .well-known/* dist/.well-known/
echo "dist built: $(find dist -type f | wc -l) files"
