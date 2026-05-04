const router = require('express').Router();

const STACK_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

function validateStackName(name) {
    return STACK_NAME_REGEX.test(name);
}

function createStackRoutes(stackManager) {
    router.get('/', async (req, res) => {
        try {
            const stacks = await stackManager.listStacks();
            res.json(stacks);
        } catch (err) {
            res.status(500).json({ error: 'Failed to list stacks' });
        }
    });

    router.get('/:name', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const stack = await stackManager.getStack(name);
            res.json(stack);
        } catch (err) {
            res.status(404).json({ error: 'Stack not found' });
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
            res.status(400).json({ error: 'Failed to create stack' });
        }
    });

    router.put('/:name', async (req, res) => {
        try {
            const { compose, env } = req.body;
            if (!compose) {
                return res.status(400).json({ error: 'Compose content is required' });
            }
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const stack = await stackManager.updateStack(name, compose, env);
            res.json(stack);
        } catch (err) {
            res.status(404).json({ error: 'Stack not found' });
        }
    });

    router.delete('/:name', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const result = await stackManager.deleteStack(name);
            res.json(result);
        } catch (err) {
            res.status(404).json({ error: 'Stack not found' });
        }
    });

    router.get('/:name/compose', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const data = await stackManager.getStackCompose(name);
            res.json(data);
        } catch (err) {
            res.status(404).json({ error: 'Stack not found' });
        }
    });

    router.post('/:name/up', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const result = await stackManager.upStack(name);
            res.json({ message: 'Stack started', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to start ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to start stack: ${err.message}` });
        }
    });

    router.post('/:name/down', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const result = await stackManager.downStack(name);
            res.json({ message: 'Stack stopped', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to stop ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to stop stack: ${err.message}` });
        }
    });

    router.post('/:name/restart', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const { service } = req.body;
            const result = await stackManager.restartStack(name, service);
            res.json({ message: 'Stack restarted', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to restart ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to restart stack: ${err.message}` });
        }
    });

    router.post('/:name/stop', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const { service } = req.body;
            const result = await stackManager.stopStack(name, service);
            res.json({ message: 'Stack stopped', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to stop ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to stop stack: ${err.message}` });
        }
    });

    router.post('/:name/start', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const { service } = req.body;
            const result = await stackManager.startStack(name, service);
            res.json({ message: 'Stack started', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to start ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to start stack: ${err.message}` });
        }
    });

    router.post('/:name/pull', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const result = await stackManager.pullStack(name);
            res.json({ message: 'Images pulled', output: result.output });
        } catch (err) {
            console.error(`[Stack] Failed to pull ${req.params.name}:`, err.message);
            res.status(500).json({ error: `Failed to pull images: ${err.message}` });
        }
    });

    router.get('/:name/services', async (req, res) => {
        try {
            const name = req.params.name;
            if (!validateStackName(name)) {
                return res.status(400).json({ error: 'Invalid stack name' });
            }
            const services = await stackManager.getStackServices(name);
            res.json(services);
        } catch (err) {
            res.status(500).json({ error: 'Failed to get stack services' });
        }
    });

    return router;
}

module.exports = { createStackRoutes };
