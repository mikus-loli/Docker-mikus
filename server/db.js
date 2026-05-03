const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ALLOWED_UPDATE_FIELDS = ['password', 'must_change_password'];

class JsonDB {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.dbPath = path.join(dataDir, 'mikus.json');

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        if (!fs.existsSync(this.dbPath)) {
            this.data = {
                users: [],
                settings: {},
                tokenBlacklist: [],
            };
            this._save();
        } else {
            this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            if (!this.data.tokenBlacklist) {
                this.data.tokenBlacklist = [];
            }
        }
    }

    _save() {
        const tmpPath = this.dbPath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
        fs.renameSync(tmpPath, this.dbPath);
    }

    getUserByUsername(username) {
        return this.data.users.find((u) => u.username === username) || null;
    }

    getUserById(id) {
        return this.data.users.find((u) => u.id === id) || null;
    }

    createUser(user) {
        this.data.users.push(user);
        this._save();
        return user;
    }

    updateUser(id, updates) {
        const idx = this.data.users.findIndex((u) => u.id === id);
        if (idx !== -1) {
            const filtered = {};
            for (const key of ALLOWED_UPDATE_FIELDS) {
                if (updates[key] !== undefined) {
                    filtered[key] = updates[key];
                }
            }
            this.data.users[idx] = { ...this.data.users[idx], ...filtered };
            this._save();
            return this.data.users[idx];
        }
        return null;
    }

    getSetting(key) {
        return this.data.settings[key] || null;
    }

    setSetting(key, value) {
        this.data.settings[key] = value;
        this._save();
    }

    blacklistToken(tokenId, exp) {
        this.data.tokenBlacklist.push({ id: tokenId, exp });
        this.cleanBlacklist();
        this._save();
    }

    isTokenBlacklisted(tokenId) {
        this.cleanBlacklist();
        return this.data.tokenBlacklist.some((t) => t.id === tokenId);
    }

    cleanBlacklist() {
        const now = Date.now() / 1000;
        this.data.tokenBlacklist = this.data.tokenBlacklist.filter((t) => t.exp > now);
    }

    deleteCredentialFile() {
        const credPath = path.join(this.dataDir, 'initial-credentials.txt');
        try {
            if (fs.existsSync(credPath)) {
                fs.unlinkSync(credPath);
                console.log('Initial credentials file deleted.');
            }
        } catch (err) {
            console.error('Failed to delete credentials file:', err.message);
        }
    }

    close() {
        this._save();
    }
}

function generatePassword(length = 16) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

function initDB(dataDir) {
    const db = new JsonDB(dataDir);

    if (db.data.users.length === 0) {
        const defaultPassword = generatePassword(16);
        const hashedPassword = bcrypt.hashSync(defaultPassword, 12);
        db.createUser({
            id: crypto.randomUUID(),
            username: 'admin',
            password: hashedPassword,
            role: 'admin',
            created_at: new Date().toISOString(),
            must_change_password: true,
        });

        const credPath = path.join(dataDir, 'initial-credentials.txt');
        fs.writeFileSync(credPath, `Mikus Initial Credentials\n========================\nUsername: admin\nPassword: ${defaultPassword}\n\nIMPORTANT: This password was auto-generated for security.\nPlease change it after first login.\nThis file will be automatically deleted after first successful login.\n`, { encoding: 'utf8', mode: 0o600 });

        console.log('==========================================');
        console.log('  Admin credentials auto-generated!');
        console.log('==========================================');
        console.log(`  Username: admin`);
        console.log(`  Password: ${defaultPassword}`);
        console.log('');
        console.log(`  Saved to: ${credPath}`);
        console.log('  This file will be deleted after first login.');
        console.log('==========================================');
    }

    return db;
}

module.exports = { initDB };
