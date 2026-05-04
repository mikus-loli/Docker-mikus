const jwt = require('jsonwebtoken');
const os = require('os');

let pty;
try {
    pty = require('node-pty');
} catch {
    pty = null;
}

const ALLOWED_SHELLS = ['/bin/sh', '/bin/bash', '/bin/ash', '/bin/zsh'];

function createTerminalWsHandler(stackManager, jwtSecret, db) {
    return function handleTerminal(ws, req, url) {
        const token = url.searchParams.get('token');
        const containerId = url.searchParams.get('container');
        const shell = url.searchParams.get('shell') || '/bin/sh';

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        try {
            const decoded = jwt.verify(token, jwtSecret);
            if (db && decoded.tid && db.isTokenBlacklisted(decoded.tid)) {
                ws.close(4001, 'Token has been revoked');
                return;
            }
        } catch {
            ws.close(4001, 'Invalid token');
            return;
        }

        if (!containerId) {
            ws.close(4002, 'Container ID required');
            return;
        }

        if (!ALLOWED_SHELLS.includes(shell)) {
            ws.close(4003, 'Shell not allowed');
            return;
        }

        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]+$/.test(containerId)) {
            ws.close(4003, 'Invalid container ID format');
            return;
        }

        if (!pty) {
            ws.send(JSON.stringify({ type: 'error', data: 'node-pty is not available on this system' }));
            ws.close(4005, 'node-pty not available');
            return;
        }

        let ptyProcess = null;
        let destroyed = false;

        try {
            ptyProcess = pty.spawn('docker', ['exec', '-it', containerId, shell], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: os.homedir(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                },
            });
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', data: 'Failed to spawn terminal: ' + err.message }));
            ws.close();
            return;
        }

        ws.send(JSON.stringify({
            type: 'ready',
            mode: 'container',
            containerId,
            shell,
            cols: 80,
            rows: 24,
        }));

        ptyProcess.onData((data) => {
            if (ws.readyState === 1 && !destroyed) {
                ws.send(data);
            }
        });

        ptyProcess.onExit(({ exitCode }) => {
            ptyProcess = null;
            if (ws.readyState === 1 && !destroyed) {
                ws.send(JSON.stringify({ type: 'done', code: exitCode }));
            }
        });

        ws.on('message', (rawData) => {
            if (destroyed || !ptyProcess) return;

            const str = rawData.toString();

            try {
                const msg = JSON.parse(str);
                if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
                    const cols = Math.max(1, Math.min(500, msg.cols));
                    const rows = Math.max(1, Math.min(200, msg.rows));
                    try {
                        ptyProcess.resize(cols, rows);
                    } catch {}
                    return;
                }
                if (msg.type === 'ping') {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                    return;
                }
                if (msg.type === 'input' && typeof msg.data === 'string') {
                    ptyProcess.write(msg.data);
                    return;
                }
            } catch {
                ptyProcess.write(str);
            }
        });

        ws.on('close', () => {
            destroyed = true;
            if (ptyProcess) {
                try { ptyProcess.kill(); } catch {}
                ptyProcess = null;
            }
        });

        ws.on('error', () => {
            destroyed = true;
            if (ptyProcess) {
                try { ptyProcess.kill(); } catch {}
                ptyProcess = null;
            }
        });
    };
}

module.exports = { createTerminalWsHandler };
