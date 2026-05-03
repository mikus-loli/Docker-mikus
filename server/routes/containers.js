const router = require('express').Router();

function createContainerRoutes(dockerService) {
    router.get('/', async (req, res) => {
        try {
            const all = req.query.all === 'true';
            const containers = await dockerService.listContainers(all);
            res.json(containers);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const id = req.params.id;
            if (!/^[a-zA-Z0-9]+$/.test(id)) {
                return res.status(400).json({ error: 'Invalid container ID' });
            }
            const info = await dockerService.getContainerInfo(id);
            res.json(info);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/:id/start', async (req, res) => {
        try {
            await dockerService.startContainer(req.params.id);
            res.json({ message: 'Container started' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:id/stop', async (req, res) => {
        try {
            await dockerService.stopContainer(req.params.id);
            res.json({ message: 'Container stopped' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:id/restart', async (req, res) => {
        try {
            await dockerService.restartContainer(req.params.id);
            res.json({ message: 'Container restarted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await dockerService.removeContainer(req.params.id);
            res.json({ message: 'Container removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:id/logs', async (req, res) => {
        try {
            const tail = Math.min(parseInt(req.query.tail) || 100, 5000);
            const since = parseInt(req.query.since) || 0;
            const logs = await dockerService.getContainerLogs(req.params.id, { tail, since });
            res.json({ logs: logs.toString('utf8') });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:id/stats', async (req, res) => {
        try {
            const stats = await dockerService.getContainerStats(req.params.id);
            res.json(JSON.parse(stats.toString()));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createContainerRoutes };
