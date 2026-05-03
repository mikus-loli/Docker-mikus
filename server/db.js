const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

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
            };
            this._save();
        } else {
            this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        }
    }

    _save() {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
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
            this.data.users[idx] = { ...this.data.users[idx], ...updates };
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

    close() {
        this._save();
    }
}

function initDB(dataDir) {
    const db = new JsonDB(dataDir);

    if (db.data.users.length === 0) {
        const defaultPassword = bcrypt.hashSync('admin', 10);
        db.createUser({
            id: 'default-admin',
            username: 'admin',
            password: defaultPassword,
            role: 'admin',
            created_at: new Date().toISOString(),
        });
        console.log('Default admin user created (username: admin, password: admin)');
        console.log('IMPORTANT: Change the default password after first login!');
    }

    return db;
}

module.exports = { initDB };
