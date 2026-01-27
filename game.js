// 梦魇宿舍 - 躺平塔防 H5单机版
// ================================

// Canvas configuration
let CANVAS_WIDTH = 450;
let CANVAS_HEIGHT = 750;
const GRID_SIZE = 50;

// Colors
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

// Ghost States (AI State Machine)
const GHOST_STATES = {
    IDLE: 'idle',
    ATTACK: 'attack',
    RETREAT: 'retreat'
};

// ========== 建筑升级树配置 ==========
const BED_CONFIG = [
    { name: '破旧木床', icon: '🛏️', goldPerSec: 2, cost: 0 },
    { name: '席梦思', icon: '🛏️', goldPerSec: 4, cost: 50 },
    { name: '智能按摩床', icon: '🛏️', goldPerSec: 8, cost: 120 },
    { name: '豪华太空舱', icon: '🚀', goldPerSec: 15, cost: 250 }
];

const DOOR_CONFIG = [
    { name: '木门', hp: 100, armor: 0, cost: 0 },
    { name: '铁门', hp: 180, armor: 5, cost: 30 },
    { name: '钢门', hp: 300, armor: 15, cost: 80 },
    { name: '钛合金门', hp: 500, armor: 30, cost: 200 }
];

// 建筑配置
const BUILDINGS = {
    turret: { name: '弹弓炮台', icon: '🔫', cost: 50, damage: 5, range: 150, attackSpeed: 1.5 },
    generator: { name: '发电机', icon: '⚡', cost: 80, bonus: 0.3 },
    trap: { name: '陷阱', icon: '🪤', cost: 40, slowPercent: 0.5, damage: 2 },
    plant: { name: '摇钱草', icon: '🌱', cost: 30, goldPerSec: 1 }
};

// 猛鬼配置
const GHOST_CONFIG = {
    baseHP: 50,
    baseDamage: 10,
    baseSpeed: 40,
    attackSpeed: 1.5,
    retreatThreshold: 0.2,
    healRate: 20
};

// 游戏配置
const CONFIG = {
    selectionTime: 25,
    ghostDelay: 30,
    survivalTime: 180,
    doorBaseHealth: 100,
    ghostSpawnInterval: 15,
    difficultyScale: 0.1
};

// ========== 存档管理 ==========
const SaveManager = {
    save(data) {
        try {
            localStorage.setItem('nightmare_dorm_save', JSON.stringify(data));
        } catch (e) {
            console.log('Save failed:', e);
        }
    },
    load() {
        try {
            const data = localStorage.getItem('nightmare_dorm_save');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },
    getDefault() {
        return {
            beeCoins: 0,
            talents: {
                startGold: 0,
                doorHP: 0
            },
            stats: {
                totalGames: 0,
                totalKills: 0,
                bestSurvivalTime: 0
            }
        };
    }
};

// ========== 房间类 ==========
class Room {
    constructor(layout) {
        this.id = layout.id;
        this.x = layout.x;
        this.y = layout.y;
        this.width = layout.width;
        this.height = layout.height;
        this.gridCols = layout.gridCols;
        this.gridRows = layout.gridRows;
        this.doorSide = layout.doorSide;

        this.owner = null;
        this.doorLevel = 0;
        this.doorHP = DOOR_CONFIG[0].hp;
        this.doorMaxHP = DOOR_CONFIG[0].hp;
        this.doorArmor = DOOR_CONFIG[0].armor;
        this.bedLevel = 0;
        this.isResting = false;
        this.grid = [];
        this.buildings = [];
        this.turrets = [];

        this.initGrid();
        this.calculateDoorPosition();
    }

    initGrid() {
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                this.grid.push({
                    col, row,
                    x: this.x + 15 + col * GRID_SIZE + GRID_SIZE / 2,
                    y: this.y + 15 + row * GRID_SIZE + GRID_SIZE / 2,
                    building: null
                });
            }
        }
    }

    calculateDoorPosition() {
        switch (this.doorSide) {
            case 'bottom':
                this.doorX = this.x + this.width / 2;
                this.doorY = this.y + this.height;
                break;
            case 'top':
                this.doorX = this.x + this.width / 2;
                this.doorY = this.y;
                break;
            case 'left':
                this.doorX = this.x;
                this.doorY = this.y + this.height / 2;
                break;
            case 'right':
                this.doorX = this.x + this.width;
                this.doorY = this.y + this.height / 2;
                break;
        }
    }

    upgradeDoor() {
        if (this.doorLevel < DOOR_CONFIG.length - 1) {
            this.doorLevel++;
            const config = DOOR_CONFIG[this.doorLevel];
            this.doorMaxHP = config.hp;
            this.doorHP = config.hp;
            this.doorArmor = config.armor;
            return true;
        }
        return false;
    }

    upgradeBed() {
        if (this.bedLevel < BED_CONFIG.length - 1) {
            this.bedLevel++;
            return true;
        }
        return false;
    }

    getGoldPerSecond() {
        let gold = 0;
        if (this.isResting) {
            gold += BED_CONFIG[this.bedLevel].goldPerSec;
        }
        for (const building of this.buildings) {
            if (building.type === 'plant') {
                gold += building.goldPerSec;
            }
        }
        return gold;
    }

    getDPS() {
        let dps = 0;
        for (const building of this.buildings) {
            if (building.type === 'turret') {
                dps += building.damage / building.attackSpeed;
            }
        }
        return dps;
    }

    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - this.doorArmor);
        this.doorHP -= actualDamage;
        return this.doorHP <= 0;
    }
}

// ========== 猛鬼类 ==========
class Ghost {
    constructor(spawnX, spawnY, wave) {
        this.x = spawnX;
        this.y = spawnY;
        this.spawnX = spawnX;
        this.spawnY = spawnY;

        // 根据波次动态调整属性
        const scale = 1 + wave * CONFIG.difficultyScale;
        this.maxHP = Math.floor(GHOST_CONFIG.baseHP * scale);
        this.hp = this.maxHP;
        this.damage = Math.floor(GHOST_CONFIG.baseDamage * scale);
        this.speed = GHOST_CONFIG.baseSpeed;
        this.attackSpeed = GHOST_CONFIG.attackSpeed;

        this.state = GHOST_STATES.IDLE;
        this.targetRoom = null;
        this.attackTimer = 0;
        this.idleTimer = 0;
        this.idleTarget = { x: spawnX, y: spawnY + 100 };
    }

    update(dt, rooms) {
        switch (this.state) {
            case GHOST_STATES.IDLE:
                this.updateIdle(dt, rooms);
                break;
            case GHOST_STATES.ATTACK:
                this.updateAttack(dt);
                break;
            case GHOST_STATES.RETREAT:
                this.updateRetreat(dt);
                break;
        }
    }

    updateIdle(dt, rooms) {
        // 在走廊徘徊
        this.idleTimer += dt;

        const dx = this.idleTarget.x - this.x;
        const dy = this.idleTarget.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
            this.x += (dx / dist) * this.speed * 0.5 * dt;
            this.y += (dy / dist) * this.speed * 0.5 * dt;
        } else {
            // 选择新的徘徊目标
            this.idleTarget = {
                x: 150 + Math.random() * 150,
                y: 200 + Math.random() * 300
            };
        }

        // 一段时间后选择房间攻击
        if (this.idleTimer >= 3 + Math.random() * 2) {
            this.selectTarget(rooms);
        }
    }

    selectTarget(rooms) {
        const validRooms = rooms.filter(r => r.owner && r.owner.alive && r.doorHP > 0);
        if (validRooms.length > 0) {
            this.targetRoom = validRooms[Math.floor(Math.random() * validRooms.length)];
            this.state = GHOST_STATES.ATTACK;
        }
    }

    updateAttack(dt) {
        if (!this.targetRoom || this.targetRoom.doorHP <= 0) {
            this.state = GHOST_STATES.IDLE;
            this.idleTimer = 0;
            return;
        }

        // 血量过低时撤退
        if (this.hp / this.maxHP < GHOST_CONFIG.retreatThreshold) {
            this.state = GHOST_STATES.RETREAT;
            return;
        }

        const room = this.targetRoom;
        const targetX = room.doorX;
        const targetY = room.doorY + (room.doorSide === 'top' ? -30 : room.doorSide === 'bottom' ? 30 : 0);

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 40) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else {
            // 攻击门
            this.attackTimer += dt;
            if (this.attackTimer >= this.attackSpeed) {
                this.attackTimer = 0;
                return this.targetRoom.takeDamage(this.damage);
            }
        }
        return false;
    }

    updateRetreat(dt) {
        // 撤回出生点回血
        const dx = this.spawnX - this.x;
        const dy = this.spawnY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 20) {
            this.x += (dx / dist) * this.speed * 1.5 * dt;
            this.y += (dy / dist) * this.speed * 1.5 * dt;
        } else {
            // 回血
            this.hp += GHOST_CONFIG.healRate * dt;
            if (this.hp >= this.maxHP * 0.8) {
                this.hp = Math.min(this.hp, this.maxHP);
                this.state = GHOST_STATES.IDLE;
                this.idleTimer = 0;
            }
        }
    }

    takeDamage(damage) {
        this.hp -= damage;
        return this.hp <= 0;
    }
}

// ========== AI玩家类 ==========
class AIPlayer {
    constructor(id, name, icon) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.room = null;
        this.alive = true;
        this.gold = 0;
        this.isPlayer = false;
        this.upgradeTimer = 0;
    }

    update(dt) {
        if (!this.alive || !this.room) return;

        // 每秒生成金币
        this.gold += this.room.getGoldPerSecond() * dt;

        // AI升级逻辑
        this.upgradeTimer += dt;
        if (this.upgradeTimer >= 2) {
            this.upgradeTimer = 0;
            this.doUpgrade();
        }
    }

    doUpgrade() {
        const room = this.room;

        // 优先升级门（如果血量低）
        if (room.doorHP < room.doorMaxHP * 0.5 && room.doorLevel < DOOR_CONFIG.length - 1) {
            const cost = DOOR_CONFIG[room.doorLevel + 1].cost;
            if (this.gold >= cost) {
                this.gold -= cost;
                room.upgradeDoor();
                return;
            }
        }

        // 升级床
        if (room.bedLevel < BED_CONFIG.length - 1) {
            const cost = BED_CONFIG[room.bedLevel + 1].cost;
            if (this.gold >= cost) {
                this.gold -= cost;
                room.upgradeBed();
                return;
            }
        }

        // 建造炮塔
        const emptyCell = room.grid.find(c => !c.building && c !== room.grid[0]);
        if (emptyCell && this.gold >= BUILDINGS.turret.cost) {
            this.gold -= BUILDINGS.turret.cost;
            const turret = {
                type: 'turret',
                ...BUILDINGS.turret,
                cell: emptyCell,
                attackTimer: 0
            };
            emptyCell.building = turret;
            room.buildings.push(turret);
            room.turrets.push(turret);
        }
    }

    die(deathMessage) {
        this.alive = false;
        return `${this.icon} ${this.name} ${deathMessage}`;
    }
}

// ========== 房间布局 ==========
function createRoomLayouts() {
    return [
        { id: 1, x: 10, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
        { id: 2, x: 310, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
        { id: 3, x: 10, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'right' },
        { id: 4, x: 310, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'left' },
        { id: 5, x: 10, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' },
        { id: 6, x: 260, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' }
    ];
}

// ========== 游戏主类 ==========
class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.state = GAME_STATES.SELECTING;
        this.rooms = [];
        this.players = [];
        this.ghosts = [];
        this.projectiles = [];
        this.floatingTexts = [];
        this.broadcasts = [];

        this.gold = 0;
        this.timer = CONFIG.selectionTime;
        this.survivalTime = 0;
        this.ghostsActive = false;
        this.wave = 0;
        this.kills = 0;
        this.lastGoldTick = 0;
        this.ghostSpawnTimer = 0;

        this.playerRoom = null;
        this.selectedCell = null;
        this.saveData = null;

        this.lastTime = 0;
    }

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });

        // UI事件
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => location.reload());
        document.getElementById('revive-btn').addEventListener('click', () => this.watchAdRevive());
        document.getElementById('double-btn').addEventListener('click', () => this.watchAdDouble());

        // 建造菜单
        document.getElementById('close-build').addEventListener('click', () => this.closeBuildMenu());
        document.querySelectorAll('.build-item').forEach(btn => {
            btn.addEventListener('click', () => this.buildItem(btn.dataset.type));
        });

        // 升级面板
        document.getElementById('close-upgrade').addEventListener('click', () => this.closeUpgradePanel());
        document.getElementById('upgrade-btn').addEventListener('click', () => this.doUpgrade());

        // 快捷按钮
        document.getElementById('btn-bed').addEventListener('click', () => this.openUpgradePanel('bed'));
        document.getElementById('btn-door').addEventListener('click', () => this.openUpgradePanel('door'));
        document.getElementById('btn-build').addEventListener('click', () => this.openBuildMenu());

        // 天赋按钮
        document.querySelectorAll('.talent-btn').forEach(btn => {
            btn.addEventListener('click', () => this.upgradeTalent(btn.dataset.talent));
        });

        // 加载存档
        this.loadSave();
        this.updateTalentUI();
    }

    resizeCanvas() {
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        CANVAS_WIDTH = rect.width;
        CANVAS_HEIGHT = rect.height - 60;
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    loadSave() {
        this.saveData = SaveManager.load() || SaveManager.getDefault();
        document.getElementById('bee-coins').textContent = this.saveData.beeCoins;
    }

    saveToDisk() {
        SaveManager.save(this.saveData);
    }

    updateTalentUI() {
        const talents = this.saveData.talents;
        document.getElementById('talent-gold-level').textContent = talents.startGold;
        document.getElementById('talent-gold-cost').textContent = 10 + talents.startGold * 5;
        document.getElementById('talent-door-level').textContent = talents.doorHP;
        document.getElementById('talent-door-cost').textContent = 15 + talents.doorHP * 8;
    }

    upgradeTalent(talent) {
        const talents = this.saveData.talents;
        let cost;

        if (talent === 'startGold') {
            cost = 10 + talents.startGold * 5;
            if (this.saveData.beeCoins >= cost) {
                this.saveData.beeCoins -= cost;
                talents.startGold++;
            }
        } else if (talent === 'doorHP') {
            cost = 15 + talents.doorHP * 8;
            if (this.saveData.beeCoins >= cost) {
                this.saveData.beeCoins -= cost;
                talents.doorHP++;
            }
        }

        this.saveToDisk();
        this.updateTalentUI();
        document.getElementById('bee-coins').textContent = this.saveData.beeCoins;
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');

        this.state = GAME_STATES.SELECTING;
        this.rooms = [];
        this.players = [];
        this.ghosts = [];
        this.projectiles = [];
        this.floatingTexts = [];
        this.broadcasts = [];

        // 应用天赋加成
        this.gold = 10 + this.saveData.talents.startGold * 5;
        this.timer = CONFIG.selectionTime;
        this.survivalTime = 0;
        this.ghostsActive = false;
        this.wave = 0;
        this.kills = 0;
        this.lastGoldTick = 0;
        this.ghostSpawnTimer = 0;
        this.playerRoom = null;

        this.initRooms();
        this.initPlayers();
        this.gameLoop();
    }

    initRooms() {
        const layouts = createRoomLayouts();
        this.rooms = layouts.map(layout => {
            const room = new Room(layout);
            // 应用门HP天赋
            const bonusHP = this.saveData.talents.doorHP * 20;
            room.doorHP += bonusHP;
            room.doorMaxHP += bonusHP;
            return room;
        });
    }

    initPlayers() {
        this.players = [
            { id: 0, name: '你', icon: '😊', room: null, alive: true, isPlayer: true },
            new AIPlayer(1, '躺平爸爸', '👴'),
            new AIPlayer(2, '躺平皇帝', '👑'),
            new AIPlayer(3, '躺平黄金', '💰'),
            new AIPlayer(4, '躺平王者', '🎮')
        ];

        // AI玩家选择房间
        const availableRooms = [...this.rooms];
        for (let i = 1; i < this.players.length && availableRooms.length > 1; i++) {
            const idx = Math.floor(Math.random() * availableRooms.length);
            const room = availableRooms[idx];
            this.players[i].room = room;
            room.owner = this.players[i];
            room.isResting = true;
            availableRooms.splice(idx, 1);
        }

        this.updatePlayerIcons();
    }

    updatePlayerIcons() {
        const container = document.getElementById('player-icons');
        container.innerHTML = '';

        this.players.forEach(player => {
            const div = document.createElement('div');
            div.className = 'player-icon' + (player.isPlayer ? ' active' : '') + (!player.alive ? ' dead' : '');
            div.textContent = player.icon;
            container.appendChild(div);
        });
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.processClick(x, y);
    }

    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
        this.processClick(x, y);
    }

    processClick(x, y) {
        if (this.state === GAME_STATES.SELECTING) {
            for (const room of this.rooms) {
                if (!room.owner && this.isPointInRoom(x, y, room)) {
                    this.selectRoom(room);
                    return;
                }
            }
        } else if (this.state === GAME_STATES.PLAYING && this.playerRoom) {
            const room = this.playerRoom;

            if (this.isPointInRoom(x, y, room)) {
                for (const cell of room.grid) {
                    const dx = x - cell.x;
                    const dy = y - cell.y;
                    if (Math.abs(dx) < GRID_SIZE / 2 && Math.abs(dy) < GRID_SIZE / 2) {
                        this.handleCellClick(cell, room);
                        return;
                    }
                }
            }

            // 点击床开始休息
            const bedCell = room.grid[0];
            const dx = x - bedCell.x;
            const dy = y - bedCell.y;
            if (Math.abs(dx) < GRID_SIZE / 2 && Math.abs(dy) < GRID_SIZE / 2) {
                room.isResting = true;
            }
        }
    }

    selectRoom(room) {
        room.owner = this.players[0];
        this.players[0].room = room;
        this.playerRoom = room;
        room.isResting = true;

        this.state = GAME_STATES.PLAYING;
        this.timer = CONFIG.survivalTime;

        this.addFloatingText(room.doorX, room.doorY - 30, '选择成功!', '#4CAF50');
        this.addBroadcast('你选择了房间');
    }

    handleCellClick(cell, room) {
        if (cell === room.grid[0]) {
            // 点击床位置
            this.openUpgradePanel('bed');
        } else if (cell.building) {
            // 点击已建造的建筑
            this.selectedCell = cell;
            // TODO: 显示建筑升级选项
        } else {
            // 空格子，显示建造菜单
            this.selectedCell = cell;
            this.openBuildMenu();
        }
    }

    isPointInRoom(x, y, room) {
        return x >= room.x && x <= room.x + room.width &&
               y >= room.y && y <= room.y + room.height;
    }

    // ========== UI面板 ==========
    openBuildMenu() {
        if (!this.playerRoom) return;
        document.getElementById('build-menu').classList.remove('hidden');
    }

    closeBuildMenu() {
        document.getElementById('build-menu').classList.add('hidden');
        this.selectedCell = null;
    }

    buildItem(type) {
        if (!this.playerRoom || !this.selectedCell) {
            // 如果没有选中格子，找一个空的
            this.selectedCell = this.playerRoom.grid.find(c => !c.building && c !== this.playerRoom.grid[0]);
        }

        if (!this.selectedCell || this.selectedCell.building) {
            this.closeBuildMenu();
            return;
        }

        const config = BUILDINGS[type];
        if (this.gold < config.cost) {
            this.addFloatingText(CANVAS_WIDTH / 2, 300, '金币不足!', '#ff6b6b');
            return;
        }

        this.gold -= config.cost;
        const building = {
            type,
            ...config,
            cell: this.selectedCell,
            attackTimer: 0
        };

        this.selectedCell.building = building;
        this.playerRoom.buildings.push(building);

        if (type === 'turret') {
            this.playerRoom.turrets.push(building);
        }

        this.addFloatingText(this.selectedCell.x, this.selectedCell.y - 20, '-' + config.cost, '#ff6b6b');
        this.closeBuildMenu();
    }

    openUpgradePanel(type) {
        if (!this.playerRoom) return;

        const panel = document.getElementById('upgrade-panel');
        panel.classList.remove('hidden');

        const room = this.playerRoom;

        if (type === 'bed') {
            const current = BED_CONFIG[room.bedLevel];
            const next = BED_CONFIG[room.bedLevel + 1];

            document.getElementById('upgrade-icon').textContent = current.icon;
            document.getElementById('upgrade-name').textContent = current.name;
            document.getElementById('upgrade-desc').textContent = `产出: ${current.goldPerSec}金币/秒`;

            if (next) {
                document.getElementById('upgrade-next').textContent = `下一级: ${next.name} (${next.goldPerSec}金币/秒)`;
                document.getElementById('upgrade-cost').textContent = next.cost;
                document.getElementById('upgrade-btn').disabled = this.gold < next.cost;
            } else {
                document.getElementById('upgrade-next').textContent = '已满级';
                document.getElementById('upgrade-btn').disabled = true;
            }

            this.upgradeType = 'bed';
        } else if (type === 'door') {
            const current = DOOR_CONFIG[room.doorLevel];
            const next = DOOR_CONFIG[room.doorLevel + 1];

            document.getElementById('upgrade-icon').textContent = '🚪';
            document.getElementById('upgrade-name').textContent = current.name;
            document.getElementById('upgrade-desc').textContent = `血量: ${room.doorHP}/${room.doorMaxHP} 护甲: ${current.armor}`;

            if (next) {
                document.getElementById('upgrade-next').textContent = `下一级: ${next.name} (HP:${next.hp} 护甲:${next.armor})`;
                document.getElementById('upgrade-cost').textContent = next.cost;
                document.getElementById('upgrade-btn').disabled = this.gold < next.cost;
            } else {
                document.getElementById('upgrade-next').textContent = '已满级';
                document.getElementById('upgrade-btn').disabled = true;
            }

            this.upgradeType = 'door';
        }
    }

    closeUpgradePanel() {
        document.getElementById('upgrade-panel').classList.add('hidden');
        this.upgradeType = null;
    }

    doUpgrade() {
        if (!this.playerRoom) return;

        const room = this.playerRoom;

        if (this.upgradeType === 'bed') {
            const next = BED_CONFIG[room.bedLevel + 1];
            if (next && this.gold >= next.cost) {
                this.gold -= next.cost;
                room.upgradeBed();
                this.addFloatingText(room.grid[0].x, room.grid[0].y - 20, '床升级!', '#4CAF50');
            }
        } else if (this.upgradeType === 'door') {
            const next = DOOR_CONFIG[room.doorLevel + 1];
            if (next && this.gold >= next.cost) {
                this.gold -= next.cost;
                room.upgradeDoor();
                this.addFloatingText(room.doorX, room.doorY - 20, '门升级!', '#4CAF50');
            }
        }

        this.closeUpgradePanel();
    }

    // ========== 广播系统 ==========
    addBroadcast(message) {
        const container = document.getElementById('broadcast-container');
        const div = document.createElement('div');
        div.className = 'broadcast-msg';
        div.textContent = message;
        container.appendChild(div);

        setTimeout(() => {
            div.remove();
        }, 3000);
    }

    addFloatingText(x, y, text, color = '#ffd700') {
        this.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -30 });
    }

    // ========== 游戏循环 ==========
    gameLoop(currentTime = 0) {
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        this.update(dt);
        this.render();

        if (this.state !== GAME_STATES.GAMEOVER && this.state !== GAME_STATES.VICTORY) {
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    update(dt) {
        // 更新浮动文字
        this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.y += ft.vy * dt;
            ft.life -= dt;
            return ft.life > 0;
        });

        if (this.state === GAME_STATES.SELECTING) {
            this.timer -= dt;
            document.getElementById('wave-info').textContent = `选择房间: ${Math.ceil(this.timer)}秒`;

            if (this.timer <= 0) {
                const available = this.rooms.filter(r => !r.owner);
                if (available.length > 0) {
                    this.selectRoom(available[Math.floor(Math.random() * available.length)]);
                }
            }
            return;
        }

        if (this.state !== GAME_STATES.PLAYING) return;

        this.survivalTime += dt;
        this.timer -= dt;

        // 更新HUD
        const remainTime = Math.max(0, Math.ceil(this.timer));
        if (this.ghostsActive) {
            document.getElementById('wave-info').textContent = `波次${this.wave} | 剩余${remainTime}秒`;
        } else {
            const ghostTime = Math.ceil(CONFIG.ghostDelay - this.survivalTime);
            document.getElementById('wave-info').textContent = `准备阶段 | 👻${ghostTime}秒后出现`;
        }

        // 胜利检查
        if (this.timer <= 0) {
            this.victory();
            return;
        }

        // 激活猛鬼
        if (!this.ghostsActive && this.survivalTime >= CONFIG.ghostDelay) {
            this.ghostsActive = true;
            this.wave = 1;
            this.spawnGhost();
            this.addBroadcast('👻 猛鬼出现了!');
        }

        // 生成更多猛鬼
        if (this.ghostsActive) {
            this.ghostSpawnTimer += dt;
            if (this.ghostSpawnTimer >= CONFIG.ghostSpawnInterval) {
                this.ghostSpawnTimer = 0;
                this.wave++;
                this.spawnGhost();
                if (this.wave % 3 === 0) {
                    this.spawnGhost(); // 每3波多生成一只
                }
            }
        }

        // 金币生成
        this.lastGoldTick += dt;
        if (this.lastGoldTick >= 1) {
            this.lastGoldTick = 0;
            this.generateGold();
        }

        // 更新猛鬼
        this.updateGhosts(dt);

        // 更新AI玩家
        for (const player of this.players) {
            if (player instanceof AIPlayer) {
                player.update(dt);
            }
        }

        // 更新炮塔
        this.updateTurrets(dt);

        // 更新投射物
        this.updateProjectiles(dt);

        // 更新HUD数值
        document.getElementById('gold-amount').textContent = Math.floor(this.gold);
        document.getElementById('dps-amount').textContent = this.playerRoom ? this.playerRoom.getDPS().toFixed(1) : '0';
    }

    generateGold() {
        if (this.playerRoom && this.playerRoom.isResting) {
            const goldPerSec = this.playerRoom.getGoldPerSecond();
            this.gold += goldPerSec;

            // 浮动金币文字
            if (goldPerSec > 0) {
                const bedCell = this.playerRoom.grid[0];
                this.addFloatingText(bedCell.x + 15, bedCell.y - 15, '+' + goldPerSec, '#ffd700');
            }
        }
    }

    spawnGhost() {
        const spawnPoints = [
            { x: CANVAS_WIDTH / 2, y: -50 },
            { x: 50, y: CANVAS_HEIGHT / 2 },
            { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT / 2 }
        ];

        const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const ghost = new Ghost(spawn.x, spawn.y, this.wave);
        this.ghosts.push(ghost);
    }

    updateGhosts(dt) {
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const ghost = this.ghosts[i];
            const doorBroken = ghost.update(dt, this.rooms);

            if (doorBroken && ghost.targetRoom) {
                const room = ghost.targetRoom;
                if (room.owner) {
                    const owner = room.owner;
                    owner.alive = false;

                    if (owner.isPlayer) {
                        this.gameOver();
                        return;
                    } else {
                        // AI玩家死亡广播
                        const deathMessages = [
                            '被猛鬼抓走了',
                            '的门被破坏了',
                            '惨遭淘汰',
                            '躺平失败了'
                        ];
                        const msg = owner.die(deathMessages[Math.floor(Math.random() * deathMessages.length)]);
                        this.addBroadcast(msg);
                        this.updatePlayerIcons();
                    }
                }

                ghost.targetRoom = null;
                ghost.state = GHOST_STATES.IDLE;
                ghost.idleTimer = 0;
            }

            // 移除死亡的猛鬼
            if (ghost.hp <= 0) {
                this.ghosts.splice(i, 1);
                this.kills++;
                this.gold += 5 + this.wave;
                this.addFloatingText(ghost.x, ghost.y - 20, '+' + (5 + this.wave), '#ffd700');
            }
        }
    }

    updateTurrets(dt) {
        if (!this.playerRoom) return;

        for (const turret of this.playerRoom.turrets) {
            turret.attackTimer += dt;

            if (turret.attackTimer >= turret.attackSpeed) {
                // 找最近的猛鬼
                let nearestGhost = null;
                let nearestDist = turret.range;

                for (const ghost of this.ghosts) {
                    const dx = ghost.x - turret.cell.x;
                    const dy = ghost.y - turret.cell.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestGhost = ghost;
                    }
                }

                if (nearestGhost) {
                    turret.attackTimer = 0;
                    this.projectiles.push({
                        x: turret.cell.x,
                        y: turret.cell.y,
                        targetX: nearestGhost.x,
                        targetY: nearestGhost.y,
                        target: nearestGhost,
                        damage: turret.damage,
                        speed: 300
                    });
                }
            }
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 15) {
                // 命中
                if (proj.target && proj.target.hp > 0) {
                    proj.target.takeDamage(proj.damage);
                }
                this.projectiles.splice(i, 1);
            } else {
                proj.x += (dx / dist) * proj.speed * dt;
                proj.y += (dy / dist) * proj.speed * dt;
            }
        }
    }

    // ========== 游戏结束 ==========
    gameOver() {
        this.state = GAME_STATES.GAMEOVER;
        this.showResult(false);
    }

    victory() {
        this.state = GAME_STATES.VICTORY;
        this.showResult(true);
    }

    showResult(isVictory) {
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.remove('hidden');

        const beeReward = Math.floor(this.survivalTime / 10) + this.kills;
        this.earnedBee = beeReward;

        if (isVictory) {
            document.getElementById('result-title').textContent = '🎉 胜利!';
            document.getElementById('result-title').style.color = '#4CAF50';
            document.getElementById('result-message').textContent = '你成功存活到了最后!';
        } else {
            document.getElementById('result-title').textContent = '💀 游戏结束';
            document.getElementById('result-title').style.color = '#ff6b6b';
            document.getElementById('result-message').textContent = '你的门被猛鬼破坏了!';
        }

        document.getElementById('final-time').textContent = Math.floor(this.survivalTime);
        document.getElementById('final-kills').textContent = this.kills;
        document.getElementById('final-gold').textContent = Math.floor(this.gold);
        document.getElementById('final-bee').textContent = beeReward;

        // 保存奖励
        this.saveData.beeCoins += beeReward;
        this.saveData.stats.totalGames++;
        this.saveData.stats.totalKills += this.kills;
        if (this.survivalTime > this.saveData.stats.bestSurvivalTime) {
            this.saveData.stats.bestSurvivalTime = this.survivalTime;
        }
        this.saveToDisk();
    }

    watchAdRevive() {
        // 模拟看广告复活
        this.addBroadcast('复活成功!');
        document.getElementById('result-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');

        this.state = GAME_STATES.PLAYING;
        this.playerRoom.doorHP = this.playerRoom.doorMaxHP;
        this.players[0].alive = true;
        this.updatePlayerIcons();

        this.gameLoop();
    }

    watchAdDouble() {
        // 模拟看广告双倍奖励
        this.saveData.beeCoins += this.earnedBee;
        this.saveToDisk();
        document.getElementById('final-bee').textContent = this.earnedBee * 2;
        document.getElementById('double-btn').disabled = true;
        document.getElementById('double-btn').textContent = '已领取';
    }

    // ========== 渲染 ==========
    render() {
        const ctx = this.ctx;

        ctx.fillStyle = COLORS.corridor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.drawCorridorPattern();

        for (const room of this.rooms) {
            this.drawRoom(room);
        }

        for (const ghost of this.ghosts) {
            this.drawGhost(ghost);
        }

        for (const proj of this.projectiles) {
            this.drawProjectile(proj);
        }

        this.drawTimer();
        this.drawFloatingTexts();

        if (this.state === GAME_STATES.SELECTING) {
            this.drawSelectionHints();
        }
    }

    drawCorridorPattern() {
        const ctx = this.ctx;

        ctx.fillStyle = COLORS.corridorFloor;
        ctx.fillRect(0, 230, CANVAS_WIDTH, 100);
        ctx.fillRect(0, 530, CANVAS_WIDTH, 30);
        ctx.fillRect(150, 60, 150, 650);

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

    drawRoom(room) {
        const ctx = this.ctx;

        // 房间地板
        ctx.fillStyle = COLORS.floor;
        ctx.fillRect(room.x, room.y, room.width, room.height);

        // 地砖图案
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

        // 格子
        ctx.strokeStyle = '#ffffff22';
        ctx.fillStyle = '#ffffff33';
        ctx.lineWidth = 1;

        for (const cell of room.grid) {
            ctx.strokeRect(cell.x - GRID_SIZE / 2 + 5, cell.y - GRID_SIZE / 2 + 5, GRID_SIZE - 10, GRID_SIZE - 10);

            if (!cell.building && cell !== room.grid[0]) {
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('+', cell.x, cell.y + 5);
            }
        }

        // 房间边框
        ctx.strokeStyle = COLORS.roomBorder;
        ctx.lineWidth = 4;
        ctx.strokeRect(room.x, room.y, room.width, room.height);

        // 绘制床
        this.drawBed(room);

        // 绘制建筑
        for (const cell of room.grid) {
            if (cell.building) {
                this.drawBuilding(cell, room);
            }
        }

        // 绘制门
        this.drawDoor(room);

        // 房间标签
        if (room.owner) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(room.owner.name, room.x + room.width / 2, room.y + room.height - 8);
        }

        // 选择高亮
        if (this.state === GAME_STATES.SELECTING && !room.owner) {
            ctx.fillStyle = '#4CAF5033';
            ctx.fillRect(room.x, room.y, room.width, room.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('点击选择', room.x + room.width / 2, room.y + room.height / 2);
        }
    }

    drawBed(room) {
        const ctx = this.ctx;
        const cell = room.grid[0];
        const bedConfig = BED_CONFIG[room.bedLevel];

        // 床底
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(cell.x - 18, cell.y - 12, 36, 24);
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(cell.x - 16, cell.y - 10, 32, 18);
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(cell.x - 14, cell.y - 8, 14, 14);

        // 睡觉的人
        if (room.isResting && room.owner) {
            ctx.fillStyle = '#ffdbac';
            ctx.beginPath();
            ctx.arc(cell.x - 7, cell.y - 1, 6, 0, Math.PI * 2);
            ctx.fill();

            // Zzz
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.fillText('💤', cell.x + 10, cell.y - 15);
        }

        // 床等级
        if (room.bedLevel > 0) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Lv' + (room.bedLevel + 1), cell.x, cell.y + 20);
        }
    }

    drawBuilding(cell, room) {
        const ctx = this.ctx;
        const building = cell.building;

        ctx.fillStyle = '#2d4a5e88';
        ctx.fillRect(cell.x - 20, cell.y - 20, 40, 40);

        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(building.icon, cell.x, cell.y + 8);
    }

    drawDoor(room) {
        const ctx = this.ctx;
        const doorWidth = room.doorSide === 'left' || room.doorSide === 'right' ? 15 : 50;
        const doorHeight = room.doorSide === 'left' || room.doorSide === 'right' ? 50 : 15;

        let doorX = room.doorX - doorWidth / 2;
        let doorY = room.doorY - doorHeight / 2;

        if (room.doorSide === 'bottom') doorY = room.doorY - doorHeight;
        if (room.doorSide === 'top') doorY = room.doorY;
        if (room.doorSide === 'left') doorX = room.doorX - doorWidth;
        if (room.doorSide === 'right') doorX = room.doorX;

        // 门框
        ctx.fillStyle = COLORS.doorFrame;
        ctx.fillRect(doorX - 3, doorY - 3, doorWidth + 6, doorHeight + 6);

        // 门血量颜色
        const healthPercent = room.doorHP / room.doorMaxHP;
        ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(doorX, doorY, doorWidth * healthPercent, doorHeight);

        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(doorX + doorWidth * healthPercent, doorY, doorWidth * (1 - healthPercent), doorHeight);

        // 门等级
        if (room.doorLevel > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Lv' + (room.doorLevel + 1), room.doorX, room.doorY + (room.doorSide === 'bottom' ? 20 : -8));
        }
    }

    drawGhost(ghost) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(ghost.x, ghost.y);

        // 根据状态显示不同颜色
        let color = '#7cb342';
        if (ghost.state === GHOST_STATES.ATTACK) {
            color = '#e53935';
        } else if (ghost.state === GHOST_STATES.RETREAT) {
            color = '#9e9e9e';
        }

        // 身体
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛
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

        // 血条
        const hpPercent = ghost.hp / ghost.maxHP;
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -35, 40, 6);
        ctx.fillStyle = hpPercent > 0.5 ? '#4CAF50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(-20, -35, 40 * hpPercent, 6);

        // 攻击指示
        if (ghost.state === GHOST_STATES.ATTACK && ghost.attackTimer > ghost.attackSpeed * 0.7) {
            ctx.fillStyle = '#f44336';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💢', 0, -45);
        }

        ctx.restore();
    }

    drawProjectile(proj) {
        const ctx = this.ctx;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawTimer() {
        const ctx = this.ctx;

        if (this.state === GAME_STATES.SELECTING) {
            const time = Math.ceil(this.timer);

            ctx.fillStyle = '#ff000088';
            ctx.beginPath();
            ctx.arc(CANVAS_WIDTH / 2, 300, 40, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(time > 0 ? time : 0, CANVAS_WIDTH / 2, 312);
        }
    }

    drawFloatingTexts() {
        const ctx = this.ctx;
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.globalAlpha = ft.life;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;
    }

    drawSelectionHints() {
        const ctx = this.ctx;
        const time = Date.now() / 1000;

        for (let i = 1; i < this.players.length; i++) {
            const player = this.players[i];
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
}

// ========== 初始化 ==========
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new Game();
    game.init();
});
