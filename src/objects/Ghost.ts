/**
 * 猛鬼AI类 - 状态机实现
 */

import Phaser from 'phaser';
import { GhostState, GAME_CONFIG, COLORS } from '../config/GameConfig';
import { Room } from './Room';

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

  state: GhostState = GhostState.IDLE;
  targetRoom: Room | null = null;
  attackTimer: number = 0;
  idleTimer: number = 0;
  idleTargetX: number;
  idleTargetY: number;

  isDead: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, wave: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;

    // Scale stats by wave
    const scale = 1 + wave * GAME_CONFIG.difficultyScale;
    this.maxHP = Math.floor(GAME_CONFIG.ghostBaseHP * scale);
    this.hp = this.maxHP;
    this.damage = Math.floor(GAME_CONFIG.ghostBaseDamage * scale);
    this.speed = GAME_CONFIG.ghostSpeed;

    this.idleTargetX = x;
    this.idleTargetY = y + 100;

    this.graphics = scene.add.graphics();
    this.hpBar = scene.add.graphics();

    this.draw();
  }

  update(dt: number, rooms: Room[]): Room | null {
    if (this.isDead) return null;

    let brokenRoom: Room | null = null;

    switch (this.state) {
      case GhostState.IDLE:
        this.updateIdle(dt, rooms);
        break;
      case GhostState.ATTACK:
        brokenRoom = this.updateAttack(dt);
        break;
      case GhostState.RETREAT:
        this.updateRetreat(dt);
        break;
    }

    this.draw();
    return brokenRoom;
  }

  private updateIdle(dt: number, rooms: Room[]): void {
    this.idleTimer += dt;

    const dx = this.idleTargetX - this.x;
    const dy = this.idleTargetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      this.x += (dx / dist) * this.speed * 0.5 * dt;
      this.y += (dy / dist) * this.speed * 0.5 * dt;
    } else {
      this.idleTargetX = 150 + Math.random() * 150;
      this.idleTargetY = 200 + Math.random() * 300;
    }

    if (this.idleTimer >= 3 + Math.random() * 2) {
      const valid = rooms.filter(r => r.ownerId >= 0 && r.doorHP > 0);
      if (valid.length > 0) {
        this.targetRoom = valid[Math.floor(Math.random() * valid.length)];
        this.state = GhostState.ATTACK;
        this.attackTimer = 0;
      }
      this.idleTimer = 0;
    }
  }

  private updateAttack(dt: number): Room | null {
    if (!this.targetRoom || this.targetRoom.doorHP <= 0) {
      this.state = GhostState.IDLE;
      this.idleTimer = 0;
      this.targetRoom = null;
      return null;
    }

    // Retreat if low HP
    if (this.hp / this.maxHP < GAME_CONFIG.retreatThreshold) {
      this.state = GhostState.RETREAT;
      return null;
    }

    const room = this.targetRoom;
    let tx = room.doorX;
    let ty = room.doorY;

    if (room.layout.doorSide === 'top') ty -= 30;
    else if (room.layout.doorSide === 'bottom') ty += 30;
    else if (room.layout.doorSide === 'left') tx -= 30;
    else if (room.layout.doorSide === 'right') tx += 30;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 40) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    } else {
      this.attackTimer += dt;
      if (this.attackTimer >= GAME_CONFIG.ghostAttackSpeed) {
        this.attackTimer = 0;
        if (this.targetRoom.takeDamage(this.damage)) {
          const broken = this.targetRoom;
          this.targetRoom = null;
          this.state = GhostState.IDLE;
          this.idleTimer = 0;
          return broken;
        }
      }
    }

    return null;
  }

  private updateRetreat(dt: number): void {
    const dx = this.spawnX - this.x;
    const dy = this.spawnY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      this.x += (dx / dist) * this.speed * 1.5 * dt;
      this.y += (dy / dist) * this.speed * 1.5 * dt;
    } else {
      this.hp += GAME_CONFIG.healRate * dt;
      if (this.hp >= this.maxHP * 0.8) {
        this.hp = Math.min(this.hp, this.maxHP);
        this.state = GhostState.IDLE;
        this.idleTimer = 0;
      }
    }
  }

  takeDamage(damage: number): boolean {
    this.hp -= damage;
    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  draw(): void {
    const g = this.graphics;
    g.clear();

    // Body color based on state
    let color = COLORS.ghostIdle;
    if (this.state === GhostState.ATTACK) color = COLORS.ghostAttack;
    else if (this.state === GhostState.RETREAT) color = COLORS.ghostRetreat;

    // Body
    g.fillStyle(color);
    g.fillCircle(this.x, this.y, 20);

    // Eyes
    g.fillStyle(0xffffff);
    g.fillCircle(this.x - 6, this.y - 3, 5);
    g.fillCircle(this.x + 6, this.y - 3, 5);

    g.fillStyle(0x000000);
    g.fillCircle(this.x - 6, this.y - 3, 2);
    g.fillCircle(this.x + 6, this.y - 3, 2);

    // HP bar
    this.hpBar.clear();
    const hpPercent = this.hp / this.maxHP;
    const barColor = hpPercent > 0.5 ? COLORS.healthGood : hpPercent > 0.25 ? COLORS.healthMedium : COLORS.healthLow;

    this.hpBar.fillStyle(0x333333);
    this.hpBar.fillRect(this.x - 20, this.y - 35, 40, 6);
    this.hpBar.fillStyle(barColor);
    this.hpBar.fillRect(this.x - 20, this.y - 35, 40 * hpPercent, 6);

    // Attack indicator
    if (this.state === GhostState.ATTACK && this.attackTimer > GAME_CONFIG.ghostAttackSpeed * 0.7) {
      g.fillStyle(0xff0000);
      g.fillCircle(this.x, this.y - 45, 8);
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.hpBar.destroy();
  }
}
