#!/bin/sh

echo "Waiting for MySQL..."
./wait-for-it.sh db:3306 --timeout=30 --strict -- echo "DB is up"

exec "$@"
