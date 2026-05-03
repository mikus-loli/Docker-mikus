const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const ALLOWED_COMPOSE_COMMANDS = [
    'up', 'down', 'restart', 'stop', 'start', 'pull',
    'ps', 'logs', 'config', 'build', 'images', 'top',
    'port', 'pause', 'unpause', 'rm', 'create',
];

const ALLOWED_SHELLS = ['/bin/sh', '/bin/bash', '/bin/ash', '/bin/zsh'];

function validateComposeCommand(args) {
    if (args.length === 0) return false;
    const subCommand = args[0].toLowerCase();
    if (!ALLOWED_COMPOSE_COMMANDS.includes(subCommand)) return false;
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-') && (arg.includes('=') || arg.length > 20)) {
            if (arg.startsWith('--env-file') || arg.startsWith('--file')) {
                return false;
            }
        }
    }
    return true;
}

function isPathSafe(baseDir, targetPath) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

function createTerminalWsHandler(stackManager, jwtSecret, db) {
    return function handleTerminal(ws, req, url) {
        const token = url.searchParams.get('token');
        const stackName = url.searchParams.get('stack');
        const containerId = url.searchParams.get('container');
        const shell = url.searchParams.get('shell') || '/bin/sh';

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
            if (db && decoded.tid && db.isTokenBlacklisted(decoded.tid)) {
                ws.close(4001, 'Token has been revoked');
                return;
            }
        } catch {
            ws.close(4001, 'Invalid token');
            return;
        }

        if (!stackName && !containerId) {
            ws.close(4002, 'Stack name or container ID required');
            return;
        }

        if (!ALLOWED_SHELLS.includes(shell)) {
            ws.close(4003, 'Shell not allowed');
            return;
        }

        if (containerId && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(containerId)) {
            ws.close(4003, 'Invalid container ID format');
            return;
        }

        if (stackName && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(stackName)) {
            ws.close(4003, 'Invalid stack name format');
            return;
        }

        let proc = null;
        let destroyed = false;

        if (containerId) {
            try {
                proc = stackManager.docker.execContainerInteractive(containerId, shell);
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', data: 'Failed to exec into container' }));
                ws.close();
                return;
            }

            ws.send(JSON.stringify({ type: 'ready', mode: 'container', containerId, shell }));

            proc.stdout.on('data', (chunk) => {
                if (ws.readyState === 1 && !destroyed) {
                    ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString() }));
                }
            });

            proc.stderr.on('data', (chunk) => {
                if (ws.readyState === 1 && !destroyed) {
                    ws.send(JSON.stringify({ type: 'stderr', data: chunk.toString() }));
                }
            });

            proc.on('close', (code) => {
                proc = null;
                if (ws.readyState === 1 && !destroyed) {
                    ws.send(JSON.stringify({ type: 'done', code: code ?? 1 }));
                }
            });

            proc.on('error', () => {
                proc = null;
                if (ws.readyState === 1 && !destroyed) {
                    ws.send(JSON.stringify({ type: 'error', data: 'Process error' }));
                }
            });

            ws.on('message', (data) => {
                if (destroyed || !proc) return;
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'input' && proc.stdin.writable) {
                        proc.stdin.write(msg.data);
                    } else if (msg.type === 'resize') {
                        // PTY resize not supported via simple spawn
                    } else if (msg.type === 'kill') {
                        if (!proc.killed) {
                            try { proc.kill('SIGKILL'); } catch {}
                        }
                    }
                } catch {}
            });

            ws.on('close', () => {
                destroyed = true;
                if (proc && !proc.killed) {
                    try { proc.kill('SIGKILL'); } catch {}
                    proc = null;
                }
            });

            return;
        }

        const stackPath = path.join(stackManager.stacksDir, stackName);

        if (!isPathSafe(stackManager.stacksDir, stackPath)) {
            ws.send(JSON.stringify({ type: 'error', data: 'Invalid stack path' }));
            ws.close();
            return;
        }

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

        ws.send(JSON.stringify({ type: 'ready', mode: 'compose' }));

        function killProc() {
            if (proc && !proc.killed) {
                try { proc.kill('SIGKILL'); } catch {}
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

                    if (!validateComposeCommand(args)) {
                        ws.send(JSON.stringify({ type: 'error', data: `Command not allowed. Allowed: ${ALLOWED_COMPOSE_COMMANDS.join(', ')}` }));
                        return;
                    }

                    try {
                        proc = stackManager.docker.runComposeInteractive(stackPath, args, env);
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', data: 'Failed to start command' }));
                        return;
                    }

                    ws.send(JSON.stringify({ type: 'running', command: commandStr }));

                    proc.stdout.on('data', (chunk) => {
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString() }));
                        }
                    });

                    proc.stderr.on('data', (chunk) => {
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({ type: 'stderr', data: chunk.toString() }));
                        }
                    });

                    proc.on('close', (code) => {
                        proc = null;
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({ type: 'done', code: code ?? 1 }));
                        }
                    });

                    proc.on('error', () => {
                        proc = null;
                        if (ws.readyState === 1 && !destroyed) {
                            ws.send(JSON.stringify({ type: 'error', data: 'Process error' }));
                            ws.send(JSON.stringify({ type: 'done', code: 1 }));
                        }
                    });
                } else if (msg.type === 'input' && proc && !proc.killed) {
                    try {
                        if (proc.stdin.writable) {
                            proc.stdin.write(msg.data);
                        }
                    } catch {}
                } else if (msg.type === 'kill') {
                    killProc();
                } else if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (err) {
                console.error('Terminal WS error:', err);
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
