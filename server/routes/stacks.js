const router = require('express').Router();

function createStackRoutes(stackManager) {
    router.get('/', async (req, res) => {
        try {
            const stacks = await stackManager.listStacks();
            res.json(stacks);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:name', async (req, res) => {
        try {
            const name = req.params.name;
            if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const stack = await stackManager.getStack(name);
            res.json(stack);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { name, compose, env } = req.body;
            if (!name || !compose) {
                return res.status(400).json({ error: 'Name and compose content are required' });
            }
            if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
                return res.status(400).json({ error: 'Invalid stack name format' });
            }
            const stack = await stackManager.createStack(name, compose, env);
            res.status(201).json(stack);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:name', async (req, res) => {
        try {
            const { compose, env } = req.body;
            if (!compose) {
                return res.status(400).json({ error: 'Compose content is required' });
            }
            const name = req.params.name;
            if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const stack = await stackManager.updateStack(name, compose, env);
            res.json(stack);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.delete('/:name', async (req, res) => {
        try {
            const name = req.params.name;
            if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const result = await stackManager.deleteStack(name);
            res.json(result);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.get('/:name/compose', async (req, res) => {
        try {
            const data = await stackManager.getStackCompose(req.params.name);
            res.json(data);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/:name/up', async (req, res) => {
        try {
            const result = await stackManager.upStack(req.params.name);
            res.json({ message: 'Stack started', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:name/down', async (req, res) => {
        try {
            const result = await stackManager.downStack(req.params.name);
            res.json({ message: 'Stack stopped', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:name/restart', async (req, res) => {
        try {
            const { service } = req.body;
            const result = await stackManager.restartStack(req.params.name, service);
            res.json({ message: 'Stack restarted', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:name/stop', async (req, res) => {
        try {
            const { service } = req.body;
            const result = await stackManager.stopStack(req.params.name, service);
            res.json({ message: 'Stack stopped', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:name/start', async (req, res) => {
        try {
            const { service } = req.body;
            const result = await stackManager.startStack(req.params.name, service);
            res.json({ message: 'Stack started', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:name/pull', async (req, res) => {
        try {
            const result = await stackManager.pullStack(req.params.name);
            res.json({ message: 'Images pulled', output: result.output });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:name/services', async (req, res) => {
        try {
            const services = await stackManager.getStackServices(req.params.name);
            res.json(services);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createStackRoutes };
