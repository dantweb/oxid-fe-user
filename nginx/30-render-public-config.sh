#!/bin/sh
# Renders the browser's /oxid-config.json from the instance's oxid-config.yaml (allow-list + secret
# guard). A config that would expose a secret stops the container: nginx must not start with it.
set -e
mkdir -p /var/lib/oxid-fe
node /opt/oxid-fe/public-config.cjs "${INSTANCE_DIR}/oxid-config.yaml" /var/lib/oxid-fe/oxid-config.json
test -s /var/lib/oxid-fe/oxid-config.json # an empty result must stop the container too
echo "oxid-fe: rendered /oxid-config.json from ${INSTANCE_DIR}/oxid-config.yaml (the YAML is not served)"
