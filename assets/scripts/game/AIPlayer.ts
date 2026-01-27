/**
 * 梦魇宿舍 - AI玩家组件
 * 模拟假多人玩家的自动升级行为
 */

import { _decorator, Component } from 'cc';
import { Room } from './Room';
import {
    BED_CONFIGS,
    DOOR_CONFIGS,
    BUILDING_CONFIGS,
    BuildingType,
    AI_PLAYER_NAMES,
    DEATH_MESSAGES
} from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('AIPlayer')
export class AIPlayer extends Component {
    // 玩家信息
    private _playerId: number = -1;
    private _playerName: string = '';
    private _iconName: string = '';

    // 状态
    private _room: Room | null = null;
    private _alive: boolean = true;
    private _gold: number = 0;

    // 升级计时器
    private _upgradeTimer: number = 0;
    private _upgradeInterval: number = 2; // 每2秒检查一次升级

    // ========== 初始化 ==========

    /**
     * 初始化AI玩家
     * @param index AI玩家索引 (0-3)
     */
    public init(index: number): void {
        if (index < 0 || index >= AI_PLAYER_NAMES.length) {
            console.error('AIPlayer: 无效的玩家索引', index);
            return;
        }

        this._playerId = index + 1; // 0是真实玩家
        this._playerName = AI_PLAYER_NAMES[index].name;
        this._iconName = AI_PLAYER_NAMES[index].icon;
        this._alive = true;
        this._gold = 0;
        this._upgradeTimer = 0;
    }

    /**
     * 设置房间
     */
    public setRoom(room: Room): void {
        this._room = room;
        room.setOwner(this._playerId, this._playerName, false);
    }

    // ========== 游戏循环 ==========

    /**
     * 每帧更新
     */
    public updateAI(dt: number): void {
        if (!this._alive || !this._room) {
            return;
        }

        // 生成金币
        this._gold += this._room.getGoldPerSecond() * dt;

        // 定期检查升级
        this._upgradeTimer += dt;
        if (this._upgradeTimer >= this._upgradeInterval) {
            this._upgradeTimer = 0;
            this.doUpgrade();
        }
    }

    /**
     * AI升级决策
     */
    private doUpgrade(): void {
        if (!this._room) return;

        // 优先级1: 门血量低时升级门
        if (this._room.doorHP < this._room.doorMaxHP * 0.5) {
            if (this.tryUpgradeDoor()) {
                return;
            }
        }

        // 优先级2: 升级床
        if (this.tryUpgradeBed()) {
            return;
        }

        // 优先级3: 建造炮塔
        this.tryBuildTurret();
    }

    /**
     * 尝试升级门
     */
    private tryUpgradeDoor(): boolean {
        if (!this._room) return false;

        const nextConfig = this._room.getNextDoorConfig();
        if (nextConfig && this._gold >= nextConfig.cost) {
            this._gold -= nextConfig.cost;
            this._room.upgradeDoor();
            return true;
        }
        return false;
    }

    /**
     * 尝试升级床
     */
    private tryUpgradeBed(): boolean {
        if (!this._room) return false;

        const nextConfig = this._room.getNextBedConfig();
        if (nextConfig && this._gold >= nextConfig.cost) {
            this._gold -= nextConfig.cost;
            this._room.upgradeBed();
            return true;
        }
        return false;
    }

    /**
     * 尝试建造炮塔
     */
    private tryBuildTurret(): boolean {
        if (!this._room) return false;

        const turretConfig = BUILDING_CONFIGS['turret'];
        const emptyCell = this._room.getEmptyCell();

        if (emptyCell && this._gold >= turretConfig.cost) {
            this._gold -= turretConfig.cost;
            this._room.buildAt(emptyCell, turretConfig);
            return true;
        }
        return false;
    }

    // ========== 死亡 ==========

    /**
     * AI玩家死亡
     * @returns 死亡广播消息
     */
    public die(): string {
        this._alive = false;
        const messageIndex = Math.floor(Math.random() * DEATH_MESSAGES.length);
        const deathMessage = DEATH_MESSAGES[messageIndex];
        return `${this._playerName} ${deathMessage}`;
    }

    // ========== Getter ==========

    public get playerId(): number {
        return this._playerId;
    }

    public get playerName(): string {
        return this._playerName;
    }

    public get iconName(): string {
        return this._iconName;
    }

    public get room(): Room | null {
        return this._room;
    }

    public get alive(): boolean {
        return this._alive;
    }

    public get gold(): number {
        return this._gold;
    }

    // ========== 重置 ==========

    public reset(): void {
        this._room = null;
        this._alive = true;
        this._gold = 0;
        this._upgradeTimer = 0;
    }
}
