const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            cash INTEGER DEFAULT 5000,
            bank INTEGER DEFAULT 0,
            tokens INTEGER DEFAULT 100,
            location TEXT DEFAULT 'Torn City',
            energy INTEGER DEFAULT 100,
            nerve INTEGER DEFAULT 10,
            life INTEGER DEFAULT 100,
            happy INTEGER DEFAULT 100,
            str REAL DEFAULT 10,
            def REAL DEFAULT 10,
            spd REAL DEFAULT 10,
            dex REAL DEFAULT 10,
            jailTime INTEGER DEFAULT 0,
            property TEXT DEFAULT 'shack'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            itemId TEXT,
            qty INTEGER DEFAULT 0,
            UNIQUE(userId, itemId)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS market (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            itemId TEXT,
            price INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS bounties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            targetId INTEGER,
            placerId INTEGER,
            reward INTEGER
        )`);
    });
}

initDb();

module.exports = { db };
