/**
 * 猎梦者AI类 - 物理精灵 + 动态追逐
 */

import Phaser from 'phaser';
import { GAME_CONFIG, COLORS } from '../config/GameConfig';
import { Room } from './Room';
import { Player, PlayerState } from './Player';

export enum GhostState {
  PATROL = 'patrol',      // 巡逻寻找目标
  CHASE = 'chase',        // 追击移动中的玩家
  ATTACK_DOOR = 'attack'  // 攻击房门
}

export class Ghost extends Phaser.Physics.Arcade.Sprite {
  maxHP: number;
  hp: number;
  damage: number;
  moveSpeed: number;
  chaseSpeed: number;

  ghostState: GhostState = GhostState.PATROL;
  targetPlayer: Player | null = null;
  targetRoom: Room | null = null;
  targetBed: Phaser.Physics.Arcade.Sprite | null = null;
  attackTimer: number = 0;
  pathUpdateTimer: number = 0;

  // Patrol waypoints
  patrolTargetX: number;
  patrolTargetY: number;

  isDead: boolean = false;
  wave: number;

  // Visual overlay
  overlay: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, wave: number) {
    super(scene, x, y, 'ghost');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.wave = wave;

    // Scale stats by wave
    const scale = 1 + wave * GAME_CONFIG.difficultyScale;
    this.maxHP = Math.floor(GAME_CONFIG.ghostBaseHP * scale);
    this.hp = this.maxHP;
    this.damage = Math.floor(GAME_CONFIG.ghostBaseDamage * scale);
    this.moveSpeed = GAME_CONFIG.ghostSpeed;
    this.chaseSpeed = GAME_CONFIG.ghostChaseSpeed;

    this.patrolTargetX = x;
    this.patrolTargetY = y;

    this.setCircle(14, 2, 2);
    this.setCollideWorldBounds(true);
    this.setDepth(11);

    this.overlay = scene.add.graphics().setDepth(12);
  }

  updateAI(dt: number, player: Player, rooms: Room[], doors: Phaser.Physics.Arcade.Group): void {
    if (this.isDead) return;

    this.pathUpdateTimer += dt;

    // Check for targets every 300ms
    if (this.pathUpdateTimer >= 0.3) {
      this.pathUpdateTimer = 0;
      this.evaluateTarget(player, rooms, doors);
    }

    // Execute current state behavior
    switch (this.ghostState) {
      case GhostState.PATROL:
        this.doPatrol();
        break;
      case GhostState.CHASE:
        this.doChase(player);
        break;
      case GhostState.ATTACK_DOOR:
        this.doAttackDoor(dt);
        break;
    }

    this.drawOverlay();
  }

  private evaluateTarget(player: Player, rooms: Room[], doors: Phaser.Physics.Arcade.Group): void {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Priority 1: If there's a target bed (door was destroyed), go for it
    if (this.targetBed && this.targetBed.active) {
      // Keep going to target bed
      return;
    }

    // Priority 2: Chase player if within detection range and NOT behind closed door
    const playerDetectable = distToPlayer < GAME_CONFIG.ghostDetectionRange;
    const playerVulnerable = !player.isInvincible();

    if (playerDetectable && playerVulnerable) {
      // Check if player is lying down but door is open (can still catch them!)
      if (player.state === PlayerState.LYING_DOWN && player.currentRoom) {
        if (!player.currentRoom.isDoorClosed()) {
          // Door is open! Chase the player into the room
          this.targetPlayer = player;
          this.ghostState = GhostState.CHASE;
          this.targetRoom = null;
          return;
        }
        // Door is closed, attack it
        this.targetRoom = player.currentRoom;
        this.ghostState = GhostState.ATTACK_DOOR;
        this.targetPlayer = null;
        return;
      }

      // Player is moving, chase them
      if (player.state === PlayerState.MOVING) {
        this.targetPlayer = player;
        this.ghostState = GhostState.CHASE;
        this.targetRoom = null;
        return;
      }
    }

    // Priority 3: Attack nearest closed door (if player is behind it)
    let nearestDoor: Phaser.Physics.Arcade.Sprite | null = null;
    let minDist = Infinity;

    const doorChildren = doors.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const door of doorChildren) {
      if (door.getData('closed')) {
        const room = door.getData('room') as Room;
        // Only attack doors that have a player behind them
        if (room && room.isPlayerRoom) {
          const dist = Phaser.Math.Distance.Between(this.x, this.y, door.x, door.y);
          if (dist < minDist) {
            minDist = dist;
            nearestDoor = door;
          }
        }
      }
    }

    if (nearestDoor !== null) {
      const room = nearestDoor.getData('room') as Room;
      this.targetRoom = room;
      this.ghostState = GhostState.ATTACK_DOOR;
      this.targetPlayer = null;
      return;
    }

    // Default: Patrol
    this.ghostState = GhostState.PATROL;
    this.targetPlayer = null;
    this.targetRoom = null;
  }

  private doPatrol(): void {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.patrolTargetX, this.patrolTargetY);

    if (dist < 50) {
      // Pick new patrol target
      this.patrolTargetX = Phaser.Math.Between(100, GAME_CONFIG.mapWidth - 100);
      this.patrolTargetY = Phaser.Math.Between(100, GAME_CONFIG.mapHeight - 100);
    }

    this.scene.physics.moveTo(this, this.patrolTargetX, this.patrolTargetY, this.moveSpeed * 0.6);
  }

  private doChase(player: Player): void {
    // If player is invincible, patrol
    if (player.isInvincible()) {
      this.ghostState = GhostState.PATROL;
      this.targetPlayer = null;
      return;
    }

    // If player is lying down, check if door is closed
    if (player.state === PlayerState.LYING_DOWN && player.currentRoom) {
      if (player.currentRoom.isDoorClosed()) {
        // Door closed, attack it
        this.targetRoom = player.currentRoom;
        this.ghostState = GhostState.ATTACK_DOOR;
        this.targetPlayer = null;
        return;
      }
      // Door is open, keep chasing! (player is vulnerable)
    }

    // Chase player at chase speed
    this.scene.physics.moveToObject(this, player, this.chaseSpeed);
  }

  private doAttackDoor(dt: number): void {
    // If targeting a bed (door was destroyed)
    if (this.targetBed && this.targetBed.active) {
      this.scene.physics.moveToObject(this, this.targetBed, this.moveSpeed);
      return;
    }

    if (!this.targetRoom || !this.targetRoom.door || !this.targetRoom.door.active) {
      // Door destroyed, find the bed
      if (this.targetRoom && this.targetRoom.bedSprite) {
        this.targetBed = this.targetRoom.bedSprite;
      }
      this.ghostState = GhostState.PATROL;
      this.targetRoom = null;
      return;
    }

    const door = this.targetRoom.door;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, door.x, door.y);

    if (dist > 50) {
      // Move toward door
      this.scene.physics.moveToObject(this, door, this.moveSpeed);
    } else {
      // At door, attack it
      this.setVelocity(0, 0);
      this.attackTimer += dt;

      if (this.attackTimer >= GAME_CONFIG.ghostAttackSpeed) {
        this.attackTimer = 0;

        if (this.targetRoom.takeDamage(this.damage)) {
          // Door destroyed
          this.targetBed = this.targetRoom.bedSprite;
          this.targetRoom = null;
        }
      }
    }
  }

  // Called when ghost collides with closed door
  onDoorCollision(door: Phaser.Physics.Arcade.Sprite): void {
    if (door.getData('closed')) {
      const room = door.getData('room') as Room;
      this.targetRoom = room;
      this.ghostState = GhostState.ATTACK_DOOR;
      this.setVelocity(0, 0);
    }
  }

  takeDamage(damage: number): boolean {
    this.hp -= damage;
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => this.clearTint());

    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  private drawOverlay(): void {
    this.overlay.clear();

    // HP bar
    const hpPercent = this.hp / this.maxHP;
    const barColor = hpPercent > 0.5 ? COLORS.healthGood : hpPercent > 0.25 ? COLORS.healthMedium : COLORS.healthLow;

    this.overlay.fillStyle(0x333333);
    this.overlay.fillRect(this.x - 20, this.y - 30, 40, 6);
    this.overlay.fillStyle(barColor);
    this.overlay.fillRect(this.x - 20, this.y - 30, 40 * hpPercent, 6);

    // State indicator
    if (this.ghostState === GhostState.CHASE) {
      this.overlay.lineStyle(2, 0xff0000, 0.8);
      this.overlay.strokeCircle(this.x, this.y, 18);
    } else if (this.ghostState === GhostState.ATTACK_DOOR) {
      // Attack indicator
      if (this.attackTimer > GAME_CONFIG.ghostAttackSpeed * 0.7) {
        this.overlay.fillStyle(0xff0000);
        this.overlay.fillCircle(this.x, this.y - 40, 8);
      }
    }
  }

  destroy(fromScene?: boolean): void {
    this.overlay.destroy();
    super.destroy(fromScene);
  }
}
