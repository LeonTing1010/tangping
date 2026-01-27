/**
 * 房间类
 */

import Phaser from 'phaser';
import {
  RoomLayout, BED_CONFIGS, DOOR_CONFIGS, BuildingConfig, BuildingType,
  GAME_CONFIG, COLORS
} from '../config/GameConfig';
import { SaveManager } from '../utils/SaveManager';

export interface GridCell {
  col: number;
  row: number;
  x: number;
  y: number;
  building: Building | null;
}

export interface Building {
  type: BuildingType;
  config: BuildingConfig;
  level: number;
  attackTimer: number;
  graphics?: Phaser.GameObjects.Graphics;
}

export class Room {
  scene: Phaser.Scene;
  layout: RoomLayout;
  graphics: Phaser.GameObjects.Graphics;
  doorGraphics: Phaser.GameObjects.Graphics;
  ownerText: Phaser.GameObjects.Text;

  ownerId: number = -1;
  ownerName: string = '';
  isPlayerRoom: boolean = false;

  doorLevel: number = 0;
  doorHP: number;
  doorMaxHP: number;
  doorArmor: number = 0;
  doorX: number = 0;
  doorY: number = 0;

  bedLevel: number = 0;
  isResting: boolean = false;

  grid: GridCell[] = [];
  buildings: Building[] = [];
  turrets: Building[] = [];

  constructor(scene: Phaser.Scene, layout: RoomLayout) {
    this.scene = scene;
    this.layout = layout;

    const bonusHP = SaveManager.getDoorHPBonus();
    this.doorMaxHP = DOOR_CONFIGS[0].hp + bonusHP;
    this.doorHP = this.doorMaxHP;

    this.graphics = scene.add.graphics();
    this.doorGraphics = scene.add.graphics();
    this.ownerText = scene.add.text(
      layout.x + layout.width / 2,
      layout.y + layout.height - 10,
      '',
      { fontSize: '12px', color: '#ffffff' }
    ).setOrigin(0.5);

    this.initGrid();
    this.calcDoorPos();
    this.draw();
  }

  private initGrid(): void {
    const { x, y, gridCols, gridRows } = this.layout;
    const size = GAME_CONFIG.gridSize;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        this.grid.push({
          col, row,
          x: x + 15 + col * size + size / 2,
          y: y + 15 + row * size + size / 2,
          building: null
        });
      }
    }
  }

  private calcDoorPos(): void {
    const { x, y, width, height, doorSide } = this.layout;
    switch (doorSide) {
      case 'bottom': this.doorX = x + width / 2; this.doorY = y + height; break;
      case 'top': this.doorX = x + width / 2; this.doorY = y; break;
      case 'left': this.doorX = x; this.doorY = y + height / 2; break;
      case 'right': this.doorX = x + width; this.doorY = y + height / 2; break;
    }
  }

  draw(): void {
    const g = this.graphics;
    const { x, y, width, height } = this.layout;
    const size = GAME_CONFIG.gridSize;

    g.clear();

    // Floor
    g.fillStyle(COLORS.floor);
    g.fillRect(x, y, width, height);

    // Checkered pattern
    g.fillStyle(COLORS.floorLight);
    for (let r = 0; r < Math.ceil(height / size); r++) {
      for (let c = 0; c < Math.ceil(width / size); c++) {
        if ((r + c) % 2 === 0) {
          g.fillRect(x + c * size, y + r * size, size, size);
        }
      }
    }

    // Grid cells
    g.lineStyle(1, 0xffffff, 0.2);
    for (const cell of this.grid) {
      g.strokeRect(cell.x - size / 2 + 5, cell.y - size / 2 + 5, size - 10, size - 10);
      if (!cell.building && cell !== this.grid[0]) {
        // Draw + sign
        g.lineStyle(1, 0xffffff, 0.3);
        g.beginPath();
        g.moveTo(cell.x - 8, cell.y);
        g.lineTo(cell.x + 8, cell.y);
        g.moveTo(cell.x, cell.y - 8);
        g.lineTo(cell.x, cell.y + 8);
        g.strokePath();
      }
    }

    // Border
    g.lineStyle(4, COLORS.roomBorder);
    g.strokeRect(x, y, width, height);

    // Draw bed
    this.drawBed();

    // Draw buildings
    for (const cell of this.grid) {
      if (cell.building && cell !== this.grid[0]) {
        this.drawBuilding(cell);
      }
    }

    // Draw door
    this.drawDoor();
  }

  private drawBed(): void {
    const g = this.graphics;
    const cell = this.grid[0];

    // Bed base
    g.fillStyle(0x8B4513);
    g.fillRect(cell.x - 18, cell.y - 12, 36, 24);
    g.fillStyle(0xA0522D);
    g.fillRect(cell.x - 16, cell.y - 10, 32, 18);
    g.fillStyle(0xD2B48C);
    g.fillRect(cell.x - 14, cell.y - 8, 14, 14);

    // Person sleeping
    if (this.isResting && this.ownerId >= 0) {
      g.fillStyle(0xffdbac);
      g.fillCircle(cell.x - 7, cell.y - 1, 6);
    }

    // Bed level
    if (this.bedLevel > 0) {
      const lvText = this.scene.add.text(cell.x, cell.y + 18, `Lv${this.bedLevel + 1}`, {
        fontSize: '10px', color: '#4CAF50'
      }).setOrigin(0.5);
      this.scene.time.delayedCall(100, () => lvText.destroy());
    }
  }

  private drawBuilding(cell: GridCell): void {
    if (!cell.building) return;
    const g = this.graphics;

    g.fillStyle(0x2d4a5e, 0.5);
    g.fillRect(cell.x - 20, cell.y - 20, 40, 40);

    // Icon text based on type
    const icons: Record<string, string> = {
      turret: '🔫', generator: '⚡', trap: '🪤', plant: '🌱'
    };
    const icon = icons[cell.building.type] || '?';

    const text = this.scene.add.text(cell.x, cell.y, icon, {
      fontSize: '24px'
    }).setOrigin(0.5);
    this.scene.time.delayedCall(100, () => text.destroy());
  }

  drawDoor(): void {
    const dg = this.doorGraphics;
    const { doorSide } = this.layout;

    dg.clear();

    const isVertical = doorSide === 'left' || doorSide === 'right';
    const dw = isVertical ? 15 : 50;
    const dh = isVertical ? 50 : 15;

    let dx = this.doorX - dw / 2;
    let dy = this.doorY - dh / 2;

    if (doorSide === 'bottom') dy = this.doorY - dh;
    if (doorSide === 'top') dy = this.doorY;
    if (doorSide === 'left') dx = this.doorX - dw;
    if (doorSide === 'right') dx = this.doorX;

    // Door frame
    dg.fillStyle(COLORS.doorFrame);
    dg.fillRect(dx - 3, dy - 3, dw + 6, dh + 6);

    // Health bar
    const hp = this.doorHP / this.doorMaxHP;
    const color = hp > 0.5 ? COLORS.healthGood : hp > 0.25 ? COLORS.healthMedium : COLORS.healthLow;
    dg.fillStyle(color);
    dg.fillRect(dx, dy, dw * hp, dh);

    dg.fillStyle(0x2d2d2d);
    dg.fillRect(dx + dw * hp, dy, dw * (1 - hp), dh);
  }

  setOwner(id: number, name: string, isPlayer: boolean): void {
    this.ownerId = id;
    this.ownerName = name;
    this.isPlayerRoom = isPlayer;
    this.isResting = true;
    this.ownerText.setText(name);
    this.draw();
  }

  takeDamage(damage: number): boolean {
    const actual = Math.max(1, damage - this.doorArmor);
    this.doorHP = Math.max(0, this.doorHP - actual);
    this.drawDoor();
    return this.doorHP <= 0;
  }

  upgradeDoor(): boolean {
    if (this.doorLevel >= DOOR_CONFIGS.length - 1) return false;

    this.doorLevel++;
    const cfg = DOOR_CONFIGS[this.doorLevel];
    this.doorMaxHP = cfg.hp + SaveManager.getDoorHPBonus();
    this.doorHP = this.doorMaxHP;
    this.doorArmor = cfg.armor;
    this.drawDoor();
    return true;
  }

  upgradeBed(): boolean {
    if (this.bedLevel >= BED_CONFIGS.length - 1) return false;
    this.bedLevel++;
    this.draw();
    return true;
  }

  getGoldPerSec(): number {
    let gold = this.isResting ? BED_CONFIGS[this.bedLevel].goldPerSec : 0;
    for (const b of this.buildings) {
      if (b.type === BuildingType.PLANT && b.config.goldPerSec) {
        gold += b.config.goldPerSec;
      }
    }
    return gold;
  }

  getDPS(): number {
    let dps = 0;
    for (const t of this.turrets) {
      if (t.config.damage && t.config.attackSpeed) {
        dps += t.config.damage / t.config.attackSpeed;
      }
    }
    return dps;
  }

  getEmptyCell(): GridCell | null {
    for (let i = 1; i < this.grid.length; i++) {
      if (!this.grid[i].building) return this.grid[i];
    }
    return null;
  }

  buildAt(cell: GridCell, config: BuildingConfig): Building | null {
    if (cell.building) return null;

    const building: Building = {
      type: config.type,
      config,
      level: 1,
      attackTimer: 0
    };

    cell.building = building;
    this.buildings.push(building);

    if (config.type === BuildingType.TURRET) {
      this.turrets.push(building);
    }

    this.draw();
    return building;
  }

  contains(px: number, py: number): boolean {
    const { x, y, width, height } = this.layout;
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }

  getCellAt(px: number, py: number): GridCell | null {
    const size = GAME_CONFIG.gridSize;
    for (const cell of this.grid) {
      if (Math.abs(px - cell.x) < size / 2 && Math.abs(py - cell.y) < size / 2) {
        return cell;
      }
    }
    return null;
  }

  destroy(): void {
    this.graphics.destroy();
    this.doorGraphics.destroy();
    this.ownerText.destroy();
  }
}
