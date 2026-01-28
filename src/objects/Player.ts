/**
 * 玩家类 - 物理精灵 + 点击移动
 */

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { Room } from './Room';

export enum PlayerState {
  MOVING = 'moving',       // 移动中，不产金币，可被抓
  LYING_DOWN = 'lying_down' // 躺平中，产金币，受门保护
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  state: PlayerState = PlayerState.MOVING;
  currentRoom: Room | null = null;

  // Stats
  gold: number = 50;
  goldPerSec: number = 0;
  hp: number = 100;
  maxHp: number = 100;

  // Movement
  moveSpeed: number = GAME_CONFIG.playerSpeed;
  targetX: number = 0;
  targetY: number = 0;
  isMovingToTarget: boolean = false;

  // Invincibility after getting up
  invincibleTimer: number = 0;

  // Visual overlay
  overlay: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCircle(12, 4, 4);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.overlay = scene.add.graphics().setDepth(11);
  }

  moveTo(x: number, y: number): void {
    if (this.state === PlayerState.LYING_DOWN) return;

    this.targetX = x;
    this.targetY = y;
    this.isMovingToTarget = true;

    this.scene.physics.moveToObject(this, { x, y }, this.moveSpeed);
  }

  stopMoving(): void {
    this.isMovingToTarget = false;
    this.setVelocity(0, 0);
  }

  update(dt: number): void {
    // Update invincibility
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    // Check if reached target
    if (this.isMovingToTarget) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
      if (dist < 10) {
        this.stopMoving();
      }
    }

    // Generate gold if lying down
    if (this.state === PlayerState.LYING_DOWN && this.currentRoom) {
      this.goldPerSec = this.currentRoom.getGoldPerSec();
      this.gold += this.goldPerSec * dt;
    }

    // Draw overlay effects
    this.drawOverlay();
  }

  lieDown(room: Room): void {
    if (this.state === PlayerState.LYING_DOWN) return;

    this.state = PlayerState.LYING_DOWN;
    this.currentRoom = room;
    this.stopMoving();

    // Snap to bed position
    this.setPosition(room.bedX, room.bedY);

    room.setOwner(0, '玩家', true);
  }

  getUp(): void {
    if (this.state === PlayerState.MOVING) return;

    this.state = PlayerState.MOVING;
    this.invincibleTimer = GAME_CONFIG.playerInvincibleTime;

    if (this.currentRoom) {
      // Move player to door position
      const room = this.currentRoom;
      const doorSide = room.layout.doorSide;
      let exitX = room.doorX;
      let exitY = room.doorY;

      // Position outside the door
      if (doorSide === 'top') exitY -= 30;
      else if (doorSide === 'bottom') exitY += 30;
      else if (doorSide === 'left') exitX -= 30;
      else if (doorSide === 'right') exitX += 30;

      this.setPosition(exitX, exitY);
      this.currentRoom.clearOwner();
      this.currentRoom = null;
    }
  }

  isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  isLyingDown(): boolean {
    return this.state === PlayerState.LYING_DOWN;
  }

  private drawOverlay(): void {
    this.overlay.clear();

    // Invincibility shield effect
    if (this.invincibleTimer > 0) {
      const alpha = 0.3 + Math.sin(Date.now() / 80) * 0.3;
      this.overlay.lineStyle(3, 0x00ffff, alpha);
      this.overlay.strokeCircle(this.x, this.y, 20);
    }

    // Sleeping Zzz effect
    if (this.state === PlayerState.LYING_DOWN) {
      this.overlay.fillStyle(0xffffff, 0.8);
      const t = Date.now() / 500;
      this.overlay.fillCircle(this.x + 15 + Math.sin(t) * 2, this.y - 15, 4);
      this.overlay.fillCircle(this.x + 22 + Math.sin(t + 1) * 2, this.y - 22, 3);
      this.overlay.fillCircle(this.x + 27 + Math.sin(t + 2) * 2, this.y - 28, 2);
    }
  }

  destroy(fromScene?: boolean): void {
    this.overlay.destroy();
    super.destroy(fromScene);
  }
}
