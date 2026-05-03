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
            const info = await dockerService.getContainerInfo(req.params.id);
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
            const { tail = 100, since = 0 } = req.query;
            const logs = await dockerService.getContainerLogs(req.params.id, {
                tail: parseInt(tail),
                since: parseInt(since),
            });
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
