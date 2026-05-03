const router = require('express').Router();

const CONTAINER_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

function validateContainerId(id) {
    return CONTAINER_ID_REGEX.test(id);
}

function createContainerRoutes(dockerService) {
    router.get('/', async (req, res) => {
        try {
            const all = req.query.all === 'true';
            const containers = await dockerService.listContainers(all);
            res.json(containers);
        } catch (err) {
            res.status(500).json({ error: 'Failed to list containers' });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            const info = await dockerService.getContainerInfo(id);
            res.json(info);
        } catch (err) {
            res.status(404).json({ error: 'Container not found' });
        }
    });

    router.post('/:id/start', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            await dockerService.startContainer(id);
            res.json({ message: 'Container started' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to start container' });
        }
    });

    router.post('/:id/stop', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            await dockerService.stopContainer(id);
            res.json({ message: 'Container stopped' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to stop container' });
        }
    });

    router.post('/:id/restart', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            await dockerService.restartContainer(id);
            res.json({ message: 'Container restarted' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to restart container' });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            await dockerService.removeContainer(id);
            res.json({ message: 'Container removed' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to remove container' });
        }
    });

    router.get('/:id/logs', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            const tail = Math.min(parseInt(req.query.tail) || 100, 5000);
            const since = parseInt(req.query.since) || 0;
            const logs = await dockerService.getContainerLogs(id, { tail, since });
            res.json({ logs: logs.toString('utf8') });
        } catch (err) {
            res.status(500).json({ error: 'Failed to get container logs' });
        }
    });

    router.get('/:id/stats', async (req, res) => {
        try {
            const id = req.params.id;
            if (!validateContainerId(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            const stats = await dockerService.getContainerStats(id);
            res.json(JSON.parse(stats.toString()));
        } catch (err) {
            res.status(500).json({ error: 'Failed to get container stats' });
        }
    });

    return router;
}

module.exports = { createContainerRoutes };
