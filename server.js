const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const { db } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const activeUsers = {}; // socket.id -> { id, username }

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register', async (data) => {
        try {
            const hash = await bcrypt.hash(data.password, 10);
            db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [data.username, hash], function(err) {
                if (err) return socket.emit('auth_error', 'Username already exists.');
                socket.emit('auth_success', { id: this.lastID, username: data.username });
            });
        } catch (e) {
            socket.emit('auth_error', 'Server error.');
        }
    });

    socket.on('login', (data) => {
        db.get(`SELECT * FROM users WHERE username = ?`, [data.username], async (err, row) => {
            if (err || !row) return socket.emit('auth_error', 'Invalid credentials.');
            const match = await bcrypt.compare(data.password, row.password);
            if (!match) return socket.emit('auth_error', 'Invalid credentials.');
            
            activeUsers[socket.id] = { id: row.id, username: row.username };
            socket.emit('login_success', row);
            io.emit('chat_message', { author: 'System', text: `${row.username} logged in.` });
            
            // Broadcast active players to everyone
            io.emit('active_players', Object.values(activeUsers));
        });
    });

    socket.on('send_chat', (text) => {
        const user = activeUsers[socket.id];
        if (user) {
            io.emit('chat_message', { author: user.username, text: text });
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            io.emit('chat_message', { author: 'System', text: `${user.username} logged out.` });
            delete activeUsers[socket.id];
            io.emit('active_players', Object.values(activeUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Neon Syndicate Multiplayer Server running on port ${PORT}`);
});
