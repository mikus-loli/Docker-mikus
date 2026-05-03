const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function getOrCreateSecret(dataDir) {
    const secretPath = path.join(dataDir, '.jwt_secret');

    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }

    if (fs.existsSync(secretPath)) {
        const saved = fs.readFileSync(secretPath, 'utf8').trim();
        if (saved.length >= 32) {
            return saved;
        }
    }

    const secret = crypto.randomBytes(64).toString('hex');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 });

    console.log('JWT secret auto-generated and saved to: ' + secretPath);
    return secret;
}

module.exports = { getOrCreateSecret };
