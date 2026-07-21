#!/usr/bin/env bash
# Builds the OTP graph from otp/graphs/berlin/{osm.pbf,vbb-gtfs.zip} and saves graph.obj there.
# Run once after `npm run otp:download`, and again whenever the input data changes.
set -euo pipefail

cd "$(dirname "$0")/../.."
DATA_DIR="$(pwd)/otp/graphs/berlin"

if [ ! -f "$DATA_DIR/osm.pbf" ] || [ ! -f "$DATA_DIR/vbb-gtfs.zip" ]; then
  echo "Missing input data in $DATA_DIR — run 'npm run otp:download' first." >&2
  exit 1
fi

docker run --rm \
  -e JAVA_TOOL_OPTIONS='-Xmx4g' \
  -v "$DATA_DIR:/var/opentripplanner" \
  docker.io/opentripplanner/opentripplanner:latest --build --save

echo "Graph built: $DATA_DIR/graph.obj"
