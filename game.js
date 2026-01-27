// 躺平发育 - 猛鬼宿舍风格
// ================================

// Canvas size (vertical mobile layout)
let CANVAS_WIDTH = 450;
let CANVAS_HEIGHT = 750;
const GRID_SIZE = 50;

// Colors matching the game screenshots
const COLORS = {
    floor: '#4a6fa5',
    floorLight: '#5d8ac7',
    corridor: '#1a2530',
    corridorFloor: '#2d4a5e',
    wall: '#0d1821',
    doorFrame: '#3d5c6e',
    roomBorder: '#1a2530'
};

// Game States
const GAME_STATES = {
    SELECTING: 'selecting',
    PLAYING: 'playing',
    GAMEOVER: 'gameover',
    VICTORY: 'victory'
};

// Item types that can be placed on grid
const ITEM_TYPES = {
    BED: { id: 'bed', name: '破旧小床', icon: '🛏️', goldPerSec: 2, cost: 0, upgradeCost: 50 },
    PLANT: { id: 'plant', name: '绿萝', icon: '🌱', goldPerSec: 1, cost: 20, upgradeCost: 30 },
    FRIDGE: { id: 'fridge', name: '小冰箱', icon: '🧊', goldPerSec: 0, cost: 30, special: true },
    TURRET: { id: 'turret', name: '弹弓', icon: '🔫', goldPerSec: 0, cost: 50, damage: 5 },
    CACTUS: { id: 'cactus', name: '仙人掌', icon: '🌵', goldPerSec: 2, cost: 40, upgradeCost: 60 }
};

// Game configuration
const CONFIG = {
    selectionTime: 25,
    ghostDelay: 30,
    survivalTime: 180,
    doorBaseHealth: 100,
    ghostDamage: 10,
    ghostAttackSpeed: 1.5
};

// Room layouts (matching screenshot style)
function createRoomLayouts() {
    return [
        // Top left room
        { id: 1, x: 10, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
        // Top right room
        { id: 2, x: 310, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
        // Middle left room
        { id: 3, x: 10, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'right' },
        // Middle right room
        { id: 4, x: 310, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'left' },
        // Bottom left room
        { id: 5, x: 10, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' },
        // Bottom right room
        { id: 6, x: 260, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' }
    ];
}

// Game state
let game = {
    state: GAME_STATES.SELECTING,
    rooms: [],
    players: [],
    ghosts: [],
    gold: 0,
    energy: 0,
    timer: CONFIG.selectionTime,
    survivalTime: 0,
    selectedRoom: null,
    playerRoom: null,
    floatingTexts: [],
    projectiles: [],
    ghostsActive: false,
    lastGoldTick: 0,
    shopItem: null
};

let canvas, ctx;
let lastTime = 0;

// Initialize rooms
function initRooms() {
    const layouts = createRoomLayouts();
    game.rooms = layouts.map(layout => {
        const room = {
            ...layout,
            owner: null,
            doorHealth: CONFIG.doorBaseHealth,
            doorMaxHealth: CONFIG.doorBaseHealth,
            doorLevel: 1,
            grid: [],
            items: [],
            isResting: false
        };

        // Create grid cells
        for (let row = 0; row < layout.gridRows; row++) {
            for (let col = 0; col < layout.gridCols; col++) {
                room.grid.push({
                    col, row,
                    x: layout.x + 15 + col * GRID_SIZE + GRID_SIZE/2,
                    y: layout.y + 15 + row * GRID_SIZE + GRID_SIZE/2,
                    item: null
                });
            }
        }

        // Calculate door position
        switch(layout.doorSide) {
            case 'bottom':
                room.doorX = layout.x + layout.width/2;
                room.doorY = layout.y + layout.height;
                break;
            case 'top':
                room.doorX = layout.x + layout.width/2;
                room.doorY = layout.y;
                break;
            case 'left':
                room.doorX = layout.x;
                room.doorY = layout.y + layout.height/2;
                break;
            case 'right':
                room.doorX = layout.x + layout.width;
                room.doorY = layout.y + layout.height/2;
                break;
        }

        return room;
    });
}

// Initialize players (AI players)
function initPlayers() {
    game.players = [
        { id: 0, name: '你', icon: '😊', room: null, alive: true, isPlayer: true },
        { id: 1, name: '躺平爸爸', icon: '👴', room: null, alive: true, gold: 0 },
        { id: 2, name: '躺平皇帝', icon: '👑', room: null, alive: true, gold: 0 },
        { id: 3, name: '躺平黄金', icon: '💰', room: null, alive: true, gold: 0 },
        { id: 4, name: '躺平王者', icon: '🎮', room: null, alive: true, gold: 0 }
    ];

    // Assign AI players to random rooms
    const availableRooms = [...game.rooms];
    for (let i = 1; i < game.players.length && availableRooms.length > 1; i++) {
        const idx = Math.floor(Math.random() * availableRooms.length);
        const room = availableRooms[idx];
        game.players[i].room = room;
        room.owner = game.players[i];
        availableRooms.splice(idx, 1);

        // Give AI initial bed
        const bedCell = room.grid[0];
        bedCell.item = { ...ITEM_TYPES.BED, level: 1, goldPerSec: 2 };
        room.items.push(bedCell.item);
    }

    updatePlayerIcons();
}

function updatePlayerIcons() {
    const container = document.getElementById('player-icons');
    container.innerHTML = '';

    game.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-icon' + (player.isPlayer ? ' active' : '') + (!player.alive ? ' dead' : '');
        div.textContent = player.icon;
        container.appendChild(div);
    });
}

// Initialize
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Resize canvas to fit container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', () => location.reload());
    document.getElementById('close-shop').addEventListener('click', closeShop);
    document.getElementById('shop-buy-btn').addEventListener('click', buyShopItem);

    // Quick action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => handleQuickAction(btn.dataset.action));
    });
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    CANVAS_WIDTH = rect.width;
    CANVAS_HEIGHT = rect.height - 60; // Subtract HUD height
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    game = {
        state: GAME_STATES.SELECTING,
        rooms: [],
        players: [],
        ghosts: [],
        gold: 0,
        energy: 0,
        timer: CONFIG.selectionTime,
        survivalTime: 0,
        selectedRoom: null,
        playerRoom: null,
        floatingTexts: [],
        projectiles: [],
        ghostsActive: false,
        lastGoldTick: 0,
        shopItem: null
    };

    initRooms();
    initPlayers();
    gameLoop();
}

function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    processClick(x, y);
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
    processClick(x, y);
}

function processClick(x, y) {
    if (game.state === GAME_STATES.SELECTING) {
        // Check if clicking on an available room
        for (const room of game.rooms) {
            if (!room.owner && isPointInRoom(x, y, room)) {
                selectRoom(room);
                return;
            }
        }
    } else if (game.state === GAME_STATES.PLAYING && game.playerRoom) {
        const room = game.playerRoom;

        // Check if clicking on grid cell in player's room
        if (isPointInRoom(x, y, room)) {
            for (const cell of room.grid) {
                const dx = x - cell.x;
                const dy = y - cell.y;
                if (Math.abs(dx) < GRID_SIZE/2 && Math.abs(dy) < GRID_SIZE/2) {
                    handleCellClick(cell, room);
                    return;
                }
            }
        }

        // Check if clicking on bed to start resting
        const bedCell = room.grid.find(c => c.item && c.item.id === 'bed');
        if (bedCell) {
            const dx = x - bedCell.x;
            const dy = y - bedCell.y;
            if (Math.abs(dx) < GRID_SIZE/2 && Math.abs(dy) < GRID_SIZE/2) {
                room.isResting = true;
            }
        }
    }
}

function selectRoom(room) {
    room.owner = game.players[0];
    game.players[0].room = room;
    game.playerRoom = room;
    game.selectedRoom = room;

    // Add initial bed
    const bedCell = room.grid[0];
    bedCell.item = { ...ITEM_TYPES.BED, level: 1, goldPerSec: 2 };
    room.items.push(bedCell.item);

    game.state = GAME_STATES.PLAYING;
    game.timer = CONFIG.survivalTime;
    game.gold = 10;

    addFloatingText(room.doorX, room.doorY - 30, '选择成功!', '#4CAF50');
}

function handleCellClick(cell, room) {
    if (cell.item) {
        // Show upgrade panel
        openShop(cell.item, cell, room);
    } else {
        // Show available items to place
        game.selectedCell = cell;
        // For now, just place a plant if we have enough gold
        if (game.gold >= ITEM_TYPES.PLANT.cost) {
            placePlant(cell, room);
        }
    }
}

function placePlant(cell, room) {
    game.gold -= ITEM_TYPES.PLANT.cost;
    cell.item = { ...ITEM_TYPES.PLANT, level: 1 };
    room.items.push(cell.item);
    addFloatingText(cell.x, cell.y - 20, '-' + ITEM_TYPES.PLANT.cost, '#ff6b6b');
}

function handleQuickAction(action) {
    if (!game.playerRoom) return;

    const room = game.playerRoom;

    switch(action) {
        case 'bed':
            const bedCell = room.grid.find(c => c.item && c.item.id === 'bed');
            if (bedCell) openShop(bedCell.item, bedCell, room);
            break;
        case 'door':
            openShop({ id: 'door', name: '升级门', level: room.doorLevel }, null, room);
            break;
        case 'plant':
            const emptyCell = room.grid.find(c => !c.item);
            if (emptyCell && game.gold >= ITEM_TYPES.PLANT.cost) {
                placePlant(emptyCell, room);
            }
            break;
        case 'turret':
            const emptyCell2 = room.grid.find(c => !c.item);
            if (emptyCell2 && game.gold >= ITEM_TYPES.TURRET.cost) {
                game.gold -= ITEM_TYPES.TURRET.cost;
                emptyCell2.item = { ...ITEM_TYPES.TURRET, level: 1 };
                room.items.push(emptyCell2.item);
            }
            break;
    }
}

function openShop(item, cell, room) {
    game.shopItem = { item, cell, room };

    const panel = document.getElementById('shop-panel');
    panel.classList.remove('hidden');

    document.getElementById('shop-title').textContent = '升级';
    document.getElementById('shop-item-name').textContent = item.name || '门';

    let cost, desc;
    if (item.id === 'door') {
        cost = 20 * room.doorLevel;
        desc = `当前等级: ${room.doorLevel} → ${room.doorLevel + 1}`;
    } else if (item.id === 'bed') {
        cost = item.upgradeCost || 50;
        const nextGold = (item.level + 1) * 2;
        desc = `生产: ${item.goldPerSec}金币/s → ${nextGold}金币/s`;
    } else {
        cost = item.upgradeCost || 30;
        desc = `等级: ${item.level}`;
    }

    document.getElementById('shop-item-desc').textContent = desc;
    document.getElementById('shop-cost').textContent = cost;

    const buyBtn = document.getElementById('shop-buy-btn');
    buyBtn.disabled = game.gold < cost;
}

function closeShop() {
    document.getElementById('shop-panel').classList.add('hidden');
    game.shopItem = null;
}

function buyShopItem() {
    if (!game.shopItem) return;

    const { item, cell, room } = game.shopItem;
    let cost;

    if (item.id === 'door') {
        cost = 20 * room.doorLevel;
        if (game.gold >= cost) {
            game.gold -= cost;
            room.doorLevel++;
            room.doorMaxHealth = CONFIG.doorBaseHealth * room.doorLevel;
            room.doorHealth = room.doorMaxHealth;
            addFloatingText(room.doorX, room.doorY, '门升级!', '#4CAF50');
        }
    } else if (item.id === 'bed') {
        cost = item.upgradeCost || 50;
        if (game.gold >= cost) {
            game.gold -= cost;
            item.level++;
            item.goldPerSec = item.level * 2;
            item.upgradeCost = Math.floor(cost * 1.5);
            addFloatingText(cell.x, cell.y - 20, '床升级!', '#4CAF50');
        }
    } else {
        cost = item.upgradeCost || 30;
        if (game.gold >= cost) {
            game.gold -= cost;
            item.level++;
            item.goldPerSec = (item.goldPerSec || 1) + 1;
            addFloatingText(cell.x, cell.y - 20, '升级!', '#4CAF50');
        }
    }

    closeShop();
}

function isPointInRoom(x, y, room) {
    return x >= room.x && x <= room.x + room.width &&
           y >= room.y && y <= room.y + room.height;
}

function addFloatingText(x, y, text, color = '#ffd700') {
    game.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -30 });
}

// Game loop
function gameLoop(currentTime = 0) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    update(dt);
    render();

    if (game.state !== GAME_STATES.GAMEOVER && game.state !== GAME_STATES.VICTORY) {
        requestAnimationFrame(gameLoop);
    }
}

function update(dt) {
    // Update floating texts
    game.floatingTexts = game.floatingTexts.filter(ft => {
        ft.y += ft.vy * dt;
        ft.life -= dt;
        return ft.life > 0;
    });

    if (game.state === GAME_STATES.SELECTING) {
        game.timer -= dt;
        if (game.timer <= 0) {
            // Auto-select random room
            const available = game.rooms.filter(r => !r.owner);
            if (available.length > 0) {
                selectRoom(available[Math.floor(Math.random() * available.length)]);
            }
        }
        return;
    }

    if (game.state !== GAME_STATES.PLAYING) return;

    game.survivalTime += dt;
    game.timer -= dt;

    // Victory check
    if (game.timer <= 0) {
        victory();
        return;
    }

    // Activate ghosts
    if (!game.ghostsActive && game.survivalTime >= CONFIG.ghostDelay) {
        game.ghostsActive = true;
        spawnGhost();
    }

    // Spawn more ghosts
    if (game.ghostsActive && game.ghosts.length < 3 && Math.random() < 0.005) {
        spawnGhost();
    }

    // Generate gold
    game.lastGoldTick += dt;
    if (game.lastGoldTick >= 1) {
        game.lastGoldTick = 0;
        generateGold();
    }

    // Update ghosts
    updateGhosts(dt);

    // Update AI players
    updateAI(dt);

    // Update projectiles
    updateProjectiles(dt);

    // Update HUD
    document.getElementById('gold-amount').textContent = Math.floor(game.gold);
    document.getElementById('energy-amount').textContent = Math.floor(game.energy);
}

function generateGold() {
    // Player gold generation
    if (game.playerRoom && game.playerRoom.isResting) {
        for (const item of game.playerRoom.items) {
            if (item.goldPerSec > 0) {
                game.gold += item.goldPerSec;
                // Find the cell with this item
                const cell = game.playerRoom.grid.find(c => c.item === item);
                if (cell) {
                    addFloatingText(cell.x + 15, cell.y - 15, '+' + item.goldPerSec, '#ffd700');
                }
            }
        }
    }

    // AI gold generation
    for (const player of game.players) {
        if (!player.isPlayer && player.alive && player.room) {
            for (const item of player.room.items) {
                if (item.goldPerSec > 0) {
                    player.gold = (player.gold || 0) + item.goldPerSec;
                }
            }
        }
    }
}

function spawnGhost() {
    const ghost = {
        x: CANVAS_WIDTH / 2,
        y: -50,
        targetRoom: null,
        speed: 50,
        attacking: false,
        attackTimer: 0
    };

    // Find a room to attack
    const occupiedRooms = game.rooms.filter(r => r.owner && r.owner.alive && r.doorHealth > 0);
    if (occupiedRooms.length > 0) {
        ghost.targetRoom = occupiedRooms[Math.floor(Math.random() * occupiedRooms.length)];
    }

    game.ghosts.push(ghost);
}

function updateGhosts(dt) {
    for (let i = game.ghosts.length - 1; i >= 0; i--) {
        const ghost = game.ghosts[i];

        if (!ghost.targetRoom || ghost.targetRoom.doorHealth <= 0) {
            // Find new target
            const occupiedRooms = game.rooms.filter(r => r.owner && r.owner.alive && r.doorHealth > 0);
            if (occupiedRooms.length > 0) {
                ghost.targetRoom = occupiedRooms[Math.floor(Math.random() * occupiedRooms.length)];
            } else {
                game.ghosts.splice(i, 1);
                continue;
            }
        }

        const room = ghost.targetRoom;
        const targetX = room.doorX;
        const targetY = room.doorY + (room.doorSide === 'top' ? -30 : room.doorSide === 'bottom' ? 30 : 0);

        const dx = targetX - ghost.x;
        const dy = targetY - ghost.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 40) {
            ghost.x += (dx / dist) * ghost.speed * dt;
            ghost.y += (dy / dist) * ghost.speed * dt;
            ghost.attacking = false;
        } else {
            ghost.attacking = true;
            ghost.attackTimer += dt;

            if (ghost.attackTimer >= CONFIG.ghostAttackSpeed) {
                ghost.attackTimer = 0;
                room.doorHealth -= CONFIG.ghostDamage;

                if (room.doorHealth <= 0) {
                    room.doorHealth = 0;
                    if (room.owner) {
                        room.owner.alive = false;
                        if (room.owner.isPlayer) {
                            gameOver();
                            return;
                        }
                        updatePlayerIcons();
                    }
                }
            }
        }
    }
}

function updateAI(dt) {
    for (const player of game.players) {
        if (player.isPlayer || !player.alive || !player.room) continue;

        // AI upgrades
        if (player.gold >= 50 && player.room.items.length < player.room.grid.length) {
            const emptyCell = player.room.grid.find(c => !c.item);
            if (emptyCell) {
                emptyCell.item = { ...ITEM_TYPES.PLANT, level: 1 };
                player.room.items.push(emptyCell.item);
                player.gold -= 20;
            }
        }

        if (player.gold >= 30 && player.room.doorHealth < player.room.doorMaxHealth * 0.5) {
            player.room.doorHealth = Math.min(player.room.doorMaxHealth, player.room.doorHealth + 20);
            player.gold -= 15;
        }
    }
}

function updateProjectiles(dt) {
    // Turret projectiles (simplified)
}

function gameOver() {
    game.state = GAME_STATES.GAMEOVER;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-title').textContent = '💀 游戏结束';
    document.getElementById('result-title').style.color = '#ff6b6b';
    document.getElementById('result-message').textContent = '你的门被鬼魂破坏了!';
    document.getElementById('final-coins').textContent = Math.floor(game.gold);
    document.getElementById('survival-time').textContent = Math.floor(game.survivalTime);
}

function victory() {
    game.state = GAME_STATES.VICTORY;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-title').textContent = '🎉 胜利!';
    document.getElementById('result-title').style.color = '#4CAF50';
    document.getElementById('result-message').textContent = '你成功存活到了最后!';
    document.getElementById('final-coins').textContent = Math.floor(game.gold);
    document.getElementById('survival-time').textContent = Math.floor(game.survivalTime);
}

// Rendering
function render() {
    ctx.fillStyle = COLORS.corridor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw corridor floor pattern
    drawCorridorPattern();

    // Draw rooms
    for (const room of game.rooms) {
        drawRoom(room);
    }

    // Draw ghosts
    for (const ghost of game.ghosts) {
        drawGhost(ghost);
    }

    // Draw timer
    drawTimer();

    // Draw floating texts
    drawFloatingTexts();

    // Draw player names in corridor (during selection)
    if (game.state === GAME_STATES.SELECTING) {
        drawSelectionHints();
    }
}

function drawCorridorPattern() {
    ctx.fillStyle = COLORS.corridorFloor;

    // Horizontal corridors
    ctx.fillRect(0, 230, CANVAS_WIDTH, 100);
    ctx.fillRect(0, 530, CANVAS_WIDTH, 30);

    // Vertical corridor
    ctx.fillRect(150, 60, 150, 650);

    // Grid pattern on corridors
    ctx.strokeStyle = '#3d5c6e22';
    ctx.lineWidth = 1;

    for (let x = 0; x < CANVAS_WIDTH; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < CANVAS_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawRoom(room) {
    // Room floor (blue tiles)
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(room.x, room.y, room.width, room.height);

    // Tile pattern
    ctx.fillStyle = COLORS.floorLight;
    for (let row = 0; row < Math.ceil(room.height / GRID_SIZE); row++) {
        for (let col = 0; col < Math.ceil(room.width / GRID_SIZE); col++) {
            if ((row + col) % 2 === 0) {
                ctx.fillRect(
                    room.x + col * GRID_SIZE,
                    room.y + row * GRID_SIZE,
                    GRID_SIZE,
                    GRID_SIZE
                );
            }
        }
    }

    // Grid cells with + marks
    ctx.strokeStyle = '#ffffff22';
    ctx.fillStyle = '#ffffff33';
    ctx.lineWidth = 1;

    for (const cell of room.grid) {
        // Cell border
        ctx.strokeRect(cell.x - GRID_SIZE/2 + 5, cell.y - GRID_SIZE/2 + 5, GRID_SIZE - 10, GRID_SIZE - 10);

        // + mark if empty
        if (!cell.item) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('+', cell.x, cell.y + 5);
        }
    }

    // Room border
    ctx.strokeStyle = COLORS.roomBorder;
    ctx.lineWidth = 4;
    ctx.strokeRect(room.x, room.y, room.width, room.height);

    // Draw items
    for (const cell of room.grid) {
        if (cell.item) {
            drawItem(cell, room);
        }
    }

    // Draw door
    drawDoor(room);

    // Room label
    if (room.owner) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(room.owner.name, room.x + room.width/2, room.y + room.height - 8);
    }

    // Selection highlight
    if (game.state === GAME_STATES.SELECTING && !room.owner) {
        ctx.fillStyle = '#4CAF5033';
        ctx.fillRect(room.x, room.y, room.width, room.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('点击选择', room.x + room.width/2, room.y + room.height/2);
    }
}

function drawItem(cell, room) {
    const item = cell.item;

    // Item background
    ctx.fillStyle = '#2d4a5e88';
    ctx.fillRect(cell.x - 20, cell.y - 20, 40, 40);

    // Item icon
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';

    if (item.id === 'bed') {
        // Draw bed sprite
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(cell.x - 18, cell.y - 12, 36, 24);
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(cell.x - 16, cell.y - 10, 32, 18);
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(cell.x - 14, cell.y - 8, 14, 14);

        // Person sleeping if resting
        if (room.isResting && room.owner && room.owner.isPlayer) {
            ctx.fillStyle = '#ffdbac';
            ctx.beginPath();
            ctx.arc(cell.x - 7, cell.y - 1, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        ctx.fillText(item.icon, cell.x, cell.y + 8);
    }

    // Upgrade arrow
    if (item.level > 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = '12px Arial';
        ctx.fillText('⬆', cell.x + 15, cell.y - 15);
    }
}

function drawDoor(room) {
    const doorWidth = room.doorSide === 'left' || room.doorSide === 'right' ? 15 : 50;
    const doorHeight = room.doorSide === 'left' || room.doorSide === 'right' ? 50 : 15;

    let doorX = room.doorX - doorWidth/2;
    let doorY = room.doorY - doorHeight/2;

    if (room.doorSide === 'bottom') doorY = room.doorY - doorHeight;
    if (room.doorSide === 'top') doorY = room.doorY;
    if (room.doorSide === 'left') doorX = room.doorX - doorWidth;
    if (room.doorSide === 'right') doorX = room.doorX;

    // Door frame
    ctx.fillStyle = COLORS.doorFrame;
    ctx.fillRect(doorX - 3, doorY - 3, doorWidth + 6, doorHeight + 6);

    // Door with health color
    const healthPercent = room.doorHealth / room.doorMaxHealth;
    ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(doorX, doorY, doorWidth * healthPercent, doorHeight);

    // Door background
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(doorX + doorWidth * healthPercent, doorY, doorWidth * (1 - healthPercent), doorHeight);

    // Door level
    if (room.doorLevel > 1) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lv' + room.doorLevel, room.doorX, room.doorY + (room.doorSide === 'bottom' ? 20 : -8));
    }
}

function drawGhost(ghost) {
    ctx.save();
    ctx.translate(ghost.x, ghost.y);

    // Ghost body (green blob style from screenshot)
    ctx.fillStyle = '#7cb342';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -3, 5, 0, Math.PI * 2);
    ctx.arc(6, -3, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -3, 2, 0, Math.PI * 2);
    ctx.arc(6, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Attacking indicator
    if (ghost.attacking) {
        ctx.fillStyle = '#f44336';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💢', 0, -30);
    }

    ctx.restore();
}

function drawTimer() {
    const time = game.state === GAME_STATES.SELECTING ? game.timer : game.survivalTime;
    const displayTime = game.state === GAME_STATES.SELECTING ? Math.ceil(time) : Math.ceil(CONFIG.survivalTime - game.survivalTime);

    // Large red timer
    ctx.fillStyle = '#ff000088';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, 300, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(displayTime > 0 ? displayTime : 0, CANVAS_WIDTH/2, 312);

    // Ghost countdown
    if (game.state === GAME_STATES.PLAYING && !game.ghostsActive) {
        const ghostTime = Math.ceil(CONFIG.ghostDelay - game.survivalTime);
        ctx.fillStyle = '#9b59b6';
        ctx.font = '14px Arial';
        ctx.fillText('👻 ' + ghostTime + '秒后出现', CANVAS_WIDTH/2, 360);
    }
}

function drawFloatingTexts() {
    for (const ft of game.floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.globalAlpha = ft.life;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
}

function drawSelectionHints() {
    // Draw player avatars walking in corridor
    const time = Date.now() / 1000;

    for (let i = 1; i < game.players.length; i++) {
        const player = game.players[i];
        if (player.room) continue;

        const x = 100 + Math.sin(time + i) * 50;
        const y = 280 + i * 30;

        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.icon, x, y);

        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText(player.name, x, y + 15);
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', init);
