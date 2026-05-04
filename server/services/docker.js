const Docker = require('dockerode');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class DockerService {
    constructor(stacksDir, hostStacksDir) {
        this.docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
        this.stacksDir = stacksDir || '/app/stacks';
        this.hostStacksDir = hostStacksDir || this.stacksDir;
        this.dockerCliAvailable = this._checkDockerCli();
    }

    _checkDockerCli() {
        try {
            execSync('docker --version', { stdio: 'pipe' });
            return true;
        } catch {
            console.warn('[Docker] WARNING: docker CLI not found in PATH. Compose operations will fail.');
            console.warn('[Docker] Please rebuild the image with: docker build -t mikus .');
            console.warn('[Docker] Or mount the host docker binary: -v /usr/bin/docker:/usr/bin/docker:ro');
            return false;
        }
    }

    _toHostPath(stackPath) {
        if (this.hostStacksDir !== this.stacksDir) {
            const relative = path.relative(this.stacksDir, stackPath);
            return path.join(this.hostStacksDir, relative);
        }
        return stackPath;
    }

    _findComposeFile(dir) {
        const names = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
        for (const name of names) {
            const filePath = path.join(dir, name);
            if (fs.existsSync(filePath)) return name;
        }
        return null;
    }

    async getSystemInfo() {
        const info = await this.docker.info();
        const version = await this.docker.version();
        return {
            containers: info.Containers,
            containersRunning: info.ContainersRunning,
            containersPaused: info.ContainersPaused,
            containersStopped: info.ContainersStopped,
            images: info.Images,
            serverVersion: version.Version,
            apiVersion: version.ApiVersion,
            operatingSystem: info.OperatingSystem,
            totalMemory: info.MemTotal,
            cpuCores: info.NCPU,
        };
    }

    async listContainers(all = true) {
        return this.docker.listContainers({ all });
    }

    async getContainer(id) {
        return this.docker.getContainer(id);
    }

    async getContainerInfo(id) {
        const container = this.docker.getContainer(id);
        return container.inspect();
    }

    async startContainer(id) {
        const container = this.docker.getContainer(id);
        return container.start();
    }

    async stopContainer(id) {
        const container = this.docker.getContainer(id);
        return container.stop({ t: 10 });
    }

    async restartContainer(id) {
        const container = this.docker.getContainer(id);
        return container.restart({ t: 10 });
    }

    async removeContainer(id) {
        const container = this.docker.getContainer(id);
        return container.remove({ force: true });
    }

    async getContainerStats(id) {
        const container = this.docker.getContainer(id);
        return container.stats({ stream: false });
    }

    async getContainerLogs(id, options = {}) {
        const container = this.docker.getContainer(id);
        const defaultOpts = {
            stdout: true,
            stderr: true,
            tail: options.tail || 100,
            timestamps: true,
            since: options.since || 0,
        };
        return container.logs(defaultOpts);
    }

    async streamContainerLogs(id, options = {}) {
        const container = this.docker.getContainer(id);
        const opts = {
            stdout: true,
            stderr: true,
            tail: options.tail || 100,
            timestamps: true,
            follow: true,
            since: options.since || 0,
        };
        return container.logs(opts);
    }

    async composeUp(stackPath, env = {}) {
        return this._runCompose(stackPath, ['up', '-d', '--remove-orphans'], env);
    }

    async composeDown(stackPath, env = {}) {
        return this._runCompose(stackPath, ['down', '--remove-orphans'], env);
    }

    async composeRestart(stackPath, serviceName = null, env = {}) {
        const args = ['restart'];
        if (serviceName) args.push(serviceName);
        return this._runCompose(stackPath, args, env);
    }

    async composeStop(stackPath, serviceName = null, env = {}) {
        const args = ['stop'];
        if (serviceName) args.push(serviceName);
        return this._runCompose(stackPath, args, env);
    }

    async composeStart(stackPath, serviceName = null, env = {}) {
        const args = ['start'];
        if (serviceName) args.push(serviceName);
        return this._runCompose(stackPath, args, env);
    }

    async composePull(stackPath, env = {}) {
        return this._runCompose(stackPath, ['pull'], env);
    }

    async composeConfig(stackPath, env = {}) {
        return this._runCompose(stackPath, ['config'], env);
    }

    async composePs(stackPath, env = {}) {
        const result = await this._runCompose(stackPath, ['ps', '--format', 'json'], env);
        try {
            return JSON.parse(result.output);
        } catch {
            return result.output;
        }
    }

    _runCompose(stackPath, args, env = {}) {
        if (!this.dockerCliAvailable) {
            return Promise.reject(new Error('docker CLI not available. Please rebuild the image or mount the host docker binary.'));
        }
        const hostPath = this._toHostPath(stackPath);
        const composeFile = this._findComposeFile(stackPath);
        if (!composeFile) {
            return Promise.reject(new Error(`No compose file found in ${stackPath}`));
        }
        const composeArgs = ['-f', path.join(hostPath, composeFile), ...args];
        console.log(`[Docker] docker compose ${composeArgs.join(' ')}`);
        return new Promise((resolve, reject) => {
            const envVars = { ...process.env, ...env };
            const proc = spawn('docker', ['compose', ...composeArgs], {
                cwd: hostPath,
                env: envVars,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ output: stdout, code });
                } else {
                    reject(new Error(stderr || stdout || `Process exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to run docker compose: ${err.message}`));
            });
        });
    }

    runComposeInteractive(stackPath, args, env = {}) {
        const hostPath = this._toHostPath(stackPath);
        const composeFile = this._findComposeFile(stackPath);
        if (!composeFile) {
            throw new Error(`No compose file found in ${stackPath}`);
        }
        const composeArgs = ['-f', path.join(hostPath, composeFile), ...args];
        console.log(`[Docker] docker compose ${composeArgs.join(' ')} (interactive)`);
        const envVars = { ...process.env, ...env };
        return spawn('docker', ['compose', ...composeArgs], {
            cwd: hostPath,
            env: envVars,
        });
    }
}

module.exports = { DockerService };
