#!/bin/bash
# REPLOID Local Startup Script
# Starts proxy server and opens REPLOID with local GPT-OSS models

echo "🚀 Starting REPLOID with GPT-OSS 120B..."
echo ""

# Check if Ollama is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "⚠️  Warning: Ollama is not running!"
    echo "   Start it with: ollama serve"
    echo ""
fi

# Check if gpt-oss:120b is available
if ! curl -s http://localhost:11434/api/tags | grep -q "gpt-oss:120b"; then
    echo "⚠️  Warning: gpt-oss:120b model not found!"
    echo "   Available models:"
    curl -s http://localhost:11434/api/tags | grep '"name"' | head -5
    echo ""
fi

echo "📋 Configuration:"
echo "   Default Model: gpt-oss:120b"
echo "   Fallback Model: gpt-oss:20b"
echo "   Ollama Endpoint: http://localhost:11434"
echo "   Proxy Port: 8000"
echo "   UI Port: 8080"
echo ""

# Start both servers
echo "🔧 Starting services..."
echo ""
npm run dev
