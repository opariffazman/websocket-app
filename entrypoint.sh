#!/bin/sh

# Entrypoint script - app.js handles MODE switching internally
echo "🔍 Environment check:"
echo "   MODE=${MODE}"
echo ""
exec node app.js
