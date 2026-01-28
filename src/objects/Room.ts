/**
 * 房间类 - 带物理墙壁和门
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
  sprite?: Phaser.GameObjects.Sprite;
}

const WALL_SIZE = 16;

export class Room {
  scene: Phaser.Scene;
  layout: RoomLayout;

  // Graphics
  floorGraphics: Phaser.GameObjects.Graphics;
  ownerText: Phaser.GameObjects.Text;

  // Physics objects
  wallSprites: Phaser.Physics.Arcade.Sprite[] = [];
  door!: Phaser.Physics.Arcade.Sprite;
  bedSprite!: Phaser.Physics.Arcade.Sprite;

  // State
  ownerId: number = -1;
  ownerName: string = '';
  isPlayerRoom: boolean = false;

  doorLevel: number = 0;
  doorHP: number;
  doorMaxHP: number;
  doorArmor: number = 0;
  doorX: number = 0;
  doorY: number = 0;
  doorClosed: boolean = false;
  doorUnderAttack: boolean = false;

  bedLevel: number = 0;
  bedX: number = 0;
  bedY: number = 0;
  isResting: boolean = false;

  grid: GridCell[] = [];
  buildings: Building[] = [];
  turrets: Building[] = [];

  constructor(
    scene: Phaser.Scene,
    layout: RoomLayout,
    wallGroup: Phaser.Physics.Arcade.StaticGroup,
    doorGroup: Phaser.Physics.Arcade.Group,
    bedGroup: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.scene = scene;
    this.layout = layout;

    const bonusHP = SaveManager.getDoorHPBonus();
    this.doorMaxHP = DOOR_CONFIGS[0].hp + bonusHP;
    this.doorHP = this.doorMaxHP;

    this.floorGraphics = scene.add.graphics();
    this.ownerText = scene.add.text(
      layout.x + layout.width / 2,
      layout.y + layout.height + 15,
      '',
      { fontSize: '11px', color: '#ffffff', backgroundColor: '#000000aa' }
    ).setOrigin(0.5).setDepth(5);

    this.calcDoorPos();
    this.initGrid();
    this.createWalls(wallGroup);
    this.createDoor(doorGroup);
    this.createBed(bedGroup);
    this.drawFloor();
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

  private initGrid(): void {
    const { x, y, width, height } = this.layout;
    const innerX = x + WALL_SIZE;
    const innerY = y + WALL_SIZE;
    const innerW = width - WALL_SIZE * 2;
    const innerH = height - WALL_SIZE * 2;
    const cellSize = 40;

    const cols = Math.floor(innerW / cellSize);
    const rows = Math.floor(innerH / cellSize);

    // Bed position (center of room)
    this.bedX = x + width / 2;
    this.bedY = y + height / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = innerX + col * cellSize + cellSize / 2;
        const cellY = innerY + row * cellSize + cellSize / 2;

        // Skip bed position
        if (Math.abs(cellX - this.bedX) < cellSize && Math.abs(cellY - this.bedY) < cellSize) {
          continue;
        }

        this.grid.push({
          col, row,
          x: cellX,
          y: cellY,
          building: null
        });
      }
    }
  }

  private createWalls(wallGroup: Phaser.Physics.Arcade.StaticGroup): void {
    const { x, y, width, height, doorSide } = this.layout;

    // Create walls around the room perimeter
    // Top wall
    for (let wx = x; wx < x + width; wx += WALL_SIZE) {
      if (doorSide === 'top' && Math.abs(wx - this.doorX) < 25) continue;
      const wall = wallGroup.create(wx + WALL_SIZE / 2, y + WALL_SIZE / 2, 'wall');
      wall.setDisplaySize(WALL_SIZE, WALL_SIZE).refreshBody();
      this.wallSprites.push(wall);
    }

    // Bottom wall
    for (let wx = x; wx < x + width; wx += WALL_SIZE) {
      if (doorSide === 'bottom' && Math.abs(wx - this.doorX) < 25) continue;
      const wall = wallGroup.create(wx + WALL_SIZE / 2, y + height - WALL_SIZE / 2, 'wall');
      wall.setDisplaySize(WALL_SIZE, WALL_SIZE).refreshBody();
      this.wallSprites.push(wall);
    }

    // Left wall
    for (let wy = y + WALL_SIZE; wy < y + height - WALL_SIZE; wy += WALL_SIZE) {
      if (doorSide === 'left' && Math.abs(wy - this.doorY) < 25) continue;
      const wall = wallGroup.create(x + WALL_SIZE / 2, wy + WALL_SIZE / 2, 'wall');
      wall.setDisplaySize(WALL_SIZE, WALL_SIZE).refreshBody();
      this.wallSprites.push(wall);
    }

    // Right wall
    for (let wy = y + WALL_SIZE; wy < y + height - WALL_SIZE; wy += WALL_SIZE) {
      if (doorSide === 'right' && Math.abs(wy - this.doorY) < 25) continue;
      const wall = wallGroup.create(x + width - WALL_SIZE / 2, wy + WALL_SIZE / 2, 'wall');
      wall.setDisplaySize(WALL_SIZE, WALL_SIZE).refreshBody();
      this.wallSprites.push(wall);
    }
  }

  private createDoor(doorGroup: Phaser.Physics.Arcade.Group): void {
    const { doorSide } = this.layout;
    const isHorizontal = doorSide === 'top' || doorSide === 'bottom';

    this.door = doorGroup.create(this.doorX, this.doorY, isHorizontal ? 'door_h' : 'door_v');
    this.door.setImmovable(true);

    if (isHorizontal) {
      this.door.setDisplaySize(50, 12);
      this.door.body?.setSize(50, 12);
    } else {
      this.door.setDisplaySize(12, 50);
      this.door.body?.setSize(12, 50);
    }

    // Store reference to this room on the door
    this.door.setData('room', this);
    this.door.setData('closed', false);
    this.door.setData('hp', this.doorHP);
    this.door.setData('maxHp', this.doorMaxHP);
  }

  private createBed(bedGroup: Phaser.Physics.Arcade.StaticGroup): void {
    this.bedSprite = bedGroup.create(this.bedX, this.bedY, 'bed') as Phaser.Physics.Arcade.Sprite;
    this.bedSprite.setDisplaySize(40, 30);
    this.bedSprite.setData('room', this);
    this.bedSprite.refreshBody();
  }

  private drawFloor(): void {
    const g = this.floorGraphics;
    const { x, y, width, height } = this.layout;

    g.clear();

    // Room floor
    g.fillStyle(COLORS.floor, 1);
    g.fillRect(x + WALL_SIZE, y + WALL_SIZE, width - WALL_SIZE * 2, height - WALL_SIZE * 2);

    // Floor pattern
    g.fillStyle(COLORS.floorLight, 0.3);
    for (let py = y + WALL_SIZE; py < y + height - WALL_SIZE; py += 20) {
      for (let px = x + WALL_SIZE; px < x + width - WALL_SIZE; px += 20) {
        if ((Math.floor((px - x) / 20) + Math.floor((py - y) / 20)) % 2 === 0) {
          g.fillRect(px, py, 20, 20);
        }
      }
    }

    // Grid cells for building
    g.lineStyle(1, 0xffffff, 0.1);
    for (const cell of this.grid) {
      g.strokeRect(cell.x - 18, cell.y - 18, 36, 36);
    }
  }

  closeDoor(): void {
    if (this.doorClosed) return;
    this.doorClosed = true;
    this.door.setData('closed', true);
    this.door.setTint(0x4ade80);
  }

  openDoor(): void {
    this.doorClosed = false;
    this.door.setData('closed', false);
    this.door.clearTint();
  }

  isDoorClosed(): boolean {
    return this.doorClosed;
  }

  takeDamage(damage: number): boolean {
    const actual = Math.max(1, damage - this.doorArmor);
    this.doorHP = Math.max(0, this.doorHP - actual);
    this.door.setData('hp', this.doorHP);

    // Flash red
    this.door.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.doorClosed && this.doorHP > 0) {
        this.door.setTint(0x4ade80);
      }
    });

    if (this.doorHP <= 0) {
      this.door.destroy();
      this.doorClosed = false;
      return true;
    }
    return false;
  }

  setOwner(id: number, name: string, isPlayer: boolean): void {
    this.ownerId = id;
    this.ownerName = name;
    this.isPlayerRoom = isPlayer;
    this.isResting = true;
    this.ownerText.setText(name);
    this.closeDoor();
  }

  clearOwner(): void {
    this.ownerId = -1;
    this.ownerName = '';
    this.isPlayerRoom = false;
    this.isResting = false;
    this.ownerText.setText('');
  }

  upgradeDoor(): boolean {
    if (this.doorLevel >= DOOR_CONFIGS.length - 1) return false;

    this.doorLevel++;
    const cfg = DOOR_CONFIGS[this.doorLevel];
    this.doorMaxHP = cfg.hp + SaveManager.getDoorHPBonus();
    this.doorHP = this.doorMaxHP;
    this.doorArmor = cfg.armor;
    this.door.setData('hp', this.doorHP);
    this.door.setData('maxHp', this.doorMaxHP);
    return true;
  }

  upgradeBed(): boolean {
    if (this.bedLevel >= BED_CONFIGS.length - 1) return false;
    this.bedLevel++;
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
    for (const cell of this.grid) {
      if (!cell.building) return cell;
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

    // Create sprite for turret
    if (config.type === BuildingType.TURRET) {
      building.sprite = this.scene.add.sprite(cell.x, cell.y, 'tower').setDepth(5);
    }

    cell.building = building;
    this.buildings.push(building);

    if (config.type === BuildingType.TURRET) {
      this.turrets.push(building);
    }

    return building;
  }

  contains(px: number, py: number): boolean {
    const { x, y, width, height } = this.layout;
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }

  getCellAt(px: number, py: number): GridCell | null {
    for (const cell of this.grid) {
      if (Math.abs(px - cell.x) < 18 && Math.abs(py - cell.y) < 18) {
        return cell;
      }
    }
    return null;
  }

  destroy(): void {
    this.floorGraphics.destroy();
    this.ownerText.destroy();
    for (const wall of this.wallSprites) {
      wall.destroy();
    }
    if (this.door && this.door.active) this.door.destroy();
    if (this.bedSprite && this.bedSprite.active) this.bedSprite.destroy();
    for (const b of this.buildings) {
      if (b.sprite) b.sprite.destroy();
    }
  }
}
