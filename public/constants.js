const COURSES = [
    { id: 'edu_sports', name: 'Sports Science', icon: '🏃', desc: 'Learn how to lift correctly.', buff: '+10% to all Gym Stat gains', time: 120, cost: 5000 },
    { id: 'edu_bus', name: 'Business Management', icon: '💼', desc: 'Negotiation tactics.', buff: '-10% to all Store prices', time: 180, cost: 15000 },
    { id: 'edu_crim', name: 'Criminal History', icon: '🦹', desc: 'Learn from past mistakes.', buff: '+10% Crime Success Rate', time: 300, cost: 50000 }
];

const ITEMS = [
    { id: 'redbull', name: 'Red Bull', icon: '🥫', desc: 'Restores 50 Energy instantly.', cost: 500, sell: 250, type: 'energy', val: 50, loc: 'Torn City' },
    { id: 'firstaid', name: 'First Aid Kit', icon: '🩹', desc: 'Restores 100 Life instantly.', cost: 1000, sell: 500, type: 'life', val: 100, loc: 'Torn City' },
    { id: 'beer', name: 'Can of Beer', icon: '🍺', desc: '+2 Nerve and +10 Happy.', cost: 200, sell: 100, type: 'mixed', loc: 'Torn City' },
    { id: 'suitcase', name: 'Small Suitcase', icon: '💼', desc: 'Capacity +5 (Max 40).', cost: 25000, sell: 10000, type: 'booster', val: 5, loc: 'Torn City' },
    { id: 'tokens', name: 'Casino Tokens', icon: '🪙', desc: '100 Casino Tokens.', cost: 1000, sell: 500, type: 'tokens', val: 100, loc: 'Torn City' },
    { id: 'plushie_mexico', name: 'Jaguar Plushie', icon: '🐆', desc: 'Sells for profit in Torn.', cost: 10000, sell: 15000, type: 'collectible', loc: 'Mexico' },
    { id: 'plushie_canada', name: 'Wolverine Plushie', icon: '🦡', desc: 'Sells for profit in Torn.', cost: 15000, sell: 22000, type: 'collectible', loc: 'Canada' },
    { id: 'plushie_uk', name: 'Nessie Plushie', icon: '🦕', desc: 'Sells for profit in Torn.', cost: 40000, sell: 60000, type: 'collectible', loc: 'United Kingdom' },
    { id: 'plushie_sa', name: 'Lion Plushie', icon: '🦁', desc: 'Sells for profit in Torn.', cost: 80000, sell: 110000, type: 'collectible', loc: 'South Africa' },
    { id: 'katana', name: 'Authentic Katana', icon: '🗡️', desc: 'Sells for profit in Torn.', cost: 150000, sell: 200000, type: 'collectible', loc: 'Japan' },
    { id: 'gold_camel', name: 'Solid Gold Camel', icon: '🐪', desc: 'Sells for profit in Torn.', cost: 500000, sell: 650000, type: 'collectible', loc: 'UAE' }
];

const CRIMES = [
    { cat: 'Petty Crime', id: 'c1', name: 'Search for Cash', cost: 1, suc: 0.95, min: 5, max: 20, jail: 0 },
    { cat: 'Petty Crime', id: 'c2', name: 'Sell Copied Media', cost: 2, suc: 0.90, min: 10, max: 40, jail: 0 },
    { cat: 'Petty Crime', id: 'c3', name: 'Shoplift', cost: 3, suc: 0.85, min: 25, max: 70, jail: 10 },
    { cat: 'Theft', id: 'c4', name: 'Pickpocketing', cost: 4, suc: 0.75, min: 50, max: 120, jail: 20 },
    { cat: 'Theft', id: 'c6', name: 'Burglary', cost: 6, suc: 0.65, min: 150, max: 350, jail: 45 },
    { cat: 'Armed Robbery', id: 'c7', name: 'Mugging', cost: 8, suc: 0.60, min: 300, max: 600, jail: 60 },
    { cat: 'Armed Robbery', id: 'c9', name: 'Bank Heist', cost: 15, suc: 0.35, min: 2000, max: 5000, jail: 180 },
    { cat: 'Auto Theft', id: 'c11', name: 'Steal Luxury Car', cost: 18, suc: 0.40, min: 4000, max: 10000, jail: 240 }
];

const PROPERTIES = [
    { id: 'shack', name: 'Shack', icon: '⛺', desc: 'A literal box.', cost: 0, happy: 100 },
    { id: 'trailer', name: 'Trailer', icon: '🚐', desc: 'Slightly better than a box.', cost: 10000, happy: 150 },
    { id: 'apartment', name: 'Apartment', icon: '🏢', desc: 'Running water included.', cost: 50000, happy: 300 },
    { id: 'suburban', name: 'Suburban Home', icon: '🏡', desc: 'A white picket fence.', cost: 250000, happy: 500 },
    { id: 'mansion', name: 'Mansion', icon: '🏛️', desc: 'Includes a pool.', cost: 2500000, happy: 1000 },
    { id: 'island', name: 'Private Island', icon: '🏝️', desc: 'The ultimate flex.', cost: 50000000, happy: 5000 }
];

const CITY_NODES = [
    { id: 'bank', name: 'The Bank', icon: '🏦', desc: 'Secure your cash.', x: 50, y: 15 },
    { id: 'supermarket', name: 'Super Store', icon: '🛒', desc: 'Buy supplies.', x: 80, y: 30 },
    { id: 'realestate', name: 'Real Estate', icon: '🏗️', desc: 'Buy better housing.', x: 85, y: 70 },
    { id: 'church', name: 'The Church', icon: '⛪', desc: 'Donate for blessings.', x: 55, y: 55 },
    { id: 'pawn', name: 'Pawn Shop', icon: '⚖️', desc: 'Dump unwanted items.', x: 10, y: 80 }
];

const TRAVEL_LOCATIONS = [
    { id: 'mexico', name: 'Mexico', icon: '🇲🇽', cost: 500, time: 15 },
    { id: 'canada', name: 'Canada', icon: '🇨🇦', cost: 1000, time: 20 },
    { id: 'uk', name: 'United Kingdom', icon: '🇬🇧', cost: 3000, time: 40 },
    { id: 'sa', name: 'South Africa', icon: '🇿🇦', cost: 5000, time: 50 },
    { id: 'japan', name: 'Japan', icon: '🇯🇵', cost: 8000, time: 60 },
    { id: 'uae', name: 'UAE', icon: '🇦🇪', cost: 12000, time: 90 }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COURSES, ITEMS, CRIMES, PROPERTIES, CITY_NODES, TRAVEL_LOCATIONS };
}
