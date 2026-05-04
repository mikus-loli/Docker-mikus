const Docker = require('dockerode');
const { spawn } = require('child_process');
const path = require('path');

class DockerService {
    constructor(stacksDir, hostStacksDir) {
        this.docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
        this.stacksDir = stacksDir || '/app/stacks';
        this.hostStacksDir = hostStacksDir || this.stacksDir;
    }

    _toHostPath(stackPath) {
        if (this.hostStacksDir !== this.stacksDir) {
            const relative = path.relative(this.stacksDir, stackPath);
            return path.join(this.hostStacksDir, relative);
        }
        return stackPath;
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
        const hostPath = this._toHostPath(stackPath);
        return new Promise((resolve, reject) => {
            const envVars = { ...process.env, ...env };
            const proc = spawn('docker', ['compose', ...args], {
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
        const envVars = { ...process.env, ...env };
        return spawn('docker', ['compose', ...args], {
            cwd: hostPath,
            env: envVars,
        });
    }
}

module.exports = { DockerService };
