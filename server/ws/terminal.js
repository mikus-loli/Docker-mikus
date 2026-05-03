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
                    killProc();

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
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'exit',
                                code: code ?? 1,
                            }));
                        }
                        proc = null;
                    });

                    proc.on('error', (err) => {
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: `Process error: ${err.message}`,
                            }));
                        }
                        proc = null;
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
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'exit', code: -1 }));
                    }
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
