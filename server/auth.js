const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_MAP_SIZE = 10000;

function isLocked(key) {
    const record = loginAttempts.get(key);
    if (!record) return false;
    if (record.attempts < MAX_ATTEMPTS) return false;
    if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
        loginAttempts.delete(key);
        return false;
    }
    return true;
}

function recordFailedAttempt(key) {
    if (loginAttempts.size >= MAX_MAP_SIZE) {
        const oldest = [...loginAttempts.entries()].sort((a, b) => a[1].lastAttempt - b[1].lastAttempt);
        for (let i = 0; i < Math.floor(MAX_MAP_SIZE / 2); i++) {
            loginAttempts.delete(oldest[i][0]);
        }
    }
    const record = loginAttempts.get(key) || { attempts: 0, lastAttempt: 0 };
    record.attempts += 1;
    record.lastAttempt = Date.now();
    loginAttempts.set(key, record);
}

function clearAttempts(key) {
    loginAttempts.delete(key);
}

function validatePasswordStrength(password) {
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }
    if (password.length > 128) {
        return { valid: false, error: 'Password must be at most 128 characters' };
    }
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const categories = [hasLower, hasUpper, hasDigit].filter(Boolean).length;
    if (categories < 2) {
        return { valid: false, error: 'Password must contain at least two of: lowercase, uppercase, digits' };
    }
    return { valid: true };
}

const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_EXPIRY = '7d';

function createAuthRoutes(db, jwtSecret) {
    const router = require('express').Router();

    router.post('/login', (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        const { username } = req.body;
        const ipKey = `ip:${ip}`;
        const userKey = username ? `user:${username.toLowerCase()}` : null;

        if (isLocked(ipKey)) {
            return res.status(429).json({ error: 'Too many login attempts from your IP. Try again later.' });
        }
        if (userKey && isLocked(userKey)) {
            return res.status(429).json({ error: 'Too many login attempts for this account. Try again later.' });
        }

        const { username: uname, password } = req.body;

        if (!uname || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = db.getUserByUsername(uname);
        if (!user) {
            recordFailedAttempt(ipKey);
            if (userKey) recordFailedAttempt(userKey);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            recordFailedAttempt(ipKey);
            recordFailedAttempt(`user:${uname.toLowerCase()}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        clearAttempts(ipKey);
        clearAttempts(`user:${uname.toLowerCase()}`);

        if (user.must_change_password) {
            db.deleteCredentialFile();
        }

        const tokenId = crypto.randomUUID();
        const refreshTokenId = crypto.randomUUID();
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, tid: tokenId, type: 'access' },
            jwtSecret,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );
        const refreshToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role, tid: refreshTokenId, type: 'refresh' },
            jwtSecret,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: user.must_change_password || false,
            }
        });
    });

    router.post('/refresh', (req, res) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        try {
            const decoded = jwt.verify(refreshToken, jwtSecret);
            if (decoded.type !== 'refresh') {
                return res.status(401).json({ error: 'Invalid token type' });
            }
            if (db && decoded.tid && db.isTokenBlacklisted(decoded.tid)) {
                return res.status(401).json({ error: 'Token has been revoked' });
            }
            const user = db.getUserById(decoded.id);
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }
            if (decoded.tid) {
                db.blacklistToken(decoded.tid, decoded.exp);
            }
            const tokenId = crypto.randomUUID();
            const newRefreshTokenId = crypto.randomUUID();
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, tid: tokenId, type: 'access' },
                jwtSecret,
                { expiresIn: ACCESS_TOKEN_EXPIRY }
            );
            const newRefreshToken = jwt.sign(
                { id: user.id, username: user.username, role: user.role, tid: newRefreshTokenId, type: 'refresh' },
                jwtSecret,
                { expiresIn: REFRESH_TOKEN_EXPIRY }
            );
            res.json({ token, refreshToken: newRefreshToken });
        } catch {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
    });

    router.post('/logout', authMiddleware(jwtSecret, db), (req, res) => {
        if (req.user.tid) {
            db.blacklistToken(req.user.tid, req.user.exp);
        }
        const { refreshToken } = req.body;
        if (refreshToken) {
            try {
                const decoded = jwt.verify(refreshToken, jwtSecret);
                if (decoded.tid) {
                    db.blacklistToken(decoded.tid, decoded.exp);
                }
            } catch {}
        }
        res.json({ message: 'Logged out' });
    });

    router.post('/change-password', authMiddleware(jwtSecret, db), (req, res) => {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const user = db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = bcrypt.compareSync(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 12);
        db.updateUser(user.id, { password: hashedPassword, must_change_password: false });

        if (req.user.tid) {
            db.blacklistToken(req.user.tid, req.user.exp);
        }

        const tokenId = crypto.randomUUID();
        const refreshTokenId = crypto.randomUUID();
        const newToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role, tid: tokenId, type: 'access' },
            jwtSecret,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );
        const newRefreshToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role, tid: refreshTokenId, type: 'refresh' },
            jwtSecret,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        res.json({
            message: 'Password changed successfully',
            token: newToken,
            refreshToken: newRefreshToken,
        });
    });

    router.get('/me', authMiddleware(jwtSecret, db), (req, res) => {
        const user = db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            created_at: user.created_at,
            must_change_password: user.must_change_password || false,
        });
    });

    return router;
}

function authMiddleware(jwtSecret, db) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, jwtSecret);

            if (decoded.type === 'refresh') {
                return res.status(401).json({ error: 'Use access token for API requests' });
            }

            if (db && decoded.tid && db.isTokenBlacklisted(decoded.tid)) {
                return res.status(401).json({ error: 'Token has been revoked' });
            }

            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
}

module.exports = { createAuthRoutes, authMiddleware };
