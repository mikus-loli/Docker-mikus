const jwt = require('jsonwebtoken');

const ALLOWED_SHELLS = ['/bin/sh', '/bin/bash'];

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
            ws.close(4003, 'Shell not allowed. Use /bin/sh or /bin/bash');
            return;
        }

        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(containerId)) {
            ws.close(4003, 'Invalid container ID format');
            return;
        }

        let destroyed = false;
        let execStream = null;

        stackManager.docker.execContainerInteractive(containerId, shell)
            .then((stream) => {
                if (destroyed) {
                    stream.destroy();
                    return;
                }

                execStream = stream;

                ws.send(JSON.stringify({ type: 'ready', mode: 'container', containerId, shell }));

                stream.on('data', (chunk) => {
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString() }));
                    }
                });

                stream.on('end', () => {
                    execStream = null;
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({ type: 'done', code: 0 }));
                    }
                });

                stream.on('error', (err) => {
                    execStream = null;
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({ type: 'error', data: err.message }));
                        ws.send(JSON.stringify({ type: 'done', code: 1 }));
                    }
                });

                stream.on('close', () => {
                    execStream = null;
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({ type: 'done', code: 0 }));
                    }
                });
            })
            .catch((err) => {
                if (ws.readyState === 1 && !destroyed) {
                    ws.send(JSON.stringify({ type: 'error', data: 'Failed to exec into container: ' + err.message }));
                    ws.close();
                }
            });

        ws.on('message', (data) => {
            if (destroyed || !execStream) return;
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'input') {
                    if (execStream.writable) {
                        execStream.write(msg.data);
                    }
                } else if (msg.type === 'resize') {
                    // resize not supported via dockerode exec stream
                }
            } catch {}
        });

        ws.on('close', () => {
            destroyed = true;
            if (execStream) {
                try { execStream.destroy(); } catch {}
                execStream = null;
            }
        });

        ws.on('error', () => {
            destroyed = true;
            if (execStream) {
                try { execStream.destroy(); } catch {}
                execStream = null;
            }
        });
    };
}

module.exports = { createTerminalWsHandler };
