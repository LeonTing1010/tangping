/**
 * 玩家类 - 可移动 + 状态机
 */

import Phaser from 'phaser';
import { COLORS } from '../config/GameConfig';
import { Room } from './Room';

export enum PlayerState {
  MOVING = 'moving',       // 移动中，不产金币，可被抓
  LYING_DOWN = 'lying_down' // 躺平中，产金币，受门保护
}

export class Player {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  graphics: Phaser.GameObjects.Graphics;

  x: number;
  y: number;
  speed: number = 120;

  state: PlayerState = PlayerState.MOVING;
  currentRoom: Room | null = null;

  // Movement
  velocityX: number = 0;
  velocityY: number = 0;

  // Stats
  gold: number = 50;
  goldPerSec: number = 0;

  // Invincibility after getting up
  invincibleTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // Create container for player visuals
    this.sprite = scene.add.container(x, y);

    // Body circle (for collision detection visual)
    this.body = scene.add.circle(0, 0, 15, 0x4CAF50);
    this.body.setStrokeStyle(2, 0xffffff);

    // Graphics for details
    this.graphics = scene.add.graphics();

    this.sprite.add([this.body, this.graphics]);
    this.sprite.setDepth(100);

    this.draw();
  }

  setVelocity(vx: number, vy: number): void {
    if (this.state === PlayerState.LYING_DOWN) {
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }

    this.velocityX = vx;
    this.velocityY = vy;

    // Normalize if diagonal
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag > 1) {
      this.velocityX = (vx / mag) * this.speed;
      this.velocityY = (vy / mag) * this.speed;
    } else {
      this.velocityX = vx * this.speed;
      this.velocityY = vy * this.speed;
    }
  }

  update(dt: number, mapWidth: number, mapHeight: number): void {
    // Update invincibility
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    if (this.state === PlayerState.MOVING) {
      // Apply velocity
      this.x += this.velocityX * dt;
      this.y += this.velocityY * dt;

      // Clamp to map bounds
      this.x = Phaser.Math.Clamp(this.x, 20, mapWidth - 20);
      this.y = Phaser.Math.Clamp(this.y, 20, mapHeight - 20);

      // Update sprite position
      this.sprite.setPosition(this.x, this.y);
    } else if (this.state === PlayerState.LYING_DOWN) {
      // Generate gold
      if (this.currentRoom) {
        this.goldPerSec = this.currentRoom.getGoldPerSec();
        this.gold += this.goldPerSec * dt;
      }
    }

    this.draw();
  }

  lieDown(room: Room): void {
    if (this.state === PlayerState.LYING_DOWN) return;

    this.state = PlayerState.LYING_DOWN;
    this.currentRoom = room;
    this.velocityX = 0;
    this.velocityY = 0;

    // Snap to bed position
    const bedCell = room.grid[0];
    this.x = bedCell.x;
    this.y = bedCell.y;
    this.sprite.setPosition(this.x, this.y);

    room.setOwner(0, '玩家', true);
  }

  getUp(): void {
    if (this.state === PlayerState.MOVING) return;

    this.state = PlayerState.MOVING;
    this.invincibleTimer = 1.5; // 1.5 seconds invincibility

    if (this.currentRoom) {
      // Move player outside the room
      const room = this.currentRoom;
      this.currentRoom.clearOwner();
      this.currentRoom = null;

      // Position at door
      this.x = room.doorX;
      this.y = room.doorY + 30;
      this.sprite.setPosition(this.x, this.y);
    }
  }

  isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  draw(): void {
    const g = this.graphics;
    g.clear();

    if (this.state === PlayerState.MOVING) {
      // Running player
      this.body.setFillStyle(0x4CAF50);

      // Face
      g.fillStyle(0xffdbac);
      g.fillCircle(0, -5, 10);

      // Eyes
      g.fillStyle(0x000000);
      g.fillCircle(-3, -7, 2);
      g.fillCircle(3, -7, 2);

      // Direction indicator (arrow)
      if (Math.abs(this.velocityX) > 1 || Math.abs(this.velocityY) > 1) {
        const angle = Math.atan2(this.velocityY, this.velocityX);
        g.lineStyle(3, 0xffffff);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
        g.strokePath();
      }

      // Invincibility effect
      if (this.invincibleTimer > 0) {
        g.lineStyle(3, 0x00ffff, 0.5 + Math.sin(Date.now() / 100) * 0.5);
        g.strokeCircle(0, 0, 20);
      }
    } else {
      // Sleeping player
      this.body.setFillStyle(0x2196F3);

      // Zzz
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(15, -15, 5);
      g.fillCircle(22, -22, 4);
      g.fillCircle(27, -28, 3);
    }
  }

  getBounds(): { x: number; y: number; radius: number } {
    return { x: this.x, y: this.y, radius: 15 };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
