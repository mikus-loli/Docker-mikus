const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { initDB } = require('./db');
const { createAuthRoutes, authMiddleware } = require('./auth');
const { createStackRoutes } = require('./routes/stacks');
const { createContainerRoutes } = require('./routes/containers');
const { createTerminalWsHandler } = require('./ws/terminal');
const { createLogsWsHandler } = require('./ws/logs');
const { DockerService } = require('./services/docker');
const { StackManager } = require('./services/stack-manager');

const PORT = process.env.PORT || 3001;
const STACKS_DIR = process.env.STACKS_DIR || path.join(__dirname, '..', 'stacks');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'mikus-secret-change-in-production';

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const db = initDB(DATA_DIR);
const dockerService = new DockerService();
const stackManager = new StackManager(STACKS_DIR, dockerService);

app.use('/api/auth', createAuthRoutes(db, JWT_SECRET));

app.use('/api/stacks', authMiddleware(JWT_SECRET), createStackRoutes(stackManager));
app.use('/api/containers', authMiddleware(JWT_SECRET), createContainerRoutes(dockerService));

app.get('/api/system/info', authMiddleware(JWT_SECRET), async (req, res) => {
    try {
        const info = await dockerService.getSystemInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const terminalHandler = createTerminalWsHandler(stackManager);
const logsHandler = createLogsWsHandler(dockerService);

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

module.exports = { app, server };
