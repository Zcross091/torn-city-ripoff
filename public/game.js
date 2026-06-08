// Game State
const state = {
    cash: 50000, 
    bank: 0,
    tokens: 100,
    jailTime: 0,
    location: 'Torn City',
    inventory: {}, 
    maxInv: 60000,
    properties: ['shack'],
    currentProp: 'shack',
    bounties: [],
    bountyTimer: 60,
    marketListings: [],
    bazaarListings: [],
    liveCityMarket: [],
    bazaarUnlocked: 0,
    dailyItemsBought: 0,
    cityFinds: [], 
    tradeLog: [],
    phoneNotifications: [],
    unreadPhone: 0,
    travel: { status: 'idle', dest: null, timeRemaining: 0, maxTime: 0 },
    bars: {
        energy: { current: 100, max: 100, tickAmount: 5 },
        nerve: { current: 10, max: 10, tickAmount: 1 },
        life: { current: 100, max: 100, tickAmount: 5 },
        happy: { current: 100, max: 100, tickAmount: 5 }
    },
    stats: { str: 10, def: 10, spd: 10, dex: 10 },
    
    // New Systems
    stocks: [
        { id: 'TCT', name: 'Torn City Times', price: 50, trend: 1 },
        { id: 'GRN', name: 'Greenleaf Corp', price: 120, trend: -1 },
        { id: 'SYM', name: 'Symbiotic Ltd', price: 400, trend: 1 },
        { id: 'SYS', name: 'Cyber Dynamics', price: 1500, trend: -1 }
    ],
    portfolio: {}, 
    education: {
        active: null,
        timeRemaining: 0,
        maxTime: 0,
        completed: []
    },
    hospital: [] // { id: 'player', name: 'Player', time: 0, reason: 'Mugged' }
};

const socket = io();

socket.on('connect', () => {
    const token = localStorage.getItem('neon_token');
    if (token) {
        socket.emit('login_token', token);
    }
});

// DOM Elements
const els = {
    cash: document.getElementById('cash-display'), bank: document.getElementById('bank-display'),
    tokens: document.getElementById('tokens-display'), prop: document.getElementById('property-display'),
    loc: document.getElementById('location-display'), invCount: document.getElementById('inv-count'),
    
    energyBar: document.getElementById('energy-bar'), energyText: document.getElementById('energy-text'),
    nerveBar: document.getElementById('nerve-bar'), nerveText: document.getElementById('nerve-text'),
    lifeBar: document.getElementById('life-bar'), lifeText: document.getElementById('life-text'),
    happyBar: document.getElementById('happy-bar'), happyText: document.getElementById('happy-text'),
    
    statStr: document.getElementById('stat-str'), statDef: document.getElementById('stat-def'),
    statSpd: document.getElementById('stat-spd'), statDex: document.getElementById('stat-dex'),
    
    streetsContainer: document.getElementById('streets-container'), bountiesContainer: document.getElementById('bounties-container'),
    tradeInv: document.getElementById('trade-inventory-list'), tradeMarket: document.getElementById('trade-market-list'),
    tradeLog: document.getElementById('trade-log-list'),
    stocksContainer: document.getElementById('stocks-container'), portfolioContainer: document.getElementById('portfolio-container'),
    coursesContainer: document.getElementById('courses-container'), gymContainer: document.getElementById('gym-container'),
    hospContainer: document.getElementById('hospital-list'),
    crimesContainer: document.getElementById('crimes-container'), crimeLog: document.getElementById('crime-log'),
    cityMap: document.getElementById('city-map'), worldMap: document.getElementById('world-map'),
    inventoryList: document.getElementById('inventory-list'),
    
    caPanel: document.getElementById('city-action-panel'), caTitle: document.getElementById('ca-title'), 
    caDesc: document.getElementById('ca-desc'), caControls: document.getElementById('ca-controls'),
    
    jailOverlay: document.getElementById('jail-overlay'), jailTime: document.getElementById('jail-time'),
    flightOverlay: document.getElementById('flight-overlay'), flightDest: document.getElementById('flight-dest'),
    flightTime: document.getElementById('flight-time'), flightBar: document.getElementById('flight-bar'),
    
    modal: document.getElementById('custom-modal'), modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'), modalConfirm: document.getElementById('modal-confirm'),
    modalCancel: document.getElementById('modal-cancel'),
    
    chatBody: document.getElementById('chat-body'), chatInput: document.getElementById('chat-input'),
    chatWindow: document.getElementById('chat-window'), chatIcon: document.getElementById('chat-toggle-icon'),
    
    phoneApp: document.getElementById('phone-app'), phoneBadge: document.getElementById('phone-badge'),
    phoneNotifs: document.getElementById('phone-notifications')
};

function init() {
    renderBounties();
    renderStreets();
    renderCrimes();
    renderCity();
    renderTravel();
    renderInventory();
    renderTrade();
    renderStocks();
    renderEducation();
    renderGym();
    renderHospital();
    setupTabs();
    updateUI();
    
    setInterval(gameTick, 2000); 
    setInterval(timerTick, 1000); 
    
    els.chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            socket.emit('send_chat', this.value.trim());
            this.value = '';
        }
    });
}

// ---- AUTHENTICATION (Multiplayer) ----
window.attemptAuth = function(type) {
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    if (!user || !pass) return document.getElementById('auth-error').innerText = "Please enter both fields.";
    socket.emit(type, { username: user, password: pass });
}

socket.on('auth_error', msg => {
    document.getElementById('auth-error').innerText = msg;
});

window.logout = function() {
    localStorage.removeItem('neon_token');
    location.reload();
}

socket.on('auth_success', data => {
    // If registered, auto-login
    if (data.token) localStorage.setItem('neon_token', data.token);
    socket.emit('login', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });
});

socket.on('login_success', data => {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    if (data.token) {
        localStorage.setItem('neon_token', data.token);
    }
    
    // OVERWRITE STATE WITH DB DATA
    state.cash = data.cash;
    state.bank = data.bank;
    state.tokens = data.tokens;
    state.location = data.location;
    state.bars.energy.current = data.energy;
    state.bars.nerve.current = data.nerve;
    state.bars.life.current = data.life;
    state.bars.happy.current = data.happy;
    state.stats.str = data.str;
    state.stats.def = data.def;
    state.stats.spd = data.spd;
    state.stats.dex = data.dex;
    state.jailTime = data.jailTime;
    state.currentProp = data.property;
    state.bazaarUnlocked = data.bazaarUnlocked || 0;
    state.dailyItemsBought = data.dailyItemsBought || 0;
    state.inventory = data.inventory || {};
    
    // Calculate suitcase capacity
    const suitcases = state.inventory['suitcase'] ? Math.min(5, state.inventory['suitcase']) : 0;
    state.maxTravelInv = 10 + (suitcases * 10);
    
    init(); // Start game loops and renders
});

socket.on('city_market_update', data => {
    state.liveCityMarket = data;
    if (document.getElementById('trade') && document.getElementById('trade').classList.contains('active')) {
        renderTrade();
    }
    if (state.location !== 'Torn City' && document.getElementById('travel').classList.contains('active')) {
        renderTravel();
    }
});

socket.on('update_cash', amount => {
    state.cash += amount;
    updateUI();
});

socket.on('inv_update', data => {
    if (data.cashChange) state.cash += data.cashChange;
    state.inventory[data.itemId] = (state.inventory[data.itemId] || 0) + data.change;
    if (state.inventory[data.itemId] <= 0) delete state.inventory[data.itemId];
    
    if (data.used) {
        if (data.type === 'energy') state.bars.energy.current = Math.min(state.bars.energy.max, state.bars.energy.current + data.val);
        if (data.type === 'life') state.bars.life.current = Math.min(state.bars.life.max, state.bars.life.current + data.val);
        if (data.type === 'mixed') { state.bars.nerve.current += 2; state.bars.happy.current += 10; }
        if (data.type === 'booster') state.capacity += data.val;
        showModal("Item Used", "You used the item successfully.", null, false);
    }
    
    updateUI();
    if (document.getElementById('items').classList.contains('active')) renderInventory();
});

// ---- CUSTOM MODAL SYSTEM ----
let modalCallback = null;
function showModal(title, msg, onConfirm = null, showCancel = false) {
    els.modalTitle.innerText = title;
    els.modalTitle.style.color = title === "Error" || title === "Busted!" || title === "Defeat" ? "var(--danger)" : "var(--text-main)";
    els.modalBody.innerHTML = msg; 
    modalCallback = onConfirm;
    if (showCancel) els.modalCancel.classList.remove('hidden'); else els.modalCancel.classList.add('hidden');
    els.modalConfirm.classList.remove('hidden'); 
    els.modal.classList.remove('hidden');
}
els.modalConfirm.onclick = () => { els.modal.classList.add('hidden'); if (modalCallback) modalCallback(); };
els.modalCancel.onclick = () => { els.modal.classList.add('hidden'); modalCallback = null; };

// ---- PHONE APP (Replaces Ticker) ----
window.togglePhone = function() {
    els.phoneApp.classList.toggle('collapsed');
    if (!els.phoneApp.classList.contains('collapsed')) {
        state.unreadPhone = 0;
        els.phoneBadge.classList.add('hidden');
    }
}

function pushPhoneNotification(msg) {
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    state.phoneNotifications.unshift({ msg: msg, time: timeStr });
    if(state.phoneNotifications.length > 30) state.phoneNotifications.pop();
    
    if (els.phoneApp.classList.contains('collapsed')) {
        state.unreadPhone++;
        els.phoneBadge.innerText = state.unreadPhone;
        els.phoneBadge.classList.remove('hidden');
    }
    
    renderPhoneNotifications();
}

function renderPhoneNotifications() {
    if (state.phoneNotifications.length === 0) {
        els.phoneNotifs.innerHTML = '<p class="text-muted text-center mt-20" style="font-size: 0.8rem;">No new notifications.</p>';
        return;
    }
    
    els.phoneNotifs.innerHTML = state.phoneNotifications.map(n => `
        <div class="phone-notif">
            <div style="color: var(--text-muted); font-size: 0.7rem; margin-bottom: 3px;">${n.time}</div>
            <div>${n.msg}</div>
        </div>
    `).join('');
}

// ---- GLOBAL CHAT ----
const FAKE_USERS = ['xX_Sniper_Xx', 'Noob123', 'TradeGod', 'Killer69', 'MuggerMan', 'Duke', 'Shadow'];
const FAKE_MSGS = [
    "how do i train gym?", "selling 10 plushies dm me", "anyone want to join a faction?",
    "stop mugging me!!", "buying red bulls 400 ea", "casino is rigged", "where do i buy a house?"
];

window.toggleChat = function() {
    els.chatWindow.classList.toggle('collapsed');
    els.chatIcon.innerText = els.chatWindow.classList.contains('collapsed') ? '▲' : '▼';
}

socket.on('chat_message', msg => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    div.innerHTML = `<span class="tag">[${time}]</span><span class="author">${msg.author}:</span> ${msg.text}`;
    els.chatBody.appendChild(div);
    els.chatBody.scrollTop = els.chatBody.scrollHeight;
    if(els.chatBody.children.length > 30) els.chatBody.removeChild(els.chatBody.firstChild);
});

// ---- LIVE STREETS & COMBAT ----
let onlinePlayers = [];

socket.on('active_players', players => {
    onlinePlayers = players;
    if (document.getElementById('streets').classList.contains('active')) {
        renderStreets();
    }
});

socket.on('combat_error', msg => showModal("Error", msg));

socket.on('combat_win', data => {
    state.bars.energy.current = Math.max(0, state.bars.energy.current - 25);
    state.cash += data.loot;
    updateUI();
    showModal("Victory!", `You attacked ${data.target} and mugged them for $${data.loot.toLocaleString()}!`);
});

socket.on('combat_lose', data => {
    state.bars.energy.current = Math.max(0, state.bars.energy.current - 25);
    state.bars.life.current = 0;
    state.hospital.push({ id: 'player', name: 'Player', time: 120, reason: `Lost a fight against ${data.target}` });
    updateUI(); renderHospital();
    showModal("Defeat", `You attacked ${data.target} but they beat you down. You are in the hospital for 120 seconds.`);
});

socket.on('attacked_by', data => {
    state.cash = Math.max(0, state.cash - data.loot);
    state.bars.life.current = 0;
    state.hospital.push({ id: 'player', name: 'Player', time: 120, reason: `Mugged by ${data.attacker}` });
    updateUI(); renderHospital();
    showModal("Attacked!", `You were mugged by ${data.attacker}! You lost $${data.loot.toLocaleString()} and are now in the hospital.`);
    pushPhoneNotification(`Combat: You were mugged by ${data.attacker} and lost $${data.loot.toLocaleString()}.`);
});

// ---- TICKERS ----
function getInventoryCount() { return Object.values(state.inventory).reduce((a, b) => a + b, 0); }

function gameTick() {
    Object.keys(state.bars).forEach(key => {
        let bar = state.bars[key];
        // If player is in hospital, life doesn't regen normally
        if (key === 'life' && state.hospital.find(h => h.id === 'player')) return;
        if (bar.current < bar.max) bar.current = Math.min(bar.max, bar.current + bar.tickAmount);
    });
    updateUI();
}

function timerTick() {
    // Jail & Travel
    if (state.jailTime > 0) {
        state.jailTime--; els.jailTime.innerText = state.jailTime;
        if (state.jailTime <= 0) { els.jailOverlay.classList.add('hidden'); pushPhoneNotification("Jail: You have been released from jail."); }
    }
    
    if (state.travel.status === 'flying') {
        state.travel.timeRemaining--; els.flightTime.innerText = state.travel.timeRemaining;
        const p = 100 - ((state.travel.timeRemaining / state.travel.maxTime) * 100);
        els.flightBar.style.width = `${p}%`;
        if (state.travel.timeRemaining <= 0) {
            state.travel.status = 'abroad'; state.location = state.travel.dest;
            els.flightOverlay.classList.add('hidden'); renderTravel(); updateUI();
            showModal("Landed", `You arrived in ${state.location}!`);
        }
    }
    
    // Hospital
    if (state.hospital.length > 0) {
        let needsRender = false;
        for (let i = state.hospital.length - 1; i >= 0; i--) {
            state.hospital[i].time--;
            needsRender = true;
            if (state.hospital[i].time <= 0) {
                if (state.hospital[i].id === 'player') {
                    showModal("Discharged", "You have been discharged from the hospital.");
                    state.bars.life.current = state.bars.life.max;
                    updateUI();
                }
                state.hospital.splice(i, 1);
            }
        }
        if (needsRender && document.getElementById('hospital').classList.contains('active')) {
            renderHospital();
        }
    }
    
    // Education
    if (state.education.active) {
        state.education.timeRemaining--;
        const eduPanel = document.getElementById('active-course-panel');
        if (eduPanel) {
            document.getElementById('ac-time').innerText = state.education.timeRemaining + 's remaining';
            document.getElementById('ac-bar').style.width = `${100 - (state.education.timeRemaining / state.education.maxTime)*100}%`;
        }
        
        if (state.education.timeRemaining <= 0) {
            const course = COURSES.find(c => c.id === state.education.active);
            state.education.completed.push(course.id);
            state.education.active = null;
            showModal("Graduated!", `You completed ${course.name}! ${course.buff}`);
            pushPhoneNotification(`Education: You graduated from <strong>${course.name}</strong>.`);
            renderEducation();
        }
    }
    
    // Stocks (Random Walk)
    if (Math.random() < 0.3) { 
        state.stocks.forEach(stock => {
            const volatility = stock.price * 0.05; 
            const change = (Math.random() * volatility * 2) - volatility;
            const newPrice = Math.max(1, Math.floor(stock.price + change));
            stock.trend = newPrice > stock.price ? 1 : newPrice < stock.price ? -1 : 0;
            stock.price = newPrice;
        });
        if (document.getElementById('stocks').classList.contains('active')) renderStocks();
    }
    
    // Bounties
    if (state.bountyTimer > 0) state.bountyTimer--;
    else { generateBounty(); renderBounties(); state.bountyTimer = 60; }
    
    // Market
    if (state.marketListings.length > 0 && Math.random() < 0.2) {
        const idx = Math.floor(Math.random() * state.marketListings.length);
        const listing = state.marketListings[idx];
        const baseItem = ITEMS.find(i => i.id === listing.itemId);
        const ratio = listing.price / baseItem.sell;
        let buyChance = ratio <= 1.2 ? 0.8 : ratio <= 2.0 ? 0.3 : 0.05;
        
        if (Math.random() < buyChance) {
            state.cash += listing.price;
            const buyer = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
            const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            
            state.tradeLog.unshift(`[${timeStr}] <strong>${buyer}</strong> bought your ${baseItem.name} for <span class="text-success">$${listing.price.toLocaleString()}</span>`);
            if(state.tradeLog.length > 20) state.tradeLog.pop();
            
            pushPhoneNotification(`Market: <strong>${buyer}</strong> bought a ${baseItem.name} for $${listing.price.toLocaleString()}!`);
            state.marketListings.splice(idx, 1);
            updateUI(); renderTrade();
        }
    }
    
    // City Finds
    if (state.location === 'Torn City' && state.cityFinds.length < 10 && Math.random() < 0.05) {
        spawnCityFind();
    }
}

function updateUI() {
    els.cash.innerText = '$' + state.cash.toLocaleString();
    els.bank.innerText = 'Bank: $' + state.bank.toLocaleString();
    els.tokens.innerText = 'Tokens: ' + state.tokens.toLocaleString();
    
    const activeProp = PROPERTIES.find(p => p.id === state.currentProp);
    els.prop.innerText = `🏠 ${activeProp.name}`;
    
    els.loc.innerText = `📍 ${state.location}`;
    els.invCount.innerText = `(${getInventoryCount()}/${state.maxInv})`;
    
    const updateBar = (key, barEl, textEl) => {
        const p = (state.bars[key].current / state.bars[key].max) * 100;
        barEl.style.width = `${p}%`;
        textEl.innerText = `${Math.floor(state.bars[key].current)}/${state.bars[key].max}`;
    };
    updateBar('energy', els.energyBar, els.energyText);
    updateBar('nerve', els.nerveBar, els.nerveText);
    updateBar('life', els.lifeBar, els.lifeText);
    updateBar('happy', els.happyBar, els.happyText);
    
    els.statStr.innerText = Math.floor(state.stats.str).toLocaleString();
    els.statDef.innerText = Math.floor(state.stats.def).toLocaleString();
    els.statSpd.innerText = Math.floor(state.stats.spd).toLocaleString();
    els.statDex.innerText = Math.floor(state.stats.dex).toLocaleString();
}

// ---- HOSPITAL ----
function renderHospital() {
    if (!els.hospContainer) return;
    els.hospContainer.innerHTML = '';
    
    if (state.hospital.length === 0) {
        els.hospContainer.innerHTML = '<p class="text-muted">The hospital is currently empty.</p>';
        return;
    }
    
    state.hospital.forEach(patient => {
        const isPlayer = patient.id === 'player';
        const card = document.createElement('div');
        card.className = `action-card ${isPlayer ? 'bg-dark' : ''}`;
        
        let btnHtml = isPlayer ? `<button class="btn btn-success" onclick="revivePlayer()">Pay Medical Fees ($50,000)</button>` : `<button class="btn btn-accent" onclick="reviveNPC('${patient.id}')">Revive ($5,000)</button>`;
        
        card.innerHTML = `
            <div class="item-info">
                <span class="icon">🛏️</span>
                <div>
                    <strong style="${isPlayer ? 'color: var(--primary)' : ''}">${patient.name}</strong> 
                    <div class="text-muted" style="font-size:0.8rem;">Reason: ${patient.reason}</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 20px;">
                <span class="hosp-time">${patient.time}s</span>
                ${btnHtml}
            </div>
        `;
        els.hospContainer.appendChild(card);
    });
}

window.revivePlayer = function() {
    if (state.cash < 50000) return showModal("Error", "You need $50,000 to pay the medical fees.");
    state.cash -= 50000;
    state.bars.life.current = state.bars.life.max;
    state.hospital = state.hospital.filter(h => h.id !== 'player');
    updateUI(); renderHospital();
    showModal("Discharged", "You paid the medical fees and were discharged.");
}

window.reviveNPC = function(id) {
    if (state.cash < 5000) return showModal("Error", "You need $5,000.");
    state.cash -= 5000;
    state.hospital = state.hospital.filter(h => h.id !== id);
    updateUI(); renderHospital();
}

// ---- CASINO ----
const REEL_SYMBOLS = ['🍒', '🔔', '💎', '7️⃣', '🍉'];
window.playSlots = function() {
    const bet = parseInt(document.getElementById('bet-amount').value);
    if (isNaN(bet) || bet <= 0) return showModal("Error", "Invalid bet.");
    if (state.tokens < bet) return showModal("Error", "Not enough tokens.");
    
    state.tokens -= bet;
    updateUI();
    
    const r1 = document.getElementById('reel1');
    const r2 = document.getElementById('reel2');
    const r3 = document.getElementById('reel3');
    const msg = document.getElementById('slot-msg');
    
    r1.classList.add('spin-anim'); r2.classList.add('spin-anim'); r3.classList.add('spin-anim');
    msg.innerText = "Rolling..."; msg.style.color = "var(--text-main)";
    
    setTimeout(() => {
        r1.classList.remove('spin-anim'); r1.innerText = REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
        r2.classList.remove('spin-anim'); r2.innerText = REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
        r3.classList.remove('spin-anim'); r3.innerText = REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
        
        let multiplier = 0;
        if (r1.innerText === r2.innerText && r2.innerText === r3.innerText) {
            multiplier = r1.innerText === '7️⃣' ? 100 : r1.innerText === '💎' ? 50 : 10;
        } else if (r1.innerText === r2.innerText || r2.innerText === r3.innerText || r1.innerText === r3.innerText) {
            multiplier = 2; // Pair
        }
        
        if (multiplier > 0) {
            const win = bet * multiplier;
            state.tokens += win;
            msg.innerText = `Winner! +${win} Tokens!`;
            msg.style.color = "var(--success)";
            updateUI();
        } else {
            msg.innerText = `You lost.`;
            msg.style.color = "var(--danger)";
        }
    }, 1000);
}

// ---- GYM ----
function renderGym() {
    if (!els.gymContainer) return;
    els.gymContainer.innerHTML = '';
    
    const statsList = [
        { id: 'str', name: 'Strength', icon: '🏋️', val: state.stats.str },
        { id: 'def', name: 'Defense', icon: '🛡️', val: state.stats.def },
        { id: 'spd', name: 'Speed', icon: '👟', val: state.stats.spd },
        { id: 'dex', name: 'Dexterity', icon: '🥷', val: state.stats.dex }
    ];
    
    statsList.forEach(s => {
        // Calculate progress to next multiple of 100
        const milestone = Math.ceil((s.val + 1) / 100) * 100;
        const previousMilestone = milestone - 100;
        const progress = s.val - previousMilestone;
        const percent = Math.min(100, Math.max(0, (progress / 100) * 100));
        
        const card = document.createElement('div');
        card.className = 'action-card';
        card.innerHTML = `
            <div class="item-info">
                <span class="icon">${s.icon}</span>
                <div>
                    <strong>${s.name}: ${Math.floor(s.val).toLocaleString()}</strong>
                    <div class="gym-stat-bar-container"><div class="gym-stat-fill" style="width: ${percent}%;"></div></div>
                    <div class="text-muted" style="font-size: 0.75rem; margin-top: 3px;">Next milestone: ${milestone}</div>
                </div>
            </div>
            <button class="btn btn-accent" onclick="train('${s.id}')">Train (-5 Eng)</button>
        `;
        els.gymContainer.appendChild(card);
    });
}

window.train = function(stat) {
    if (state.hospital.find(h => h.id === 'player')) return showModal("Error", "You cannot train while in the hospital.");
    if (state.bars.energy.current < 5) return showModal("Error", "Need 5 Energy.");
    state.bars.energy.current -= 5;
    
    let gain = (Math.random() * 2 + 1) * (0.5 + (state.bars.happy.current / 100) * 0.5); 
    if (state.education.completed.includes('edu_sports')) gain *= 1.10; 
    
    state.stats[stat] += gain; 
    updateUI();
    renderGym(); // Re-render bars
}

// ---- TRADE (MARKET) ----
function renderTrade() {
    if (!els.tradeContainer) return;
    els.tradeContainer.innerHTML = '';
    
    const storeHeader = document.createElement('h3'); storeHeader.innerText = "City Stores (NPC)";
    els.tradeContainer.appendChild(storeHeader);
    
    ITEMS.filter(i => i.loc === 'Torn City' && i.cost > 0 && i.type !== 'collectible').forEach(item => {
        let actualCost = item.cost;
        if (state.education.completed.includes('edu_bus')) actualCost = Math.floor(actualCost * 0.9);
        
        const card = document.createElement('div'); card.className = 'action-card';
        card.innerHTML = `<div class="item-info"><span class="icon">${item.icon}</span><div><strong>${item.name}</strong> <span class="badge bg-dark">$${actualCost.toLocaleString()}</span></div></div>
            <div>
                <button class="btn btn-success" onclick="buyItem('${item.id}')">Buy</button>
            </div>`;
        els.tradeContainer.appendChild(card);
    });

    const marketHeader = document.createElement('h3'); marketHeader.innerText = "Global Player Market"; marketHeader.style.marginTop = '30px';
    els.tradeContainer.appendChild(marketHeader);
    
    const marketDiv = document.createElement('div');
    marketDiv.id = 'player-market-container';
    els.tradeContainer.appendChild(marketDiv);
    
    socket.emit('get_market');
}

let liveMarket = [];
socket.on('bazaar_data', data => {
    state.bazaarListings = data;
    const list = document.getElementById('bazaar-market-list');
    if (list) {
        list.innerHTML = '';
        data.forEach(m => {
            const item = ITEMS.find(i => i.id === m.itemId);
            list.innerHTML += `<div class="action-card mt-10"><div>${item.icon} ${item.name} <span class="text-muted">by ${m.sellerName}</span></div><button class="btn btn-success" onclick="socket.emit('buy_bazaar_item', ${m.id})">Buy $${m.price.toLocaleString()}</button></div>`;
        });
    }
});

socket.on('market_data', data => {
    state.marketListings = data;
    liveMarket = data;
    
    // Update Trade UI market list if it exists
    const list = document.getElementById('trade-market-list');
    if (list) {
        list.innerHTML = '';
        data.forEach(m => {
            const item = ITEMS.find(i => i.id === m.itemId);
            list.innerHTML += `<div class="action-card mt-10"><div>${item.icon} ${item.name} <span class="text-muted">by ${m.sellerName}</span></div><button class="btn btn-success" onclick="socket.emit('buy_market_item', ${m.id})">Buy $${m.price.toLocaleString()}</button></div>`;
        });
    }

    // Update Player Market container if it exists
    const container = document.getElementById('player-market-container');
    if (container) {
        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">The market is empty.</p>';
        } else {
            data.forEach(m => {
                const itemDef = ITEMS.find(i => i.id === m.itemId);
                const card = document.createElement('div'); card.className = 'action-card';
                card.innerHTML = `<div class="item-info"><span class="icon">${itemDef?itemDef.icon:'📦'}</span><div><strong>${itemDef?itemDef.name:'Unknown'}</strong> <span class="badge" style="background:var(--accent);">$${m.price.toLocaleString()}</span><div class="text-muted" style="font-size:0.8rem;">Seller: ${m.sellerName}</div></div></div>
                    <button class="btn btn-success" onclick="socket.emit('buy_market_item', ${m.id})">Buy</button>`;
                container.appendChild(card);
            });
        }
    }
});

window.buyItem = function(id) {
    socket.emit('buy_npc_item', id);
}

window.useItem = function(id) {
    socket.emit('use_item', id);
}

window.sellItem = function(id) {
    const price = prompt("Enter the price you want to list this item for on the Global Market:");
    if (!price || isNaN(price) || parseInt(price) <= 0) return;
    socket.emit('list_market_item', { itemId: id, price: parseInt(price) });
}

// ---- COMBAT & BOUNTIES ----
function renderCrimes() {
    if (!els.crimesContainer) return;
    els.crimesContainer.innerHTML = '';
    CRIMES.forEach(c => {
        const card = document.createElement('div'); card.className = 'action-card';
        card.innerHTML = `<div class="item-info"><span class="icon">🦹</span><div><strong>${c.name}</strong> <span class="badge bg-dark">${c.cat}</span><div class="text-muted" style="font-size:0.8rem;">Success: ${Math.floor(c.suc * 100)}% | Jail: ${c.jail}s</div></div></div>
            <button class="btn btn-primary" onclick="commitCrime('${c.id}')">Do (-${c.cost} Nerve)</button>`;
        els.crimesContainer.appendChild(card);
    });
}

function commitCrime(id) {
    if (state.hospital.find(h => h.id === 'player')) return showModal("Error", "You are in the hospital.");
    const c = CRIMES.find(x=>x.id===id); if(state.bars.nerve.current<c.cost)return;
    state.bars.nerve.current -= c.cost;
    
    let successRate = c.suc;
    if (state.education.completed.includes('edu_crim')) successRate += 0.10;
    
    if(Math.random() <= successRate) { 
        const loot = Math.floor(Math.random()*(c.max-c.min)+c.min);
        state.cash += loot; 
        showModal("Success!", `You completed ${c.name} and got $${loot.toLocaleString()}.`);
    } else if(c.jail>0) { 
        state.jailTime=c.jail; els.jailOverlay.classList.remove('hidden'); 
        showModal("Busted!", `You were caught! You are in jail for ${c.jail} seconds.`);
    } else {
        showModal("Failed", `You failed the crime but got away.`);
    }
    updateUI();
}

function renderStreets() {
    if (!els.streetsContainer) return;
    els.streetsContainer.innerHTML = '';
    
    if (onlinePlayers.length <= 1) {
        els.streetsContainer.innerHTML = '<p class="text-muted">No one else is currently out on the streets.</p>';
        return;
    }
    
    const myName = document.getElementById('auth-username').value;
    
    onlinePlayers.forEach(p => {
        if (p.username === myName) return; // Don't attack yourself
        const card = document.createElement('div'); card.className = 'action-card';
        card.innerHTML = `<div class="item-info"><span class="icon">👤</span><div><strong>${p.username}</strong> <span class="badge" style="background:#555;">Player</span></div></div>
            <button class="btn btn-danger" onclick="attackTarget('${p.id}')">Attack (-25 Eng)</button>`;
        els.streetsContainer.appendChild(card);
    });
}

window.attackTarget = function(playerId) {
    if (state.jailTime > 0) return;
    if (state.hospital.find(h => h.id === 'player')) return showModal("Error", "You are in the hospital.");
    if (state.bars.energy.current < 25) return showModal("Error", "Need 25 Energy.");
    
    socket.emit('attack_player', playerId);
}

// ---- BOUNTIES ----
let liveBounties = [];

socket.on('bounties_data', data => {
    liveBounties = data;
    if (document.getElementById('bounties').classList.contains('active')) {
        renderBounties();
    }
});

function renderBounties() {
    const container = document.getElementById('bounties-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (liveBounties.length === 0) {
        container.innerHTML = '<p class="text-muted">No active bounties on the board.</p>';
        return;
    }
    
    liveBounties.forEach(b => {
        const card = document.createElement('div'); card.className = 'action-card';
        card.innerHTML = `<div class="item-info"><span class="icon">🎯</span><div><strong>${b.targetName}</strong> <span class="badge" style="background:var(--danger);">$${b.reward.toLocaleString()}</span><div class="text-muted" style="font-size:0.8rem;">Placed by: ${b.placerName}</div></div></div>
            <button class="btn btn-danger" onclick="document.querySelectorAll('.nav-btn[data-tab=\\'streets\\']')[0].click()">Find on Streets</button>`;
        container.appendChild(card);
    });
}

window.placeBounty = function() {
    const target = document.getElementById('bounty-target').value.trim();
    const reward = parseInt(document.getElementById('bounty-reward').value);
    const qty = parseInt(document.getElementById('bounty-qty').value);
    
    if (!target) return showModal("Error", "Enter a target username.");
    if (reward < 1000) return showModal("Error", "Minimum bounty is $1,000.");
    if (qty < 1 || qty > 200) return showModal("Error", "Quantity must be 1 to 200.");
    
    socket.emit('place_bounty', { target: target, reward: reward, count: qty });
    document.getElementById('bounty-target').value = '';
}

// ---- STOCKS & EDUCATION ----
function renderStocks() {
    if (!els.stocksContainer) return;
    els.stocksContainer.innerHTML = '';
    state.stocks.forEach(stock => {
        const trendClass = stock.trend > 0 ? 'stock-up' : stock.trend < 0 ? 'stock-down' : 'text-muted';
        const trendIcon = stock.trend > 0 ? '▲' : stock.trend < 0 ? '▼' : '−';
        
        const card = document.createElement('div'); card.className = 'action-card';
        card.innerHTML = `<div class="item-info"><span class="stock-ticker">${stock.id}</span><div><strong>${stock.name}</strong> <div class="${trendClass}">$${stock.price.toLocaleString()} ${trendIcon}</div></div></div>
            <button class="btn btn-success" onclick="buyStock('${stock.id}')">Buy</button>`;
        els.stocksContainer.appendChild(card);
    });
    
    els.portfolioContainer.innerHTML = '';
    let hasPortfolio = false;
    for (const [id, data] of Object.entries(state.portfolio)) {
        if (data.shares > 0) {
            hasPortfolio = true;
            const stock = state.stocks.find(s => s.id === id);
            const currentVal = stock.price * data.shares;
            const avgVal = data.avgPrice * data.shares;
            const profit = currentVal - avgVal;
            const profitClass = profit >= 0 ? 'stock-up' : 'stock-down';
            
            const card = document.createElement('div'); card.className = 'action-card';
            card.innerHTML = `<div class="item-info"><span class="stock-ticker">${id}</span><div><strong>${data.shares.toLocaleString()} Shares</strong> <div class="text-muted" style="font-size:0.8rem;">Avg: $${Math.floor(data.avgPrice).toLocaleString()}</div><div class="${profitClass}">P/L: $${profit.toLocaleString()}</div></div></div>
                <button class="btn btn-danger" onclick="sellStock('${id}')">Sell All ($${currentVal.toLocaleString()})</button>`;
            els.portfolioContainer.appendChild(card);
        }
    }
    if (!hasPortfolio) els.portfolioContainer.innerHTML = '<p class="text-muted">You own no shares.</p>';
}

window.buyStock = function(id) {
    const stock = state.stocks.find(s => s.id === id);
    const html = `<p>Buy shares of <strong>${stock.name}</strong> at $${stock.price.toLocaleString()} each.</p>
        <div style="margin-top:15px;"><label>Shares: </label><input type="number" id="stock-shares-input" value="10" style="background:#111; color:white; border:1px solid #444; padding:5px;"></div>`;
    showModal("Buy Stock", html, () => {
        const shares = parseInt(document.getElementById('stock-shares-input').value);
        if(isNaN(shares) || shares <= 0) return showModal("Error", "Invalid amount.");
        const cost = shares * stock.price;
        if(state.cash < cost) return showModal("Error", "Not enough cash.");
        
        state.cash -= cost;
        if(!state.portfolio[id]) state.portfolio[id] = { shares: 0, avgPrice: 0 };
        const oldShares = state.portfolio[id].shares;
        const oldAvg = state.portfolio[id].avgPrice;
        state.portfolio[id].avgPrice = ((oldShares * oldAvg) + (shares * stock.price)) / (oldShares + shares);
        state.portfolio[id].shares += shares;
        updateUI(); renderStocks();
    }, true);
}

window.sellStock = function(id) {
    const stock = state.stocks.find(s => s.id === id);
    const data = state.portfolio[id];
    if(!data || data.shares <= 0) return;
    state.cash += data.shares * stock.price;
    data.shares = 0;
    updateUI(); renderStocks();
}

function renderEducation() {
    if(!els.coursesContainer) return;
    const panel = document.getElementById('active-course-panel');
    if (state.education.active) {
        panel.classList.remove('hidden');
        document.getElementById('ac-name').innerText = COURSES.find(c => c.id === state.education.active).name;
    } else {
        panel.classList.add('hidden');
    }
    
    els.coursesContainer.innerHTML = '';
    COURSES.forEach(c => {
        const isCompleted = state.education.completed.includes(c.id);
        const isActive = state.education.active === c.id;
        const card = document.createElement('div'); 
        card.className = `action-card ${isCompleted ? 'course-completed' : ''}`;
        
        let btnHtml = isCompleted ? `<button class="btn" disabled>Graduated</button>` : isActive ? `<button class="btn btn-accent" onclick="cancelEducation()">Cancel</button>` : `<button class="btn btn-success" onclick="enrollEducation('${c.id}')">Enroll ($${c.cost.toLocaleString()})</button>`;
        
        card.innerHTML = `<div class="item-info"><span class="icon">${c.icon}</span><div><strong>${c.name}</strong> <span class="badge bg-dark">${c.time}s</span><div class="text-muted" style="font-size:0.8rem;">${c.desc}</div><div class="course-buff">${c.buff}</div></div></div>${btnHtml}`;
        els.coursesContainer.appendChild(card);
    });
}

window.enrollEducation = function(id) {
    if(state.education.active) return showModal("Error", "You are already enrolled in a course.");
    const course = COURSES.find(c => c.id === id);
    if(state.cash < course.cost) return showModal("Error", "Not enough cash.");
    state.cash -= course.cost; state.education.active = id; state.education.timeRemaining = course.time; state.education.maxTime = course.time;
    updateUI(); renderEducation();
}

window.cancelEducation = function() { state.education.active = null; updateUI(); renderEducation(); }

window.switchMarketTab = function(tab) {
    document.querySelectorAll('.market-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('market-' + tab).classList.remove('hidden');
    if(tab === 'city') renderCityMarket();
    if(tab === 'player') renderPlayerMarket();
    if(tab === 'bazaar') renderBazaar();
}

function renderCityMarket() {
    const list = document.getElementById('city-market-list');
    if(!list) return;
    list.innerHTML = '';
    state.liveCityMarket.forEach(liveItem => {
        const item = ITEMS.find(i => i.id === liveItem.id);
        if(!item) return;
        let cost = liveItem.currentCost;
        if (state.education.completed.includes('edu_bus')) cost = Math.floor(cost * 0.9);
        list.innerHTML += `<div class="action-card" style="padding:10px;"><div>${item.icon} <strong>${item.name}</strong></div><div class="text-muted" style="font-size:0.8rem;">${item.desc}</div><button class="btn btn-success mt-10" onclick="buyItem('${item.id}')" style="width:100%">Buy $${cost.toLocaleString()}</button></div>`;
    });
}

function renderPlayerMarket() {
    socket.emit('get_market');
    const invList = document.getElementById('trade-inventory-list');
    if(!invList) return;
    invList.innerHTML = '';
    for (const [itemId, qty] of Object.entries(state.inventory)) {
        if (qty > 0) {
            const item = ITEMS.find(i => i.id === itemId);
            invList.innerHTML += `<div class="action-card" style="padding:10px; margin-bottom:5px;"><div>${item.icon} ${item.name} <span class="badge">x${qty}</span></div>
            <div style="display:flex; gap:5px; margin-top:5px;"><input type="number" id="qty_${itemId}" placeholder="Qty" value="1" class="chat-input" style="width:60px;"><input type="number" id="price_${itemId}" placeholder="Price" class="chat-input" style="width:80px;"><button class="btn btn-accent" onclick="listMarketItem('${itemId}')">List</button></div></div>`;
        }
    }
}

function renderBazaar() {
    socket.emit('get_bazaar'); // Always fetch bazaar listings for everyone

    if(state.bazaarUnlocked === 0) {
        document.getElementById('bazaar-locked-ui').classList.remove('hidden');
        document.getElementById('bazaar-unlocked-ui').classList.add('hidden');
    } else {
        document.getElementById('bazaar-locked-ui').classList.add('hidden');
        document.getElementById('bazaar-unlocked-ui').classList.remove('hidden');
        
        const invList = document.getElementById('bazaar-inventory-list');
        if(!invList) return;
        invList.innerHTML = '';
        for (const [itemId, qty] of Object.entries(state.inventory)) {
            if (qty > 0) {
                const item = ITEMS.find(i => i.id === itemId);
                invList.innerHTML += `<div class="action-card" style="padding:10px; margin-bottom:5px;"><div>${item.icon} ${item.name} <span class="badge">x${qty}</span></div>
                <div style="display:flex; gap:5px; margin-top:5px;"><input type="number" id="bzqty_${itemId}" placeholder="Qty" value="1" class="chat-input" style="width:60px;"><input type="number" id="bzprice_${itemId}" placeholder="Price" class="chat-input" style="width:80px;"><button class="btn btn-success" onclick="listBazaarItem('${itemId}')">List</button></div></div>`;
            }
        }
    }
}

window.mockPayment = function() {
    // Simulates a Stripe / Razerpay checkout success
    showModal("Payment Processing", "Connecting to secure mock gateway...");
    setTimeout(() => {
        socket.emit('bazaar_unlock');
    }, 1500);
}

socket.on('bazaar_unlocked_success', () => {
    state.bazaarUnlocked = 1;
    renderBazaar();
});

socket.on('bazaar_data', (data) => {
    // Handle bazaar items if needed
});

function renderTrade() {
    switchMarketTab('city');
}

window.listBazaarItem = function(itemId) {
    const price = document.getElementById(`bzprice_${itemId}`).value;
    const qty = document.getElementById(`bzqty_${itemId}`).value;
    socket.emit('list_bazaar_item', { itemId: itemId, price: price, qty: qty });
}

window.listMarketItem = function(itemId) {
    const price = document.getElementById(`price_${itemId}`).value;
    const qty = document.getElementById(`qty_${itemId}`).value;
    socket.emit('list_market_item', { itemId: itemId, price: price, qty: qty });
}

window.searchProfile = function() {
    const target = document.getElementById('search-username').value;
    if(!target) return;
    socket.emit('search_user', target);
}

socket.on('profile_data', (data) => {
    const res = document.getElementById('profile-result');
    res.classList.remove('hidden');
    res.innerHTML = `
        <h2 style="color:var(--primary);">${data.username}</h2>
        <div class="text-muted mb-15">Lives in: ${data.location} | Property: ${data.property} | Total Stats: ${Math.floor(data.totalStats).toLocaleString()}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-danger" onclick="socket.emit('attack_player', ${data.id})">Attack</button>
            <button class="btn btn-accent" onclick="promptBounty('${data.username}')">Bounty</button>
            <button class="btn btn-success" onclick="socket.emit('set_relationship', {targetId: ${data.id}, type: 'friend'})">Add Friend</button>
            <button class="btn" style="background:#8b0000; color:white;" onclick="socket.emit('set_relationship', {targetId: ${data.id}, type: 'enemy'})">Add Enemy</button>
        </div>
    `;
});

// ---- CORE MISC ----
function renderInventory() {
    els.inventoryList.innerHTML = '';
    for (const [itemId, qty] of Object.entries(state.inventory)) {
        if (qty > 0) {
            const item = ITEMS.find(i => i.id === itemId);
            const card = document.createElement('div'); card.className = 'action-card';
            card.innerHTML = `<div class="item-info"><span class="icon">${item.icon}</span><div><strong>${item.name}</strong> <span class="badge">x${qty}</span></div></div>
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                <button class="btn btn-success" onclick="useItem('${item.id}')">Use</button>
                <button class="btn" onclick="socket.emit('equip_item', '${item.id}')">Equip</button>
                <button class="btn btn-accent" onclick="promptSendItem('${item.id}')">Send</button>
                <button class="btn btn-danger" onclick="quickSellItem('${item.id}')">Sell (50%)</button>
            </div>`;
            els.inventoryList.appendChild(card);
        }
    }
}

window.promptSendItem = function(itemId) {
    const target = prompt("Enter the username to send this item to:");
    if(!target) return;
    socket.emit('send_item', { itemId: itemId, target: target });
}

window.quickSellItem = function(itemId) {
    socket.emit('quick_sell_item', itemId);
}
function buyItem(itemId) {
    const item = ITEMS.find(i => i.id === itemId);
    const liveItem = state.liveCityMarket.find(i => i.id === itemId);
    let cost = liveItem ? liveItem.currentCost : item.cost;
    
    if (state.education.completed.includes('edu_bus')) cost = Math.floor(cost * 0.9);
    
    // Check inventory capacity
    const currentInvCount = getInventoryCount();
    if (currentInvCount >= state.maxInv) return showModal("Error", "Your inventory is full (Max 60,000).");
    
    // Check travel capacity
    if (state.location !== 'Torn City') {
        const foreignItemsCount = Object.keys(state.inventory).reduce((sum, key) => {
            const it = ITEMS.find(i => i.id === key);
            if (it && it.loc !== 'Torn City') return sum + state.inventory[key];
            return sum;
        }, 0);
        if (foreignItemsCount >= state.maxTravelInv) return showModal("Error", `Travel capacity reached (${state.maxTravelInv} items). Buy suitcases in Torn City to increase this limit.`);
    }

    if(state.cash >= cost) { 
        socket.emit('buy_npc_item', itemId); // Server handles deduction and adding
    } else {
        showModal("Error", "Not enough cash.");
    }
}


function spawnCityFind() {
    const pool = ITEMS.filter(i => i.loc === 'Torn City');
    const randomItem = pool[Math.floor(Math.random() * pool.length)];
    const id = 'find_' + Date.now() + Math.random();
    state.cityFinds.push({ id: id, itemId: randomItem.id, x: Math.floor(Math.random() * 90) + 5, y: Math.floor(Math.random() * 90) + 5 });
    if (document.getElementById('city').classList.contains('active')) renderCity();
}

window.collectCityFind = function(findId) {
    const idx = state.cityFinds.findIndex(f => f.id === findId);
    if(idx === -1) return;
    if (getInventoryCount() >= state.maxInv) return showModal("Error", "Your inventory is full.");
    const find = state.cityFinds[idx]; const item = ITEMS.find(i => i.id === find.itemId);
    state.cityFinds.splice(idx, 1);
    if (!state.inventory[item.id]) state.inventory[item.id] = 0;
    state.inventory[item.id]++;
    showModal("City Find", `You found a <strong>${item.name}</strong> laying on the ground!`);
    pushPhoneNotification(`City Finds: You picked up a ${item.name} from the streets.`);
    updateUI(); renderInventory(); renderCity();
}

function renderCity() {
    els.cityMap.innerHTML = '';
    CITY_NODES.forEach(node => {
        const el = document.createElement('div'); el.className = 'map-pin';
        el.style.left = `${node.x}%`; el.style.top = `${node.y}%`;
        el.innerHTML = `<div class="pin-icon">${node.icon}</div><div class="pin-label">${node.name}</div>`;
        el.onclick = () => openCityAction(node); els.cityMap.appendChild(el);
    });
    state.cityFinds.forEach(find => {
        const item = ITEMS.find(i => i.id === find.itemId);
        const el = document.createElement('div'); el.className = 'city-find-icon';
        el.style.left = `${find.x}%`; el.style.top = `${find.y}%`; el.innerHTML = item.icon;
        el.onclick = () => collectCityFind(find.id); els.cityMap.appendChild(el);
    });
}

function openCityAction(node) {
    els.caPanel.classList.remove('hidden'); els.caTitle.innerText = node.name; els.caDesc.innerText = node.desc;
    if (node.id === 'bank') els.caControls.innerHTML = `<button class="btn" onclick="state.bank+=state.cash;state.cash=0;updateUI()">Deposit All</button> <button class="btn" onclick="state.cash+=state.bank;state.bank=0;updateUI()">Withdraw All</button>`;
    else if (node.id === 'church') els.caControls.innerHTML = `<button class="btn btn-accent" onclick="if(state.cash>=1000){state.cash-=1000;state.bars.happy.max+=10;state.bars.happy.current+=10;updateUI();showModal('Blessed','You donated to the church. Max Happy +10!');}">Donate ($1,000)</button>`;
    else if (node.id === 'pawn') {
        let html = '<p class="text-muted">Dump unwanted items for a low price.</p><div class="action-list mt-10">';
        for (const [itemId, qty] of Object.entries(state.inventory)) {
            if (qty > 0) {
                const item = ITEMS.find(i => i.id === itemId);
                html += `<div class="action-card"><div>${item.icon} ${item.name} (x${qty})</div> <button class="btn btn-danger" onclick="quickSellItem('${item.id}');openCityAction(CITY_NODES.find(n=>n.id==='pawn'));">Sell $${item.sell}</button></div>`;
            }
        }
        html += '</div>';
        els.caControls.innerHTML = html;
    }
    else if (node.id === 'realestate') {
        let cost = 0;
        els.caControls.innerHTML = PROPERTIES.map(p => {
            cost = p.cost;
            if (state.education.completed.includes('edu_bus')) cost = Math.floor(cost * 0.9);
            return `<div class="action-card mt-10"><div>${p.icon} ${p.name} (Max Happy ${p.happy})</div> <button class="btn" onclick="if(state.cash>=${cost}){state.cash-=${cost};state.properties.push('${p.id}');showModal('Bought','Bought ${p.name}');updateUI();}else{showModal('Error','Not enough cash');}">Buy $${cost.toLocaleString()}</button> <button class="btn btn-success" onclick="if(state.properties.includes('${p.id}')){state.currentProp='${p.id}';state.bars.happy.max=${p.happy};updateUI();}">Move In</button></div>`;
        }).join('');
    }
    else if (node.id === 'supermarket') {
        els.caControls.innerHTML = ITEMS.filter(i=>i.loc==='Torn City').map(i => {
            let cost = i.cost;
            if (state.education.completed.includes('edu_bus')) cost = Math.floor(cost * 0.9);
            return `<div class="action-card mt-10"><div>${i.icon} ${i.name}</div> <button class="btn" onclick="buyItem('${i.id}')">$${cost.toLocaleString()}</button></div>`;
        }).join('');
    }
}
window.closeCityAction = function() { els.caPanel.classList.add('hidden'); }

function renderTravel() {
    els.worldMap.innerHTML = state.location === 'Torn City' ? TRAVEL_LOCATIONS.map(l => `<div class="map-node" onclick="bookFlight('${l.id}')"><span class="icon">${l.icon}</span><span class="title">${l.name}</span><span class="subtitle">$${l.cost}</span></div>`).join('') : `<div class="map-node" onclick="bookFlight('torn')"><span class="icon">✈️</span><span class="title">Return to Torn City</span></div>`;
    if(state.location !== 'Torn City') {
        const item = ITEMS.find(i=>i.loc===state.location);
        if(item) {
            let cost = item.cost;
            if (state.education.completed.includes('edu_bus')) cost = Math.floor(cost * 0.9);
            els.worldMap.innerHTML += `<div class="action-card mt-20" style="grid-column:1/-1;"><div>${item.icon} ${item.name}</div><button class="btn btn-success" onclick="buyItem('${item.id}')">Buy $${cost.toLocaleString()}</button></div>`;
        }
    }
}
window.bookFlight = function(id) {
    const loc = id==='torn' ? {name:'Torn City', cost:0, time:20} : TRAVEL_LOCATIONS.find(l=>l.id===id);
    if(state.cash<loc.cost) return; state.cash-=loc.cost;
    state.travel = {status:'flying', dest:loc.name, maxTime:loc.time, timeRemaining:loc.time};
    els.flightDest.innerText = loc.name; els.flightOverlay.classList.remove('hidden'); updateUI();
}

function setupTabs() {
    document.querySelectorAll('.nav-btn').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn, .tab-content').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); document.getElementById(t.dataset.tab).classList.add('active');
        if(t.dataset.tab==='trade') renderTrade();
        if(t.dataset.tab==='city') renderCity();
        if(t.dataset.tab==='stocks') renderStocks();
        if(t.dataset.tab==='university') renderEducation();
        if(t.dataset.tab==='hospital') renderHospital();
        if(t.dataset.tab==='gym') renderGym();
        if(t.dataset.tab==='crimes') renderCrimes();
        if(t.dataset.tab==='bounties') {
            socket.emit('get_bounties');
            renderBounties();
        }
        if(t.dataset.tab==='newspaper') {
            // Static visual newspaper tab, no render func needed for prototype
        }
        
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
        }
    }));
}

// ---- CASINO LOGIC ----
window.playSlots = function() {
    const bet = parseInt(document.getElementById('bet-amount').value);
    if (!bet || bet <= 0) return;
    socket.emit('play_slots', bet);
}

socket.on('slots_result', data => {
    state.tokens += data.netChange;
    updateUI();
    document.getElementById('reel1').innerText = data.reels[0];
    document.getElementById('reel2').innerText = data.reels[1];
    document.getElementById('reel3').innerText = data.reels[2];
    
    const msg = document.getElementById('slot-msg');
    if (data.win > 0) {
        msg.innerHTML = `<span style="color:var(--success)">You won ${data.win} Tokens!</span>`;
    } else {
        msg.innerHTML = `<span style="color:var(--danger)">You lost.</span>`;
    }
});

window.playRoulette = function(color) {
    const bet = parseInt(document.getElementById('roulette-bet').value);
    if (!bet || bet <= 0) return;
    socket.emit('play_roulette', { bet: bet, color: color });
}

socket.on('roulette_result', data => {
    state.tokens += data.netChange;
    updateUI();
    const display = document.getElementById('roulette-display');
    display.innerText = data.roll;
    if (data.rollColor === 'red') display.style.color = '#ff4444';
    else if (data.rollColor === 'black') display.style.color = '#fff';
    else display.style.color = 'var(--success)';
    
    const msg = document.getElementById('roulette-msg');
    if (data.netChange > 0) {
        msg.innerHTML = `<span style="color:var(--success)">Winner! +${data.netChange} Tokens!</span>`;
    } else {
        msg.innerHTML = `<span style="color:var(--danger)">You lost.</span>`;
    }
});

window.bjStart = function() {
    const bet = parseInt(document.getElementById('bj-bet').value);
    if (!bet || bet <= 0) return;
    socket.emit('bj_start', bet);
}

socket.on('bj_update', data => {
    if (data.netChange !== undefined) {
        state.tokens += data.netChange;
        updateUI();
    }
    const pHandHtml = data.pHand.map(c => `<span style="color:${['♥','♦'].includes(c.face.slice(-1))?'#ff4444':'#fff'}">${c.face}</span>`).join(' ');
    const dHandHtml = data.dHand.map(c => `<span style="color:${['♥','♦'].includes(c.face.slice(-1))?'#ff4444':'#fff'}">${c.face}</span>`).join(' ');
    
    document.getElementById('bj-player').innerHTML = pHandHtml;
    document.getElementById('bj-player-score').innerText = `Score: ${data.pScore}`;
    document.getElementById('bj-dealer').innerHTML = dHandHtml;
    document.getElementById('bj-dealer-score').innerText = `Score: ${data.dScore || '?'}`;
    
    const startDiv = document.getElementById('bj-controls-start');
    const playDiv = document.getElementById('bj-controls-play');
    const msg = document.getElementById('bj-msg');
    
    if (data.status === 'playing') {
        startDiv.classList.add('hidden');
        playDiv.classList.remove('hidden');
        msg.innerHTML = `Your turn. Hit or Stand?`;
    } else {
        startDiv.classList.remove('hidden');
        playDiv.classList.add('hidden');
        if (data.status === 'bust') msg.innerHTML = `<span style="color:var(--danger)">Bust! You lost ${Math.abs(data.netChange)} Tokens.</span>`;
        else if (data.status === 'win') msg.innerHTML = `<span style="color:var(--success)">You won ${data.netChange} Tokens!</span>`;
        else if (data.status === 'lose') msg.innerHTML = `<span style="color:var(--danger)">Dealer wins. You lost ${Math.abs(data.netChange)} Tokens.</span>`;
        else msg.innerHTML = `<span style="color:var(--text-muted)">Push. Bet returned.</span>`;
    }
});

// ---- MOBILE SIDEBAR LOGIC ----
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

// ---- CRASH LOGIC ----
window.crashStart = function() {
    const bet = document.getElementById('crash-bet').value;
    socket.emit('crash_start', bet);
}
window.crashCashout = function() {
    socket.emit('crash_cashout');
}
socket.on('crash_update', data => {
    const multDiv = document.getElementById('crash-multiplier');
    const startDiv = document.getElementById('crash-controls-start');
    const playDiv = document.getElementById('crash-controls-play');
    const msg = document.getElementById('crash-msg');
    
    multDiv.innerText = data.mult.toFixed(2) + 'x';
    
    if (data.status === 'playing') {
        startDiv.classList.add('hidden');
        playDiv.classList.remove('hidden');
        multDiv.style.color = 'var(--primary)';
        msg.innerHTML = `Running...`;
    } else if (data.status === 'crashed') {
        startDiv.classList.remove('hidden');
        playDiv.classList.add('hidden');
        multDiv.style.color = 'var(--danger)';
        msg.innerHTML = `<span style="color:var(--danger)">Crashed! You lost ${Math.abs(data.netChange)} Tokens.</span>`;
    } else if (data.status === 'cashed_out') {
        startDiv.classList.remove('hidden');
        playDiv.classList.add('hidden');
        multDiv.style.color = 'var(--success)';
        msg.innerHTML = `<span style="color:var(--success)">Cashed Out! Won ${data.netChange} Tokens!</span>`;
    }
});

// ---- HILO LOGIC ----
const hiloCards = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
socket.on('hilo_update', data => {
    const cardDiv = document.getElementById('hilo-card');
    const startDiv = document.getElementById('hilo-controls-start');
    const playDiv = document.getElementById('hilo-controls-play');
    const msg = document.getElementById('hilo-msg');
    
    let displayCard = data.card;
    if(displayCard > 10) displayCard = hiloCards[displayCard];
    cardDiv.innerText = `🂠 ${displayCard}`;
    
    if(data.status === 'playing') {
        startDiv.classList.add('hidden');
        playDiv.classList.remove('hidden');
        msg.innerHTML = data.msg;
    } else {
        startDiv.classList.remove('hidden');
        playDiv.classList.add('hidden');
        if(data.status === 'win') msg.innerHTML = `<span style="color:var(--success)">${data.msg} Won ${data.netChange} Tokens!</span>`;
        else if(data.status === 'lose') msg.innerHTML = `<span style="color:var(--danger)">${data.msg} Lost ${Math.abs(data.netChange)} Tokens.</span>`;
        else msg.innerHTML = `<span style="color:var(--text-muted)">${data.msg}</span>`;
    }
});
