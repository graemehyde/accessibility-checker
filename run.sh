#!/usr/bin/env bash
# Wrapper around `docker compose run` that prevents Git Bash from
# converting Linux paths (e.g. /reports/rush.html) to Windows paths.
MSYS_NO_PATHCONV=1 docker compose run --rm accessibility-checker "$@"
