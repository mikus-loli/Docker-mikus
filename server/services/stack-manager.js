const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const { v4: uuidv4 } = require('uuid');

class StackManager {
    constructor(stacksDir, dockerService) {
        this.stacksDir = stacksDir;
        this.docker = dockerService;
        this.watcher = null;
        this._ensureStacksDir();
    }

    _ensureStacksDir() {
        if (!fs.existsSync(this.stacksDir)) {
            fs.mkdirSync(this.stacksDir, { recursive: true });
        }
    }

    async listStacks() {
        this._ensureStacksDir();
        const entries = fs.readdirSync(this.stacksDir, { withFileTypes: true });
        const stacks = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const stackPath = path.join(this.stacksDir, entry.name);
                const composeFile = this._findComposeFile(stackPath);
                if (composeFile) {
                    try {
                        const stack = await this._buildStackInfo(entry.name, stackPath, composeFile);
                        stacks.push(stack);
                    } catch (err) {
                        stacks.push({
                            name: entry.name,
                            path: stackPath,
                            status: 'error',
                            error: err.message,
                            services: [],
                        });
                    }
                }
            }
        }

        return stacks;
    }

    async getStack(name) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }

        const composeFile = this._findComposeFile(stackPath);
        if (!composeFile) {
            throw new Error(`No compose file found in stack "${name}"`);
        }

        return this._buildStackInfo(name, stackPath, composeFile);
    }

    async createStack(name, content, envContent = '') {
        const stackPath = path.join(this.stacksDir, name);

        if (fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" already exists`);
        }

        fs.mkdirSync(stackPath, { recursive: true });

        const composePath = path.join(stackPath, 'docker-compose.yml');
        fs.writeFileSync(composePath, content, 'utf8');

        if (envContent) {
            const envPath = path.join(stackPath, '.env');
            fs.writeFileSync(envPath, envContent, 'utf8');
        }

        return this._buildStackInfo(name, stackPath, composePath);
    }

    async updateStack(name, content, envContent = null) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }

        const composePath = path.join(stackPath, 'docker-compose.yml');
        fs.writeFileSync(composePath, content, 'utf8');

        if (envContent !== null) {
            const envPath = path.join(stackPath, '.env');
            fs.writeFileSync(envPath, envContent, 'utf8');
        }

        const composeFile = this._findComposeFile(stackPath);
        return this._buildStackInfo(name, stackPath, composeFile);
    }

    async deleteStack(name) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }

        fs.rmSync(stackPath, { recursive: true, force: true });
        return { message: `Stack "${name}" deleted` };
    }

    async getStackCompose(name) {
        const stackPath = path.join(this.stacksDir, name);
        const composeFile = this._findComposeFile(stackPath);
        if (!composeFile) {
            throw new Error(`No compose file found in stack "${name}"`);
        }

        const content = fs.readFileSync(composeFile, 'utf8');

        let envContent = null;
        const envPath = path.join(stackPath, '.env');
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        return { compose: content, env: envContent, filePath: composeFile };
    }

    async upStack(name) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composeUp(stackPath, env);
    }

    async downStack(name) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composeDown(stackPath, env);
    }

    async restartStack(name, serviceName = null) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composeRestart(stackPath, serviceName, env);
    }

    async stopStack(name, serviceName = null) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composeStop(stackPath, serviceName, env);
    }

    async startStack(name, serviceName = null) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composeStart(stackPath, serviceName, env);
    }

    async pullStack(name) {
        const stackPath = path.join(this.stacksDir, name);
        if (!fs.existsSync(stackPath)) {
            throw new Error(`Stack "${name}" not found`);
        }
        const env = this._loadEnv(stackPath);
        return this.docker.composePull(stackPath, env);
    }

    async getStackServices(name) {
        const stackPath = path.join(this.stacksDir, name);
        const composeFile = this._findComposeFile(stackPath);
        if (!composeFile) return [];

        const content = fs.readFileSync(composeFile, 'utf8');
        const parsed = yaml.load(content);
        const services = parsed?.services || {};

        const allContainers = await this.docker.listContainers(true);
        const stackContainers = allContainers.filter(c =>
            c.Labels?.['com.docker.compose.project'] === name
        );

        return Object.entries(services).map(([serviceName, serviceDef]) => {
            const container = stackContainers.find(c =>
                c.Labels?.['com.docker.compose.service'] === serviceName
            );

            return {
                name: serviceName,
                image: serviceDef.image || 'N/A',
                status: container ? container.State : 'not created',
                containerId: container?.Id?.substring(0, 12) || null,
                ports: container?.Ports || [],
                health: container?.Status || null,
            };
        });
    }

    async _buildStackInfo(name, stackPath, composeFile) {
        const content = fs.readFileSync(composeFile, 'utf8');
        let parsed;
        try {
            parsed = yaml.load(content);
        } catch (err) {
            return {
                name,
                path: stackPath,
                status: 'invalid',
                error: `Invalid YAML: ${err.message}`,
                services: [],
                serviceCount: 0,
            };
        }

        const serviceNames = Object.keys(parsed?.services || {});
        const allContainers = await this.docker.listContainers(true);
        const stackContainers = allContainers.filter(c =>
            c.Labels?.['com.docker.compose.project'] === name
        );

        const running = stackContainers.filter(c => c.State === 'running').length;
        const total = serviceNames.length;

        let status;
        if (running === 0 && stackContainers.length === 0) {
            status = 'inactive';
        } else if (running === total) {
            status = 'running';
        } else if (running > 0) {
            status = 'partial';
        } else {
            status = 'stopped';
        }

        const services = serviceNames.map(svcName => {
            const container = stackContainers.find(c =>
                c.Labels?.['com.docker.compose.service'] === svcName
            );
            return {
                name: svcName,
                status: container ? container.State : 'not created',
                containerId: container?.Id?.substring(0, 12) || null,
            };
        });

        return {
            name,
            path: stackPath,
            status,
            services,
            serviceCount: total,
            runningCount: running,
        };
    }

    _findComposeFile(dir) {
        const names = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
        for (const name of names) {
            const filePath = path.join(dir, name);
            if (fs.existsSync(filePath)) return filePath;
        }
        return null;
    }

    _loadEnv(stackPath) {
        const envPath = path.join(stackPath, '.env');
        if (!fs.existsSync(envPath)) return {};

        const content = fs.readFileSync(envPath, 'utf8');
        const env = {};
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return env;
    }

    startWatching() {
        this.watcher = chokidar.watch(this.stacksDir, {
            ignoreInitial: true,
            depth: 1,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100,
            },
        });

        this.watcher.on('all', (event, filePath) => {
            console.log(`[Watcher] ${event}: ${filePath}`);
        });
    }

    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}

module.exports = { StackManager };
