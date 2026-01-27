/**
 * 梦魇宿舍 - 猛鬼AI组件
 * 实现 IDLE/ATTACK/RETREAT 状态机
 */

import { _decorator, Component, Node, Vec3, Sprite, Color, ProgressBar } from 'cc';
import { GhostState, GHOST_CONFIG, GAME_CONFIG } from '../data/GameConfig';
import { Room } from './Room';

const { ccclass, property } = _decorator;

@ccclass('Ghost')
export class Ghost extends Component {
    @property(Sprite)
    public bodySprite: Sprite | null = null;

    @property(ProgressBar)
    public hpBar: ProgressBar | null = null;

    @property(Node)
    public attackIndicator: Node | null = null;

    // 基础属性
    private _maxHP: number = 0;
    private _hp: number = 0;
    private _damage: number = 0;
    private _speed: number = 0;
    private _attackSpeed: number = 0;

    // 状态
    private _state: GhostState = GhostState.IDLE;
    private _targetRoom: Room | null = null;
    private _attackTimer: number = 0;
    private _idleTimer: number = 0;

    // 位置
    private _spawnPos: Vec3 = new Vec3();
    private _idleTarget: Vec3 = new Vec3();

    // 回调
    private _onDoorBroken: ((room: Room) => void) | null = null;
    private _onDeath: ((ghost: Ghost) => void) | null = null;

    // ========== 初始化 ==========

    /**
     * 初始化猛鬼
     * @param wave 当前波次
     * @param spawnPos 出生位置
     */
    public init(wave: number, spawnPos: Vec3): void {
        // 根据波次计算属性
        const scale = 1 + wave * GAME_CONFIG.difficultyScale;

        this._maxHP = Math.floor(GHOST_CONFIG.baseHP * scale);
        this._hp = this._maxHP;
        this._damage = Math.floor(GHOST_CONFIG.baseDamage * scale);
        this._speed = GHOST_CONFIG.baseSpeed;
        this._attackSpeed = GHOST_CONFIG.attackSpeed;

        // 设置位置
        this._spawnPos = spawnPos.clone();
        this.node.setPosition(spawnPos);

        // 初始化状态
        this._state = GhostState.IDLE;
        this._idleTimer = 0;
        this._attackTimer = 0;
        this._targetRoom = null;

        // 设置初始徘徊目标
        this._idleTarget = new Vec3(
            spawnPos.x,
            spawnPos.y + 100,
            0
        );

        this.updateVisuals();
    }

    /**
     * 设置回调
     */
    public setCallbacks(
        onDoorBroken: (room: Room) => void,
        onDeath: (ghost: Ghost) => void
    ): void {
        this._onDoorBroken = onDoorBroken;
        this._onDeath = onDeath;
    }

    // ========== 游戏循环 ==========

    /**
     * 每帧更新
     */
    public updateGhost(dt: number, rooms: Room[]): void {
        switch (this._state) {
            case GhostState.IDLE:
                this.updateIdle(dt, rooms);
                break;
            case GhostState.ATTACK:
                this.updateAttack(dt);
                break;
            case GhostState.RETREAT:
                this.updateRetreat(dt);
                break;
        }

        this.updateVisuals();
    }

    // ========== IDLE 状态 ==========

    private updateIdle(dt: number, rooms: Room[]): void {
        this._idleTimer += dt;

        // 移动到徘徊目标
        const currentPos = this.node.getPosition();
        const dx = this._idleTarget.x - currentPos.x;
        const dy = this._idleTarget.y - currentPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
            const moveSpeed = this._speed * 0.5 * dt;
            this.node.setPosition(
                currentPos.x + (dx / dist) * moveSpeed,
                currentPos.y + (dy / dist) * moveSpeed,
                0
            );
        } else {
            // 到达目标，选择新的徘徊点
            this._idleTarget = new Vec3(
                150 + Math.random() * 150,
                200 + Math.random() * 300,
                0
            );
        }

        // 一段时间后选择攻击目标
        const idleTime = 3 + Math.random() * 2;
        if (this._idleTimer >= idleTime) {
            this.selectTarget(rooms);
        }
    }

    /**
     * 选择攻击目标
     */
    private selectTarget(rooms: Room[]): void {
        // 筛选有效房间（有主人、主人存活、门未破）
        const validRooms = rooms.filter(room =>
            room.hasOwner && room.doorHP > 0
        );

        if (validRooms.length > 0) {
            // 随机选择一个房间
            const index = Math.floor(Math.random() * validRooms.length);
            this._targetRoom = validRooms[index];
            this._state = GhostState.ATTACK;
            this._attackTimer = 0;
        }
    }

    // ========== ATTACK 状态 ==========

    private updateAttack(dt: number): void {
        // 目标检查
        if (!this._targetRoom || this._targetRoom.doorHP <= 0) {
            this._state = GhostState.IDLE;
            this._idleTimer = 0;
            this._targetRoom = null;
            return;
        }

        // 血量检查 - 低于阈值时撤退
        if (this._hp / this._maxHP < GHOST_CONFIG.retreatThreshold) {
            this._state = GhostState.RETREAT;
            return;
        }

        // 获取门位置
        const doorPos = this._targetRoom.getDoorPosition();
        const layout = this._targetRoom.layout;

        // 计算攻击站位
        let targetX = doorPos.x;
        let targetY = doorPos.y;
        if (layout) {
            if (layout.doorSide === 'top') targetY -= 30;
            else if (layout.doorSide === 'bottom') targetY += 30;
            else if (layout.doorSide === 'left') targetX -= 30;
            else if (layout.doorSide === 'right') targetX += 30;
        }

        // 移动到门附近
        const currentPos = this.node.getPosition();
        const dx = targetX - currentPos.x;
        const dy = targetY - currentPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 40) {
            // 移动
            const moveSpeed = this._speed * dt;
            this.node.setPosition(
                currentPos.x + (dx / dist) * moveSpeed,
                currentPos.y + (dy / dist) * moveSpeed,
                0
            );
        } else {
            // 攻击
            this._attackTimer += dt;

            if (this._attackTimer >= this._attackSpeed) {
                this._attackTimer = 0;
                const doorBroken = this._targetRoom.takeDamage(this._damage);

                if (doorBroken && this._onDoorBroken) {
                    this._onDoorBroken(this._targetRoom);
                    this._targetRoom = null;
                    this._state = GhostState.IDLE;
                    this._idleTimer = 0;
                }
            }
        }
    }

    // ========== RETREAT 状态 ==========

    private updateRetreat(dt: number): void {
        const currentPos = this.node.getPosition();
        const dx = this._spawnPos.x - currentPos.x;
        const dy = this._spawnPos.y - currentPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 20) {
            // 快速撤退
            const moveSpeed = this._speed * 1.5 * dt;
            this.node.setPosition(
                currentPos.x + (dx / dist) * moveSpeed,
                currentPos.y + (dy / dist) * moveSpeed,
                0
            );
        } else {
            // 回血
            this._hp += GHOST_CONFIG.healRate * dt;

            if (this._hp >= this._maxHP * 0.8) {
                this._hp = Math.min(this._hp, this._maxHP);
                this._state = GhostState.IDLE;
                this._idleTimer = 0;
            }
        }
    }

    // ========== 受伤/死亡 ==========

    /**
     * 受到伤害
     * @returns 是否死亡
     */
    public takeDamage(damage: number): boolean {
        this._hp -= damage;
        this.updateVisuals();

        if (this._hp <= 0) {
            if (this._onDeath) {
                this._onDeath(this);
            }
            return true;
        }
        return false;
    }

    // ========== Getter ==========

    public get hp(): number {
        return this._hp;
    }

    public get maxHP(): number {
        return this._maxHP;
    }

    public get state(): GhostState {
        return this._state;
    }

    public get targetRoom(): Room | null {
        return this._targetRoom;
    }

    public get isAttacking(): boolean {
        return this._state === GhostState.ATTACK &&
               this._attackTimer > this._attackSpeed * 0.7;
    }

    // ========== 视觉更新 ==========

    private updateVisuals(): void {
        // 更新血条
        if (this.hpBar) {
            this.hpBar.progress = this._hp / this._maxHP;
        }

        // 根据状态更新颜色
        if (this.bodySprite) {
            switch (this._state) {
                case GhostState.IDLE:
                    this.bodySprite.color = new Color(124, 179, 66); // 绿色
                    break;
                case GhostState.ATTACK:
                    this.bodySprite.color = new Color(229, 57, 53); // 红色
                    break;
                case GhostState.RETREAT:
                    this.bodySprite.color = new Color(158, 158, 158); // 灰色
                    break;
            }
        }

        // 攻击指示器
        if (this.attackIndicator) {
            this.attackIndicator.active = this.isAttacking;
        }
    }
}
