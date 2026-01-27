// 梦魇宿舍 - 躺平塔防 H5单机版
// 可直接在浏览器运行

// ========== 配置 ==========
let CANVAS_WIDTH = 450;
let CANVAS_HEIGHT = 750;
const GRID_SIZE = 50;

const COLORS = {
    floor: '#4a6fa5',
    floorLight: '#5d8ac7',
    corridor: '#1a2530',
    corridorFloor: '#2d4a5e',
    doorFrame: '#3d5c6e',
    roomBorder: '#1a2530'
};

const GAME_STATES = { SELECTING: 0, PLAYING: 1, GAMEOVER: 2, VICTORY: 3 };
const GHOST_STATES = { IDLE: 0, ATTACK: 1, RETREAT: 2 };

const BED_CONFIG = [
    { name: '破旧木床', goldPerSec: 2, cost: 0 },
    { name: '席梦思', goldPerSec: 4, cost: 50 },
    { name: '智能按摩床', goldPerSec: 8, cost: 120 },
    { name: '豪华太空舱', goldPerSec: 15, cost: 250 }
];

const DOOR_CONFIG = [
    { name: '木门', hp: 100, armor: 0, cost: 0 },
    { name: '铁门', hp: 180, armor: 5, cost: 30 },
    { name: '钢门', hp: 300, armor: 15, cost: 80 },
    { name: '钛合金门', hp: 500, armor: 30, cost: 200 }
];

const BUILDINGS = {
    turret: { name: '弹弓炮台', icon: '🔫', cost: 50, damage: 5, range: 150, attackSpeed: 1.5 },
    generator: { name: '发电机', icon: '⚡', cost: 80, bonus: 0.3 },
    trap: { name: '陷阱', icon: '🪤', cost: 40, damage: 2 },
    plant: { name: '摇钱草', icon: '🌱', cost: 30, goldPerSec: 1 }
};

const CONFIG = {
    selectionTime: 25,
    ghostDelay: 30,
    survivalTime: 180,
    ghostSpawnInterval: 15,
    difficultyScale: 0.1,
    ghostBaseHP: 50,
    ghostBaseDamage: 10,
    ghostSpeed: 40,
    ghostAttackSpeed: 1.5,
    retreatThreshold: 0.2,
    healRate: 20
};

const ROOM_LAYOUTS = [
    { id: 1, x: 10, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
    { id: 2, x: 310, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
    { id: 3, x: 10, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'right' },
    { id: 4, x: 310, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'left' },
    { id: 5, x: 10, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' },
    { id: 6, x: 260, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' }
];

const AI_NAMES = [
    { name: '躺平爸爸', icon: '👴' },
    { name: '躺平皇帝', icon: '👑' },
    { name: '躺平黄金', icon: '💰' },
    { name: '躺平王者', icon: '🎮' }
];

const DEATH_MESSAGES = ['被猛鬼抓走了', '的门被破坏了', '惨遭淘汰', '躺平失败了'];

// ========== 存档管理 ==========
const SaveManager = {
    key: 'nightmare_dorm_save',
    data: null,

    load() {
        try {
            const str = localStorage.getItem(this.key);
            this.data = str ? JSON.parse(str) : this.getDefault();
        } catch (e) {
            this.data = this.getDefault();
        }
        return this.data;
    },

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {}
    },

    getDefault() {
        return {
            beeCoins: 0,
            talents: { startGold: 0, doorHP: 0 },
            stats: { totalGames: 0, totalKills: 0, bestTime: 0 }
        };
    },

    getTalentCost(type) {
        return type === 'startGold' ? 10 + this.data.talents.startGold * 5 : 15 + this.data.talents.doorHP * 8;
    },

    upgradeTalent(type) {
        const cost = this.getTalentCost(type);
        if (this.data.beeCoins >= cost) {
            this.data.beeCoins -= cost;
            this.data.talents[type]++;
            this.save();
            return true;
        }
        return false;
    }
};

// ========== 房间类 ==========
class Room {
    constructor(layout) {
        Object.assign(this, layout);
        this.owner = null;
        this.ownerName = '';
        this.isPlayerRoom = false;
        this.doorLevel = 0;
        this.doorHP = DOOR_CONFIG[0].hp + SaveManager.data.talents.doorHP * 20;
        this.doorMaxHP = this.doorHP;
        this.doorArmor = 0;
        this.bedLevel = 0;
        this.isResting = false;
        this.grid = [];
        this.buildings = [];
        this.turrets = [];
        this.initGrid();
        this.calcDoorPos();
    }

    initGrid() {
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                this.grid.push({
                    col: c, row: r,
                    x: this.x + 15 + c * GRID_SIZE + GRID_SIZE / 2,
                    y: this.y + 15 + r * GRID_SIZE + GRID_SIZE / 2,
                    building: null
                });
            }
        }
    }

    calcDoorPos() {
        switch (this.doorSide) {
            case 'bottom': this.doorX = this.x + this.width / 2; this.doorY = this.y + this.height; break;
            case 'top': this.doorX = this.x + this.width / 2; this.doorY = this.y; break;
            case 'left': this.doorX = this.x; this.doorY = this.y + this.height / 2; break;
            case 'right': this.doorX = this.x + this.width; this.doorY = this.y + this.height / 2; break;
        }
    }

    takeDamage(dmg) {
        const actual = Math.max(1, dmg - this.doorArmor);
        this.doorHP = Math.max(0, this.doorHP - actual);
        return this.doorHP <= 0;
    }

    upgradeDoor() {
        if (this.doorLevel < DOOR_CONFIG.length - 1) {
            this.doorLevel++;
            const cfg = DOOR_CONFIG[this.doorLevel];
            this.doorMaxHP = cfg.hp + SaveManager.data.talents.doorHP * 20;
            this.doorHP = this.doorMaxHP;
            this.doorArmor = cfg.armor;
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

    getGoldPerSec() {
        let gold = this.isResting ? BED_CONFIG[this.bedLevel].goldPerSec : 0;
        for (const b of this.buildings) {
            if (b.type === 'plant') gold += b.goldPerSec;
        }
        return gold;
    }

    getDPS() {
        let dps = 0;
        for (const t of this.turrets) dps += t.damage / t.attackSpeed;
        return dps;
    }

    getEmptyCell() {
        for (let i = 1; i < this.grid.length; i++) {
            if (!this.grid[i].building) return this.grid[i];
        }
        return null;
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
    }
}

// ========== 猛鬼类 ==========
class Ghost {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.spawnX = x;
        this.spawnY = y;
        const scale = 1 + wave * CONFIG.difficultyScale;
        this.maxHP = Math.floor(CONFIG.ghostBaseHP * scale);
        this.hp = this.maxHP;
        this.damage = Math.floor(CONFIG.ghostBaseDamage * scale);
        this.speed = CONFIG.ghostSpeed;
        this.state = GHOST_STATES.IDLE;
        this.targetRoom = null;
        this.attackTimer = 0;
        this.idleTimer = 0;
        this.idleTarget = { x: x, y: y + 100 };
    }

    update(dt, rooms) {
        switch (this.state) {
            case GHOST_STATES.IDLE: this.updateIdle(dt, rooms); break;
            case GHOST_STATES.ATTACK: return this.updateAttack(dt);
            case GHOST_STATES.RETREAT: this.updateRetreat(dt); break;
        }
        return false;
    }

    updateIdle(dt, rooms) {
        this.idleTimer += dt;
        const dx = this.idleTarget.x - this.x, dy = this.idleTarget.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
            this.x += (dx / dist) * this.speed * 0.5 * dt;
            this.y += (dy / dist) * this.speed * 0.5 * dt;
        } else {
            this.idleTarget = { x: 150 + Math.random() * 150, y: 200 + Math.random() * 300 };
        }
        if (this.idleTimer >= 3 + Math.random() * 2) {
            const valid = rooms.filter(r => r.owner && r.doorHP > 0);
            if (valid.length > 0) {
                this.targetRoom = valid[Math.floor(Math.random() * valid.length)];
                this.state = GHOST_STATES.ATTACK;
            }
        }
    }

    updateAttack(dt) {
        if (!this.targetRoom || this.targetRoom.doorHP <= 0) {
            this.state = GHOST_STATES.IDLE;
            this.idleTimer = 0;
            return false;
        }
        if (this.hp / this.maxHP < CONFIG.retreatThreshold) {
            this.state = GHOST_STATES.RETREAT;
            return false;
        }
        const room = this.targetRoom;
        let tx = room.doorX, ty = room.doorY;
        if (room.doorSide === 'top') ty -= 30;
        else if (room.doorSide === 'bottom') ty += 30;
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 40) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else {
            this.attackTimer += dt;
            if (this.attackTimer >= CONFIG.ghostAttackSpeed) {
                this.attackTimer = 0;
                if (this.targetRoom.takeDamage(this.damage)) {
                    const broken = this.targetRoom;
                    this.targetRoom = null;
                    this.state = GHOST_STATES.IDLE;
                    this.idleTimer = 0;
                    return broken;
                }
            }
        }
        return false;
    }

    updateRetreat(dt) {
        const dx = this.spawnX - this.x, dy = this.spawnY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
            this.x += (dx / dist) * this.speed * 1.5 * dt;
            this.y += (dy / dist) * this.speed * 1.5 * dt;
        } else {
            this.hp += CONFIG.healRate * dt;
            if (this.hp >= this.maxHP * 0.8) {
                this.hp = Math.min(this.hp, this.maxHP);
                this.state = GHOST_STATES.IDLE;
                this.idleTimer = 0;
            }
        }
    }

    takeDamage(dmg) {
        this.hp -= dmg;
        return this.hp <= 0;
    }
}

// ========== AI玩家类 ==========
class AIPlayer {
    constructor(index) {
        this.id = index + 1;
        this.name = AI_NAMES[index].name;
        this.icon = AI_NAMES[index].icon;
        this.room = null;
        this.alive = true;
        this.gold = 0;
        this.upgradeTimer = 0;
    }

    update(dt) {
        if (!this.alive || !this.room) return;
        this.gold += this.room.getGoldPerSec() * dt;
        this.upgradeTimer += dt;
        if (this.upgradeTimer >= 2) {
            this.upgradeTimer = 0;
            this.doUpgrade();
        }
    }

    doUpgrade() {
        const room = this.room;
        if (room.doorHP < room.doorMaxHP * 0.5 && room.doorLevel < DOOR_CONFIG.length - 1) {
            const cost = DOOR_CONFIG[room.doorLevel + 1].cost;
            if (this.gold >= cost) { this.gold -= cost; room.upgradeDoor(); return; }
        }
        if (room.bedLevel < BED_CONFIG.length - 1) {
            const cost = BED_CONFIG[room.bedLevel + 1].cost;
            if (this.gold >= cost) { this.gold -= cost; room.upgradeBed(); return; }
        }
        const cell = room.getEmptyCell();
        if (cell && this.gold >= BUILDINGS.turret.cost) {
            this.gold -= BUILDINGS.turret.cost;
            const turret = { type: 'turret', ...BUILDINGS.turret, attackTimer: 0 };
            cell.building = turret;
            room.buildings.push(turret);
            room.turrets.push(turret);
        }
    }

    die() {
        this.alive = false;
        return `${this.icon} ${this.name} ${DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]}`;
    }
}

// ========== 游戏主类 ==========
class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.state = GAME_STATES.SELECTING;
        this.rooms = [];
        this.ghosts = [];
        this.aiPlayers = [];
        this.projectiles = [];
        this.floatingTexts = [];
        this.gold = 0;
        this.timer = 0;
        this.survivalTime = 0;
        this.wave = 0;
        this.kills = 0;
        this.ghostsActive = false;
        this.ghostSpawnTimer = 0;
        this.goldTimer = 0;
        this.playerRoom = null;
        this.selectedCell = null;
        this.upgradeType = null;
        this.lastTime = 0;
        this.earnedBee = 0;
    }

    init() {
        SaveManager.load();
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('click', e => this.onClick(e));
        this.canvas.addEventListener('touchstart', e => this.onTouch(e), { passive: false });
        this.bindUI();
        this.updateTalentUI();
    }

    resize() {
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        CANVAS_WIDTH = rect.width;
        CANVAS_HEIGHT = rect.height - 60;
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    bindUI() {
        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => location.reload();
        document.getElementById('revive-btn').onclick = () => this.revive();
        document.getElementById('double-btn').onclick = () => this.doubleReward();
        document.getElementById('close-build').onclick = () => this.closeBuildMenu();
        document.getElementById('close-upgrade').onclick = () => this.closeUpgradePanel();
        document.getElementById('upgrade-btn').onclick = () => this.doUpgrade();
        document.getElementById('btn-bed').onclick = () => this.openUpgradePanel('bed');
        document.getElementById('btn-door').onclick = () => this.openUpgradePanel('door');
        document.getElementById('btn-build').onclick = () => this.openBuildMenu();
        document.querySelectorAll('.build-item').forEach(btn => {
            btn.onclick = () => this.buildItem(btn.dataset.type);
        });
        document.querySelectorAll('.talent-btn').forEach(btn => {
            btn.onclick = () => {
                if (SaveManager.upgradeTalent(btn.dataset.talent)) this.updateTalentUI();
            };
        });
    }

    updateTalentUI() {
        document.getElementById('bee-coins').textContent = SaveManager.data.beeCoins;
        document.getElementById('talent-gold-level').textContent = SaveManager.data.talents.startGold;
        document.getElementById('talent-gold-cost').textContent = SaveManager.getTalentCost('startGold');
        document.getElementById('talent-door-level').textContent = SaveManager.data.talents.doorHP;
        document.getElementById('talent-door-cost').textContent = SaveManager.getTalentCost('doorHP');
    }

    start() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        this.state = GAME_STATES.SELECTING;
        this.rooms = ROOM_LAYOUTS.map(l => new Room(l));
        this.ghosts = [];
        this.aiPlayers = [];
        this.projectiles = [];
        this.floatingTexts = [];
        this.gold = 10 + SaveManager.data.talents.startGold * 5;
        this.timer = CONFIG.selectionTime;
        this.survivalTime = 0;
        this.wave = 0;
        this.kills = 0;
        this.ghostsActive = false;
        this.ghostSpawnTimer = 0;
        this.goldTimer = 0;
        this.playerRoom = null;

        const available = [...this.rooms];
        for (let i = 0; i < 4 && available.length > 1; i++) {
            const ai = new AIPlayer(i);
            const idx = Math.floor(Math.random() * available.length);
            ai.room = available[idx];
            ai.room.owner = ai;
            ai.room.ownerName = ai.name;
            ai.room.isResting = true;
            available.splice(idx, 1);
            this.aiPlayers.push(ai);
        }
        this.updatePlayerIcons();
        this.loop();
    }

    updatePlayerIcons() {
        const container = document.getElementById('player-icons');
        container.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-icon active';
        playerDiv.textContent = '😊';
        container.appendChild(playerDiv);
        for (const ai of this.aiPlayers) {
            const div = document.createElement('div');
            div.className = 'player-icon' + (ai.alive ? '' : ' dead');
            div.textContent = ai.icon;
            container.appendChild(div);
        }
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.handleClick(x, y);
    }

    onTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
        this.handleClick(x, y);
    }

    handleClick(x, y) {
        if (this.state === GAME_STATES.SELECTING) {
            for (const room of this.rooms) {
                if (!room.owner && room.contains(x, y)) {
                    this.selectRoom(room);
                    return;
                }
            }
        } else if (this.state === GAME_STATES.PLAYING && this.playerRoom) {
            if (this.playerRoom.contains(x, y)) {
                for (const cell of this.playerRoom.grid) {
                    if (Math.abs(x - cell.x) < GRID_SIZE / 2 && Math.abs(y - cell.y) < GRID_SIZE / 2) {
                        if (cell === this.playerRoom.grid[0]) {
                            this.openUpgradePanel('bed');
                        } else if (!cell.building) {
                            this.selectedCell = cell;
                            this.openBuildMenu();
                        }
                        return;
                    }
                }
            }
        }
    }

    selectRoom(room) {
        room.owner = { isPlayer: true };
        room.ownerName = '你';
        room.isPlayerRoom = true;
        room.isResting = true;
        this.playerRoom = room;
        this.state = GAME_STATES.PLAYING;
        this.timer = CONFIG.survivalTime;
        this.addFloatingText(room.doorX, room.doorY - 30, '选择成功!', '#4CAF50');
        this.showBroadcast('你选择了房间');
    }

    openBuildMenu() {
        if (!this.playerRoom) return;
        document.getElementById('build-menu').classList.remove('hidden');
    }

    closeBuildMenu() {
        document.getElementById('build-menu').classList.add('hidden');
        this.selectedCell = null;
    }

    buildItem(type) {
        if (!this.playerRoom) return;
        if (!this.selectedCell) this.selectedCell = this.playerRoom.getEmptyCell();
        if (!this.selectedCell || this.selectedCell.building) { this.closeBuildMenu(); return; }
        const cfg = BUILDINGS[type];
        if (this.gold < cfg.cost) {
            this.addFloatingText(CANVAS_WIDTH / 2, 300, '金币不足!', '#ff6b6b');
            return;
        }
        this.gold -= cfg.cost;
        const building = { type, ...cfg, attackTimer: 0 };
        this.selectedCell.building = building;
        this.playerRoom.buildings.push(building);
        if (type === 'turret') this.playerRoom.turrets.push(building);
        this.addFloatingText(this.selectedCell.x, this.selectedCell.y - 20, '-' + cfg.cost, '#ff6b6b');
        this.closeBuildMenu();
    }

    openUpgradePanel(type) {
        if (!this.playerRoom) return;
        this.upgradeType = type;
        const panel = document.getElementById('upgrade-panel');
        panel.classList.remove('hidden');
        const room = this.playerRoom;
        if (type === 'bed') {
            const cur = BED_CONFIG[room.bedLevel];
            const next = BED_CONFIG[room.bedLevel + 1];
            document.getElementById('upgrade-icon').textContent = '🛏️';
            document.getElementById('upgrade-name').textContent = cur.name;
            document.getElementById('upgrade-desc').textContent = `产出: ${cur.goldPerSec}金币/秒`;
            if (next) {
                document.getElementById('upgrade-next').textContent = `下一级: ${next.name} (${next.goldPerSec}金币/秒)`;
                document.getElementById('upgrade-cost').textContent = next.cost;
                document.getElementById('upgrade-btn').disabled = this.gold < next.cost;
            } else {
                document.getElementById('upgrade-next').textContent = '已满级';
                document.getElementById('upgrade-btn').disabled = true;
            }
        } else {
            const cur = DOOR_CONFIG[room.doorLevel];
            const next = DOOR_CONFIG[room.doorLevel + 1];
            document.getElementById('upgrade-icon').textContent = '🚪';
            document.getElementById('upgrade-name').textContent = cur.name;
            document.getElementById('upgrade-desc').textContent = `血量: ${Math.floor(room.doorHP)}/${room.doorMaxHP} 护甲: ${cur.armor}`;
            if (next) {
                document.getElementById('upgrade-next').textContent = `下一级: ${next.name} (HP:${next.hp} 护甲:${next.armor})`;
                document.getElementById('upgrade-cost').textContent = next.cost;
                document.getElementById('upgrade-btn').disabled = this.gold < next.cost;
            } else {
                document.getElementById('upgrade-next').textContent = '已满级';
                document.getElementById('upgrade-btn').disabled = true;
            }
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
        } else {
            const next = DOOR_CONFIG[room.doorLevel + 1];
            if (next && this.gold >= next.cost) {
                this.gold -= next.cost;
                room.upgradeDoor();
                this.addFloatingText(room.doorX, room.doorY - 20, '门升级!', '#4CAF50');
            }
        }
        this.closeUpgradePanel();
    }

    showBroadcast(msg) {
        const container = document.getElementById('broadcast-container');
        const div = document.createElement('div');
        div.className = 'broadcast-msg';
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -30 });
    }

    loop(time = 0) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.update(dt);
        this.render();
        if (this.state !== GAME_STATES.GAMEOVER && this.state !== GAME_STATES.VICTORY) {
            requestAnimationFrame(t => this.loop(t));
        }
    }

    update(dt) {
        this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.y += ft.vy * dt;
            ft.life -= dt;
            return ft.life > 0;
        });

        if (this.state === GAME_STATES.SELECTING) {
            this.timer -= dt;
            document.getElementById('wave-info').textContent = `选择房间: ${Math.ceil(this.timer)}秒`;
            if (this.timer <= 0) {
                const avail = this.rooms.filter(r => !r.owner);
                if (avail.length > 0) this.selectRoom(avail[Math.floor(Math.random() * avail.length)]);
            }
            return;
        }

        if (this.state !== GAME_STATES.PLAYING) return;

        this.survivalTime += dt;
        this.timer -= dt;

        const remain = Math.max(0, Math.ceil(this.timer));
        if (this.ghostsActive) {
            document.getElementById('wave-info').textContent = `波次${this.wave} | 剩余${remain}秒`;
        } else {
            const ghostTime = Math.ceil(CONFIG.ghostDelay - this.survivalTime);
            document.getElementById('wave-info').textContent = `准备阶段 | 👻${ghostTime}秒后出现`;
        }

        if (this.timer <= 0) { this.victory(); return; }

        if (!this.ghostsActive && this.survivalTime >= CONFIG.ghostDelay) {
            this.ghostsActive = true;
            this.wave = 1;
            this.spawnGhost();
            this.showBroadcast('👻 猛鬼出现了!');
        }

        if (this.ghostsActive) {
            this.ghostSpawnTimer += dt;
            if (this.ghostSpawnTimer >= CONFIG.ghostSpawnInterval) {
                this.ghostSpawnTimer = 0;
                this.wave++;
                this.spawnGhost();
                if (this.wave % 3 === 0) this.spawnGhost();
            }
        }

        this.goldTimer += dt;
        if (this.goldTimer >= 1) {
            this.goldTimer = 0;
            if (this.playerRoom && this.playerRoom.isResting) {
                const gps = this.playerRoom.getGoldPerSec();
                this.gold += gps;
                if (gps > 0) this.addFloatingText(this.playerRoom.grid[0].x + 15, this.playerRoom.grid[0].y - 15, '+' + gps, '#ffd700');
            }
        }

        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const ghost = this.ghosts[i];
            const brokenRoom = ghost.update(dt, this.rooms);
            if (brokenRoom) {
                if (brokenRoom.isPlayerRoom) { this.gameOver(); return; }
                const ai = this.aiPlayers.find(a => a.room === brokenRoom);
                if (ai) {
                    this.showBroadcast(ai.die());
                    this.updatePlayerIcons();
                }
            }
            if (ghost.hp <= 0) {
                this.ghosts.splice(i, 1);
                this.kills++;
                const reward = 5 + this.wave;
                this.gold += reward;
                this.addFloatingText(ghost.x, ghost.y - 20, '+' + reward, '#ffd700');
            }
        }

        for (const ai of this.aiPlayers) ai.update(dt);

        if (this.playerRoom) {
            for (const turret of this.playerRoom.turrets) {
                turret.attackTimer = (turret.attackTimer || 0) + dt;
                if (turret.attackTimer >= turret.attackSpeed) {
                    const cell = this.playerRoom.grid.find(c => c.building === turret);
                    if (cell) {
                        let nearest = null, nearestDist = turret.range;
                        for (const ghost of this.ghosts) {
                            const dist = Math.hypot(ghost.x - cell.x, ghost.y - cell.y);
                            if (dist < nearestDist) { nearestDist = dist; nearest = ghost; }
                        }
                        if (nearest) {
                            turret.attackTimer = 0;
                            this.projectiles.push({ x: cell.x, y: cell.y, target: nearest, damage: turret.damage, speed: 300 });
                        }
                    }
                }
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 15) {
                p.target.takeDamage(p.damage);
                this.projectiles.splice(i, 1);
            } else {
                p.x += (dx / dist) * p.speed * dt;
                p.y += (dy / dist) * p.speed * dt;
            }
        }

        document.getElementById('gold-amount').textContent = Math.floor(this.gold);
        document.getElementById('dps-amount').textContent = this.playerRoom ? this.playerRoom.getDPS().toFixed(1) : '0';
    }

    spawnGhost() {
        const spawns = [{ x: CANVAS_WIDTH / 2, y: -50 }, { x: 50, y: CANVAS_HEIGHT / 2 }, { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT / 2 }];
        const s = spawns[Math.floor(Math.random() * spawns.length)];
        this.ghosts.push(new Ghost(s.x, s.y, this.wave));
    }

    gameOver() {
        this.state = GAME_STATES.GAMEOVER;
        this.showResult(false);
    }

    victory() {
        this.state = GAME_STATES.VICTORY;
        this.showResult(true);
    }

    showResult(win) {
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.remove('hidden');
        this.earnedBee = Math.floor(this.survivalTime / 10) + this.kills;
        document.getElementById('result-title').textContent = win ? '🎉 胜利!' : '💀 游戏结束';
        document.getElementById('result-title').style.color = win ? '#4CAF50' : '#ff6b6b';
        document.getElementById('result-message').textContent = win ? '你成功存活到了最后!' : '你的门被猛鬼破坏了!';
        document.getElementById('final-time').textContent = Math.floor(this.survivalTime);
        document.getElementById('final-kills').textContent = this.kills;
        document.getElementById('final-gold').textContent = Math.floor(this.gold);
        document.getElementById('final-bee').textContent = this.earnedBee;
        SaveManager.data.beeCoins += this.earnedBee;
        SaveManager.data.stats.totalGames++;
        SaveManager.data.stats.totalKills += this.kills;
        if (this.survivalTime > SaveManager.data.stats.bestTime) SaveManager.data.stats.bestTime = this.survivalTime;
        SaveManager.save();
    }

    revive() {
        document.getElementById('result-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        this.state = GAME_STATES.PLAYING;
        this.playerRoom.doorHP = this.playerRoom.doorMaxHP;
        this.showBroadcast('复活成功!');
        this.loop();
    }

    doubleReward() {
        SaveManager.data.beeCoins += this.earnedBee;
        SaveManager.save();
        document.getElementById('final-bee').textContent = this.earnedBee * 2;
        document.getElementById('double-btn').disabled = true;
        document.getElementById('double-btn').textContent = '已领取';
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = COLORS.corridor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = COLORS.corridorFloor;
        ctx.fillRect(0, 230, CANVAS_WIDTH, 100);
        ctx.fillRect(0, 530, CANVAS_WIDTH, 30);
        ctx.fillRect(150, 60, 150, 650);

        for (const room of this.rooms) this.drawRoom(room);
        for (const ghost of this.ghosts) this.drawGhost(ghost);
        for (const p of this.projectiles) {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.state === GAME_STATES.SELECTING) {
            ctx.fillStyle = '#ff000088';
            ctx.beginPath();
            ctx.arc(CANVAS_WIDTH / 2, 300, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.timer), CANVAS_WIDTH / 2, 312);
        }

        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.globalAlpha = ft.life;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;
    }

    drawRoom(room) {
        const ctx = this.ctx;
        ctx.fillStyle = COLORS.floor;
        ctx.fillRect(room.x, room.y, room.width, room.height);

        ctx.fillStyle = COLORS.floorLight;
        for (let r = 0; r < Math.ceil(room.height / GRID_SIZE); r++) {
            for (let c = 0; c < Math.ceil(room.width / GRID_SIZE); c++) {
                if ((r + c) % 2 === 0) ctx.fillRect(room.x + c * GRID_SIZE, room.y + r * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }

        ctx.strokeStyle = '#ffffff22';
        ctx.fillStyle = '#ffffff33';
        for (const cell of room.grid) {
            ctx.strokeRect(cell.x - GRID_SIZE / 2 + 5, cell.y - GRID_SIZE / 2 + 5, GRID_SIZE - 10, GRID_SIZE - 10);
            if (!cell.building && cell !== room.grid[0]) {
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('+', cell.x, cell.y + 5);
            }
        }

        ctx.strokeStyle = COLORS.roomBorder;
        ctx.lineWidth = 4;
        ctx.strokeRect(room.x, room.y, room.width, room.height);

        // Bed
        const bed = room.grid[0];
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(bed.x - 18, bed.y - 12, 36, 24);
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(bed.x - 16, bed.y - 10, 32, 18);
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(bed.x - 14, bed.y - 8, 14, 14);
        if (room.isResting && room.owner) {
            ctx.fillStyle = '#ffdbac';
            ctx.beginPath();
            ctx.arc(bed.x - 7, bed.y - 1, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.fillText('💤', bed.x + 10, bed.y - 15);
        }
        if (room.bedLevel > 0) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Lv' + (room.bedLevel + 1), bed.x, bed.y + 20);
        }

        // Buildings
        for (const cell of room.grid) {
            if (cell.building && cell !== room.grid[0]) {
                ctx.fillStyle = '#2d4a5e88';
                ctx.fillRect(cell.x - 20, cell.y - 20, 40, 40);
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(cell.building.icon, cell.x, cell.y + 8);
            }
        }

        // Door
        const dw = room.doorSide === 'left' || room.doorSide === 'right' ? 15 : 50;
        const dh = room.doorSide === 'left' || room.doorSide === 'right' ? 50 : 15;
        let dx = room.doorX - dw / 2, dy = room.doorY - dh / 2;
        if (room.doorSide === 'bottom') dy = room.doorY - dh;
        if (room.doorSide === 'top') dy = room.doorY;
        if (room.doorSide === 'left') dx = room.doorX - dw;
        if (room.doorSide === 'right') dx = room.doorX;

        ctx.fillStyle = COLORS.doorFrame;
        ctx.fillRect(dx - 3, dy - 3, dw + 6, dh + 6);
        const hp = room.doorHP / room.doorMaxHP;
        ctx.fillStyle = hp > 0.5 ? '#4CAF50' : hp > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(dx, dy, dw * hp, dh);
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(dx + dw * hp, dy, dw * (1 - hp), dh);
        if (room.doorLevel > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Lv' + (room.doorLevel + 1), room.doorX, room.doorY + (room.doorSide === 'bottom' ? 20 : -8));
        }

        if (room.owner) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(room.ownerName, room.x + room.width / 2, room.y + room.height - 8);
        }

        if (this.state === GAME_STATES.SELECTING && !room.owner) {
            ctx.fillStyle = '#4CAF5033';
            ctx.fillRect(room.x, room.y, room.width, room.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('点击选择', room.x + room.width / 2, room.y + room.height / 2);
        }
    }

    drawGhost(ghost) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(ghost.x, ghost.y);

        let color = '#7cb342';
        if (ghost.state === GHOST_STATES.ATTACK) color = '#e53935';
        else if (ghost.state === GHOST_STATES.RETREAT) color = '#9e9e9e';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

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

        const hp = ghost.hp / ghost.maxHP;
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -35, 40, 6);
        ctx.fillStyle = hp > 0.5 ? '#4CAF50' : hp > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(-20, -35, 40 * hp, 6);

        if (ghost.state === GHOST_STATES.ATTACK && ghost.attackTimer > CONFIG.ghostAttackSpeed * 0.7) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💢', 0, -45);
        }

        ctx.restore();
    }
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});
