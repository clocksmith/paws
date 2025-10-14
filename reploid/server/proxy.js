#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load unified configuration
let appConfig = null;
try {
  const { getConfig } = require('../utils/config-loader.js');
  const configLoader = getConfig();
  configLoader.load();
  appConfig = configLoader.getAll();
  console.log('[Proxy] Loaded configuration from:', configLoader.getConfigPath() || 'defaults');
} catch (err) {
  console.warn('[Proxy] Config loader not available, using environment variables');
}

const app = express();
const PORT = appConfig?.server?.port || process.env.PORT || 8000;
const GEMINI_API_KEY = appConfig?.api?.geminiKey || process.env.GEMINI_API_KEY;
const LOCAL_MODEL_ENDPOINT = appConfig?.api?.localEndpoint || process.env.LOCAL_MODEL_ENDPOINT || 'http://localhost:11434';
const OPENAI_API_KEY = appConfig?.api?.openaiKey || process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = appConfig?.api?.anthropicKey || process.env.ANTHROPIC_API_KEY;
const CORS_ORIGINS = appConfig?.server?.corsOrigins || ['http://localhost:8080'];

if (!GEMINI_API_KEY) {
  console.error('⚠️  WARNING: GEMINI_API_KEY not found in .env file');
  console.error('   The Gemini proxy endpoint will not work without it.');
}

console.log('🔧 Available API providers:');
if (GEMINI_API_KEY) console.log('   ✅ Google Gemini');
if (OPENAI_API_KEY) console.log('   ✅ OpenAI');
if (ANTHROPIC_API_KEY) console.log('   ✅ Anthropic');
console.log(`   🖥️  Local models at: ${LOCAL_MODEL_ENDPOINT}`);

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// CORS headers for API endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.header('Access-Control-Allow-Origin', CORS_ORIGINS[0]);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const providers = [];
  if (GEMINI_API_KEY) providers.push('gemini');
  if (OPENAI_API_KEY) providers.push('openai');
  if (ANTHROPIC_API_KEY) providers.push('anthropic');
  providers.push('local');

  res.json({
    status: 'ok',
    providers: providers,
    primaryProvider: providers.includes('gemini') ? 'gemini' : providers[0],
    timestamp: new Date().toISOString()
  });
});

// Proxy endpoint for Gemini API
app.post('/api/gemini/*', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: 'Server is not configured with Gemini API key' 
    });
  }

  // Extract the Gemini API path
  const geminiPath = req.params[0];
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${geminiPath}?key=${GEMINI_API_KEY}`;

  try {
    // Make the request to Gemini API
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        console.error('Gemini API error:', data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      res.status(response.status || 500).json({ 
        error: 'Invalid response from Gemini API',
        status: response.status,
        statusText: response.statusText,
        details: responseText.substring(0, 500) // First 500 chars
      });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request to Gemini API',
      details: error.message 
    });
  }
});

// Proxy endpoint for local models (Ollama, LM Studio, etc.)
app.post('/api/local/*', async (req, res) => {
  const localPath = req.params[0];
  const localUrl = `${LOCAL_MODEL_ENDPOINT}/${localPath}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        console.error('Local model error:', data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      res.status(response.status || 500).json({ 
        error: 'Invalid response from local model',
        status: response.status,
        statusText: response.statusText,
        details: responseText.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('Local model proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request to local model',
      details: error.message,
      endpoint: localUrl
    });
  }
});

// Proxy endpoint for OpenAI API
app.post('/api/openai/*', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'Server is not configured with OpenAI API key' 
    });
  }

  const openaiPath = req.params[0];
  const openaiUrl = `https://api.openai.com/v1/${openaiPath}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        console.error('OpenAI API error:', data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      res.status(response.status || 500).json({ 
        error: 'Invalid response from OpenAI API',
        status: response.status,
        statusText: response.statusText,
        details: responseText.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('OpenAI proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request to OpenAI API',
      details: error.message 
    });
  }
});

// Proxy endpoint for Anthropic API
app.post('/api/anthropic/*', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ 
      error: 'Server is not configured with Anthropic API key' 
    });
  }

  const anthropicPath = req.params[0];
  const anthropicUrl = `https://api.anthropic.com/v1/${anthropicPath}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(anthropicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        console.error('Anthropic API error:', data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      res.status(response.status || 500).json({ 
        error: 'Invalid response from Anthropic API',
        status: response.status,
        statusText: response.statusText,
        details: responseText.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request to Anthropic API',
      details: error.message 
    });
  }
});

// Endpoint to check if proxy is available (for client detection)
app.get('/api/proxy-status', (req, res) => {
  res.json({ 
    proxyAvailable: true,
    providers: {
      gemini: !!GEMINI_API_KEY,
      openai: !!OPENAI_API_KEY,
      anthropic: !!ANTHROPIC_API_KEY,
      local: true
    },
    localEndpoint: LOCAL_MODEL_ENDPOINT
  });
});

// --- VFS Persistence Endpoints ---
const VFS_BACKUP_PATH = path.join(__dirname, '..', 'vfs_backup.json');

// Endpoint to check for VFS state
app.get('/api/vfs/status', (req, res) => {
  try {
    const backupExists = fs.existsSync(VFS_BACKUP_PATH);
    res.status(200).json({ backupExists });
  } catch (error) {
    console.error('Error checking VFS status:', error);
    res.status(500).json({ error: 'Failed to check VFS status.' });
  }
});

// Endpoint to save the VFS state
app.post('/api/vfs/backup', (req, res) => {
  try {
    fs.writeFileSync(VFS_BACKUP_PATH, JSON.stringify(req.body, null, 2));
    res.status(200).json({ message: 'VFS state saved successfully.' });
  } catch (error) {
    console.error('Error saving VFS state:', error);
    res.status(500).json({ error: 'Failed to save VFS state.' });
  }
});

// Endpoint to load the VFS state
app.get('/api/vfs/restore', (req, res) => {
  try {
    if (fs.existsSync(VFS_BACKUP_PATH)) {
      const vfsState = fs.readFileSync(VFS_BACKUP_PATH, 'utf8');
      res.status(200).json(JSON.parse(vfsState));
    } else {
      res.status(404).json({ error: 'No VFS backup found.' });
    }
  } catch (error) {
    console.error('Error loading VFS state:', error);
    res.status(500).json({ error: 'Failed to load VFS state.' });
  }
});
// --- End VFS Persistence Endpoints ---

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..')));

// 404 handler
app.use((req, res) => {
  res.status(404).send('File not found');
});

// Start server
app.listen(PORT, () => {
  const providers = [];
  if (GEMINI_API_KEY) providers.push('Gemini');
  if (OPENAI_API_KEY) providers.push('OpenAI');
  if (ANTHROPIC_API_KEY) providers.push('Anthropic');
  providers.push('Local');
  
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   REPLOID Multi-Provider Proxy Server                 ║
║                                                        ║
║   URL: http://localhost:${PORT}                           ║
║   Providers: ${providers.join(', ').padEnd(25)}    ║
║   Local endpoint: ${LOCAL_MODEL_ENDPOINT.padEnd(21)}║
║                                                        ║
║   Press Ctrl+C to stop                                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});