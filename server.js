const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('./db');

let ITEMS = [];
try { ITEMS = require('./constants.js').ITEMS; } 
catch(e) { try { ITEMS = require('./public/constants.js').ITEMS; } catch(e2) {} }

// Inflation Base Tracker
let liveCityMarket = ITEMS.map(i => ({ id: i.id, baseCost: i.cost, currentCost: i.cost }));

setInterval(() => {
    // Inflation loop: random walk
    liveCityMarket.forEach(item => {
        if(item.baseCost > 0) {
            const volatility = item.baseCost * 0.05;
            const change = (Math.random() * volatility * 2) - volatility;
            item.currentCost = Math.max(1, Math.floor(item.currentCost + change));
        }
    });
    io.emit('city_market_update', liveCityMarket);
}, 60000); // update every 60s

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const activeUsers = {}; // socket.id -> { id, username }

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Ensure token column exists
    db.run("ALTER TABLE users ADD COLUMN token TEXT", () => {});

    socket.on('register', async (data) => {
        try {
            const hash = await bcrypt.hash(data.password, 10);
            const token = crypto.randomBytes(32).toString('hex');
            db.run(`INSERT INTO users (username, password, token) VALUES (?, ?, ?)`, [data.username, hash, token], function(err) {
                if (err) return socket.emit('auth_error', 'Username already exists.');
                socket.emit('auth_success', { id: this.lastID, username: data.username, token: token });
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
            
            // Check for daily reset
            const today = new Date().toISOString().split('T')[0];
            if (row.lastActiveDate !== today) {
                db.run('UPDATE users SET dailyItemsBought = 0, lastActiveDate = ? WHERE id = ?', [today, row.id]);
                row.dailyItemsBought = 0;
                row.lastActiveDate = today;
            }

            // Generate new token for this session
            const token = crypto.randomBytes(32).toString('hex');
            db.run('UPDATE users SET token = ? WHERE id = ?', [token, row.id]);
            row.token = token;

            // Load Inventory
            db.all(`SELECT itemId, qty FROM inventory WHERE userId = ?`, [row.id], (err, invRows) => {
                const inventory = {};
                if (invRows) invRows.forEach(i => inventory[i.itemId] = i.qty);
                
                row.inventory = inventory;
                socket.emit('login_success', row);
                socket.emit('city_market_update', liveCityMarket);
                io.emit('chat_message', { author: 'System', text: `${row.username} logged in.` });
                io.emit('active_players', Object.values(activeUsers));
            });
        });
    });

    socket.on('login_token', (token) => {
        db.get(`SELECT * FROM users WHERE token = ?`, [token], (err, row) => {
            if (err || !row) return socket.emit('auth_error', 'Session expired.');
            
            activeUsers[socket.id] = { id: row.id, username: row.username };
            
            // Check for daily reset
            const today = new Date().toISOString().split('T')[0];
            if (row.lastActiveDate !== today) {
                db.run('UPDATE users SET dailyItemsBought = 0, lastActiveDate = ? WHERE id = ?', [today, row.id]);
                row.dailyItemsBought = 0;
                row.lastActiveDate = today;
            }

            // Load Inventory
            db.all(`SELECT itemId, qty FROM inventory WHERE userId = ?`, [row.id], (err, invRows) => {
                const inventory = {};
                if (invRows) invRows.forEach(i => inventory[i.itemId] = i.qty);
                
                row.inventory = inventory;
                socket.emit('login_success', row);
                socket.emit('city_market_update', liveCityMarket);
                io.emit('chat_message', { author: 'System', text: `${row.username} logged in.` });
                io.emit('active_players', Object.values(activeUsers));
            });
        });
    });

    socket.on('send_chat', (text) => {
        const user = activeUsers[socket.id];
        if (user) {
            io.emit('chat_message', { author: user.username, text: text });
        }
    });

    socket.on('attack_player', (targetId) => {
        const attacker = activeUsers[socket.id];
        if (!attacker) return;
        
        db.get('SELECT * FROM users WHERE id = ?', [attacker.id], (err, attDb) => {
            db.get('SELECT * FROM users WHERE id = ?', [targetId], (err, tarDb) => {
                if (!tarDb || !attDb) return socket.emit('combat_error', 'Player not found.');
                if (attDb.life <= 0) return socket.emit('combat_error', 'You are in the hospital!');
                if (tarDb.life <= 0) return socket.emit('combat_error', 'Target is currently in the hospital.');
                if (attDb.energy < 25) return socket.emit('combat_error', 'Not enough energy. Need 25.');

                // Deduct 25 energy
                db.run('UPDATE users SET energy = energy - 25 WHERE id = ?', [attDb.id]);

                const attStats = attDb.str + attDb.def + attDb.spd + attDb.dex;
                const tarStats = tarDb.str + tarDb.def + tarDb.spd + tarDb.dex;

                const attRoll = attStats * (0.8 + Math.random() * 0.4);
                const tarRoll = tarStats * (0.8 + Math.random() * 0.4);

                if (attRoll >= tarRoll) {
                    const loot = Math.floor(tarDb.cash * 0.10);
                    db.run('UPDATE users SET cash = cash + ? WHERE id = ?', [loot, attDb.id]);
                    db.run('UPDATE users SET cash = CASE WHEN cash - ? < 0 THEN 0 ELSE cash - ? END, life = 0 WHERE id = ?', [loot, loot, tarDb.id]);

                    // Check for active bounties to claim
                    db.get('SELECT * FROM bounties WHERE targetId = ? LIMIT 1', [tarDb.id], (err, bounty) => {
                        let bountyReward = 0;
                        if (bounty) {
                            bountyReward = bounty.reward;
                            db.run('UPDATE users SET cash = cash + ? WHERE id = ?', [bountyReward, attDb.id]);
                            db.run('DELETE FROM bounties WHERE id = ?', [bounty.id]);
                            broadcastBounties();
                        }
                        
                        socket.emit('combat_win', { target: tarDb.username, loot: loot, bounty: bountyReward });
                        
                        const targetSocketId = Object.keys(activeUsers).find(key => activeUsers[key].id === targetId);
                        if (targetSocketId) {
                            io.to(targetSocketId).emit('attacked_by', { attacker: attDb.username, loot: loot });
                        }
                    });

                } else {
                    db.run('UPDATE users SET life = 0 WHERE id = ?', [attDb.id]);
                    socket.emit('combat_lose', { target: tarDb.username });
                }
            });
        });
    });

    // ---- BOUNTIES ----
    function broadcastBounties() {
        db.all(`SELECT b.id, b.reward, u.username as targetName, p.username as placerName 
                FROM bounties b 
                JOIN users u ON b.targetId = u.id 
                JOIN users p ON b.placerId = p.id
                ORDER BY b.reward DESC LIMIT 50`, [], (err, rows) => {
            if (!err) io.emit('bounties_data', rows);
        });
    }

    socket.on('get_bounties', () => broadcastBounties());

    socket.on('place_bounty', (data) => {
        const placer = activeUsers[socket.id];
        if (!placer) return;
        
        const reward = parseInt(data.reward);
        const count = parseInt(data.count) || 1;
        if (reward < 1000) return socket.emit('modal', { title: 'Error', msg: 'Minimum bounty is $1,000.' });
        if (count < 1 || count > 200) return socket.emit('modal', { title: 'Error', msg: 'Quantity must be between 1 and 200.' });
        const totalCost = reward * count;
            
        db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [data.target], (err, targetDb) => {
            if (!targetDb) return socket.emit('modal', { title: 'Error', msg: 'Target player not found.' });
            if (targetDb.id === placer.id) return socket.emit('modal', { title: 'Error', msg: 'You cannot bounty yourself.' });
            
            // Check limit: 10 distinct targets
            db.get('SELECT COUNT(DISTINCT targetId) as distinctTargets FROM bounties WHERE placerId = ?', [placer.id], (err, row) => {
                db.get('SELECT COUNT(*) as currentBounties FROM bounties WHERE placerId = ? AND targetId = ?', [placer.id, targetDb.id], (err, row2) => {
                    
                    const isNewTarget = (row2.currentBounties === 0);
                    if (isNewTarget && row.distinctTargets >= 10) return socket.emit('modal', { title: 'Error', msg: 'You can only have active bounties on 10 different people at once.' });
                    if (row2.currentBounties + count > 200) return socket.emit('modal', { title: 'Error', msg: `You can only stack up to 200 bounties on one person. They already have ${row2.currentBounties} from you.` });
                    
                    // Atomic deduction
                    db.run('UPDATE users SET cash = cash - ? WHERE id = ? AND cash >= ?', [totalCost, placer.id, totalCost], function(err) {
                        if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: `You do not have enough cash.` });
                        
                        const stmt = db.prepare('INSERT INTO bounties (targetId, placerId, reward) VALUES (?, ?, ?)');
                        for (let i = 0; i < count; i++) {
                            stmt.run([targetDb.id, placer.id, reward]);
                        }
                        stmt.finalize(() => {
                            socket.emit('modal', { title: 'Success', msg: `Placed ${count} bounties on ${data.target}.` });
                            broadcastBounties();
                        });
                    });
                });
            });
        });
    });

    // ---- INVENTORY & NPC STORE ----
    socket.on('buy_npc_item', (itemId) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        const liveItem = liveCityMarket.find(i => i.id === itemId);
        const itemDef = ITEMS.find(i => i.id === itemId);
        if (!liveItem || !itemDef) return;

        const cost = liveItem.currentCost;

        db.get('SELECT dailyItemsBought FROM users WHERE id = ?', [user.id], (err, row) => {
            if (!row) return;
            if (row.dailyItemsBought >= 100) return socket.emit('modal', { title: 'Error', msg: 'You have reached your limit of 100 items bought from the city market today.' });

            db.run('UPDATE users SET cash = cash - ?, dailyItemsBought = dailyItemsBought + 1 WHERE id = ? AND cash >= ?', [cost, user.id, cost], function(err) {
                if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'Not enough cash.' });
                
                db.run('INSERT INTO inventory (userId, itemId, qty) VALUES (?, ?, 1) ON CONFLICT(userId, itemId) DO UPDATE SET qty = qty + 1', [user.id, itemId], () => {
                    socket.emit('inv_update', { itemId: itemId, change: 1, cashChange: -cost });
                    socket.emit('modal', { title: 'Purchased', msg: `Bought ${itemDef.name} for $${cost.toLocaleString()}.` });
                });
            });
        });
    });

    socket.on('use_item', (itemId) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        const item = ITEMS.find(i => i.id === itemId);
        if (!item || !['energy', 'life', 'mixed', 'booster', 'tokens'].includes(item.type)) return;

        db.run('UPDATE inventory SET qty = qty - 1 WHERE userId = ? AND itemId = ? AND qty >= 1', [user.id, itemId], function(err) {
            if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'You do not own this item.' });
            
            if (item.type === 'energy') db.run('UPDATE users SET energy = MIN(100, energy + 50) WHERE id = ?', [user.id]);
            else if (item.type === 'life') db.run('UPDATE users SET life = MIN(100, life + 100) WHERE id = ?', [user.id]);
            else if (item.type === 'tokens') db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [item.val, user.id]);
            else if (item.type === 'mixed' && itemId === 'beer') db.run('UPDATE users SET nerve = MIN(100, nerve + 2), happy = MIN(10000, happy + 10) WHERE id = ?', [user.id]);
            
            socket.emit('inv_update', { itemId: itemId, change: -1, used: true, type: item.type, val: item.val });
        });
    });

    socket.on('quick_sell_item', (itemId) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        const item = ITEMS.find(i => i.id === itemId);
        if (!item) return;

        db.run('UPDATE inventory SET qty = qty - 1 WHERE userId = ? AND itemId = ? AND qty >= 1', [user.id, itemId], function(err) {
            if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'You do not own this item.' });
            const sellPrice = Math.floor(item.cost * 0.5);
            db.run('UPDATE users SET cash = cash + ? WHERE id = ?', [sellPrice, user.id]);
            socket.emit('inv_update', { itemId: itemId, change: -1, cashChange: sellPrice });
            socket.emit('modal', { title: 'Sold', msg: `Sold ${item.name} for $${sellPrice.toLocaleString()} (50% market value).` });
        });
    });

    socket.on('send_item', (data) => {
        const user = activeUsers[socket.id];
        if (!user || !data.target || !data.itemId) return;

        db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [data.target], (err, targetDb) => {
            if (!targetDb) return socket.emit('modal', { title: 'Error', msg: 'Target player not found.' });
            if (targetDb.id === user.id) return socket.emit('modal', { title: 'Error', msg: 'You cannot send items to yourself.' });

            db.run('UPDATE inventory SET qty = qty - 1 WHERE userId = ? AND itemId = ? AND qty >= 1', [user.id, data.itemId], function(err) {
                if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'You do not have this item.' });
                
                db.run('INSERT INTO inventory (userId, itemId, qty) VALUES (?, ?, 1) ON CONFLICT(userId, itemId) DO UPDATE SET qty = qty + 1', [targetDb.id, data.itemId], () => {
                    socket.emit('inv_update', { itemId: data.itemId, change: -1 });
                    socket.emit('modal', { title: 'Sent', msg: `Item sent to ${data.target}.` });
                    
                    const targetSocketId = Object.keys(activeUsers).find(key => activeUsers[key].id === targetDb.id);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('inv_update', { itemId: data.itemId, change: 1 });
                        io.to(targetSocketId).emit('modal', { title: 'Item Received', msg: `${user.username} sent you an item!` });
                    }
                });
            });
        });
    });

    // ---- PLAYER MARKET ----
    function broadcastMarket() {
        db.all(`SELECT m.id, m.itemId, m.price, u.username as sellerName 
                FROM market m JOIN users u ON m.userId = u.id 
                ORDER BY m.price ASC`, [], (err, rows) => {
            if (!err) io.emit('market_data', rows);
        });
    }

    socket.on('get_market', () => broadcastMarket());

    socket.on('list_market_item', (data) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        const price = parseInt(data.price);
        const qty = parseInt(data.qty) || 1;
        if (price <= 0) return socket.emit('modal', { title: 'Error', msg: 'Price must be positive.' });
        if (qty <= 0) return socket.emit('modal', { title: 'Error', msg: 'Quantity must be positive.' });

        db.run('UPDATE inventory SET qty = qty - ? WHERE userId = ? AND itemId = ? AND qty >= ?', [qty, user.id, data.itemId, qty], function(err) {
            if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'You do not have enough of this item.' });
            
            const stmt = db.prepare('INSERT INTO market (userId, itemId, price) VALUES (?, ?, ?)');
            for(let i=0; i<qty; i++) {
                stmt.run([user.id, data.itemId, price]);
            }
            stmt.finalize(() => {
                socket.emit('inv_update', { itemId: data.itemId, change: -qty });
                broadcastMarket();
                socket.emit('modal', { title: 'Listed', msg: `Listed ${qty} item(s) on the Global Market!` });
            });
        });
    });

    socket.on('buy_market_item', (marketId) => {
        const buyer = activeUsers[socket.id];
        if (!buyer) return;

        db.get('SELECT * FROM market WHERE id = ?', [marketId], (err, marketRow) => {
            if (!marketRow) return socket.emit('modal', { title: 'Error', msg: 'Item no longer exists.' });
            if (marketRow.userId === buyer.id) return socket.emit('modal', { title: 'Error', msg: 'You cannot buy your own item.' });

            db.run('UPDATE users SET cash = cash - ? WHERE id = ? AND cash >= ?', [marketRow.price, buyer.id, marketRow.price], function(err) {
                if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'Not enough cash.' });

                db.run('INSERT INTO inventory (userId, itemId, qty) VALUES (?, ?, 1) ON CONFLICT(userId, itemId) DO UPDATE SET qty = qty + 1', [buyer.id, marketRow.itemId]);

                // Pay seller (10% fee)
                const fee = Math.floor(marketRow.price * 0.10);
                const sellerRevenue = marketRow.price - fee;
                db.run('UPDATE users SET cash = cash + ? WHERE id = ?', [sellerRevenue, marketRow.userId]);
                
                // Remove from market
                db.run('DELETE FROM market WHERE id = ?', [marketId]);

                socket.emit('inv_update', { itemId: marketRow.itemId, change: 1, cashChange: -marketRow.price });
                broadcastMarket();
                socket.emit('modal', { title: 'Purchased', msg: `You bought the item for $${marketRow.price.toLocaleString()}.` });
                
                // Notify Seller
                const sellerSocketId = Object.keys(activeUsers).find(key => activeUsers[key].id === marketRow.userId);
                if (sellerSocketId) {
                    io.to(sellerSocketId).emit('modal', { title: 'Item Sold!', msg: `Someone bought your item for $${marketRow.price.toLocaleString()}. After 10% fee, you received $${sellerRevenue.toLocaleString()}.` });
                    io.to(sellerSocketId).emit('update_cash', sellerRevenue); 
                }
            });
        });
    });

    // ---- BAZAAR ----
    socket.on('bazaar_unlock', () => {
        const user = activeUsers[socket.id];
        if(!user) return;
        db.run('UPDATE users SET bazaarUnlocked = 1 WHERE id = ?', [user.id], () => {
            socket.emit('modal', { title: 'Bazaar Unlocked!', msg: 'Thank you for your $5 payment. You can now sell items in the Bazaar tax-free forever!' });
            socket.emit('bazaar_unlocked_success');
        });
    });

    function broadcastBazaar() {
        db.all(`SELECT b.id, b.itemId, b.price, u.username as sellerName 
                FROM bazaar b JOIN users u ON b.userId = u.id 
                ORDER BY b.price ASC`, [], (err, rows) => {
            if (!err) io.emit('bazaar_data', rows);
        });
    }

    socket.on('get_bazaar', () => broadcastBazaar());

    socket.on('list_bazaar_item', (data) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        db.get('SELECT bazaarUnlocked FROM users WHERE id = ?', [user.id], (err, row) => {
            if (!row || row.bazaarUnlocked === 0) return socket.emit('modal', { title: 'Error', msg: 'You must unlock the Bazaar first.' });
            
            const price = parseInt(data.price);
            const qty = parseInt(data.qty) || 1;
            if (price <= 0) return socket.emit('modal', { title: 'Error', msg: 'Price must be positive.' });
            if (qty <= 0) return socket.emit('modal', { title: 'Error', msg: 'Quantity must be positive.' });

            db.run('UPDATE inventory SET qty = qty - ? WHERE userId = ? AND itemId = ? AND qty >= ?', [qty, user.id, data.itemId, qty], function(err) {
                if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'You do not have enough of this item.' });
                
                const stmt = db.prepare('INSERT INTO bazaar (userId, itemId, price) VALUES (?, ?, ?)');
                for(let i=0; i<qty; i++) {
                    stmt.run([user.id, data.itemId, price]);
                }
                stmt.finalize(() => {
                    socket.emit('inv_update', { itemId: data.itemId, change: -qty });
                    broadcastBazaar();
                    socket.emit('modal', { title: 'Listed', msg: `Listed ${qty} item(s) in your Bazaar!` });
                });
            });
        });
    });

    socket.on('buy_bazaar_item', (bazaarId) => {
        const buyer = activeUsers[socket.id];
        if (!buyer) return;

        db.get('SELECT * FROM bazaar WHERE id = ?', [bazaarId], (err, row) => {
            if (!row) return socket.emit('modal', { title: 'Error', msg: 'Item no longer exists.' });
            if (row.userId === buyer.id) return socket.emit('modal', { title: 'Error', msg: 'You cannot buy your own item.' });

            db.run('UPDATE users SET cash = cash - ? WHERE id = ? AND cash >= ?', [row.price, buyer.id, row.price], function(err) {
                if (this.changes === 0) return socket.emit('modal', { title: 'Error', msg: 'Not enough cash.' });
                db.run('INSERT INTO inventory (userId, itemId, qty) VALUES (?, ?, 1) ON CONFLICT(userId, itemId) DO UPDATE SET qty = qty + 1', [buyer.id, row.itemId]);
                db.run('UPDATE users SET cash = cash + ? WHERE id = ?', [row.price, row.userId]); 
                db.run('DELETE FROM bazaar WHERE id = ?', [bazaarId]);

                socket.emit('inv_update', { itemId: row.itemId, change: 1, cashChange: -row.price });
                broadcastBazaar();
                socket.emit('modal', { title: 'Purchased', msg: `Bought from Bazaar for $${row.price.toLocaleString()}.` });
                
                const sellerSocketId = Object.keys(activeUsers).find(key => activeUsers[key].id === row.userId);
                if (sellerSocketId) {
                    io.to(sellerSocketId).emit('update_cash', row.price); 
                }
            });
        });
    });

    // ---- PROFILES & SOCIAL ----
    socket.on('search_user', (username) => {
        db.get(`SELECT id, username, cash, tokens, location, property, str, def, spd, dex FROM users WHERE username = ? COLLATE NOCASE`, [username], (err, target) => {
            if (!target) return socket.emit('modal', { title: 'Not Found', msg: 'User does not exist.' });
            const totalStats = target.str + target.def + target.spd + target.dex;
            socket.emit('profile_data', {
                id: target.id, username: target.username,
                totalStats: totalStats, location: target.location, property: target.property
            });
        });
    });

    socket.on('set_relationship', (data) => {
        const user = activeUsers[socket.id];
        if (!user || !data.targetId || user.id === data.targetId) return;
        
        db.run('DELETE FROM relationships WHERE userId = ? AND targetId = ?', [user.id, data.targetId], () => {
            if (data.type === 'friend' || data.type === 'enemy') {
                db.run('INSERT INTO relationships (userId, targetId, type) VALUES (?, ?, ?)', [user.id, data.targetId, data.type], () => {
                    socket.emit('modal', { title: 'Social', msg: `Marked player as ${data.type}.` });
                });
            } else {
                socket.emit('modal', { title: 'Social', msg: `Removed relationship.` });
            }
        });
    });

    // ---- TRADES ----
    const pendingTrades = {}; // tradeId -> { status, ... }
    

    // ---- CASINO ----
    function drawCard(deck) {
        if (deck.length === 0) return { val: 0, face: 'X' };
        return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
    }
    function scoreHand(hand) {
        let score = 0; let aces = 0;
        hand.forEach(c => {
            if (c.val === 11) aces++;
            score += c.val;
        });
        while (score > 21 && aces > 0) { score -= 10; aces--; }
        return score;
    }

    socket.on('play_slots', (bet) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        
        db.run('UPDATE users SET tokens = tokens - ? WHERE id = ? AND tokens >= ?', [bet, user.id, bet], function(err) {
            if (this.changes === 0) return socket.emit('casino_error', 'Not enough tokens.');
            
            const symbols = ['🍒', '🔔', '💎', '7️⃣', '🍉'];
            const r1 = symbols[Math.floor(Math.random()*symbols.length)];
            const r2 = symbols[Math.floor(Math.random()*symbols.length)];
            const r3 = symbols[Math.floor(Math.random()*symbols.length)];
            
            let win = 0;
            if (r1 === r2 && r2 === r3) {
                if (r1 === '7️⃣') win = bet * 10;
                else win = bet * 5;
            } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                win = bet * 1.5;
            }

            const netChange = Math.floor(win - bet);
            if (win > 0) {
                db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [Math.floor(win), user.id]);
            }
            socket.emit('slots_result', { reels: [r1, r2, r3], netChange: netChange, win: win });
        });
    });

    socket.on('play_roulette', (data) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        const bet = parseInt(data.bet);
        
        db.run('UPDATE users SET tokens = tokens - ? WHERE id = ? AND tokens >= ?', [bet, user.id, bet], function(err) {
            if (this.changes === 0) return socket.emit('casino_error', 'Not enough tokens.');
            
            const roll = Math.floor(Math.random() * 37); // 0-36
            let rollColor = 'green';
            if (roll > 0) {
                rollColor = (roll % 2 === 0) ? 'black' : 'red';
            }
            
            let netChange = -bet;
            let win = 0;
            if (data.color === rollColor) {
                if (rollColor === 'green') win = bet * 14;
                else win = bet * 2; // 2x payout (returns bet + profit)
                netChange = win - bet;
            }

            if (win > 0) {
                db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [win, user.id]);
            }
            socket.emit('roulette_result', { roll: roll, rollColor: rollColor, netChange: netChange });
        });
    });

    socket.on('bj_start', (bet) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        
        db.run('UPDATE users SET tokens = tokens - ? WHERE id = ? AND tokens >= ?', [bet, user.id, bet], function(err) {
            if (this.changes === 0) return socket.emit('casino_error', 'Not enough tokens.');
            
            // Build deck
            const deck = [];
            const suits = ['♠','♥','♣','♦'];
            const faces = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
            suits.forEach(s => faces.forEach(f => {
                let val = parseInt(f);
                if (f === 'A') val = 11;
                else if (['J','Q','K'].includes(f)) val = 10;
                deck.push({ face: f+s, val: val });
            }));

            const pHand = [drawCard(deck), drawCard(deck)];
            const dHand = [drawCard(deck), drawCard(deck)];
            
            user.bj = { bet: bet, deck: deck, pHand: pHand, dHand: dHand };
            
            socket.emit('bj_update', { pHand: pHand, pScore: scoreHand(pHand), dHand: [dHand[0], {face:'??'}], status: 'playing', netChange: -bet });
        });
    });

    socket.on('bj_hit', () => {
        const user = activeUsers[socket.id];
        if (!user || !user.bj) return;
        user.bj.pHand.push(drawCard(user.bj.deck));
        const score = scoreHand(user.bj.pHand);
        
        if (score > 21) {
            // Already deducted bet at start
            socket.emit('bj_update', { pHand: user.bj.pHand, pScore: score, dHand: user.bj.dHand, dScore: scoreHand(user.bj.dHand), status: 'bust', netChange: 0 });
            delete user.bj;
        } else {
            socket.emit('bj_update', { pHand: user.bj.pHand, pScore: score, dHand: [user.bj.dHand[0], {face:'??'}], status: 'playing' });
        }
    });

    socket.on('bj_stand', () => {
        const user = activeUsers[socket.id];
        if (!user || !user.bj) return;
        
        const pScore = scoreHand(user.bj.pHand);
        let dScore = scoreHand(user.bj.dHand);
        
        while (dScore < 17) {
            user.bj.dHand.push(drawCard(user.bj.deck));
            dScore = scoreHand(user.bj.dHand);
        }
        
        let winAmount = 0;
        let netChange = 0; // For UI
        let status = 'push';
        
        if (dScore > 21 || pScore > dScore) {
            winAmount = user.bj.bet * 2;
            netChange = user.bj.bet * 2; // Tell UI to give back bet + profit
            status = 'win';
        } else if (pScore < dScore) {
            winAmount = 0;
            netChange = 0; // Already took the bet
            status = 'lose';
        } else {
            winAmount = user.bj.bet; // Push
            netChange = user.bj.bet; // Return original bet
        }
        
        if (winAmount > 0) {
            db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [winAmount, user.id]);
        }
        
        socket.emit('bj_update', { pHand: user.bj.pHand, pScore: pScore, dHand: user.bj.dHand, dScore: dScore, status: status, netChange: netChange });
        delete user.bj;
    });

    // ---- CRASH ----
    socket.on('crash_start', (bet) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        bet = parseInt(bet);
        if (isNaN(bet) || bet <= 0) return socket.emit('casino_error', 'Invalid bet.');
        
        db.run('UPDATE users SET tokens = tokens - ? WHERE id = ? AND tokens >= ?', [bet, user.id, bet], function(err) {
            if (this.changes === 0) return socket.emit('casino_error', 'Not enough tokens.');
            
            // Random crash point
            const e = 2 ** 32;
            const h = crypto.getRandomValues(new Uint32Array(1))[0];
            let crashPoint = Math.max(1, (e / (e - h)) * 0.99); // 1% house edge
            if(crashPoint > 1000) crashPoint = 1000;
            
            user.crash = { bet: bet, point: crashPoint, currentMult: 1.00, active: true };
            socket.emit('crash_update', { status: 'playing', mult: 1.00 });
            
            user.crash.interval = setInterval(() => {
                if(!user.crash || !user.crash.active) return;
                user.crash.currentMult += (user.crash.currentMult * 0.05); // Accelerate
                if (user.crash.currentMult >= user.crash.point) {
                    clearInterval(user.crash.interval);
                    user.crash.active = false;
                    socket.emit('crash_update', { status: 'crashed', mult: user.crash.point, netChange: -user.crash.bet });
                    delete user.crash;
                } else {
                    socket.emit('crash_update', { status: 'playing', mult: user.crash.currentMult });
                }
            }, 100);
        });
    });

    socket.on('crash_cashout', () => {
        const user = activeUsers[socket.id];
        if (!user || !user.crash || !user.crash.active) return;
        
        clearInterval(user.crash.interval);
        user.crash.active = false;
        
        const win = Math.floor(user.crash.bet * user.crash.currentMult);
        db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [win, user.id]);
        
        socket.emit('crash_update', { status: 'cashed_out', mult: user.crash.currentMult, netChange: win - user.crash.bet });
        delete user.crash;
    });

    // ---- HI-LO ----
    socket.on('hilo_start', (bet) => {
        const user = activeUsers[socket.id];
        if (!user) return;
        bet = parseInt(bet);
        if (isNaN(bet) || bet <= 0) return socket.emit('casino_error', 'Invalid bet.');
        
        db.run('UPDATE users SET tokens = tokens - ? WHERE id = ? AND tokens >= ?', [bet, user.id, bet], function(err) {
            if (this.changes === 0) return socket.emit('casino_error', 'Not enough tokens.');
            
            const card = Math.floor(Math.random() * 13) + 2; // 2 to 14 (Ace)
            user.hilo = { bet: bet, current: card };
            socket.emit('hilo_update', { status: 'playing', card: card, msg: 'Higher or Lower?' });
        });
    });

    socket.on('hilo_guess', (guess) => {
        const user = activeUsers[socket.id];
        if (!user || !user.hilo) return;
        
        const nextCard = Math.floor(Math.random() * 13) + 2;
        let win = false;
        let draw = false;
        if (nextCard === user.hilo.current) draw = true;
        else if (guess === 'hi' && nextCard > user.hilo.current) win = true;
        else if (guess === 'lo' && nextCard < user.hilo.current) win = true;

        if (win) {
            const payout = user.hilo.bet * 2;
            db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [payout, user.id]);
            socket.emit('hilo_update', { status: 'win', card: nextCard, netChange: payout - user.hilo.bet, msg: 'You won!' });
        } else if (draw) {
            db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [user.hilo.bet, user.id]);
            socket.emit('hilo_update', { status: 'draw', card: nextCard, netChange: 0, msg: 'Draw. Bet returned.' });
        } else {
            socket.emit('hilo_update', { status: 'lose', card: nextCard, netChange: -user.hilo.bet, msg: 'You lost.' });
        }
        delete user.hilo;
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
