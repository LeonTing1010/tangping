// 躺平休息 - Hunter Rest Game
// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 40;
const PLAYER_SIZE = 30;
const HUNTER_SIZE = 35;

const GAME_STATES = {
    SEARCHING: 'searching',
    RESTING: 'resting',
    FIGHTING: 'fighting',
    WIN: 'win',
    LOSE: 'lose'
};

// Game Configuration
const CONFIG = {
    searchTime: 30,
    baseCoinsPerSecond: 1,
    hunterSpeed: 1.5,
    playerSpeed: 3,
    hunterMaxHealth: 5,
    playerMaxHealth: 3,
    doorBreakTime: 3, // seconds per door level
    hunterSpawnDelay: 10, // seconds before hunter starts hunting
};

// Room definitions
const ROOMS = [
    { id: 1, x: 50, y: 50, width: 150, height: 120, doorX: 125, doorY: 170, bedX: 80, bedY: 80 },
    { id: 2, x: 250, y: 50, width: 150, height: 120, doorX: 325, doorY: 170, bedX: 280, bedY: 80 },
    { id: 3, x: 450, y: 50, width: 150, height: 120, doorX: 525, doorY: 170, bedX: 480, bedY: 80 },
    { id: 4, x: 600, y: 200, width: 150, height: 120, doorX: 600, doorY: 260, bedX: 680, bedY: 230 },
    { id: 5, x: 50, y: 250, width: 150, height: 120, doorX: 200, doorY: 310, bedX: 80, bedY: 280 },
    { id: 6, x: 300, y: 300, width: 150, height: 120, doorX: 375, doorY: 420, bedX: 330, bedY: 330 },
    { id: 7, x: 50, y: 450, width: 150, height: 120, doorX: 125, doorY: 450, bedX: 80, bedY: 490 },
    { id: 8, x: 500, y: 450, width: 150, height: 120, doorX: 575, doorY: 450, bedX: 530, bedY: 490 },
];

// Game State
let gameState = {
    state: GAME_STATES.SEARCHING,
    timer: CONFIG.searchTime,
    coins: 0,
    totalCoins: 0,
    playerHealth: CONFIG.playerMaxHealth,
    hunterHealth: CONFIG.hunterMaxHealth,
    doorLevel: 1,
    bedLevel: 1,
    weapons: 0,
    traps: 0,
    placedTraps: [],

    player: {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        inRoom: null,
        isResting: false,
        isMoving: false
    },

    hunter: {
        x: -100,
        y: -100,
        active: false,
        targetRoom: null,
        breakingDoor: false,
        breakProgress: 0,
        stunned: false,
        stunTime: 0
    },

    currentRoom: null,
    gameTime: 0,
    lastCoinTime: 0,
    keys: {},
    gameOver: false,
    startTime: 0
};

// DOM Elements
let canvas, ctx;
let startScreen, gameScreen, resultScreen;
let timerEl, coinsEl, healthEl, statusEl;
let doorCostEl, bedCostEl, weaponCostEl, trapCostEl;
let doorLevelEl, bedLevelEl, weaponCountEl, trapCountEl;
let hunterHealthFill, hunterHealthText, hunterLocationEl;

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Get DOM elements
    startScreen = document.getElementById('start-screen');
    gameScreen = document.getElementById('game-screen');
    resultScreen = document.getElementById('result-screen');

    timerEl = document.getElementById('timer');
    coinsEl = document.getElementById('coins');
    healthEl = document.getElementById('health');
    statusEl = document.getElementById('status');

    doorCostEl = document.getElementById('door-cost');
    bedCostEl = document.getElementById('bed-cost');
    weaponCostEl = document.getElementById('weapon-cost');
    trapCostEl = document.getElementById('trap-cost');

    doorLevelEl = document.getElementById('door-level');
    bedLevelEl = document.getElementById('bed-level');
    weaponCountEl = document.getElementById('weapon-count');
    trapCountEl = document.getElementById('trap-count');

    hunterHealthFill = document.getElementById('hunter-health-fill');
    hunterHealthText = document.getElementById('hunter-health-text');
    hunterLocationEl = document.getElementById('hunter-location');

    // Event listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function startGame() {
    resetGameState();
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    resultScreen.classList.add('hidden');

    gameState.startTime = Date.now();
    gameLoop();
}

function restartGame() {
    startGame();
}

function resetGameState() {
    gameState = {
        state: GAME_STATES.SEARCHING,
        timer: CONFIG.searchTime,
        coins: 0,
        totalCoins: 0,
        playerHealth: CONFIG.playerMaxHealth,
        hunterHealth: CONFIG.hunterMaxHealth,
        doorLevel: 1,
        bedLevel: 1,
        weapons: 0,
        traps: 0,
        placedTraps: [],

        player: {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            inRoom: null,
            isResting: false,
            isMoving: false
        },

        hunter: {
            x: -100,
            y: -100,
            active: false,
            targetRoom: null,
            breakingDoor: false,
            breakProgress: 0,
            stunned: false,
            stunTime: 0
        },

        currentRoom: null,
        gameTime: 0,
        lastCoinTime: 0,
        keys: {},
        gameOver: false,
        startTime: 0
    };

    updateHUD();
}

function handleKeyDown(e) {
    gameState.keys[e.key.toLowerCase()] = true;

    // Shop interactions
    if (e.key === '1') buyDoorUpgrade();
    if (e.key === '2') buyBedUpgrade();
    if (e.key === '3') buyWeapon();
    if (e.key === '4') buyTrap();

    // Room interactions
    if (e.key.toLowerCase() === 'e') handleInteraction();
    if (e.key.toLowerCase() === 'q') handleExit();

    // Attack
    if (e.key === ' ' && gameState.weapons > 0) attackHunter();
}

function handleKeyUp(e) {
    gameState.keys[e.key.toLowerCase()] = false;
}

function handleInteraction() {
    const player = gameState.player;

    if (!player.inRoom) {
        // Try to enter a room
        for (const room of ROOMS) {
            const doorDist = Math.hypot(player.x - room.doorX, player.y - room.doorY);
            if (doorDist < 40) {
                player.inRoom = room;
                player.x = room.x + room.width / 2;
                player.y = room.y + room.height / 2;
                gameState.currentRoom = room;
                updateStatus('进入房间 ' + room.id);
                return;
            }
        }
    } else if (!player.isResting) {
        // Try to rest on bed
        const room = player.inRoom;
        const bedDist = Math.hypot(player.x - room.bedX, player.y - room.bedY);
        if (bedDist < 40) {
            player.isResting = true;
            gameState.state = GAME_STATES.RESTING;
            gameState.lastCoinTime = gameState.gameTime;
            updateStatus('躺平中... 💤');
        }
    }
}

function handleExit() {
    const player = gameState.player;

    if (player.isResting) {
        player.isResting = false;
        gameState.state = GAME_STATES.SEARCHING;
        updateStatus('离开床铺');
    } else if (player.inRoom) {
        const room = player.inRoom;
        player.x = room.doorX;
        player.y = room.doorY + 30;
        player.inRoom = null;
        gameState.currentRoom = null;
        updateStatus('离开房间');
    }
}

function buyDoorUpgrade() {
    const cost = getDoorCost();
    if (gameState.coins >= cost && gameState.currentRoom) {
        gameState.coins -= cost;
        gameState.doorLevel++;
        updateHUD();
        updateStatus('门升级到 Lv.' + gameState.doorLevel);
    }
}

function buyBedUpgrade() {
    const cost = getBedCost();
    if (gameState.coins >= cost && gameState.currentRoom) {
        gameState.coins -= cost;
        gameState.bedLevel++;
        updateHUD();
        updateStatus('床升级到 Lv.' + gameState.bedLevel);
    }
}

function buyWeapon() {
    const cost = getWeaponCost();
    if (gameState.coins >= cost) {
        gameState.coins -= cost;
        gameState.weapons++;
        updateHUD();
        updateStatus('获得武器! (空格键使用)');
    }
}

function buyTrap() {
    const cost = getTrapCost();
    if (gameState.coins >= cost && gameState.currentRoom) {
        gameState.coins -= cost;
        gameState.traps++;
        // Place trap at room entrance
        gameState.placedTraps.push({
            roomId: gameState.currentRoom.id,
            x: gameState.currentRoom.doorX,
            y: gameState.currentRoom.doorY
        });
        updateHUD();
        updateStatus('陷阱已放置在门口!');
    }
}

function attackHunter() {
    const hunter = gameState.hunter;
    const player = gameState.player;

    if (!hunter.active || gameState.weapons <= 0) return;

    const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
    if (dist < 80) {
        gameState.weapons--;
        hunter.stunned = true;
        hunter.stunTime = 2;
        gameState.hunterHealth--;

        updateHUD();
        updateStatus('击中猎梦者! 剩余血量: ' + gameState.hunterHealth);

        if (gameState.hunterHealth <= 0) {
            gameWin();
        }
    } else {
        updateStatus('猎梦者不在攻击范围内!');
    }
}

function getDoorCost() {
    return 10 * gameState.doorLevel;
}

function getBedCost() {
    return 15 * gameState.bedLevel;
}

function getWeaponCost() {
    return 20 + gameState.weapons * 5;
}

function getTrapCost() {
    return 25 + gameState.traps * 10;
}

function updateHUD() {
    timerEl.textContent = Math.ceil(gameState.timer);
    coinsEl.textContent = gameState.coins;
    healthEl.textContent = gameState.playerHealth;

    doorCostEl.textContent = getDoorCost();
    bedCostEl.textContent = getBedCost();
    weaponCostEl.textContent = getWeaponCost();
    trapCostEl.textContent = getTrapCost();

    doorLevelEl.textContent = gameState.doorLevel;
    bedLevelEl.textContent = gameState.bedLevel;
    weaponCountEl.textContent = gameState.weapons;
    trapCountEl.textContent = gameState.traps;

    // Hunter health bar
    const healthPercent = (gameState.hunterHealth / CONFIG.hunterMaxHealth) * 100;
    hunterHealthFill.style.width = healthPercent + '%';
    hunterHealthText.textContent = gameState.hunterHealth + '/' + CONFIG.hunterMaxHealth;
}

function updateStatus(text) {
    statusEl.textContent = text;
}

function gameLoop() {
    if (gameState.gameOver) return;

    const currentTime = Date.now();
    const deltaTime = 1 / 60; // Assume 60 FPS

    gameState.gameTime += deltaTime;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Update timer during search phase
    if (gameState.state === GAME_STATES.SEARCHING) {
        gameState.timer -= dt;
        if (gameState.timer <= 0) {
            gameLose('时间到了! 你没能找到休息的地方');
            return;
        }
    }

    // Update timer label
    const timerLabel = document.getElementById('timer-label');
    if (gameState.state === GAME_STATES.SEARCHING) {
        timerLabel.textContent = '寻找房间';
    } else {
        timerLabel.textContent = '休息时间';
        gameState.timer += dt; // Count up when resting
    }

    // Player movement
    updatePlayer(dt);

    // Generate coins when resting
    if (gameState.player.isResting) {
        const coinsPerSecond = CONFIG.baseCoinsPerSecond * gameState.bedLevel;
        if (gameState.gameTime - gameState.lastCoinTime >= 1) {
            gameState.coins += coinsPerSecond;
            gameState.totalCoins += coinsPerSecond;
            gameState.lastCoinTime = gameState.gameTime;
        }
    }

    // Activate hunter after delay
    if (!gameState.hunter.active && gameState.gameTime >= CONFIG.hunterSpawnDelay) {
        activateHunter();
    }

    // Update hunter
    if (gameState.hunter.active) {
        updateHunter(dt);
    }

    updateHUD();
}

function updatePlayer(dt) {
    if (gameState.player.isResting) return;

    const speed = CONFIG.playerSpeed;
    let dx = 0, dy = 0;

    if (gameState.keys['w'] || gameState.keys['arrowup']) dy -= speed;
    if (gameState.keys['s'] || gameState.keys['arrowdown']) dy += speed;
    if (gameState.keys['a'] || gameState.keys['arrowleft']) dx -= speed;
    if (gameState.keys['d'] || gameState.keys['arrowright']) dx += speed;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    const newX = gameState.player.x + dx;
    const newY = gameState.player.y + dy;

    // Boundary checking
    if (gameState.player.inRoom) {
        const room = gameState.player.inRoom;
        gameState.player.x = Math.max(room.x + PLAYER_SIZE/2, Math.min(room.x + room.width - PLAYER_SIZE/2, newX));
        gameState.player.y = Math.max(room.y + PLAYER_SIZE/2, Math.min(room.y + room.height - PLAYER_SIZE/2, newY));
    } else {
        gameState.player.x = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_WIDTH - PLAYER_SIZE/2, newX));
        gameState.player.y = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE/2, newY));
    }

    gameState.player.isMoving = dx !== 0 || dy !== 0;
}

function activateHunter() {
    gameState.hunter.active = true;
    // Spawn at random edge
    const side = Math.floor(Math.random() * 4);
    switch(side) {
        case 0: // Top
            gameState.hunter.x = Math.random() * CANVAS_WIDTH;
            gameState.hunter.y = -HUNTER_SIZE;
            break;
        case 1: // Right
            gameState.hunter.x = CANVAS_WIDTH + HUNTER_SIZE;
            gameState.hunter.y = Math.random() * CANVAS_HEIGHT;
            break;
        case 2: // Bottom
            gameState.hunter.x = Math.random() * CANVAS_WIDTH;
            gameState.hunter.y = CANVAS_HEIGHT + HUNTER_SIZE;
            break;
        case 3: // Left
            gameState.hunter.x = -HUNTER_SIZE;
            gameState.hunter.y = Math.random() * CANVAS_HEIGHT;
            break;
    }
    updateStatus('⚠️ 猎梦者出现了!');
}

function updateHunter(dt) {
    const hunter = gameState.hunter;
    const player = gameState.player;

    // Handle stun
    if (hunter.stunned) {
        hunter.stunTime -= dt;
        if (hunter.stunTime <= 0) {
            hunter.stunned = false;
        }
        return;
    }

    // Check for trap collision
    for (let i = gameState.placedTraps.length - 1; i >= 0; i--) {
        const trap = gameState.placedTraps[i];
        const dist = Math.hypot(hunter.x - trap.x, hunter.y - trap.y);
        if (dist < 30) {
            hunter.stunned = true;
            hunter.stunTime = 3;
            gameState.hunterHealth--;
            gameState.placedTraps.splice(i, 1);
            updateStatus('猎梦者触发了陷阱!');

            if (gameState.hunterHealth <= 0) {
                gameWin();
                return;
            }
        }
    }

    let targetX, targetY;

    if (player.inRoom) {
        // Target the player's room door
        targetX = player.inRoom.doorX;
        targetY = player.inRoom.doorY;
        hunter.targetRoom = player.inRoom;
        hunterLocationEl.textContent = '位置: 前往房间 ' + player.inRoom.id;
    } else {
        // Chase player directly
        targetX = player.x;
        targetY = player.y;
        hunter.targetRoom = null;
        hunterLocationEl.textContent = '位置: 追逐玩家';
    }

    // Move towards target
    const dx = targetX - hunter.x;
    const dy = targetY - hunter.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
        const speed = CONFIG.hunterSpeed;
        hunter.x += (dx / dist) * speed;
        hunter.y += (dy / dist) * speed;
    }

    // Check if hunter reached room door
    if (hunter.targetRoom) {
        const doorDist = Math.hypot(hunter.x - hunter.targetRoom.doorX, hunter.y - hunter.targetRoom.doorY);
        if (doorDist < 20) {
            if (!hunter.breakingDoor) {
                hunter.breakingDoor = true;
                hunter.breakProgress = 0;
                updateStatus('⚠️ 猎梦者正在破门!');
            }

            hunter.breakProgress += dt;
            const breakTime = CONFIG.doorBreakTime * gameState.doorLevel;

            if (hunter.breakProgress >= breakTime) {
                // Door broken, hunter enters
                hunter.breakingDoor = false;
                hunterEntersRoom();
            }
        }
    }

    // Direct collision with player (outside room)
    if (!player.inRoom) {
        const playerDist = Math.hypot(hunter.x - player.x, hunter.y - player.y);
        if (playerDist < 30) {
            playerTakeDamage();
        }
    }
}

function hunterEntersRoom() {
    const player = gameState.player;

    if (player.isResting) {
        // Player caught while resting
        gameLose('你在躺平时被猎梦者抓住了!');
    } else {
        // Player in room but not resting, take damage
        playerTakeDamage();
    }
}

function playerTakeDamage() {
    gameState.playerHealth--;
    updateStatus('受到攻击! 剩余生命: ' + gameState.playerHealth);

    // Knock back hunter
    gameState.hunter.stunned = true;
    gameState.hunter.stunTime = 1;

    // Push hunter back
    const dx = gameState.hunter.x - gameState.player.x;
    const dy = gameState.hunter.y - gameState.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
        gameState.hunter.x += (dx / dist) * 50;
        gameState.hunter.y += (dy / dist) * 50;
    }

    if (gameState.playerHealth <= 0) {
        gameLose('你被猎梦者击败了!');
    }
}

function gameWin() {
    gameState.gameOver = true;
    gameState.state = GAME_STATES.WIN;

    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    document.getElementById('result-title').textContent = '🎉 胜利!';
    document.getElementById('result-title').style.color = '#4CAF50';
    document.getElementById('result-message').textContent = '你成功击败了猎梦者!';
    document.getElementById('final-coins').textContent = gameState.totalCoins;
    document.getElementById('survival-time').textContent = Math.floor(gameState.gameTime);
}

function gameLose(message) {
    gameState.gameOver = true;
    gameState.state = GAME_STATES.LOSE;

    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    document.getElementById('result-title').textContent = '💀 失败';
    document.getElementById('result-title').style.color = '#f44336';
    document.getElementById('result-message').textContent = message;
    document.getElementById('final-coins').textContent = gameState.totalCoins;
    document.getElementById('survival-time').textContent = Math.floor(gameState.gameTime);
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw floor pattern
    ctx.fillStyle = '#16213e';
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
            if ((x + y) % 80 === 0) {
                ctx.fillRect(x, y, 40, 40);
            }
        }
    }

    // Draw rooms
    for (const room of ROOMS) {
        drawRoom(room);
    }

    // Draw traps
    for (const trap of gameState.placedTraps) {
        ctx.fillStyle = '#ff9800';
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🪤', trap.x, trap.y + 4);
    }

    // Draw hunter
    if (gameState.hunter.active) {
        drawHunter();
    }

    // Draw player
    drawPlayer();

    // Draw door breaking progress
    if (gameState.hunter.breakingDoor && gameState.hunter.targetRoom) {
        const room = gameState.hunter.targetRoom;
        const breakTime = CONFIG.doorBreakTime * gameState.doorLevel;
        const progress = gameState.hunter.breakProgress / breakTime;

        ctx.fillStyle = '#333';
        ctx.fillRect(room.doorX - 30, room.doorY - 50, 60, 10);
        ctx.fillStyle = '#f44336';
        ctx.fillRect(room.doorX - 30, room.doorY - 50, 60 * progress, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('破门中...', room.doorX, room.doorY - 55);
    }

    // Draw interaction hints
    drawInteractionHints();
}

function drawRoom(room) {
    const isCurrentRoom = gameState.currentRoom && gameState.currentRoom.id === room.id;

    // Room floor
    ctx.fillStyle = isCurrentRoom ? '#2d4a3e' : '#1e3a5f';
    ctx.fillRect(room.x, room.y, room.width, room.height);

    // Room walls
    ctx.strokeStyle = isCurrentRoom ? '#4CAF50' : '#3498db';
    ctx.lineWidth = 3;
    ctx.strokeRect(room.x, room.y, room.width, room.height);

    // Door
    const doorWidth = 30;
    const doorHeight = 10;
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(room.doorX - doorWidth/2, room.doorY - doorHeight/2, doorWidth, doorHeight);

    // Door level indicator
    if (isCurrentRoom && gameState.doorLevel > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lv.' + gameState.doorLevel, room.doorX, room.doorY - 10);
    }

    // Bed
    ctx.fillStyle = '#6a1b9a';
    ctx.fillRect(room.bedX - 20, room.bedY - 15, 40, 30);
    ctx.fillStyle = '#9c27b0';
    ctx.fillRect(room.bedX - 18, room.bedY - 13, 36, 20);

    // Pillow
    ctx.fillStyle = '#e1bee7';
    ctx.fillRect(room.bedX - 15, room.bedY - 10, 15, 14);

    // Bed level indicator
    if (isCurrentRoom && gameState.bedLevel > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lv.' + gameState.bedLevel, room.bedX, room.bedY - 25);
    }

    // Room number
    ctx.fillStyle = '#ffffff44';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(room.id, room.x + room.width/2, room.y + room.height/2 + 40);
}

function drawPlayer() {
    const player = gameState.player;

    ctx.save();

    if (player.isResting) {
        // Draw sleeping player
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.ellipse(player.x, player.y, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Zzz
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('💤', player.x + 15, player.y - 10);
    } else {
        // Draw standing player
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(player.x - 5, player.y - 3, 3, 0, Math.PI * 2);
        ctx.arc(player.x + 5, player.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y + 2, 6, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    }

    // Weapon indicator
    if (gameState.weapons > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️x' + gameState.weapons, player.x, player.y - 25);
    }

    ctx.restore();
}

function drawHunter() {
    const hunter = gameState.hunter;

    ctx.save();

    if (hunter.stunned) {
        ctx.globalAlpha = 0.5;
    }

    // Body
    ctx.fillStyle = '#f44336';
    ctx.beginPath();
    ctx.arc(hunter.x, hunter.y, HUNTER_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Evil eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hunter.x - 7, hunter.y - 5, 5, 0, Math.PI * 2);
    ctx.arc(hunter.x + 7, hunter.y - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(hunter.x - 7, hunter.y - 5, 2, 0, Math.PI * 2);
    ctx.arc(hunter.x + 7, hunter.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Evil grin
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hunter.x, hunter.y + 5, 8, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Horns
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.moveTo(hunter.x - 12, hunter.y - 12);
    ctx.lineTo(hunter.x - 8, hunter.y - 25);
    ctx.lineTo(hunter.x - 4, hunter.y - 12);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(hunter.x + 12, hunter.y - 12);
    ctx.lineTo(hunter.x + 8, hunter.y - 25);
    ctx.lineTo(hunter.x + 4, hunter.y - 12);
    ctx.fill();

    if (hunter.stunned) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💫', hunter.x, hunter.y - 30);
    }

    ctx.restore();
}

function drawInteractionHints() {
    const player = gameState.player;
    ctx.fillStyle = '#ffffff88';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    if (!player.inRoom) {
        // Check for nearby doors
        for (const room of ROOMS) {
            const doorDist = Math.hypot(player.x - room.doorX, player.y - room.doorY);
            if (doorDist < 50) {
                ctx.fillText('按 E 进入房间', room.doorX, room.doorY + 25);
            }
        }
    } else if (!player.isResting) {
        // Show bed interaction hint
        const room = player.inRoom;
        const bedDist = Math.hypot(player.x - room.bedX, player.y - room.bedY);
        if (bedDist < 50) {
            ctx.fillText('按 E 躺平休息', room.bedX, room.bedY + 30);
        }

        // Show exit hint near door
        const doorDist = Math.hypot(player.x - room.doorX, player.y - room.doorY);
        if (doorDist < 50) {
            ctx.fillText('按 Q 离开房间', room.doorX, room.doorY - 20);
        }
    } else {
        // Show get up hint
        ctx.fillText('按 Q 起床', player.x, player.y + 30);
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
