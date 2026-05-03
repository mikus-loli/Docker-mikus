const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const jwt = require('jsonwebtoken');
const { initDB } = require('./db');
const { createAuthRoutes, authMiddleware } = require('./auth');
const { createStackRoutes } = require('./routes/stacks');
const { createContainerRoutes } = require('./routes/containers');
const { createTerminalWsHandler } = require('./ws/terminal');
const { createLogsWsHandler } = require('./ws/logs');
const { DockerService } = require('./services/docker');
const { StackManager } = require('./services/stack-manager');
const { getOrCreateSecret } = require('./secret');

const PORT = process.env.PORT || 3001;
const STACKS_DIR = process.env.STACKS_DIR || path.join(__dirname, '..', 'stacks');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const JWT_SECRET = getOrCreateSecret(DATA_DIR);

const app = express();
const server = http.createServer(app);

const db = initDB(DATA_DIR);
const dockerService = new DockerService();
const stackManager = new StackManager(STACKS_DIR, dockerService);

const corsOrigin = process.env.CORS_ORIGIN || '';

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(compression());

if (corsOrigin) {
    const origins = corsOrigin.split(',').map(o => o.trim()).filter(Boolean);
    app.use(cors({
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }));
} else {
    app.use(cors());
}

app.use(express.json({ limit: '1mb' }));

const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024,
    verifyClient: (info, callback) => {
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token');
        if (!token) {
            callback(false, 401, 'Authentication required');
            return;
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (db && decoded.tid && db.isTokenBlacklisted(decoded.tid)) {
                callback(false, 401, 'Token has been revoked');
                return;
            }
            callback(true);
        } catch {
            callback(false, 401, 'Invalid token');
        }
    },
});

app.use('/api/auth', createAuthRoutes(db, JWT_SECRET));

app.use('/api/stacks', authMiddleware(JWT_SECRET, db), createStackRoutes(stackManager));
app.use('/api/containers', authMiddleware(JWT_SECRET, db), createContainerRoutes(dockerService));

app.get('/api/system/info', authMiddleware(JWT_SECRET, db), async (req, res) => {
    try {
        const info = await dockerService.getSystemInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get system info' });
    }
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist'), { maxAge: '1h' }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const terminalHandler = createTerminalWsHandler(stackManager, JWT_SECRET, db);
const logsHandler = createLogsWsHandler(dockerService, JWT_SECRET, db);

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');

    if (type === 'terminal') {
        terminalHandler(ws, req, url);
    } else if (type === 'logs') {
        logsHandler(ws, req, url);
    } else {
        ws.close(4000, 'Unknown connection type');
    }
});

stackManager.startWatching();

server.listen(PORT, () => {
    console.log(`Mikus server running on port ${PORT}`);
    console.log(`Stacks directory: ${STACKS_DIR}`);
    console.log(`Data directory: ${DATA_DIR}`);
});

process.on('SIGTERM', () => {
    stackManager.stopWatching();
    server.close();
    db.close();
});

process.on('SIGINT', () => {
    stackManager.stopWatching();
    server.close();
    db.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

module.exports = { app, server };
