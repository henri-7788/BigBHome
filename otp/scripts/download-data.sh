#!/usr/bin/env bash
# Downloads Berlin OSM data (Geofabrik) and the VBB GTFS feed into otp/graphs/berlin/.
# Re-run whenever you want fresher schedules/streets before `npm run otp:build`.
set -euo pipefail

cd "$(dirname "$0")/../.."
DATA_DIR="otp/graphs/berlin"
mkdir -p "$DATA_DIR"

echo "Downloading Berlin OSM extract (Geofabrik)…"
curl -L "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf" -o "$DATA_DIR/osm.pbf"

echo "Downloading VBB GTFS feed…"
curl -L "https://vbb.de/vbbgtfs" -o "$DATA_DIR/vbb-gtfs.zip"

echo "Done. Data in $DATA_DIR:"
ls -lh "$DATA_DIR"
