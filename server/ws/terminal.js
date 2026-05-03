const jwt = require('jsonwebtoken');

function createTerminalWsHandler(stackManager) {
    return function handleTerminal(ws, req, url) {
        const token = url.searchParams.get('token');
        const stackName = url.searchParams.get('stack');

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        try {
            const jwtSecret = process.env.JWT_SECRET || 'mikus-secret-change-in-production';
            jwt.verify(token, jwtSecret);
        } catch {
            ws.close(4001, 'Invalid token');
            return;
        }

        if (!stackName) {
            ws.close(4002, 'Stack name required');
            return;
        }

        const stackPath = require('path').join(stackManager.stacksDir, stackName);
        const env = stackManager._loadEnv(stackPath);

        let proc = null;

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'command') {
                    if (proc) {
                        proc.kill();
                    }

                    const args = msg.command.split(' ');
                    proc = stackManager.docker.runComposeInteractive(
                        stackPath,
                        args,
                        env
                    );

                    proc.stdout.on('data', (chunk) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({
                                type: 'stdout',
                                data: chunk.toString(),
                            }));
                        }
                    });

                    proc.stderr.on('data', (chunk) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({
                                type: 'stderr',
                                data: chunk.toString(),
                            }));
                        }
                    });

                    proc.on('close', (code) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({
                                type: 'exit',
                                code,
                            }));
                        }
                        proc = null;
                    });

                    proc.on('error', (err) => {
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: err.message,
                            }));
                        }
                        proc = null;
                    });
                } else if (msg.type === 'input' && proc && proc.stdin.writable) {
                    proc.stdin.write(msg.data);
                } else if (msg.type === 'resize' && proc) {
                    // Terminal resize not supported for compose commands
                }
            } catch (err) {
                console.error('Terminal WS error:', err);
            }
        });

        ws.on('close', () => {
            if (proc) {
                proc.kill();
                proc = null;
            }
        });
    };
}

module.exports = { createTerminalWsHandler };
