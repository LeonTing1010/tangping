/**
 * 猎梦者AI类 - 动态追逐状态机
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

export class Ghost {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;

  x: number;
  y: number;
  spawnX: number;
  spawnY: number;

  maxHP: number;
  hp: number;
  damage: number;
  speed: number;
  chaseSpeed: number;

  state: GhostState = GhostState.PATROL;
  targetPlayer: Player | null = null;
  targetRoom: Room | null = null;
  attackTimer: number = 0;
  pathUpdateTimer: number = 0;

  // Patrol waypoints
  patrolTargetX: number;
  patrolTargetY: number;

  isDead: boolean = false;
  wave: number;

  constructor(scene: Phaser.Scene, x: number, y: number, wave: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.wave = wave;

    // Scale stats by wave
    const scale = 1 + wave * GAME_CONFIG.difficultyScale;
    this.maxHP = Math.floor(GAME_CONFIG.ghostBaseHP * scale);
    this.hp = this.maxHP;
    this.damage = Math.floor(GAME_CONFIG.ghostBaseDamage * scale);
    this.speed = GAME_CONFIG.ghostSpeed;
    this.chaseSpeed = this.speed * 1.5; // Faster when chasing

    this.patrolTargetX = x;
    this.patrolTargetY = y;

    this.graphics = scene.add.graphics();
    this.hpBar = scene.add.graphics();

    this.draw();
  }

  update(dt: number, player: Player, rooms: Room[], mapWidth: number, mapHeight: number): Room | null {
    if (this.isDead) return null;

    let brokenRoom: Room | null = null;

    // Update path periodically (throttle)
    this.pathUpdateTimer += dt;

    switch (this.state) {
      case GhostState.PATROL:
        this.updatePatrol(dt, player, rooms, mapWidth, mapHeight);
        break;
      case GhostState.CHASE:
        this.updateChase(dt, player);
        break;
      case GhostState.ATTACK_DOOR:
        brokenRoom = this.updateAttackDoor(dt, player);
        break;
    }

    this.draw();
    return brokenRoom;
  }

  private updatePatrol(dt: number, player: Player, rooms: Room[], mapWidth: number, mapHeight: number): void {
    // Check for targets every 300ms
    if (this.pathUpdateTimer >= 0.3) {
      this.pathUpdateTimer = 0;

      // Priority: Chase moving player
      if (player.state === PlayerState.MOVING && !player.isInvincible()) {
        const dist = this.distanceTo(player.x, player.y);
        if (dist < 400) { // Detection range
          this.targetPlayer = player;
          this.state = GhostState.CHASE;
          return;
        }
      }

      // Secondary: Attack room with player or weakest door
      if (player.state === PlayerState.LYING_DOWN && player.currentRoom) {
        this.targetRoom = player.currentRoom;
        this.state = GhostState.ATTACK_DOOR;
        return;
      }

      // Find weakest occupied room
      const occupied = rooms.filter(r => r.ownerId >= 0 && r.doorHP > 0);
      if (occupied.length > 0) {
        occupied.sort((a, b) => a.doorHP - b.doorHP);
        this.targetRoom = occupied[0];
        this.state = GhostState.ATTACK_DOOR;
        return;
      }
    }

    // Patrol movement
    const dx = this.patrolTargetX - this.x;
    const dy = this.patrolTargetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      this.x += (dx / dist) * this.speed * 0.6 * dt;
      this.y += (dy / dist) * this.speed * 0.6 * dt;
    } else {
      // Pick new patrol target
      this.patrolTargetX = 100 + Math.random() * (mapWidth - 200);
      this.patrolTargetY = 100 + Math.random() * (mapHeight - 200);
    }

    // Clamp to map
    this.x = Phaser.Math.Clamp(this.x, 30, mapWidth - 30);
    this.y = Phaser.Math.Clamp(this.y, 30, mapHeight - 30);
  }

  private updateChase(dt: number, player: Player): void {
    // Re-evaluate target every 200ms
    if (this.pathUpdateTimer >= 0.2) {
      this.pathUpdateTimer = 0;

      // If player started lying down, switch to attack door
      if (player.state === PlayerState.LYING_DOWN) {
        if (player.currentRoom) {
          this.targetRoom = player.currentRoom;
          this.state = GhostState.ATTACK_DOOR;
        } else {
          this.state = GhostState.PATROL;
        }
        this.targetPlayer = null;
        return;
      }

      // If player is invincible, patrol
      if (player.isInvincible()) {
        this.state = GhostState.PATROL;
        this.targetPlayer = null;
        return;
      }
    }

    if (!this.targetPlayer) {
      this.state = GhostState.PATROL;
      return;
    }

    // Chase player directly
    const dx = this.targetPlayer.x - this.x;
    const dy = this.targetPlayer.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      this.x += (dx / dist) * this.chaseSpeed * dt;
      this.y += (dy / dist) * this.chaseSpeed * dt;
    }
  }

  private updateAttackDoor(dt: number, player: Player): Room | null {
    // Re-check if player is moving
    if (this.pathUpdateTimer >= 0.3) {
      this.pathUpdateTimer = 0;

      if (player.state === PlayerState.MOVING && !player.isInvincible()) {
        const dist = this.distanceTo(player.x, player.y);
        if (dist < 300) {
          this.targetPlayer = player;
          this.targetRoom = null;
          this.state = GhostState.CHASE;
          return null;
        }
      }
    }

    if (!this.targetRoom || this.targetRoom.doorHP <= 0) {
      this.state = GhostState.PATROL;
      this.targetRoom = null;
      return null;
    }

    // Move toward door
    let tx = this.targetRoom.doorX;
    let ty = this.targetRoom.doorY;

    // Stand outside the door
    const side = this.targetRoom.layout.doorSide;
    if (side === 'top') ty -= 35;
    else if (side === 'bottom') ty += 35;
    else if (side === 'left') tx -= 35;
    else if (side === 'right') tx += 35;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 30) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    } else {
      // Attack door
      this.attackTimer += dt;
      if (this.attackTimer >= GAME_CONFIG.ghostAttackSpeed) {
        this.attackTimer = 0;
        if (this.targetRoom.takeDamage(this.damage)) {
          const broken = this.targetRoom;
          this.targetRoom = null;
          this.state = GhostState.PATROL;
          return broken;
        }
      }
    }

    return null;
  }

  // Check collision with player
  checkPlayerCollision(player: Player): boolean {
    if (player.state !== PlayerState.MOVING) return false;
    if (player.isInvincible()) return false;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist < 30; // Collision radius
  }

  takeDamage(damage: number): boolean {
    this.hp -= damage;
    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  private distanceTo(x: number, y: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  draw(): void {
    const g = this.graphics;
    g.clear();

    // Body color based on state
    let color = COLORS.ghostIdle;
    let size = 22;

    if (this.state === GhostState.CHASE) {
      color = COLORS.ghostAttack;
      size = 25; // Bigger when chasing
    } else if (this.state === GhostState.ATTACK_DOOR) {
      color = 0xff6600;
    }

    // Ghost body
    g.fillStyle(color);
    g.fillCircle(this.x, this.y, size);

    // Wavy bottom
    g.beginPath();
    g.moveTo(this.x - size, this.y + 5);
    for (let i = 0; i <= 6; i++) {
      const wx = this.x - size + (i * size * 2 / 6);
      const wy = this.y + 5 + (i % 2 === 0 ? 10 : 0);
      g.lineTo(wx, wy);
    }
    g.closePath();
    g.fillPath();

    // Eyes
    const eyeOffset = this.state === GhostState.CHASE ? 0 : -2;
    g.fillStyle(0xffffff);
    g.fillCircle(this.x - 7, this.y + eyeOffset, 6);
    g.fillCircle(this.x + 7, this.y + eyeOffset, 6);

    // Pupils (look toward target)
    let pupilOffX = 0, pupilOffY = 0;
    if (this.targetPlayer && this.state === GhostState.CHASE) {
      const angle = Math.atan2(this.targetPlayer.y - this.y, this.targetPlayer.x - this.x);
      pupilOffX = Math.cos(angle) * 2;
      pupilOffY = Math.sin(angle) * 2;
    } else if (this.targetRoom && this.state === GhostState.ATTACK_DOOR) {
      const angle = Math.atan2(this.targetRoom.doorY - this.y, this.targetRoom.doorX - this.x);
      pupilOffX = Math.cos(angle) * 2;
      pupilOffY = Math.sin(angle) * 2;
    }

    g.fillStyle(this.state === GhostState.CHASE ? 0xff0000 : 0x000000);
    g.fillCircle(this.x - 7 + pupilOffX, this.y + eyeOffset + pupilOffY, 3);
    g.fillCircle(this.x + 7 + pupilOffX, this.y + eyeOffset + pupilOffY, 3);

    // Angry eyebrows when chasing
    if (this.state === GhostState.CHASE) {
      g.lineStyle(2, 0x000000);
      g.beginPath();
      g.moveTo(this.x - 12, this.y - 8);
      g.lineTo(this.x - 4, this.y - 5);
      g.moveTo(this.x + 12, this.y - 8);
      g.lineTo(this.x + 4, this.y - 5);
      g.strokePath();
    }

    // Attack indicator
    if (this.state === GhostState.ATTACK_DOOR && this.attackTimer > GAME_CONFIG.ghostAttackSpeed * 0.7) {
      g.fillStyle(0xff0000);
      g.fillCircle(this.x, this.y - 35, 8);
    }

    // HP bar
    this.hpBar.clear();
    const hpPercent = this.hp / this.maxHP;
    const barColor = hpPercent > 0.5 ? COLORS.healthGood : hpPercent > 0.25 ? COLORS.healthMedium : COLORS.healthLow;

    this.hpBar.fillStyle(0x333333);
    this.hpBar.fillRect(this.x - 20, this.y - 40, 40, 6);
    this.hpBar.fillStyle(barColor);
    this.hpBar.fillRect(this.x - 20, this.y - 40, 40 * hpPercent, 6);
  }

  destroy(): void {
    this.graphics.destroy();
    this.hpBar.destroy();
  }
}
