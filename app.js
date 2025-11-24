// ============================================================================
// DOCKER CONNECT - Combined Server & Client Application
// ============================================================================
// Startup validation - demonstrates dependency issues
console.log('🔍 Validating system dependencies...');
console.log('');

// Check Node.js version
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);
const REQUIRED_VERSION = 25;

if (majorVersion < REQUIRED_VERSION) {
    console.error('❌ ERROR: Node.js version 25+ (latest) is required!');
    console.error(`   Current version: v${nodeVersion} (detected)`);
    console.error(`   Required version: v${REQUIRED_VERSION}.x or higher`);
    console.error('');
    process.exit(1);
}

console.log(`✅ Node.js version check passed (v${nodeVersion})`);
console.log('');

// ============================================================================
// SERVER MODE
// ============================================================================
function runServer() {
    const express = require('express');
    const http = require('http');
    const WebSocket = require('ws');
    const path = require('path');

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    // Store connected clients
    const clients = new Map();

    // Serve static files
    app.use(express.static('public'));

    // API endpoint to get all clients
    app.get('/api/clients', (req, res) => {
        const clientList = Array.from(clients.values()).map(client => ({
            id: client.id,
            name: client.name,
            location: client.location,
            connectedAt: client.connectedAt,
            lastSeen: client.lastSeen,
            uptime: Date.now() - client.connectedAt
        }));
        res.json(clientList);
    });

    // WebSocket connection handler
    wss.on('connection', (ws, req) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        console.log('New connection from:', clientIp);

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'register') {
                    // Register new client
                    const clientId = data.id || generateId();
                    const clientInfo = {
                        id: clientId,
                        name: data.name || 'Anonymous',
                        location: data.location || clientIp,
                        connectedAt: Date.now(),
                        lastSeen: Date.now(),
                        ws: ws
                    };

                    clients.set(clientId, clientInfo);

                    // Send confirmation to client
                    ws.send(JSON.stringify({
                        type: 'registered',
                        id: clientId,
                        totalClients: clients.size
                    }));

                    // Broadcast to all clients
                    broadcastUpdate();

                    console.log(`Client registered: ${clientInfo.name} (${clientId})`);
                }

                if (data.type === 'heartbeat') {
                    // Update last seen
                    const client = clients.get(data.id);
                    if (client) {
                        client.lastSeen = Date.now();

                        // Send heartbeat response
                        ws.send(JSON.stringify({
                            type: 'heartbeat_ack',
                            timestamp: Date.now()
                        }));
                    }
                }

            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('close', () => {
            // Find and remove disconnected client
            for (const [id, client] of clients.entries()) {
                if (client.ws === ws) {
                    console.log(`Client disconnected: ${client.name} (${id})`);
                    clients.delete(id);
                    broadcastUpdate();
                    break;
                }
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    // Broadcast updates to all connected dashboard viewers
    function broadcastUpdate() {
        const clientList = Array.from(clients.values()).map(client => ({
            id: client.id,
            name: client.name,
            location: client.location,
            connectedAt: client.connectedAt,
            uptime: Date.now() - client.connectedAt
        }));

        const message = JSON.stringify({
            type: 'update',
            clients: clientList,
            total: clients.size
        });

        // Send to all WebSocket clients (including dashboard)
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Generate random client ID
    function generateId() {
        return Math.random().toString(36).substring(2, 15);
    }

    // Cleanup stale connections (no heartbeat for 30 seconds)
    setInterval(() => {
        const now = Date.now();
        const staleTimeout = 30000; // 30 seconds

        for (const [id, client] of clients.entries()) {
            if (now - client.lastSeen > staleTimeout) {
                console.log(`Removing stale client: ${client.name} (${id})`);
                clients.delete(id);
                broadcastUpdate();
            }
        }
    }, 10000); // Check every 10 seconds

    const PORT = process.env.PORT || 8080;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🐳 Docker Connect Server running on port ${PORT}`);
        console.log(`Dashboard: http://localhost:${PORT}`);
    });
}

// ============================================================================
// CLIENT MODE
// ============================================================================
async function runClient() {
    const WebSocket = require('ws');
    const os = require('os');
    const readline = require('readline');

    // Function to prompt user for input (only works in interactive terminals)
    function promptUser(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim() || null);
            });
        });
    }

    // Configuration from environment variables
    const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '5000');

    // Get server URL, name and location - only check explicit env vars for now
    let SERVER_URL = process.env.SERVER_URL;
    let CLIENT_NAME = process.env.CLIENT_NAME;
    let CLIENT_LOCATION = process.env.CLIENT_LOCATION;

    // Check if running in interactive terminal (works with 'node app.js' or 'docker run -it')
    if (process.stdin.isTTY && (!SERVER_URL || !CLIENT_NAME || !CLIENT_LOCATION)) {
        console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════════════════╗');
        console.log('\x1b[36m%s\x1b[0m', '║                                                        ║');
        console.log('\x1b[36m%s\x1b[0m', '║              🐳  DOCKER CONNECT CLIENT  🐳             ║');
        console.log('\x1b[36m%s\x1b[0m', '║                                                        ║');
        console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════════════════╝');
        console.log('');

        if (!SERVER_URL) {
            const serverIp = await promptUser('🌐 IP Server: ');
            if (serverIp) {
                // Add ws:// protocol if not already present
                SERVER_URL = serverIp.startsWith('ws://') || serverIp.startsWith('wss://')
                    ? serverIp
                    : `ws://${serverIp}`;
            } else {
                SERVER_URL = 'ws://localhost:8080';
            }
        }

        if (!CLIENT_NAME) {
            CLIENT_NAME = await promptUser('📝 Nama Anda: ');
            if (!CLIENT_NAME) {
                CLIENT_NAME = 'Anonymous';
            }
        }

        if (!CLIENT_LOCATION) {
            CLIENT_LOCATION = await promptUser('📍 Lokasi Anda: ');
            if (!CLIENT_LOCATION) {
                CLIENT_LOCATION = '';
            }
        }
        console.log('');
    }

    // Fall back to defaults if still not set
    SERVER_URL = SERVER_URL || 'ws://localhost:8080';
    CLIENT_NAME = CLIENT_NAME || process.env.NAME || 'Anonymous';
    CLIENT_LOCATION = CLIENT_LOCATION || process.env.LOCATION || '';

    let clientId = null;
    let ws = null;
    let heartbeatTimer = null;
    let reconnectTimer = null;
    let isConnected = false;

    // Display banner
    function displayBanner() {
        console.clear();
        console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════════════════╗');
        console.log('\x1b[36m%s\x1b[0m', '║                                                        ║');
        console.log('\x1b[36m%s\x1b[0m', '║              🐳  DOCKER CONNECT CLIENT  🐳             ║');
        console.log('\x1b[36m%s\x1b[0m', '║                                                        ║');
        console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('\x1b[33m%s\x1b[0m', `📝 Name:     ${CLIENT_NAME}`);
        console.log('\x1b[33m%s\x1b[0m', `📍 Location: ${CLIENT_LOCATION}`);
        console.log('\x1b[33m%s\x1b[0m', `🖥️  Hostname: ${os.hostname()}`);
        console.log('\x1b[33m%s\x1b[0m', `🌐 Server:   ${SERVER_URL}`);
        console.log('');
        console.log('\x1b[90m%s\x1b[0m', '════════════════════════════════════════════════════════');
        console.log('');
    }

    // Log with timestamp
    function log(emoji, message, color = '\x1b[0m') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${color}[${timestamp}] ${emoji} ${message}\x1b[0m`);
    }

    // Connect to server
    function connect() {
        log('🔌', 'Connecting to server...', '\x1b[33m');

        ws = new WebSocket(SERVER_URL);

        ws.on('open', () => {
            isConnected = true;
            log('✅', 'Connected to server!', '\x1b[32m');

            // Register with server
            const registrationData = {
                type: 'register',
                name: CLIENT_NAME,
                location: CLIENT_LOCATION,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch()
            };

            ws.send(JSON.stringify(registrationData));

            // Start heartbeat
            startHeartbeat();
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);

                if (message.type === 'registered') {
                    clientId = message.id;
                    log('🎉', `Registered successfully! ID: ${clientId}`, '\x1b[32m');
                    log('👥', `Total clients connected: ${message.totalClients}`, '\x1b[36m');
                }

                if (message.type === 'heartbeat_ack') {
                    log('💓', 'Heartbeat acknowledged', '\x1b[90m');
                }

                if (message.type === 'update') {
                    log('📊', `Network update: ${message.total} clients online`, '\x1b[36m');
                }

            } catch (error) {
                log('⚠️', `Error parsing message: ${error.message}`, '\x1b[31m');
            }
        });

        ws.on('close', () => {
            isConnected = false;
            log('❌', 'Disconnected from server', '\x1b[31m');
            stopHeartbeat();
            scheduleReconnect();
        });

        ws.on('error', (error) => {
            log('⚠️', `WebSocket error: ${error.message}`, '\x1b[31m');
        });
    }

    // Send heartbeat to server
    function sendHeartbeat() {
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const heartbeat = {
            type: 'heartbeat',
            id: clientId,
            timestamp: Date.now()
        };

        ws.send(JSON.stringify(heartbeat));
    }

    // Start heartbeat timer
    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        log('💓', `Heartbeat started (every ${HEARTBEAT_INTERVAL / 1000}s)`, '\x1b[90m');
    }

    // Stop heartbeat timer
    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    // Schedule reconnection
    function scheduleReconnect() {
        if (reconnectTimer) {
            return;
        }

        const delay = 5000; // 5 seconds
        log('🔄', `Reconnecting in ${delay / 1000} seconds...`, '\x1b[33m');

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    }

    // Graceful shutdown
    function shutdown() {
        log('👋', 'Shutting down gracefully...', '\x1b[33m');

        stopHeartbeat();

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }

        if (ws) {
            ws.close();
        }

        setTimeout(() => {
            log('✅', 'Goodbye!', '\x1b[32m');
            process.exit(0);
        }, 1000);
    }

    // Handle shutdown signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start application
    displayBanner();
    connect();

    // Keep alive
    setInterval(() => {
        if (isConnected) {
            log('⏱️', `Uptime: ${Math.floor(process.uptime())}s | Status: Connected`, '\x1b[32m');
        } else {
            log('⏱️', `Uptime: ${Math.floor(process.uptime())}s | Status: Disconnected`, '\x1b[31m');
        }
    }, 30000); // Log status every 30 seconds
}

// ============================================================================
// START APPLICATION BASED ON MODE
// ============================================================================
const MODE = (process.env.MODE || 'server').toLowerCase();

if (MODE === 'server') {
    console.log('🚀 Starting in SERVER mode...');
    console.log('');
    runServer();
} else if (MODE === 'client') {
    console.log('🚀 Starting in CLIENT mode...');
    console.log('');
    runClient();
} else {
    console.error(`❌ ERROR: Invalid MODE '${MODE}'. Must be 'server' or 'client'.`);
    process.exit(1);
}
