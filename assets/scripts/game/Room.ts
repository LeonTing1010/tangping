/**
 * 梦魇宿舍 - 房间组件
 * 管理单个房间的状态、建筑和门
 */

import { _decorator, Component, Node, Vec3, Sprite, Color, Label, ProgressBar } from 'cc';
import {
    RoomLayout,
    BED_CONFIGS,
    DOOR_CONFIGS,
    BuildingConfig,
    BuildingType,
    GAME_CONFIG
} from '../data/GameConfig';
import { SaveManager } from '../data/SaveManager';

const { ccclass, property } = _decorator;

export interface GridCell {
    col: number;
    row: number;
    worldPos: Vec3;
    building: Building | null;
}

export interface Building {
    type: BuildingType;
    config: BuildingConfig;
    level: number;
    node?: Node;
    attackTimer?: number;
}

@ccclass('Room')
export class Room extends Component {
    @property(Node)
    public floorNode: Node | null = null;

    @property(Node)
    public doorNode: Node | null = null;

    @property(ProgressBar)
    public doorHPBar: ProgressBar | null = null;

    @property(Label)
    public ownerLabel: Label | null = null;

    @property(Node)
    public bedNode: Node | null = null;

    @property(Node)
    public gridContainer: Node | null = null;

    // 房间数据
    private _layout: RoomLayout | null = null;
    private _ownerId: number = -1;
    private _ownerName: string = '';
    private _isPlayerRoom: boolean = false;

    // 门属性
    private _doorLevel: number = 0;
    private _doorHP: number = 0;
    private _doorMaxHP: number = 0;
    private _doorArmor: number = 0;

    // 床属性
    private _bedLevel: number = 0;
    private _isResting: boolean = false;

    // 网格和建筑
    private _grid: GridCell[] = [];
    private _buildings: Building[] = [];
    private _turrets: Building[] = [];

    // ========== 初始化 ==========

    public init(layout: RoomLayout): void {
        this._layout = layout;
        this.initDoor();
        this.initGrid();
        this.updateVisuals();
    }

    private initDoor(): void {
        const doorConfig = DOOR_CONFIGS[0];
        const bonusHP = SaveManager.getInstance().getDoorHPBonus();

        this._doorLevel = 0;
        this._doorMaxHP = doorConfig.hp + bonusHP;
        this._doorHP = this._doorMaxHP;
        this._doorArmor = doorConfig.armor;
    }

    private initGrid(): void {
        if (!this._layout) return;

        this._grid = [];
        const gridSize = GAME_CONFIG.gridSize;

        for (let row = 0; row < this._layout.gridRows; row++) {
            for (let col = 0; col < this._layout.gridCols; col++) {
                const cell: GridCell = {
                    col,
                    row,
                    worldPos: new Vec3(
                        this._layout.x + 15 + col * gridSize + gridSize / 2,
                        this._layout.y + 15 + row * gridSize + gridSize / 2,
                        0
                    ),
                    building: null
                };
                this._grid.push(cell);
            }
        }
    }

    // ========== 房间所有权 ==========

    public setOwner(playerId: number, playerName: string, isPlayer: boolean): void {
        this._ownerId = playerId;
        this._ownerName = playerName;
        this._isPlayerRoom = isPlayer;
        this._isResting = true;

        if (this.ownerLabel) {
            this.ownerLabel.string = playerName;
        }
    }

    public get ownerId(): number {
        return this._ownerId;
    }

    public get ownerName(): string {
        return this._ownerName;
    }

    public get isPlayerRoom(): boolean {
        return this._isPlayerRoom;
    }

    public get hasOwner(): boolean {
        return this._ownerId >= 0;
    }

    // ========== 门操作 ==========

    public get doorHP(): number {
        return this._doorHP;
    }

    public get doorMaxHP(): number {
        return this._doorMaxHP;
    }

    public get doorLevel(): number {
        return this._doorLevel;
    }

    public get doorArmor(): number {
        return this._doorArmor;
    }

    /**
     * 门受到伤害
     * @returns 门是否被破坏
     */
    public takeDamage(damage: number): boolean {
        const actualDamage = Math.max(1, damage - this._doorArmor);
        this._doorHP = Math.max(0, this._doorHP - actualDamage);
        this.updateDoorVisuals();
        return this._doorHP <= 0;
    }

    /**
     * 升级门
     */
    public upgradeDoor(): boolean {
        if (this._doorLevel >= DOOR_CONFIGS.length - 1) {
            return false;
        }

        this._doorLevel++;
        const config = DOOR_CONFIGS[this._doorLevel];
        const bonusHP = SaveManager.getInstance().getDoorHPBonus();

        this._doorMaxHP = config.hp + bonusHP;
        this._doorHP = this._doorMaxHP;
        this._doorArmor = config.armor;

        this.updateDoorVisuals();
        return true;
    }

    /**
     * 获取下一级门配置
     */
    public getNextDoorConfig() {
        if (this._doorLevel >= DOOR_CONFIGS.length - 1) {
            return null;
        }
        return DOOR_CONFIGS[this._doorLevel + 1];
    }

    /**
     * 获取当前门配置
     */
    public getCurrentDoorConfig() {
        return DOOR_CONFIGS[this._doorLevel];
    }

    // ========== 床操作 ==========

    public get bedLevel(): number {
        return this._bedLevel;
    }

    public get isResting(): boolean {
        return this._isResting;
    }

    public set isResting(value: boolean) {
        this._isResting = value;
    }

    /**
     * 升级床
     */
    public upgradeBed(): boolean {
        if (this._bedLevel >= BED_CONFIGS.length - 1) {
            return false;
        }

        this._bedLevel++;
        this.updateBedVisuals();
        return true;
    }

    /**
     * 获取下一级床配置
     */
    public getNextBedConfig() {
        if (this._bedLevel >= BED_CONFIGS.length - 1) {
            return null;
        }
        return BED_CONFIGS[this._bedLevel + 1];
    }

    /**
     * 获取当前床配置
     */
    public getCurrentBedConfig() {
        return BED_CONFIGS[this._bedLevel];
    }

    // ========== 金币生成 ==========

    /**
     * 获取每秒金币产出
     */
    public getGoldPerSecond(): number {
        let gold = 0;

        // 床产出（需要在休息状态）
        if (this._isResting) {
            gold += BED_CONFIGS[this._bedLevel].goldPerSec;
        }

        // 建筑产出
        for (const building of this._buildings) {
            if (building.type === BuildingType.PLANT && building.config.goldPerSec) {
                gold += building.config.goldPerSec;
            }
        }

        return gold;
    }

    // ========== 建筑系统 ==========

    public get grid(): GridCell[] {
        return this._grid;
    }

    public get buildings(): Building[] {
        return this._buildings;
    }

    public get turrets(): Building[] {
        return this._turrets;
    }

    /**
     * 获取空闲格子（排除床位置）
     */
    public getEmptyCell(): GridCell | null {
        for (let i = 1; i < this._grid.length; i++) {
            if (!this._grid[i].building) {
                return this._grid[i];
            }
        }
        return null;
    }

    /**
     * 在指定格子建造建筑
     */
    public buildAt(cell: GridCell, config: BuildingConfig): Building | null {
        if (cell.building) {
            return null;
        }

        const building: Building = {
            type: config.type,
            config,
            level: 1,
            attackTimer: 0
        };

        cell.building = building;
        this._buildings.push(building);

        if (config.type === BuildingType.TURRET) {
            this._turrets.push(building);
        }

        return building;
    }

    /**
     * 获取总DPS
     */
    public getDPS(): number {
        let dps = 0;
        for (const turret of this._turrets) {
            if (turret.config.damage && turret.config.attackSpeed) {
                dps += turret.config.damage / turret.config.attackSpeed;
            }
        }
        return dps;
    }

    // ========== 位置信息 ==========

    public get layout(): RoomLayout | null {
        return this._layout;
    }

    /**
     * 获取门的世界坐标
     */
    public getDoorPosition(): Vec3 {
        if (!this._layout) {
            return Vec3.ZERO;
        }

        let x = 0, y = 0;
        switch (this._layout.doorSide) {
            case 'bottom':
                x = this._layout.x + this._layout.width / 2;
                y = this._layout.y + this._layout.height;
                break;
            case 'top':
                x = this._layout.x + this._layout.width / 2;
                y = this._layout.y;
                break;
            case 'left':
                x = this._layout.x;
                y = this._layout.y + this._layout.height / 2;
                break;
            case 'right':
                x = this._layout.x + this._layout.width;
                y = this._layout.y + this._layout.height / 2;
                break;
        }

        return new Vec3(x, y, 0);
    }

    /**
     * 检查点是否在房间内
     */
    public containsPoint(x: number, y: number): boolean {
        if (!this._layout) return false;
        return x >= this._layout.x &&
               x <= this._layout.x + this._layout.width &&
               y >= this._layout.y &&
               y <= this._layout.y + this._layout.height;
    }

    /**
     * 获取点击位置对应的格子
     */
    public getCellAtPoint(x: number, y: number): GridCell | null {
        const gridSize = GAME_CONFIG.gridSize;
        for (const cell of this._grid) {
            const dx = Math.abs(x - cell.worldPos.x);
            const dy = Math.abs(y - cell.worldPos.y);
            if (dx < gridSize / 2 && dy < gridSize / 2) {
                return cell;
            }
        }
        return null;
    }

    // ========== 视觉更新 ==========

    private updateVisuals(): void {
        this.updateDoorVisuals();
        this.updateBedVisuals();
    }

    private updateDoorVisuals(): void {
        if (this.doorHPBar) {
            this.doorHPBar.progress = this._doorHP / this._doorMaxHP;
        }

        // 根据血量更新门的颜色
        if (this.doorNode) {
            const sprite = this.doorNode.getComponent(Sprite);
            if (sprite) {
                const percent = this._doorHP / this._doorMaxHP;
                if (percent > 0.5) {
                    sprite.color = new Color(76, 175, 80); // 绿色
                } else if (percent > 0.25) {
                    sprite.color = new Color(255, 152, 0); // 橙色
                } else {
                    sprite.color = new Color(244, 67, 54); // 红色
                }
            }
        }
    }

    private updateBedVisuals(): void {
        // 更新床的显示（等级、动画等）
        // 实际实现需要根据美术资源调整
    }

    // ========== 重置 ==========

    public reset(): void {
        this._ownerId = -1;
        this._ownerName = '';
        this._isPlayerRoom = false;
        this._isResting = false;

        this.initDoor();

        this._bedLevel = 0;
        this._buildings = [];
        this._turrets = [];

        for (const cell of this._grid) {
            cell.building = null;
        }

        this.updateVisuals();
    }
}
