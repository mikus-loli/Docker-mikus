const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

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

        const stackPath = path.join(stackManager.stacksDir, stackName);

        if (!fs.existsSync(stackPath)) {
            ws.send(JSON.stringify({ type: 'error', data: `Stack "${stackName}" not found` }));
            ws.close();
            return;
        }

        const composeFile = stackManager._findComposeFile(stackPath);
        if (!composeFile) {
            ws.send(JSON.stringify({ type: 'error', data: `No compose file found in stack "${stackName}"` }));
            ws.close();
            return;
        }

        const env = stackManager._loadEnv(stackPath);

        let proc = null;
        let destroyed = false;

        ws.send(JSON.stringify({ type: 'ready' }));

        function killProc() {
            if (proc && !proc.killed) {
                try {
                    proc.kill('SIGKILL');
                } catch {}
                proc = null;
            }
        }

        ws.on('message', (data) => {
            if (destroyed) return;

            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'command') {
                    if (proc && !proc.killed) {
                        ws.send(JSON.stringify({ type: 'error', data: 'A command is already running. Kill it first.' }));
                        return;
                    }

                    const commandStr = msg.command.trim();
                    if (!commandStr) {
                        ws.send(JSON.stringify({ type: 'error', data: 'Empty command' }));
                        return;
                    }

                    const args = parseArgs(commandStr);

                    try {
                        proc = stackManager.docker.runComposeInteractive(
                            stackPath,
                            args,
                            env
                        );
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', data: `Failed to start: ${err.message}` }));
                        return;
                    }

                    ws.send(JSON.stringify({ type: 'running', command: commandStr }));

                    proc.stdout.on('data', (chunk) => {
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'stdout',
                                data: chunk.toString(),
                            }));
                        }
                    });

                    proc.stderr.on('data', (chunk) => {
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'stderr',
                                data: chunk.toString(),
                            }));
                        }
                    });

                    proc.on('close', (code) => {
                        proc = null;
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'done',
                                code: code ?? 1,
                            }));
                        }
                    });

                    proc.on('error', (err) => {
                        proc = null;
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: `Process error: ${err.message}`,
                            }));
                            ws.send(JSON.stringify({ type: 'done', code: 1 }));
                        }
                    });
                } else if (msg.type === 'input' && proc && !proc.killed) {
                    try {
                        if (proc.stdin.writable) {
                            proc.stdin.write(msg.data);
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', data: `Input error: ${err.message}` }));
                    }
                } else if (msg.type === 'kill') {
                    killProc();
                } else if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (err) {
                console.error('Terminal WS error:', err);
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'error', data: `Internal error: ${err.message}` }));
                }
            }
        });

        ws.on('close', () => {
            destroyed = true;
            killProc();
        });

        ws.on('error', (err) => {
            console.error('Terminal WS connection error:', err);
            destroyed = true;
            killProc();
        });
    };
}

function parseArgs(str) {
    const args = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];

        if (inQuote) {
            if (ch === quoteChar) {
                inQuote = false;
            } else {
                current += ch;
            }
        } else if (ch === '"' || ch === "'") {
            inQuote = true;
            quoteChar = ch;
        } else if (ch === ' ' || ch === '\t') {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += ch;
        }
    }

    if (current) {
        args.push(current);
    }

    return args;
}

module.exports = { createTerminalWsHandler };
