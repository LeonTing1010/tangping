// 躺平休息 - Hunter Rest Game (猛鬼宿舍风格)
// ============================================

// Game Constants
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 40; // 格子大小

// Game States
const GAME_STATES = {
    MENU: 'menu',
    SELECTING_ROOM: 'selecting_room',
    PLAYING: 'playing',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
};

// Game Configuration
const CONFIG = {
    roomSelectionTime: 20,        // 选房时间
    ghostSpawnDelay: 30,          // 鬼出现延迟 (30秒)
    ghostAttackInterval: 1.5,     // 鬼攻击间隔(秒)
    baseGoldPerSecond: 2,         // 基础每秒金币
    ghostBaseHealth: 15,          // 鬼基础血量
    ghostBaseDamage: 8,           // 鬼基础伤害
    doorBaseHealth: 100,          // 门基础血量
    turretBaseDamage: 5,          // 炮台基础伤害
    turretRange: 180,             // 炮台射程
    turretFireRate: 1.2,          // 炮台射速(次/秒)
    survivalTime: 180,            // 存活目标时间(秒)
    ghostLevelUpInterval: 40,     // 鬼升级间隔(秒)
    playerSpeed: 5,               // 玩家速度
    ghostSpeed: 1.8,              // 鬼移动速度
};

// 走廊区域定义
const CORRIDOR = {
    y: 250,
    height: 100
};

// 房间布局 - 宿舍楼风格 (上下两排)
const ROOMS_CONFIG = [
    // 上排房间 (门朝下)
    { id: 1, x: 50, y: 50, width: 200, height: 180, doorSide: 'bottom' },
    { id: 2, x: 270, y: 50, width: 200, height: 180, doorSide: 'bottom' },
    { id: 3, x: 490, y: 50, width: 200, height: 180, doorSide: 'bottom' },
    { id: 4, x: 710, y: 50, width: 200, height: 180, doorSide: 'bottom' },
    // 下排房间 (门朝上)
    { id: 5, x: 50, y: 370, width: 200, height: 180, doorSide: 'top' },
    { id: 6, x: 270, y: 370, width: 200, height: 180, doorSide: 'top' },
    { id: 7, x: 490, y: 370, width: 200, height: 180, doorSide: 'top' },
    { id: 8, x: 710, y: 370, width: 200, height: 180, doorSide: 'top' },
];

// Generate rooms with grid
function generateRooms() {
    return ROOMS_CONFIG.map(config => {
        const doorY = config.doorSide === 'bottom' ? config.y + config.height : config.y;
        const doorX = config.x + config.width / 2;

        // Generate grid cells for the room
        const gridCols = Math.floor(config.width / GRID_SIZE);
        const gridRows = Math.floor(config.height / GRID_SIZE);
        const grid = [];

        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const cellX = config.x + col * GRID_SIZE + GRID_SIZE / 2;
                const cellY = config.y + row * GRID_SIZE + GRID_SIZE / 2;
                grid.push({
                    col, row,
                    x: cellX,
                    y: cellY,
                    occupied: false,
                    item: null
                });
            }
        }

        // Mark bed position as occupied (bottom-left area)
        const bedCol = 0;
        const bedRow = Math.floor(gridRows / 2);
        const bedCell = grid.find(c => c.col === bedCol && c.row === bedRow);
        if (bedCell) {
            bedCell.occupied = true;
            bedCell.item = 'bed';
        }

        return {
            ...config,
            doorX,
            doorY,
            bedX: config.x + 50,
            bedY: config.y + config.height / 2,
            owner: null,
            doorHealth: CONFIG.doorBaseHealth,
            doorMaxHealth: CONFIG.doorBaseHealth,
            doorLevel: 1,
            bedLevel: 1,
            turrets: [],
            items: [],
            goldPerSecond: CONFIG.baseGoldPerSecond,
            isOccupied: false,
            doorClosed: false,
            grid,
            gridCols,
            gridRows
        };
    });
}

// Items and Upgrades
const ITEMS = {
    DOOR_UPGRADE: { id: 'door', name: '升级门', icon: '🚪', baseCost: 20 },
    BED_UPGRADE: { id: 'bed', name: '升级床', icon: '🛏️', baseCost: 30 },
    TURRET: { id: 'turret', name: '炮台', icon: '🔫', baseCost: 50 },
    REPAIR: { id: 'repair', name: '修门', icon: '🔧', baseCost: 15 },
    TRAP: { id: 'trap', name: '陷阱', icon: '🪤', baseCost: 40 },
    BLIND_BOX: { id: 'blindbox', name: '盲盒', icon: '🎁', baseCost: 25 }
};

// Game State
let game = {
    state: GAME_STATES.MENU,
    rooms: [],
    player: null,
    ghosts: [],
    projectiles: [],
    effects: [],
    gold: 0,
    totalGold: 0,
    timer: 0,
    survivalTime: 0,
    ghostLevel: 1,
    mouseX: 0,
    mouseY: 0,
    selectedRoom: null,
    messages: [],
    lastGoldTime: 0,
    lastGhostSpawn: 0,
    aiPlayers: [],
    selectedGridCell: null,
    ghostsActive: false
};

// Player object
function createPlayer() {
    return {
        x: CANVAS_WIDTH / 2,
        y: CORRIDOR.y + CORRIDOR.height / 2,
        targetX: null,
        targetY: null,
        speed: CONFIG.playerSpeed,
        size: 20,
        inRoom: null,
        isResting: false,
        health: 3,
        maxHealth: 3
    };
}

// Ghost object with pathfinding
function createGhost(level = 1) {
    // Spawn in corridor
    const spawnX = Math.random() < 0.5 ? -50 : CANVAS_WIDTH + 50;
    const spawnY = CORRIDOR.y + CORRIDOR.height / 2;

    return {
        x: spawnX,
        y: spawnY,
        speed: CONFIG.ghostSpeed + level * 0.15,
        size: 30 + level * 2,
        health: CONFIG.ghostBaseHealth + level * 8,
        maxHealth: CONFIG.ghostBaseHealth + level * 8,
        damage: CONFIG.ghostBaseDamage + level * 3,
        level: level,
        targetRoom: null,
        currentPath: [],
        pathIndex: 0,
        isAttacking: false,
        attackTimer: 0,
        stunned: false,
        stunTimer: 0,
        slowedTimer: 0,
        inCorridor: true
    };
}

// Turret object
function createTurret(x, y, roomId) {
    return {
        x, y, roomId,
        level: 1,
        damage: CONFIG.turretBaseDamage,
        range: CONFIG.turretRange,
        fireRate: CONFIG.turretFireRate,
        lastFire: 0,
        angle: 0,
        target: null
    };
}

// DOM Elements
let canvas, ctx;

// Initialize
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);

    renderMenu();
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('result-screen').classList.add('hidden');

    resetGame();
    game.state = GAME_STATES.SELECTING_ROOM;
    game.timer = CONFIG.roomSelectionTime;

    addMessage('🏃 快选择一个房间! 还有 ' + CONFIG.roomSelectionTime + ' 秒');
    spawnAIPlayers();
    gameLoop();
}

function restartGame() {
    startGame();
}

function resetGame() {
    game = {
        state: GAME_STATES.MENU,
        rooms: generateRooms(),
        player: createPlayer(),
        ghosts: [],
        projectiles: [],
        effects: [],
        gold: 0,
        totalGold: 0,
        timer: 0,
        survivalTime: 0,
        ghostLevel: 1,
        mouseX: 0,
        mouseY: 0,
        selectedRoom: null,
        messages: [],
        lastGoldTime: 0,
        lastGhostSpawn: 0,
        aiPlayers: [],
        selectedGridCell: null,
        ghostsActive: false
    };
}

function spawnAIPlayers() {
    const aiNames = ['小明', '小红', '小华', '小李', '小王'];
    const availableRooms = game.rooms.filter(r => !r.owner);
    const numAI = Math.min(4, availableRooms.length - 1);

    for (let i = 0; i < numAI; i++) {
        const roomIndex = Math.floor(Math.random() * availableRooms.length);
        const room = availableRooms[roomIndex];
        room.owner = aiNames[i];
        room.isOccupied = true;
        room.doorClosed = true;
        availableRooms.splice(roomIndex, 1);

        game.aiPlayers.push({
            name: aiNames[i],
            room: room,
            gold: 0,
            alive: true
        });
    }
}

function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

    if (game.state === GAME_STATES.SELECTING_ROOM) {
        for (const room of game.rooms) {
            if (isPointInRoom(x, y, room) && !room.owner) {
                selectRoom(room);
                return;
            }
        }
        // Click to move in corridor during selection
        if (isInCorridor(y)) {
            game.player.targetX = x;
            game.player.targetY = Math.max(CORRIDOR.y + 20, Math.min(CORRIDOR.y + CORRIDOR.height - 20, y));
        }
    } else if (game.state === GAME_STATES.PLAYING) {
        handlePlayingClick(x, y);
    }
}

function handlePlayingClick(x, y) {
    const player = game.player;

    if (player.isResting) {
        // Can't move while resting, but can click grid to place items
        if (player.inRoom) {
            const cell = getGridCellAt(player.inRoom, x, y);
            if (cell && !cell.occupied) {
                game.selectedGridCell = cell;
                addMessage('选中格子 [' + cell.col + ',' + cell.row + '] - 按3放置炮台');
            }
        }
        return;
    }

    if (player.inRoom) {
        const room = player.inRoom;

        // Check if clicking on bed
        const bedDist = Math.hypot(x - room.bedX, y - room.bedY);
        if (bedDist < 40) {
            player.targetX = room.bedX;
            player.targetY = room.bedY;
            return;
        }

        // Check if clicking on grid cell for item placement
        const cell = getGridCellAt(room, x, y);
        if (cell && !cell.occupied) {
            game.selectedGridCell = cell;
            addMessage('选中格子 - 按数字键放置道具');
        }

        // Check if clicking near door to exit
        const doorDist = Math.hypot(x - room.doorX, y - room.doorY);
        if (doorDist < 50) {
            exitRoom();
            return;
        }

        // Move within room
        player.targetX = Math.max(room.x + player.size, Math.min(room.x + room.width - player.size, x));
        player.targetY = Math.max(room.y + player.size, Math.min(room.y + room.height - player.size, y));
    } else {
        // In corridor
        if (isInCorridor(y)) {
            player.targetX = x;
            player.targetY = Math.max(CORRIDOR.y + 20, Math.min(CORRIDOR.y + CORRIDOR.height - 20, y));
        }

        // Check if clicking on owned room door to enter
        for (const room of game.rooms) {
            if (room.owner === 'player') {
                const doorDist = Math.hypot(x - room.doorX, y - room.doorY);
                if (doorDist < 50) {
                    enterRoom(room);
                    return;
                }
            }
        }
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    game.mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    game.mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
}

function handleKeyDown(e) {
    const key = e.key;

    if (game.state === GAME_STATES.SELECTING_ROOM) {
        return;
    }

    if (game.state !== GAME_STATES.PLAYING) return;

    // Number keys for shop
    if (key >= '1' && key <= '6') {
        const items = Object.values(ITEMS);
        const index = parseInt(key) - 1;
        if (index < items.length) {
            buyItem(items[index]);
        }
    }

    if (key.toLowerCase() === 'e') handleInteraction();
    if (key.toLowerCase() === 'q') handleExit();
    if (key === ' ') {
        e.preventDefault();
        if (game.player.inRoom) buyItem(ITEMS.REPAIR);
    }
}

function selectRoom(room) {
    room.owner = 'player';
    room.isOccupied = true;
    room.doorClosed = true;
    game.selectedRoom = room;
    game.player.inRoom = room;
    game.player.x = room.x + room.width / 2;
    game.player.y = room.y + room.height / 2;

    game.state = GAME_STATES.PLAYING;
    game.timer = CONFIG.survivalTime;
    game.gold = 15;

    addMessage('✅ 你选择了房间 ' + room.id + '! 点击床躺下休息!');
    addMessage('⏰ ' + CONFIG.ghostSpawnDelay + '秒后鬼魂将出现...');
}

function handleInteraction() {
    const player = game.player;

    if (!player.inRoom) {
        for (const room of game.rooms) {
            if (room.owner === 'player') {
                const doorDist = Math.hypot(player.x - room.doorX, player.y - room.doorY);
                if (doorDist < 60) {
                    enterRoom(room);
                    return;
                }
            }
        }
    } else if (!player.isResting) {
        const room = player.inRoom;
        const bedDist = Math.hypot(player.x - room.bedX, player.y - room.bedY);
        if (bedDist < 50) {
            player.isResting = true;
            player.x = room.bedX;
            player.y = room.bedY;
            room.doorClosed = true;
            addMessage('💤 开始躺平休息，金币持续增加中...');
        }
    }
}

function handleExit() {
    const player = game.player;

    if (player.isResting) {
        player.isResting = false;
        addMessage('🏃 起床了!');
    } else if (player.inRoom) {
        exitRoom();
    }
}

function enterRoom(room) {
    game.player.inRoom = room;
    game.player.x = room.x + room.width / 2;
    game.player.y = room.y + room.height / 2;
    game.player.targetX = null;
    game.player.targetY = null;
    room.doorClosed = true;
    addMessage('🚪 进入房间，门已关闭');
}

function exitRoom() {
    const room = game.player.inRoom;
    const exitY = room.doorSide === 'bottom' ? room.doorY + 30 : room.doorY - 30;
    game.player.x = room.doorX;
    game.player.y = exitY;
    game.player.inRoom = null;
    game.player.targetX = null;
    game.player.targetY = null;
    room.doorClosed = false;
    addMessage('🚪 离开房间');
}

function getGridCellAt(room, x, y) {
    if (!room || !room.grid) return null;

    for (const cell of room.grid) {
        const cellLeft = room.x + cell.col * GRID_SIZE;
        const cellTop = room.y + cell.row * GRID_SIZE;
        if (x >= cellLeft && x < cellLeft + GRID_SIZE &&
            y >= cellTop && y < cellTop + GRID_SIZE) {
            return cell;
        }
    }
    return null;
}

function buyItem(item) {
    if (!game.player.inRoom) {
        addMessage('❌ 必须在房间内才能购买!');
        return;
    }

    const room = game.player.inRoom;
    let cost = item.baseCost;

    if (item.id === 'door') cost = item.baseCost * room.doorLevel;
    else if (item.id === 'bed') cost = item.baseCost * room.bedLevel;
    else if (item.id === 'turret') cost = item.baseCost + room.turrets.length * 25;

    if (game.gold < cost) {
        addMessage('❌ 金币不足! 需要 ' + cost + ' 金币');
        return;
    }

    switch(item.id) {
        case 'door':
            game.gold -= cost;
            room.doorLevel++;
            room.doorMaxHealth = CONFIG.doorBaseHealth * room.doorLevel;
            room.doorHealth = room.doorMaxHealth;
            addMessage('🚪 门升级到 Lv.' + room.doorLevel + '!');
            break;

        case 'bed':
            game.gold -= cost;
            room.bedLevel++;
            room.goldPerSecond = CONFIG.baseGoldPerSecond * room.bedLevel;
            addMessage('🛏️ 床升级到 Lv.' + room.bedLevel + '! 每秒 +' + room.goldPerSecond + ' 金币');
            break;

        case 'turret':
            if (room.turrets.length >= 4) {
                addMessage('❌ 房间内炮台已满!');
                return;
            }

            // Place turret on selected grid cell or find empty cell near door
            let turretCell = game.selectedGridCell;
            if (!turretCell || turretCell.occupied) {
                // Find empty cell near door
                const doorRow = room.doorSide === 'bottom' ? room.gridRows - 1 : 0;
                turretCell = room.grid.find(c => c.row === doorRow && !c.occupied);
            }

            if (turretCell) {
                game.gold -= cost;
                turretCell.occupied = true;
                turretCell.item = 'turret';
                const turret = createTurret(turretCell.x, turretCell.y, room.id);
                room.turrets.push(turret);
                game.selectedGridCell = null;
                addMessage('🔫 炮台已放置!');
            } else {
                addMessage('❌ 没有空余格子放置炮台!');
            }
            break;

        case 'repair':
            if (room.doorHealth < room.doorMaxHealth) {
                game.gold -= cost;
                room.doorHealth = Math.min(room.doorMaxHealth, room.doorHealth + 30);
                addMessage('🔧 门已修复! ' + Math.ceil(room.doorHealth) + '/' + room.doorMaxHealth);
            } else {
                addMessage('门不需要修复');
            }
            break;

        case 'trap':
            game.gold -= cost;
            game.effects.push({
                type: 'trap',
                x: room.doorX,
                y: room.doorSide === 'bottom' ? room.doorY + 30 : room.doorY - 30,
                roomId: room.id,
                active: true
            });
            addMessage('🪤 陷阱已放置在门口!');
            break;

        case 'blindbox':
            game.gold -= cost;
            openBlindBox();
            break;
    }

    updateShopUI();
}

function openBlindBox() {
    const rewards = [
        { type: 'gold', amount: 50, message: '💰 获得 50 金币!' },
        { type: 'gold', amount: 100, message: '💰💰 获得 100 金币!' },
        { type: 'repair', message: '🔧 门完全修复!' },
        { type: 'turret_damage', message: '⚡ 炮台伤害 +50%!' },
        { type: 'slow_ghost', message: '🐌 所有鬼减速 5 秒!' },
        { type: 'nothing', message: '📦 空盒子...' }
    ];

    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    switch(reward.type) {
        case 'gold': game.gold += reward.amount; break;
        case 'repair':
            if (game.player.inRoom) {
                game.player.inRoom.doorHealth = game.player.inRoom.doorMaxHealth;
            }
            break;
        case 'turret_damage':
            if (game.player.inRoom) {
                game.player.inRoom.turrets.forEach(t => t.damage *= 1.5);
            }
            break;
        case 'slow_ghost':
            game.ghosts.forEach(g => g.slowedTimer = 5);
            break;
    }

    addMessage(reward.message);
}

function isPointInRoom(x, y, room) {
    return x >= room.x && x <= room.x + room.width &&
           y >= room.y && y <= room.y + room.height;
}

function isInCorridor(y) {
    return y >= CORRIDOR.y && y <= CORRIDOR.y + CORRIDOR.height;
}

function addMessage(text) {
    game.messages.unshift({ text, time: 4 });
    if (game.messages.length > 6) game.messages.pop();
}

// Game Loop
let lastTime = 0;
function gameLoop(currentTime = 0) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (game.state === GAME_STATES.PLAYING || game.state === GAME_STATES.SELECTING_ROOM) {
        update(deltaTime);
        render();
        requestAnimationFrame(gameLoop);
    }
}

function update(dt) {
    // Update messages
    game.messages = game.messages.filter(m => {
        m.time -= dt;
        return m.time > 0;
    });

    if (game.state === GAME_STATES.SELECTING_ROOM) {
        game.timer -= dt;
        if (game.timer <= 0) {
            const emptyRooms = game.rooms.filter(r => !r.owner);
            if (emptyRooms.length > 0) {
                selectRoom(emptyRooms[Math.floor(Math.random() * emptyRooms.length)]);
            }
        }
        updatePlayer(dt);
        return;
    }

    // Playing state
    game.survivalTime += dt;
    game.timer -= dt;

    if (game.timer <= 0) {
        victory();
        return;
    }

    // Activate ghosts after delay
    if (!game.ghostsActive && game.survivalTime >= CONFIG.ghostSpawnDelay) {
        game.ghostsActive = true;
        addMessage('👻 鬼魂开始行动了!');
    }

    // Ghost level up
    const newLevel = Math.floor(game.survivalTime / CONFIG.ghostLevelUpInterval) + 1;
    if (newLevel > game.ghostLevel) {
        game.ghostLevel = newLevel;
        addMessage('⚠️ 鬼魂升级到 Lv.' + game.ghostLevel + '!');
    }

    // Spawn ghosts
    if (game.ghostsActive) {
        const spawnInterval = Math.max(8, 20 - game.ghostLevel * 2);
        if (game.survivalTime - game.lastGhostSpawn >= spawnInterval) {
            game.ghosts.push(createGhost(game.ghostLevel));
            game.lastGhostSpawn = game.survivalTime;
            addMessage('👻 新的鬼魂出现了!');
        }
    }

    // Generate gold
    if (game.player.isResting && game.player.inRoom) {
        game.lastGoldTime += dt;
        if (game.lastGoldTime >= 1) {
            game.lastGoldTime = 0;
            game.gold += game.player.inRoom.goldPerSecond;
            game.totalGold += game.player.inRoom.goldPerSecond;
        }
    }

    updateAIPlayers(dt);
    updatePlayer(dt);
    updateGhosts(dt);
    updateTurrets(dt);
    updateProjectiles(dt);
    updateHUD();
}

function updatePlayer(dt) {
    const player = game.player;
    if (player.isResting) return;

    if (player.targetX !== null && player.targetY !== null) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
            player.x += (dx / dist) * player.speed;
            player.y += (dy / dist) * player.speed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;
            player.targetX = null;
            player.targetY = null;

            // Check if reached bed
            if (player.inRoom) {
                const room = player.inRoom;
                const bedDist = Math.hypot(player.x - room.bedX, player.y - room.bedY);
                if (bedDist < 30) {
                    player.isResting = true;
                    room.doorClosed = true;
                    addMessage('💤 开始躺平休息...');
                }
            }
        }
    }
}

function updateGhosts(dt) {
    if (!game.ghostsActive) return;

    for (let i = game.ghosts.length - 1; i >= 0; i--) {
        const ghost = game.ghosts[i];

        if (ghost.stunned) {
            ghost.stunTimer -= dt;
            if (ghost.stunTimer <= 0) ghost.stunned = false;
            continue;
        }

        let speedMod = ghost.slowedTimer > 0 ? 0.4 : 1;
        if (ghost.slowedTimer > 0) ghost.slowedTimer -= dt;

        // Find target room
        if (!ghost.targetRoom || !ghost.targetRoom.isOccupied || ghost.targetRoom.doorHealth <= 0) {
            const occupiedRooms = game.rooms.filter(r => r.isOccupied && r.doorHealth > 0);
            if (occupiedRooms.length > 0) {
                ghost.targetRoom = occupiedRooms[Math.floor(Math.random() * occupiedRooms.length)];
            }
        }

        if (ghost.targetRoom) {
            const room = ghost.targetRoom;
            const doorTargetY = room.doorSide === 'bottom' ? room.doorY + 25 : room.doorY - 25;

            // Ghost movement - stay in corridor, move to door
            const dx = room.doorX - ghost.x;
            const dy = doorTargetY - ghost.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 35) {
                // Move towards door through corridor
                ghost.x += (dx / dist) * ghost.speed * speedMod;

                // Keep ghost in corridor Y range until near door
                if (Math.abs(dx) > 50) {
                    const corridorCenterY = CORRIDOR.y + CORRIDOR.height / 2;
                    const yDiff = corridorCenterY - ghost.y;
                    ghost.y += Math.sign(yDiff) * Math.min(Math.abs(yDiff), ghost.speed * speedMod * 0.5);
                } else {
                    ghost.y += (dy / dist) * ghost.speed * speedMod;
                }

                ghost.isAttacking = false;
            } else {
                // At door - attack
                ghost.isAttacking = true;
                ghost.attackTimer += dt;

                if (ghost.attackTimer >= CONFIG.ghostAttackInterval) {
                    ghost.attackTimer = 0;
                    room.doorHealth -= ghost.damage;

                    // Check trap
                    const trap = game.effects.find(e =>
                        e.type === 'trap' && e.roomId === room.id && e.active
                    );
                    if (trap) {
                        trap.active = false;
                        ghost.stunned = true;
                        ghost.stunTimer = 3;
                        ghost.health -= 15;
                        addMessage('🪤 鬼魂触发了陷阱!');
                    }

                    if (room.doorHealth <= 0) {
                        room.doorHealth = 0;
                        if (room.owner === 'player') {
                            gameOver('门被鬼魂破坏了!');
                            return;
                        } else {
                            const ai = game.aiPlayers.find(a => a.room === room);
                            if (ai) {
                                ai.alive = false;
                                room.isOccupied = false;
                                addMessage('💀 ' + ai.name + ' 被淘汰了!');
                            }
                            ghost.targetRoom = null;
                        }
                    }
                }
            }
        }

        // Check death
        if (ghost.health <= 0) {
            game.ghosts.splice(i, 1);
            game.gold += 15 * ghost.level;
            addMessage('💀 消灭鬼魂! +' + (15 * ghost.level) + ' 金币');
        }
    }
}

function updateTurrets(dt) {
    const currentTime = game.survivalTime;

    for (const room of game.rooms) {
        for (const turret of room.turrets) {
            let closestGhost = null;
            let closestDist = turret.range;

            for (const ghost of game.ghosts) {
                const dist = Math.hypot(ghost.x - turret.x, ghost.y - turret.y);
                if (dist < closestDist && !ghost.stunned) {
                    closestDist = dist;
                    closestGhost = ghost;
                }
            }

            if (closestGhost) {
                turret.target = closestGhost;
                turret.angle = Math.atan2(closestGhost.y - turret.y, closestGhost.x - turret.x);

                if (currentTime - turret.lastFire >= 1 / turret.fireRate) {
                    turret.lastFire = currentTime;
                    game.projectiles.push({
                        x: turret.x,
                        y: turret.y,
                        targetX: closestGhost.x,
                        targetY: closestGhost.y,
                        speed: 10,
                        damage: turret.damage,
                        target: closestGhost
                    });
                }
            } else {
                turret.target = null;
            }
        }
    }
}

function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const proj = game.projectiles[i];
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 15) {
            if (proj.target && game.ghosts.includes(proj.target)) {
                proj.target.health -= proj.damage;
            }
            game.projectiles.splice(i, 1);
        } else {
            proj.x += (dx / dist) * proj.speed;
            proj.y += (dy / dist) * proj.speed;

            if (proj.x < -50 || proj.x > CANVAS_WIDTH + 50 ||
                proj.y < -50 || proj.y > CANVAS_HEIGHT + 50) {
                game.projectiles.splice(i, 1);
            }
        }
    }
}

function updateAIPlayers(dt) {
    for (const ai of game.aiPlayers) {
        if (!ai.alive) continue;

        const room = ai.room;
        ai.gold += room.goldPerSecond * dt;

        // AI upgrades
        if (ai.gold >= 50 && room.turrets.length < 3) {
            const doorRow = room.doorSide === 'bottom' ? room.gridRows - 1 : 0;
            const cell = room.grid.find(c => c.row === doorRow && !c.occupied);
            if (cell) {
                cell.occupied = true;
                cell.item = 'turret';
                room.turrets.push(createTurret(cell.x, cell.y, room.id));
                ai.gold -= 50;
            }
        } else if (ai.gold >= 20 && room.doorHealth < room.doorMaxHealth * 0.4) {
            room.doorHealth = Math.min(room.doorMaxHealth, room.doorHealth + 30);
            ai.gold -= 15;
        } else if (ai.gold >= 35 && room.bedLevel < 4) {
            room.bedLevel++;
            room.goldPerSecond = CONFIG.baseGoldPerSecond * room.bedLevel;
            ai.gold -= 30;
        } else if (ai.gold >= 50 && room.doorLevel < 3) {
            room.doorLevel++;
            room.doorMaxHealth = CONFIG.doorBaseHealth * room.doorLevel;
            room.doorHealth = room.doorMaxHealth;
            ai.gold -= 20 * room.doorLevel;
        }
    }
}

function updateHUD() {
    document.getElementById('timer').textContent = Math.ceil(game.timer);
    document.getElementById('coins').textContent = Math.floor(game.gold);
    document.getElementById('health').textContent = game.player.health;

    const room = game.player.inRoom;
    if (room) {
        document.getElementById('door-level').textContent = room.doorLevel;
        document.getElementById('bed-level').textContent = room.bedLevel;
        document.getElementById('door-cost').textContent = ITEMS.DOOR_UPGRADE.baseCost * room.doorLevel;
        document.getElementById('bed-cost').textContent = ITEMS.BED_UPGRADE.baseCost * room.bedLevel;
        document.getElementById('turret-cost').textContent = ITEMS.TURRET.baseCost + room.turrets.length * 25;
    }

    document.getElementById('ghost-level').textContent = game.ghostLevel;
    document.getElementById('ghost-count').textContent = game.ghosts.length;

    let status = '在走廊';
    if (game.state === GAME_STATES.SELECTING_ROOM) {
        status = '选择房间...';
    } else if (game.player.isResting) {
        status = '💤 躺平中 +' + (room ? room.goldPerSecond : 0) + '/秒';
    } else if (game.player.inRoom) {
        status = '在房间内';
    }

    if (!game.ghostsActive && game.state === GAME_STATES.PLAYING) {
        const timeToGhost = Math.ceil(CONFIG.ghostSpawnDelay - game.survivalTime);
        status += ' | 鬼魂 ' + timeToGhost + '秒后出现';
    }

    document.getElementById('status').textContent = status;
}

function updateShopUI() {}

function gameOver(reason) {
    game.state = GAME_STATES.GAME_OVER;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-title').textContent = '💀 游戏结束';
    document.getElementById('result-title').style.color = '#f44336';
    document.getElementById('result-message').textContent = reason;
    document.getElementById('final-coins').textContent = game.totalGold;
    document.getElementById('survival-time').textContent = Math.floor(game.survivalTime);
}

function victory() {
    game.state = GAME_STATES.VICTORY;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-title').textContent = '🎉 胜利!';
    document.getElementById('result-title').style.color = '#4CAF50';
    document.getElementById('result-message').textContent = '你成功存活到了最后!';
    document.getElementById('final-coins').textContent = game.totalGold;
    document.getElementById('survival-time').textContent = Math.floor(game.survivalTime);
}

// Rendering
function render() {
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawCorridor();
    drawRooms();
    drawEffects();
    drawGhosts();
    drawProjectiles();
    drawPlayer();
    drawUI();
    drawMessages();
}

function drawCorridor() {
    // Corridor floor
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(0, CORRIDOR.y, CANVAS_WIDTH, CORRIDOR.height);

    // Corridor lines
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, CORRIDOR.y + CORRIDOR.height / 2);
    ctx.lineTo(CANVAS_WIDTH, CORRIDOR.y + CORRIDOR.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawRooms() {
    for (const room of game.rooms) {
        drawRoom(room);
    }
}

function drawRoom(room) {
    const isPlayerRoom = room.owner === 'player';
    const isHovered = isPointInRoom(game.mouseX, game.mouseY, room);

    // Room floor
    ctx.fillStyle = room.owner ? (isPlayerRoom ? '#1a3a2a' : '#252839') : '#151a26';
    ctx.fillRect(room.x, room.y, room.width, room.height);

    // Grid
    if (isPlayerRoom && game.player.inRoom === room) {
        ctx.strokeStyle = '#ffffff15';
        ctx.lineWidth = 1;
        for (let col = 0; col <= room.gridCols; col++) {
            ctx.beginPath();
            ctx.moveTo(room.x + col * GRID_SIZE, room.y);
            ctx.lineTo(room.x + col * GRID_SIZE, room.y + room.height);
            ctx.stroke();
        }
        for (let row = 0; row <= room.gridRows; row++) {
            ctx.beginPath();
            ctx.moveTo(room.x, room.y + row * GRID_SIZE);
            ctx.lineTo(room.x + room.width, room.y + row * GRID_SIZE);
            ctx.stroke();
        }

        // Highlight selected cell
        if (game.selectedGridCell) {
            const cell = game.selectedGridCell;
            ctx.fillStyle = '#4CAF5044';
            ctx.fillRect(room.x + cell.col * GRID_SIZE, room.y + cell.row * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }
    }

    // Room border
    ctx.strokeStyle = isPlayerRoom ? '#4CAF50' : (room.owner ? '#5a6275' : '#3498db');
    ctx.lineWidth = isHovered && !room.owner ? 4 : 2;
    ctx.strokeRect(room.x, room.y, room.width, room.height);

    // Door
    const doorWidth = 60;
    const doorHeight = 12;
    const doorY = room.doorSide === 'bottom' ? room.y + room.height - doorHeight/2 : room.y - doorHeight/2;
    const healthPercent = room.doorHealth / room.doorMaxHealth;

    ctx.fillStyle = '#3d2817';
    ctx.fillRect(room.doorX - doorWidth/2, doorY, doorWidth, doorHeight);

    if (room.isOccupied) {
        ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : (healthPercent > 0.25 ? '#ff9800' : '#f44336');
        ctx.fillRect(room.doorX - doorWidth/2, doorY, doorWidth * healthPercent, doorHeight);
    }

    ctx.strokeStyle = room.doorClosed ? '#654321' : '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(room.doorX - doorWidth/2, doorY, doorWidth, doorHeight);

    if (room.doorLevel > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        const labelY = room.doorSide === 'bottom' ? doorY - 8 : doorY + doorHeight + 14;
        ctx.fillText('Lv.' + room.doorLevel, room.doorX, labelY);
    }

    // Bed
    ctx.fillStyle = '#4a1259';
    ctx.fillRect(room.bedX - 22, room.bedY - 15, 44, 30);
    ctx.fillStyle = '#7b1fa2';
    ctx.fillRect(room.bedX - 20, room.bedY - 13, 40, 24);
    ctx.fillStyle = '#ce93d8';
    ctx.fillRect(room.bedX - 18, room.bedY - 10, 18, 16);

    if (room.bedLevel > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lv.' + room.bedLevel, room.bedX, room.bedY - 22);
    }

    // Turrets
    for (const turret of room.turrets) {
        drawTurret(turret);
    }

    // Room label
    ctx.fillStyle = '#ffffff55';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    const label = room.owner ? (room.owner === 'player' ? '你的房间' : room.owner) : '房间 ' + room.id;
    ctx.fillText(label, room.x + room.width/2, room.y + room.height - 8);

    // Selection highlight
    if (game.state === GAME_STATES.SELECTING_ROOM && !room.owner && isHovered) {
        ctx.fillStyle = '#4CAF5033';
        ctx.fillRect(room.x, room.y, room.width, room.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('点击选择', room.x + room.width/2, room.y + room.height/2);
    }
}

function drawTurret(turret) {
    ctx.save();
    ctx.translate(turret.x, turret.y);

    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(turret.angle);
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, -3, 18, 6);

    ctx.restore();

    if (turret.target) {
        ctx.strokeStyle = '#ff572222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, turret.range, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawGhosts() {
    for (const ghost of game.ghosts) {
        ctx.save();
        ctx.translate(ghost.x, ghost.y);

        if (ghost.stunned) ctx.globalAlpha = 0.5;

        const size = ghost.size;
        const gradient = ctx.createRadialGradient(0, -5, 0, 0, 0, size);
        gradient.addColorStop(0, '#9b59b6');
        gradient.addColorStop(1, '#5b2c6f');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, -size/4, size/2, Math.PI, 0);
        ctx.lineTo(size/2, size/4);
        for (let i = 0; i < 5; i++) {
            const x = size/2 - (i + 1) * (size/5);
            const y = size/4 + (i % 2 === 0 ? 8 : 0);
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-7, -size/4, 5, 0, Math.PI * 2);
        ctx.arc(7, -size/4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(-7, -size/4, 2.5, 0, Math.PI * 2);
        ctx.arc(7, -size/4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Level & health
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lv.' + ghost.level, 0, -size/2 - 12);

        const hp = ghost.health / ghost.maxHealth;
        ctx.fillStyle = '#222';
        ctx.fillRect(-18, -size/2 - 6, 36, 5);
        ctx.fillStyle = hp > 0.5 ? '#4CAF50' : (hp > 0.25 ? '#ff9800' : '#f44336');
        ctx.fillRect(-18, -size/2 - 6, 36 * hp, 5);

        if (ghost.isAttacking) {
            ctx.fillStyle = '#f44336';
            ctx.font = '14px Arial';
            ctx.fillText('💢', 0, size/2 + 15);
        }

        if (ghost.stunned) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText('💫', 0, -size/2 - 18);
        }

        ctx.restore();
    }
}

function drawProjectiles() {
    ctx.fillStyle = '#ffeb3b';
    for (const proj of game.projectiles) {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayer() {
    const player = game.player;

    ctx.save();
    ctx.translate(player.x, player.y);

    if (player.isResting) {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        const bounce = Math.sin(Date.now() / 300) * 4;
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText('💤', 18, -12 + bounce);
    } else {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(0, 0, player.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5, -3, 3, 0, Math.PI * 2);
        ctx.arc(5, -3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 3, 6, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        if (player.targetX !== null) {
            ctx.strokeStyle = '#4CAF5055';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(player.targetX - player.x, player.targetY - player.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.restore();
}

function drawEffects() {
    for (const effect of game.effects) {
        if (effect.type === 'trap' && effect.active) {
            ctx.fillStyle = '#ff9800';
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🪤', effect.x, effect.y + 4);
        }
    }
}

function drawUI() {
    // Ghost spawn countdown
    if (!game.ghostsActive && game.state === GAME_STATES.PLAYING) {
        const timeLeft = Math.ceil(CONFIG.ghostSpawnDelay - game.survivalTime);
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👻 鬼魂将在 ' + timeLeft + ' 秒后出现', CANVAS_WIDTH / 2, 30);
    }

    // Room selection timer
    if (game.state === GAME_STATES.SELECTING_ROOM) {
        ctx.fillStyle = '#e91e63';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⏰ 选择房间: ' + Math.ceil(game.timer) + ' 秒', CANVAS_WIDTH / 2, 35);
    }

    // Door health when in room
    if (game.player.inRoom && game.state === GAME_STATES.PLAYING) {
        const room = game.player.inRoom;
        const hp = room.doorHealth / room.doorMaxHealth;

        ctx.fillStyle = '#000000aa';
        ctx.fillRect(CANVAS_WIDTH - 220, 10, 210, 35);

        ctx.fillStyle = '#fff';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('门耐久:', CANVAS_WIDTH - 210, 30);

        ctx.fillStyle = '#333';
        ctx.fillRect(CANVAS_WIDTH - 145, 18, 120, 18);
        ctx.fillStyle = hp > 0.5 ? '#4CAF50' : (hp > 0.25 ? '#ff9800' : '#f44336');
        ctx.fillRect(CANVAS_WIDTH - 145, 18, 120 * hp, 18);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(room.doorHealth) + '/' + room.doorMaxHealth, CANVAS_WIDTH - 85, 32);
    }
}

function drawMessages() {
    ctx.textAlign = 'left';
    for (let i = 0; i < game.messages.length; i++) {
        const msg = game.messages[i];
        const alpha = Math.min(1, msg.time);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = '13px Arial';
        ctx.fillText(msg.text, 12, CANVAS_HEIGHT - 15 - i * 18);
    }
}

function renderMenu() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

document.addEventListener('DOMContentLoaded', init);
