/**
 * AI玩家类
 */

import { Room } from './Room';
import {
  BED_CONFIGS, DOOR_CONFIGS, BUILDING_CONFIGS, AI_PLAYERS, DEATH_MESSAGES
} from '../config/GameConfig';

export class AIPlayer {
  id: number;
  name: string;
  color: number;
  room: Room | null = null;
  alive: boolean = true;
  gold: number = 0;
  upgradeTimer: number = 0;

  constructor(index: number) {
    this.id = index + 1;
    this.name = AI_PLAYERS[index].name;
    this.color = AI_PLAYERS[index].color;
  }

  setRoom(room: Room): void {
    this.room = room;
    room.setOwner(this.id, this.name, false);
  }

  update(dt: number): void {
    if (!this.alive || !this.room) return;

    this.gold += this.room.getGoldPerSec() * dt;

    this.upgradeTimer += dt;
    if (this.upgradeTimer >= 2) {
      this.upgradeTimer = 0;
      this.doUpgrade();
    }
  }

  private doUpgrade(): void {
    if (!this.room) return;

    // Priority 1: Upgrade door if damaged
    if (this.room.doorHP < this.room.doorMaxHP * 0.5 && this.room.doorLevel < DOOR_CONFIGS.length - 1) {
      const cost = DOOR_CONFIGS[this.room.doorLevel + 1].cost;
      if (this.gold >= cost) {
        this.gold -= cost;
        this.room.upgradeDoor();
        return;
      }
    }

    // Priority 2: Upgrade bed
    if (this.room.bedLevel < BED_CONFIGS.length - 1) {
      const cost = BED_CONFIGS[this.room.bedLevel + 1].cost;
      if (this.gold >= cost) {
        this.gold -= cost;
        this.room.upgradeBed();
        return;
      }
    }

    // Priority 3: Build turret
    const cell = this.room.getEmptyCell();
    if (cell && this.gold >= BUILDING_CONFIGS.turret.cost) {
      this.gold -= BUILDING_CONFIGS.turret.cost;
      this.room.buildAt(cell, BUILDING_CONFIGS.turret);
    }
  }

  die(): string {
    this.alive = false;
    const msg = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];
    return `${this.name} ${msg}`;
  }
}
