/**
 * 梦魇宿舍 - 游戏管理器
 * 核心游戏逻辑控制
 */

import { _decorator, Component, Node, Vec3, instantiate, Prefab } from 'cc';
import {
    GameState,
    GAME_CONFIG,
    ROOM_LAYOUTS,
    BUILDING_CONFIGS,
    BuildingConfig
} from '../data/GameConfig';
import { SaveManager } from '../data/SaveManager';
import { Room, GridCell } from './Room';
import { Ghost } from './Ghost';
import { AIPlayer } from './AIPlayer';
import { GameUI } from '../ui/GameUI';

const { ccclass, property } = _decorator;

// 投射物数据
interface Projectile {
    node: Node;
    target: Ghost;
    damage: number;
    speed: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
    // ========== 引用 ==========
    @property(Node)
    public roomContainer: Node | null = null;

    @property(Node)
    public ghostContainer: Node | null = null;

    @property(Node)
    public projectileContainer: Node | null = null;

    @property(Prefab)
    public roomPrefab: Prefab | null = null;

    @property(Prefab)
    public ghostPrefab: Prefab | null = null;

    @property(Prefab)
    public projectilePrefab: Prefab | null = null;

    @property(GameUI)
    public gameUI: GameUI | null = null;

    // ========== 游戏状态 ==========
    private _state: GameState = GameState.SELECTING;
    private _gold: number = 0;
    private _timer: number = 0;
    private _survivalTime: number = 0;
    private _wave: number = 0;
    private _kills: number = 0;

    // ========== 游戏对象 ==========
    private _rooms: Room[] = [];
    private _ghosts: Ghost[] = [];
    private _aiPlayers: AIPlayer[] = [];
    private _projectiles: Projectile[] = [];

    // ========== 玩家数据 ==========
    private _playerRoom: Room | null = null;
    private _selectedCell: GridCell | null = null;

    // ========== 计时器 ==========
    private _ghostsActive: boolean = false;
    private _ghostSpawnTimer: number = 0;
    private _goldTickTimer: number = 0;

    // ========== 单例 ==========
    private static _instance: GameManager | null = null;

    public static getInstance(): GameManager | null {
        return GameManager._instance;
    }

    // ========== 生命周期 ==========

    protected onLoad(): void {
        GameManager._instance = this;
    }

    protected onDestroy(): void {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
    }

    protected update(dt: number): void {
        if (this._state === GameState.PLAYING || this._state === GameState.SELECTING) {
            this.gameUpdate(dt);
        }
    }

    // ========== 游戏流程 ==========

    /**
     * 开始新游戏
     */
    public startGame(): void {
        this.resetGame();

        // 应用天赋加成
        const saveManager = SaveManager.getInstance();
        this._gold = 10 + saveManager.getStartGoldBonus();

        this._state = GameState.SELECTING;
        this._timer = GAME_CONFIG.selectionTime;

        this.initRooms();
        this.initAIPlayers();

        this.gameUI?.showGameScreen();
        this.gameUI?.updateGold(this._gold);
    }

    /**
     * 重置游戏状态
     */
    private resetGame(): void {
        this._state = GameState.SELECTING;
        this._gold = 0;
        this._timer = 0;
        this._survivalTime = 0;
        this._wave = 0;
        this._kills = 0;
        this._ghostsActive = false;
        this._ghostSpawnTimer = 0;
        this._goldTickTimer = 0;
        this._playerRoom = null;
        this._selectedCell = null;

        // 清理对象
        this.clearGhosts();
        this.clearProjectiles();

        for (const room of this._rooms) {
            room.reset();
        }

        for (const ai of this._aiPlayers) {
            ai.reset();
        }
    }

    /**
     * 初始化房间
     */
    private initRooms(): void {
        if (this._rooms.length > 0) {
            // 房间已存在，只需重置
            return;
        }

        if (!this.roomPrefab || !this.roomContainer) {
            console.error('GameManager: 缺少房间预制体或容器');
            return;
        }

        for (const layout of ROOM_LAYOUTS) {
            const roomNode = instantiate(this.roomPrefab);
            roomNode.setParent(this.roomContainer);
            roomNode.setPosition(layout.x, layout.y, 0);

            const room = roomNode.getComponent(Room);
            if (room) {
                room.init(layout);
                this._rooms.push(room);
            }
        }
    }

    /**
     * 初始化AI玩家
     */
    private initAIPlayers(): void {
        // 获取可用房间
        const availableRooms = [...this._rooms];

        for (let i = 0; i < 4 && availableRooms.length > 1; i++) {
            let aiPlayer = this._aiPlayers[i];

            if (!aiPlayer) {
                const aiNode = new Node(`AIPlayer_${i}`);
                aiNode.setParent(this.node);
                aiPlayer = aiNode.addComponent(AIPlayer);
                this._aiPlayers.push(aiPlayer);
            }

            aiPlayer.init(i);

            // 随机分配房间
            const roomIndex = Math.floor(Math.random() * availableRooms.length);
            const room = availableRooms[roomIndex];
            aiPlayer.setRoom(room);
            availableRooms.splice(roomIndex, 1);
        }

        this.gameUI?.updatePlayerIcons(this._aiPlayers);
    }

    // ========== 游戏更新 ==========

    private gameUpdate(dt: number): void {
        if (this._state === GameState.SELECTING) {
            this.updateSelecting(dt);
        } else if (this._state === GameState.PLAYING) {
            this.updatePlaying(dt);
        }
    }

    /**
     * 选房阶段更新
     */
    private updateSelecting(dt: number): void {
        this._timer -= dt;
        this.gameUI?.updateWaveInfo(`选择房间: ${Math.ceil(this._timer)}秒`);

        if (this._timer <= 0) {
            // 自动选择房间
            const availableRooms = this._rooms.filter(r => !r.hasOwner);
            if (availableRooms.length > 0) {
                const index = Math.floor(Math.random() * availableRooms.length);
                this.selectRoom(availableRooms[index]);
            }
        }
    }

    /**
     * 游戏阶段更新
     */
    private updatePlaying(dt: number): void {
        this._survivalTime += dt;
        this._timer -= dt;

        // 更新HUD
        this.updateHUD();

        // 胜利检查
        if (this._timer <= 0) {
            this.victory();
            return;
        }

        // 激活猛鬼
        if (!this._ghostsActive && this._survivalTime >= GAME_CONFIG.ghostDelay) {
            this._ghostsActive = true;
            this._wave = 1;
            this.spawnGhost();
            this.gameUI?.showBroadcast('猛鬼出现了!');
        }

        // 生成更多猛鬼
        if (this._ghostsActive) {
            this._ghostSpawnTimer += dt;
            if (this._ghostSpawnTimer >= GAME_CONFIG.ghostSpawnInterval) {
                this._ghostSpawnTimer = 0;
                this._wave++;
                this.spawnGhost();

                // 每3波多生成一只
                if (this._wave % 3 === 0) {
                    this.spawnGhost();
                }
            }
        }

        // 金币生成
        this._goldTickTimer += dt;
        if (this._goldTickTimer >= 1) {
            this._goldTickTimer = 0;
            this.generateGold();
        }

        // 更新猛鬼
        this.updateGhosts(dt);

        // 更新AI玩家
        for (const ai of this._aiPlayers) {
            ai.updateAI(dt);
        }

        // 更新炮塔
        this.updateTurrets(dt);

        // 更新投射物
        this.updateProjectiles(dt);
    }

    /**
     * 更新HUD
     */
    private updateHUD(): void {
        const remainTime = Math.max(0, Math.ceil(this._timer));

        if (this._ghostsActive) {
            this.gameUI?.updateWaveInfo(`波次${this._wave} | 剩余${remainTime}秒`);
        } else {
            const ghostTime = Math.ceil(GAME_CONFIG.ghostDelay - this._survivalTime);
            this.gameUI?.updateWaveInfo(`准备阶段 | 猛鬼${ghostTime}秒后出现`);
        }

        this.gameUI?.updateGold(this._gold);

        if (this._playerRoom) {
            this.gameUI?.updateDPS(this._playerRoom.getDPS());
        }
    }

    // ========== 房间选择 ==========

    /**
     * 玩家选择房间
     */
    public selectRoom(room: Room): void {
        if (room.hasOwner) return;

        room.setOwner(0, '你', true);
        this._playerRoom = room;

        this._state = GameState.PLAYING;
        this._timer = GAME_CONFIG.survivalTime;

        this.gameUI?.showFloatingText(room.getDoorPosition(), '选择成功!', '#4CAF50');
        this.gameUI?.showBroadcast('你选择了房间');
    }

    /**
     * 处理点击
     */
    public handleClick(x: number, y: number): void {
        if (this._state === GameState.SELECTING) {
            for (const room of this._rooms) {
                if (!room.hasOwner && room.containsPoint(x, y)) {
                    this.selectRoom(room);
                    return;
                }
            }
        } else if (this._state === GameState.PLAYING && this._playerRoom) {
            if (this._playerRoom.containsPoint(x, y)) {
                const cell = this._playerRoom.getCellAtPoint(x, y);
                if (cell) {
                    this.handleCellClick(cell);
                }
            }
        }
    }

    /**
     * 处理格子点击
     */
    private handleCellClick(cell: GridCell): void {
        if (!this._playerRoom) return;

        if (cell === this._playerRoom.grid[0]) {
            // 点击床
            this.gameUI?.showUpgradePanel('bed', this._playerRoom);
        } else if (cell.building) {
            // 点击已有建筑
            this._selectedCell = cell;
        } else {
            // 空格子，显示建造菜单
            this._selectedCell = cell;
            this.gameUI?.showBuildMenu();
        }
    }

    // ========== 建造系统 ==========

    /**
     * 建造建筑
     */
    public buildItem(type: string): boolean {
        if (!this._playerRoom) return false;

        // 确保有选中的格子
        if (!this._selectedCell) {
            this._selectedCell = this._playerRoom.getEmptyCell();
        }

        if (!this._selectedCell || this._selectedCell.building) {
            return false;
        }

        const config = BUILDING_CONFIGS[type];
        if (!config || this._gold < config.cost) {
            this.gameUI?.showFloatingText(
                new Vec3(225, 300, 0),
                '金币不足!',
                '#ff6b6b'
            );
            return false;
        }

        this._gold -= config.cost;
        this._playerRoom.buildAt(this._selectedCell, config);

        this.gameUI?.showFloatingText(
            this._selectedCell.worldPos,
            `-${config.cost}`,
            '#ff6b6b'
        );

        this._selectedCell = null;
        this.gameUI?.updateGold(this._gold);
        return true;
    }

    /**
     * 升级床
     */
    public upgradeBed(): boolean {
        if (!this._playerRoom) return false;

        const nextConfig = this._playerRoom.getNextBedConfig();
        if (!nextConfig || this._gold < nextConfig.cost) {
            return false;
        }

        this._gold -= nextConfig.cost;
        this._playerRoom.upgradeBed();

        this.gameUI?.showFloatingText(
            this._playerRoom.grid[0].worldPos,
            '床升级!',
            '#4CAF50'
        );
        this.gameUI?.updateGold(this._gold);
        return true;
    }

    /**
     * 升级门
     */
    public upgradeDoor(): boolean {
        if (!this._playerRoom) return false;

        const nextConfig = this._playerRoom.getNextDoorConfig();
        if (!nextConfig || this._gold < nextConfig.cost) {
            return false;
        }

        this._gold -= nextConfig.cost;
        this._playerRoom.upgradeDoor();

        this.gameUI?.showFloatingText(
            this._playerRoom.getDoorPosition(),
            '门升级!',
            '#4CAF50'
        );
        this.gameUI?.updateGold(this._gold);
        return true;
    }

    // ========== 金币系统 ==========

    private generateGold(): void {
        if (this._playerRoom && this._playerRoom.isResting) {
            const goldPerSec = this._playerRoom.getGoldPerSecond();
            this._gold += goldPerSec;

            if (goldPerSec > 0) {
                this.gameUI?.showFloatingText(
                    this._playerRoom.grid[0].worldPos,
                    `+${goldPerSec}`,
                    '#ffd700'
                );
            }
        }
    }

    // ========== 猛鬼系统 ==========

    private spawnGhost(): void {
        if (!this.ghostPrefab || !this.ghostContainer) return;

        const spawnPoints = [
            new Vec3(225, -50, 0),
            new Vec3(50, 375, 0),
            new Vec3(400, 375, 0)
        ];

        const spawnIndex = Math.floor(Math.random() * spawnPoints.length);
        const spawnPos = spawnPoints[spawnIndex];

        const ghostNode = instantiate(this.ghostPrefab);
        ghostNode.setParent(this.ghostContainer);

        const ghost = ghostNode.getComponent(Ghost);
        if (ghost) {
            ghost.init(this._wave, spawnPos);
            ghost.setCallbacks(
                (room) => this.onDoorBroken(room),
                (g) => this.onGhostDeath(g)
            );
            this._ghosts.push(ghost);
        }
    }

    private updateGhosts(dt: number): void {
        for (const ghost of this._ghosts) {
            ghost.updateGhost(dt, this._rooms);
        }
    }

    private onDoorBroken(room: Room): void {
        const owner = this._aiPlayers.find(ai => ai.room === room);

        if (room.isPlayerRoom) {
            this.gameOver();
        } else if (owner) {
            const message = owner.die();
            this.gameUI?.showBroadcast(message);
            this.gameUI?.updatePlayerIcons(this._aiPlayers);
        }
    }

    private onGhostDeath(ghost: Ghost): void {
        const index = this._ghosts.indexOf(ghost);
        if (index >= 0) {
            this._ghosts.splice(index, 1);
        }

        this._kills++;
        const reward = GAME_CONFIG.killReward + this._wave;
        this._gold += reward;

        this.gameUI?.showFloatingText(
            ghost.node.getPosition(),
            `+${reward}`,
            '#ffd700'
        );

        ghost.node.destroy();
    }

    private clearGhosts(): void {
        for (const ghost of this._ghosts) {
            ghost.node.destroy();
        }
        this._ghosts = [];
    }

    // ========== 炮塔系统 ==========

    private updateTurrets(dt: number): void {
        if (!this._playerRoom) return;

        for (const turret of this._playerRoom.turrets) {
            if (!turret.attackTimer) turret.attackTimer = 0;
            turret.attackTimer += dt;

            const attackSpeed = turret.config.attackSpeed || 1.5;
            if (turret.attackTimer >= attackSpeed) {
                const target = this.findNearestGhost(
                    turret.cell!.worldPos,
                    turret.config.range || 150
                );

                if (target) {
                    turret.attackTimer = 0;
                    this.fireProjectile(turret.cell!.worldPos, target, turret.config.damage || 5);
                }
            }
        }
    }

    private findNearestGhost(pos: Vec3, range: number): Ghost | null {
        let nearest: Ghost | null = null;
        let nearestDist = range;

        for (const ghost of this._ghosts) {
            const ghostPos = ghost.node.getPosition();
            const dx = ghostPos.x - pos.x;
            const dy = ghostPos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = ghost;
            }
        }

        return nearest;
    }

    private fireProjectile(from: Vec3, target: Ghost, damage: number): void {
        if (!this.projectilePrefab || !this.projectileContainer) return;

        const projNode = instantiate(this.projectilePrefab);
        projNode.setParent(this.projectileContainer);
        projNode.setPosition(from);

        this._projectiles.push({
            node: projNode,
            target,
            damage,
            speed: 300
        });
    }

    private updateProjectiles(dt: number): void {
        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const proj = this._projectiles[i];
            const projPos = proj.node.getPosition();
            const targetPos = proj.target.node.getPosition();

            const dx = targetPos.x - projPos.x;
            const dy = targetPos.y - projPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) {
                // 命中
                proj.target.takeDamage(proj.damage);
                proj.node.destroy();
                this._projectiles.splice(i, 1);
            } else {
                // 移动
                const moveSpeed = proj.speed * dt;
                proj.node.setPosition(
                    projPos.x + (dx / dist) * moveSpeed,
                    projPos.y + (dy / dist) * moveSpeed,
                    0
                );
            }
        }
    }

    private clearProjectiles(): void {
        for (const proj of this._projectiles) {
            proj.node.destroy();
        }
        this._projectiles = [];
    }

    // ========== 游戏结束 ==========

    private gameOver(): void {
        this._state = GameState.GAMEOVER;
        this.showResult(false);
    }

    private victory(): void {
        this._state = GameState.VICTORY;
        this.showResult(true);
    }

    private showResult(isVictory: boolean): void {
        const beeReward = Math.floor(this._survivalTime / GAME_CONFIG.beeRewardRate) + this._kills;

        // 保存结果
        SaveManager.getInstance().recordGameResult(
            this._survivalTime,
            this._kills,
            beeReward
        );

        this.gameUI?.showResultScreen(isVictory, {
            survivalTime: Math.floor(this._survivalTime),
            kills: this._kills,
            gold: Math.floor(this._gold),
            beeReward
        });
    }

    /**
     * 复活（看广告）
     */
    public revive(): void {
        if (this._state !== GameState.GAMEOVER || !this._playerRoom) {
            return;
        }

        // 恢复门血量
        this._playerRoom.upgradeDoor(); // 这会重置门血量
        this._state = GameState.PLAYING;

        this.gameUI?.hideResultScreen();
        this.gameUI?.showBroadcast('复活成功!');
    }

    /**
     * 双倍奖励（看广告）
     */
    public doubleReward(): void {
        const beeReward = Math.floor(this._survivalTime / GAME_CONFIG.beeRewardRate) + this._kills;
        SaveManager.getInstance().addBeeCoins(beeReward);
    }

    // ========== Getter ==========

    public get state(): GameState {
        return this._state;
    }

    public get gold(): number {
        return this._gold;
    }

    public get playerRoom(): Room | null {
        return this._playerRoom;
    }

    public get rooms(): Room[] {
        return this._rooms;
    }
}
