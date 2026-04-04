#!/bin/bash
OUTPUT_FILE=${1:-"metrics.log"}
# Interval in seconds
INTERVAL=2

# Find the PID of the backend process
# It's running via ts-node-dev src/app.ts
PID=$(ps aux | grep "[t]s-node-dev.*src/app.ts" | awk '{print $2}' | head -n 1)

if [ -z "$PID" ]; then
    # Fallback to looking for the node process spawned by ts-node-dev
    PID=$(ps aux | grep "[n]ode.*src/app.ts" | awk '{print $2}' | head -n 1)
fi

if [ -z "$PID" ]; then
    echo "Error: Backend PID not found."
    exit 1
fi

echo "Monitoring PID: $PID. Saving to $OUTPUT_FILE."
echo "Timestamp,CPU%,MEM%" > "$OUTPUT_FILE"

# Run until killed
while true; do
    # ps -p $PID -o %cpu,%mem on macOS returns %cpu and %mem
    STATS=$(ps -p "$PID" -o %cpu,%mem | tail -n 1 | awk '{print $1 "," $2}')
    if [ -z "$STATS" ]; then
        echo "Process $PID lost."
        break
    fi
    echo "$(date '+%H:%M:%S'),$STATS" >> "$OUTPUT_FILE"
    sleep $INTERVAL
done
