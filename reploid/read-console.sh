#!/bin/bash
# Helper script to read browser console logs

if [ -f console.log ]; then
    echo "=== Latest Browser Console Logs ==="
    tail -n 50 console.log
else
    echo "No console logs found yet. Make sure to:"
    echo "1. Reload http://localhost:8080 in your browser"
    echo "2. The console-monitor.js script will automatically send logs here"
fi
