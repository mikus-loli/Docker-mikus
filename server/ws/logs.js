const jwt = require('jsonwebtoken');

function createLogsWsHandler(dockerService, jwtSecret, db) {
    return function handleLogs(ws, req, url) {
        const token = url.searchParams.get('token');
        const containerId = url.searchParams.get('container');
        const tail = parseInt(url.searchParams.get('tail') || '200');

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

        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(containerId)) {
            ws.close(4003, 'Invalid container ID format');
            return;
        }

        let stream = null;
        let destroyed = false;

        dockerService.streamContainerLogs(containerId, { tail })
            .then((logStream) => {
                if (destroyed) {
                    logStream.destroy();
                    return;
                }
                stream = logStream;

                stream.on('data', (chunk) => {
                    if (ws.readyState === 1 && !destroyed) {
                        const header = chunk.slice(0, 8);
                        const type = header[0];
                        const data = chunk.slice(8).toString('utf8');
                        ws.send(JSON.stringify({
                            type: type === 1 ? 'stdout' : 'stderr',
                            data,
                            timestamp: Date.now(),
                        }));
                    }
                });

                stream.on('error', () => {
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: 'Log stream error',
                        }));
                    }
                });

                stream.on('end', () => {
                    if (ws.readyState === 1 && !destroyed) {
                        ws.send(JSON.stringify({ type: 'end' }));
                    }
                });
            })
            .catch(() => {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: 'Failed to stream logs',
                    }));
                }
            });

        ws.on('close', () => {
            destroyed = true;
            if (stream) {
                stream.destroy();
                stream = null;
            }
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch {}
        });
    };
}

module.exports = { createLogsWsHandler };
