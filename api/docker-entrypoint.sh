#!/bin/sh
# Migrate (idempotent, advisory-locked), optionally seed the story cast, then serve.
set -e
node dist/db/migrate.js
if [ "${RUN_SEED:-true}" = "true" ]; then
  node dist/db/seed.js
fi
exec node dist/server.js
