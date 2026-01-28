/**
 * 游戏主场景 - 物理碰撞版
 */

import Phaser from 'phaser';
import {
  GameState, GAME_CONFIG, ROOM_LAYOUTS, COLORS, BUILDING_CONFIGS, BED_CONFIGS, DOOR_CONFIGS
} from '../config/GameConfig';
import { Room } from '../objects/Room';
import { Ghost, GhostState } from '../objects/Ghost';
import { Player, PlayerState } from '../objects/Player';
import { SaveManager } from '../utils/SaveManager';

export class GameScene extends Phaser.Scene {
  gameState: GameState = GameState.PLAYING;

  // Physics groups
  walls!: Phaser.Physics.Arcade.StaticGroup;
  doors!: Phaser.Physics.Arcade.Group;
  beds!: Phaser.Physics.Arcade.StaticGroup;
  bullets!: Phaser.Physics.Arcade.Group;

  player!: Player;
  ghost: Ghost | null = null;
  rooms: Room[] = [];
  ghostSpawned: boolean = false;

  // Camera drag
  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  cameraFollowEnabled: boolean = true;

  wave: number = 0;
  kills: number = 0;
  gameTimer: number = 0;
  spawnTimer: number = 0;

  // Map
  mapWidth: number = GAME_CONFIG.mapWidth;
  mapHeight: number = GAME_CONFIG.mapHeight;

  // UI
  uiGraphics!: Phaser.GameObjects.Graphics;
  goldText!: Phaser.GameObjects.Text;
  timerText!: Phaser.GameObjects.Text;
  statusText!: Phaser.GameObjects.Text;
  messageText!: Phaser.GameObjects.Text;

  // Upgrade panel
  upgradePanel!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.createTextures();
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Wall texture - brick style
    g.clear();
    g.fillStyle(0x2d3748);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x1a202c);
    g.fillRect(0, 0, 7, 7);
    g.fillRect(8, 8, 8, 8);
    g.lineStyle(1, 0x4a5568);
    g.strokeRect(0, 0, 16, 16);
    g.generateTexture('wall', 16, 16);

    // Floor texture - wooden floor style
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, 64, 64);
    // Wood grain effect
    g.fillStyle(0x232340);
    for (let i = 0; i < 64; i += 16) {
      g.fillRect(0, i, 64, 2);
    }
    g.lineStyle(1, 0x2d2d4a, 0.5);
    g.strokeRect(0, 0, 32, 64);
    g.strokeRect(32, 0, 32, 64);
    g.generateTexture('floor', 64, 64);

    // Door horizontal - wooden door with handle
    g.clear();
    g.fillStyle(0x8b4513);
    g.fillRect(0, 0, 50, 12);
    g.fillStyle(0x654321);
    g.fillRect(2, 2, 46, 8);
    g.fillStyle(0xffd700);
    g.fillCircle(40, 6, 3);
    g.generateTexture('door_h', 50, 12);

    // Door vertical
    g.clear();
    g.fillStyle(0x8b4513);
    g.fillRect(0, 0, 12, 50);
    g.fillStyle(0x654321);
    g.fillRect(2, 2, 8, 46);
    g.fillStyle(0xffd700);
    g.fillCircle(6, 40, 3);
    g.generateTexture('door_v', 12, 50);

    // Bed - cozy bed with pillow and blanket
    g.clear();
    // Frame
    g.fillStyle(0x5d4037);
    g.fillRect(0, 0, 50, 35);
    // Mattress
    g.fillStyle(0xe8e8e8);
    g.fillRect(3, 3, 44, 29);
    // Pillow
    g.fillStyle(0xffffff);
    g.fillRect(5, 5, 15, 10);
    // Blanket
    g.fillStyle(0x3b82f6);
    g.fillRect(5, 16, 40, 14);
    g.fillStyle(0x2563eb);
    g.fillRect(5, 26, 40, 4);
    g.generateTexture('bed', 50, 35);

    // Player - cute character
    g.clear();
    // Body
    g.fillStyle(0x60a5fa);
    g.fillRect(8, 16, 16, 14);
    // Head
    g.fillStyle(0xfcd9b6);
    g.fillCircle(16, 12, 10);
    // Hair
    g.fillStyle(0x4a3728);
    g.fillRect(6, 4, 20, 6);
    // Eyes
    g.fillStyle(0x000000);
    g.fillCircle(12, 12, 2);
    g.fillCircle(20, 12, 2);
    // Smile
    g.lineStyle(1, 0x000000);
    g.beginPath();
    g.arc(16, 14, 4, 0.2, Math.PI - 0.2);
    g.strokePath();
    g.generateTexture('player', 32, 32);

    // Ghost - scary but cute ghost
    g.clear();
    // Body - wavy bottom
    g.fillStyle(0x4a1a6b);
    g.fillCircle(20, 16, 16);
    g.fillRect(4, 16, 32, 16);
    // Wavy bottom
    g.fillStyle(0x1a1a2e);
    g.fillRect(4, 28, 8, 8);
    g.fillRect(20, 28, 8, 8);
    g.fillStyle(0x4a1a6b);
    g.fillCircle(8, 32, 4);
    g.fillCircle(16, 32, 4);
    g.fillCircle(24, 32, 4);
    g.fillCircle(32, 32, 4);
    // Glowing red eyes
    g.fillStyle(0xff0000);
    g.fillCircle(14, 14, 5);
    g.fillCircle(26, 14, 5);
    g.fillStyle(0xffff00);
    g.fillCircle(14, 14, 2);
    g.fillCircle(26, 14, 2);
    g.generateTexture('ghost', 40, 40);

    // Tower - defensive turret
    g.clear();
    // Base
    g.fillStyle(0x374151);
    g.fillRect(6, 20, 20, 12);
    // Turret body
    g.fillStyle(0x4b5563);
    g.fillCircle(16, 16, 10);
    // Barrel
    g.fillStyle(0x1f2937);
    g.fillRect(14, 2, 4, 14);
    // Accent
    g.fillStyle(0x10b981);
    g.fillCircle(16, 16, 4);
    g.generateTexture('tower', 32, 32);

    // Bullet - energy ball
    g.clear();
    g.fillStyle(0x10b981);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0x34d399);
    g.fillCircle(5, 5, 3);
    g.generateTexture('bullet', 12, 12);

    // Furniture - desk
    g.clear();
    g.fillStyle(0x78350f);
    g.fillRect(0, 8, 32, 16);
    g.fillStyle(0x92400e);
    g.fillRect(2, 10, 28, 12);
    g.generateTexture('desk', 32, 24);

    // Furniture - lamp
    g.clear();
    g.fillStyle(0xfbbf24);
    g.fillCircle(10, 8, 8);
    g.fillStyle(0x78716c);
    g.fillRect(8, 16, 4, 14);
    g.generateTexture('lamp', 20, 30);

    // Furniture - plant
    g.clear();
    g.fillStyle(0x7c2d12);
    g.fillRect(4, 16, 12, 10);
    g.fillStyle(0x22c55e);
    g.fillCircle(10, 12, 8);
    g.fillCircle(6, 8, 5);
    g.fillCircle(14, 8, 5);
    g.generateTexture('plant_decor', 20, 26);

    g.destroy();
  }

  create(): void {
    this.gameState = GameState.PLAYING;
    this.wave = 0;
    this.kills = 0;
    this.gameTimer = 0;
    this.spawnTimer = GAME_CONFIG.ghostDelay;

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // Create background
    this.createBackground();

    // Create physics groups
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.group();
    this.beds = this.physics.add.staticGroup();
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });

    // Create rooms
    this.createRooms();

    // Create player
    this.createPlayer();

    // Ghost will spawn after delay (not immediately)
    this.ghostSpawned = false;

    // Setup colliders
    this.setupColliders();

    // Setup camera
    this.setupCamera();

    // Create UI
    this.createUI();

    // Input handling - click to move, drag to pan camera
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
  }

  private createBackground(): void {
    const g = this.add.graphics().setDepth(-2);

    // Dark corridor floor
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // Add some texture/variation to corridors
    g.fillStyle(0x16162a, 0.5);
    for (let y = 0; y < this.mapHeight; y += 40) {
      for (let x = 0; x < this.mapWidth; x += 40) {
        if ((x + y) % 80 === 0) {
          g.fillRect(x, y, 40, 40);
        }
      }
    }

    // Add corridor lighting effect (subtle lighter spots)
    g.fillStyle(0x2a2a4e, 0.3);
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(100, this.mapWidth - 100);
      const y = Phaser.Math.Between(100, this.mapHeight - 100);
      g.fillCircle(x, y, Phaser.Math.Between(30, 60));
    }

    // Map border with glow effect
    g.lineStyle(6, 0x1e3a5f);
    g.strokeRect(3, 3, this.mapWidth - 6, this.mapHeight - 6);
    g.lineStyle(2, 0x3b82f6);
    g.strokeRect(5, 5, this.mapWidth - 10, this.mapHeight - 10);

    // Add decorative elements in corridors
    this.addCorridorDecorations();
  }

  private addCorridorDecorations(): void {
    // Add some random decorations in corridor areas
    const decorPositions = [
      { x: 350, y: 350 },
      { x: 850, y: 350 },
      { x: 350, y: 750 },
      { x: 850, y: 750 },
      { x: 600, y: 450 },
      { x: 600, y: 1150 },
    ];

    for (const pos of decorPositions) {
      // Add a small light/lamp sprite
      if (this.textures.exists('lamp')) {
        const lamp = this.add.sprite(pos.x, pos.y, 'lamp').setDepth(0).setAlpha(0.7);
      }
    }
  }

  private createRooms(): void {
    this.rooms = [];
    for (const layout of ROOM_LAYOUTS) {
      const room = new Room(this, layout, this.walls, this.doors, this.beds);
      this.rooms.push(room);
    }
  }

  private createPlayer(): void {
    // Start in center corridor area
    this.player = new Player(this, this.mapWidth / 2, this.mapHeight / 2 - 100);
    this.player.gold = SaveManager.getStartGoldBonus();
  }

  private spawnGhost(): void {
    if (this.ghostSpawned) return;
    this.ghostSpawned = true;

    this.wave++;
    // Spawn ghost 400-600 pixels away from player in a random direction
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(400, 600);
    let x = this.player.x + Math.cos(angle) * distance;
    let y = this.player.y + Math.sin(angle) * distance;

    // Clamp to map bounds
    x = Phaser.Math.Clamp(x, 50, this.mapWidth - 50);
    y = Phaser.Math.Clamp(y, 50, this.mapHeight - 50);

    this.ghost = new Ghost(this, x, y, this.wave);

    // Setup ghost colliders
    this.physics.add.collider(this.ghost, this.walls);
    this.physics.add.collider(this.ghost, this.doors, (ghost, door) => {
      const g = ghost as Ghost;
      const d = door as Phaser.Physics.Arcade.Sprite;
      if (d.getData('closed')) {
        g.onDoorCollision(d);
      }
    }, (ghost, door) => {
      const d = door as Phaser.Physics.Arcade.Sprite;
      return d.getData('closed') === true;
    });

    this.physics.add.overlap(this.ghost, this.player, () => {
      if (this.player.isInvincible()) return;
      // Game over if player is moving
      if (this.player.state === PlayerState.MOVING) {
        this.endGame(false, '被猎梦者抓住了！');
        return;
      }
      // Game over if lying down but door is open
      if (this.player.state === PlayerState.LYING_DOWN && this.player.currentRoom) {
        if (!this.player.currentRoom.isDoorClosed()) {
          this.endGame(false, '门没关好，被猎梦者抓住了！');
        }
      }
    });

    this.physics.add.overlap(this.bullets, this.ghost, (ghost, bullet) => {
      bullet.destroy();
      const g = ghost as Ghost;
      if (g.takeDamage(BUILDING_CONFIGS.turret.damage || 5)) {
        this.kills++;
        this.player.gold += GAME_CONFIG.killReward;
        g.destroy();
        this.ghost = null;
        // Spawn new ghost after delay
        this.time.delayedCall(3000, () => this.spawnNewGhost());
      }
    });

    this.showMessage('猎梦者出现了！快找房间躺下！');
  }

  private setupColliders(): void {
    // Player collides with walls
    this.physics.add.collider(this.player, this.walls);

    // Player collides with closed doors (but can pass through open doors)
    this.physics.add.collider(this.player, this.doors, undefined, (player, door) => {
      const d = door as Phaser.Physics.Arcade.Sprite;
      // If door is open (not closed), allow passage
      if (!d.getData('closed')) return false;
      // If this is player's room, allow passage
      const room = d.getData('room') as Room;
      if (room && room.isPlayerRoom) return false;
      return true; // Block otherwise
    });

    // Player overlaps with beds - trigger lying down
    this.physics.add.overlap(this.player, this.beds, (player, bed) => {
      const b = bed as Phaser.Physics.Arcade.Sprite;
      const room = b.getData('room') as Room;

      if (this.player.state === PlayerState.MOVING && room && room.ownerId < 0) {
        this.player.lieDown(room);
        this.showMessage('躺下了！快点击门关门！');
      }
    });

    // Ghost colliders are set up when ghost spawns (in spawnGhost/spawnNewGhost)
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(0.9);
  }

  private createUI(): void {
    this.uiGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);

    // Top bar
    const barBg = this.add.rectangle(GAME_CONFIG.width / 2, 30, GAME_CONFIG.width - 20, 50, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(99);

    this.goldText = this.add.text(20, 15, '', {
      fontSize: '16px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(100);

    this.timerText = this.add.text(GAME_CONFIG.width - 20, 15, '', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.statusText = this.add.text(GAME_CONFIG.width / 2, 15, '', {
      fontSize: '14px', color: '#4ade80', fontFamily: 'Arial'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.messageText = this.add.text(GAME_CONFIG.width / 2, 60, '', {
      fontSize: '14px', color: '#ffeb3b', fontFamily: 'Arial'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Upgrade panel
    this.createUpgradePanel();
  }

  private createUpgradePanel(): void {
    this.upgradePanel = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height - 80)
      .setScrollFactor(0).setDepth(100).setVisible(false);

    const bg = this.add.rectangle(0, 0, 340, 80, 0x000000, 0.85)
      .setStrokeStyle(2, 0x4ade80);

    const btnStyle = { fontSize: '13px', color: '#fff', backgroundColor: '#166534', padding: { x: 10, y: 8 } };

    const bedBtn = this.add.text(-120, -15, '床', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeBed());

    const doorBtn = this.add.text(-40, -15, '门', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeDoor());

    const turretBtn = this.add.text(40, -15, '炮台', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.buildTurret());

    const getUpBtn = this.add.text(120, -15, '起床', { ...btnStyle, backgroundColor: '#dc2626' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleGetUp());

    const infoText = this.add.text(0, 25, '', { fontSize: '11px', color: '#aaa' }).setOrigin(0.5);

    this.upgradePanel.add([bg, bedBtn, doorBtn, turretBtn, getUpBtn, infoText]);
    this.upgradePanel.setData('bedBtn', bedBtn);
    this.upgradePanel.setData('doorBtn', doorBtn);
    this.upgradePanel.setData('turretBtn', turretBtn);
    this.upgradePanel.setData('infoText', infoText);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Record drag start position
    this.isDragging = false;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;

    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);

    // If moved more than 10 pixels, consider it a drag
    if (dragDistance > 10) {
      this.isDragging = true;

      // Disable camera follow while dragging
      if (this.cameraFollowEnabled) {
        this.cameras.main.stopFollow();
        this.cameraFollowEnabled = false;
      }

      // Pan camera (invert direction for natural feel)
      const cam = this.cameras.main;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;

      // Clamp camera to bounds
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, this.mapWidth - cam.width / cam.zoom);
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, this.mapHeight - cam.height / cam.zoom);
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // If it was a drag, re-enable camera follow after a delay
    if (this.isDragging) {
      // Short delay before re-enabling follow
      this.time.delayedCall(2000, () => {
        if (!this.cameraFollowEnabled) {
          this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
          this.cameraFollowEnabled = true;
        }
      });
      this.isDragging = false;
      return;
    }

    // It was a click, not a drag - handle click actions
    if (this.gameState !== GameState.PLAYING) return;

    // Don't move if clicking UI area
    if (pointer.y > GAME_CONFIG.height - 120) return;

    const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const clickX = worldPoint.x;
    const clickY = worldPoint.y;

    // Check if clicking on a door (to close it)
    if (this.player.state === PlayerState.LYING_DOWN && this.player.currentRoom) {
      const room = this.player.currentRoom;
      if (room.isDoorClicked(clickX, clickY) && !room.isDoorClosed()) {
        room.closeDoor();
        this.showMessage('门已关闭！你安全了！');
        return;
      }
      // Handle build
      this.handleBuild(clickX, clickY);
      return;
    }

    // When moving, check if clicking on own room's door to close it
    for (const room of this.rooms) {
      if (room.isPlayerRoom && room.isDoorClicked(clickX, clickY) && !room.isDoorClosed()) {
        // Player must be near the door to close it
        const distToDoor = Phaser.Math.Distance.Between(this.player.x, this.player.y, room.doorX, room.doorY);
        if (distToDoor < 80) {
          room.closeDoor();
          this.showMessage('门已关闭！');
          return;
        }
      }
    }

    // Move to clicked position
    this.player.moveTo(clickX, clickY);
  }

  private handleBuild(x: number, y: number): void {
    if (!this.player.currentRoom) return;

    const cell = this.player.currentRoom.getCellAt(x, y);
    if (cell && !cell.building) {
      const cost = BUILDING_CONFIGS.turret.cost;
      if (this.player.gold >= cost) {
        this.player.gold -= cost;
        this.player.currentRoom.buildAt(cell, BUILDING_CONFIGS.turret);
        this.showMessage('炮台建造完成！');
      } else {
        this.showMessage('金币不足！');
      }
    }
  }

  private handleGetUp(): void {
    if (this.player.state === PlayerState.LYING_DOWN) {
      this.player.getUp();
      this.showMessage('起床了！小心猎梦者！');
    }
  }

  private upgradeBed(): void {
    if (!this.player.currentRoom) return;
    const cost = this.player.currentRoom.bedLevel < BED_CONFIGS.length - 1
      ? BED_CONFIGS[this.player.currentRoom.bedLevel + 1].cost : 0;

    if (cost > 0 && this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.currentRoom.upgradeBed();
      this.showMessage('床已升级！');
    }
  }

  private upgradeDoor(): void {
    if (!this.player.currentRoom) return;
    const cost = this.player.currentRoom.doorLevel < DOOR_CONFIGS.length - 1
      ? DOOR_CONFIGS[this.player.currentRoom.doorLevel + 1].cost : 0;

    if (cost > 0 && this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.currentRoom.upgradeDoor();
      this.showMessage('门已升级！');
    }
  }

  private buildTurret(): void {
    if (!this.player.currentRoom) return;

    const cell = this.player.currentRoom.getEmptyCell();
    if (!cell) {
      this.showMessage('没有空位了！');
      return;
    }

    const cost = BUILDING_CONFIGS.turret.cost;
    if (this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.currentRoom.buildAt(cell, BUILDING_CONFIGS.turret);
      this.showMessage('炮台建造完成！');
    } else {
      this.showMessage('金币不足！');
    }
  }

  private spawnNewGhost(): void {
    if (this.gameState !== GameState.PLAYING) return;

    this.wave++;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    // Spawn at map edges (in corridors)
    switch (edge) {
      case 0: x = 50; y = Phaser.Math.Between(100, this.mapHeight - 100); break;
      case 1: x = this.mapWidth - 50; y = Phaser.Math.Between(100, this.mapHeight - 100); break;
      case 2: x = Phaser.Math.Between(100, this.mapWidth - 100); y = 50; break;
      default: x = Phaser.Math.Between(100, this.mapWidth - 100); y = this.mapHeight - 50;
    }

    this.ghost = new Ghost(this, x, y, this.wave);

    // Setup ghost colliders
    this.physics.add.collider(this.ghost, this.walls);
    this.physics.add.collider(this.ghost, this.doors, (ghost, door) => {
      const g = ghost as Ghost;
      const d = door as Phaser.Physics.Arcade.Sprite;
      if (d.getData('closed')) {
        g.onDoorCollision(d);
      }
    }, (ghost, door) => {
      const d = door as Phaser.Physics.Arcade.Sprite;
      return d.getData('closed') === true;
    });

    this.physics.add.overlap(this.ghost, this.player, () => {
      if (this.player.isInvincible()) return;
      // Game over if player is moving
      if (this.player.state === PlayerState.MOVING) {
        this.endGame(false, '被猎梦者抓住了！');
        return;
      }
      // Game over if lying down but door is open
      if (this.player.state === PlayerState.LYING_DOWN && this.player.currentRoom) {
        if (!this.player.currentRoom.isDoorClosed()) {
          this.endGame(false, '门没关好，被猎梦者抓住了！');
        }
      }
    });

    this.physics.add.overlap(this.bullets, this.ghost, (ghost, bullet) => {
      bullet.destroy();
      const g = ghost as Ghost;
      if (g.takeDamage(BUILDING_CONFIGS.turret.damage || 5)) {
        this.kills++;
        this.player.gold += GAME_CONFIG.killReward;
        g.destroy();
        this.ghost = null;
        this.time.delayedCall(3000, () => this.spawnNewGhost());
      }
    });

    this.showMessage(`第 ${this.wave} 波猎梦者出现！`);
  }

  update(time: number, delta: number): void {
    if (this.gameState !== GameState.PLAYING) return;

    const dt = delta / 1000;
    this.gameTimer += dt;

    // Spawn ghost after delay
    if (!this.ghostSpawned && this.gameTimer >= GAME_CONFIG.ghostDelay) {
      this.spawnGhost();
    }

    // Update player
    this.player.update(dt);

    // Update ghost AI
    if (this.ghost && this.ghost.active) {
      this.ghost.updateAI(dt, this.player, this.rooms, this.doors);
    }

    // Process turret attacks
    this.processTurretAttacks(time);

    // Draw door HP bars
    this.drawDoorHPBars();

    // Update UI
    this.updateUI();

    // Victory check
    if (this.gameTimer >= GAME_CONFIG.survivalTime) {
      this.endGame(true, '成功存活！');
    }
  }

  private processTurretAttacks(time: number): void {
    if (!this.ghost || !this.ghost.active) return;

    for (const room of this.rooms) {
      for (const turret of room.turrets) {
        if (!turret.sprite) continue;

        const dist = Phaser.Math.Distance.Between(
          turret.sprite.x, turret.sprite.y,
          this.ghost.x, this.ghost.y
        );

        if (dist < (turret.config.range || 150)) {
          if (time > turret.attackTimer) {
            // Fire bullet
            const bullet = this.bullets.create(turret.sprite.x, turret.sprite.y, 'bullet');
            if (bullet) {
              this.physics.moveToObject(bullet, this.ghost, 400);
              bullet.setDepth(6);
            }
            turret.attackTimer = time + ((turret.config.attackSpeed || 1) * 1000);
          }
        }
      }
    }

    // Remove out-of-bounds bullets
    this.bullets.getChildren().forEach((b) => {
      const bullet = b as Phaser.Physics.Arcade.Sprite;
      if (bullet.x < 0 || bullet.x > this.mapWidth || bullet.y < 0 || bullet.y > this.mapHeight) {
        bullet.destroy();
      }
    });
  }

  private drawDoorHPBars(): void {
    this.uiGraphics.clear();

    this.doors.getChildren().forEach((d) => {
      const door = d as Phaser.Physics.Arcade.Sprite;
      if (door.getData('closed')) {
        const hp = door.getData('hp') || 0;
        const maxHp = door.getData('maxHp') || 100;
        const pct = hp / maxHp;

        // Convert world coords to screen coords
        const cam = this.cameras.main;
        const screenX = (door.x - cam.scrollX) * cam.zoom;
        const screenY = (door.y - 20 - cam.scrollY) * cam.zoom;

        this.uiGraphics.fillStyle(0x000000);
        this.uiGraphics.fillRect(screenX - 25, screenY, 50, 5);
        this.uiGraphics.fillStyle(pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfacc15 : 0xef4444);
        this.uiGraphics.fillRect(screenX - 25, screenY, 50 * pct, 5);
      }
    });
  }

  private updateUI(): void {
    this.goldText.setText(`💰 ${Math.floor(this.player.gold)}`);

    const remaining = Math.max(0, GAME_CONFIG.survivalTime - this.gameTimer);
    this.timerText.setText(`存活: ${Math.ceil(remaining)}s`);

    if (this.player.state === PlayerState.LYING_DOWN) {
      this.statusText.setText(`躺平中 +${this.player.goldPerSec.toFixed(1)}/s | 击杀: ${this.kills}`);
      this.statusText.setColor('#4ade80');
      this.upgradePanel.setVisible(true);
      this.updateUpgradePanel();
    } else if (this.player.isInvincible()) {
      this.statusText.setText('无敌中...');
      this.statusText.setColor('#00ffff');
      this.upgradePanel.setVisible(false);
    } else {
      this.statusText.setText('移动中 (危险!) | 点击移动');
      this.statusText.setColor('#ff5722');
      this.upgradePanel.setVisible(false);
    }
  }

  private updateUpgradePanel(): void {
    if (!this.player.currentRoom) return;

    const room = this.player.currentRoom;
    const bedCost = room.bedLevel < BED_CONFIGS.length - 1 ? BED_CONFIGS[room.bedLevel + 1].cost : 0;
    const doorCost = room.doorLevel < DOOR_CONFIGS.length - 1 ? DOOR_CONFIGS[room.doorLevel + 1].cost : 0;

    const bedBtn = this.upgradePanel.getData('bedBtn') as Phaser.GameObjects.Text;
    const doorBtn = this.upgradePanel.getData('doorBtn') as Phaser.GameObjects.Text;
    const turretBtn = this.upgradePanel.getData('turretBtn') as Phaser.GameObjects.Text;
    const infoText = this.upgradePanel.getData('infoText') as Phaser.GameObjects.Text;

    bedBtn.setText(bedCost > 0 ? `床 $${bedCost}` : '床 MAX');
    doorBtn.setText(doorCost > 0 ? `门 $${doorCost}` : '门 MAX');
    turretBtn.setText(`炮台 $${BUILDING_CONFIGS.turret.cost}`);

    infoText.setText(`门HP: ${Math.floor(room.doorHP)}/${room.doorMaxHP} | 床Lv${room.bedLevel + 1}`);
  }

  private showMessage(text: string): void {
    this.messageText.setText(text);
    this.time.delayedCall(2500, () => {
      if (this.messageText.text === text) {
        this.messageText.setText('');
      }
    });
  }

  private endGame(victory: boolean, message: string): void {
    this.gameState = victory ? GameState.VICTORY : GameState.GAMEOVER;
    this.showMessage(message);

    this.player.stopMoving();
    if (this.ghost && this.ghost.active) this.ghost.setVelocity(0, 0);

    const beeReward = Math.floor(this.gameTimer / GAME_CONFIG.beeRewardRate) + this.kills;
    SaveManager.recordGame(this.gameTimer, this.kills, beeReward);

    this.time.delayedCall(1500, () => {
      this.scene.start('ResultScene', {
        victory,
        survivalTime: this.gameTimer,
        kills: this.kills,
        beeReward
      });
    });
  }

  shutdown(): void {
    if (this.player) this.player.destroy();
    if (this.ghost) this.ghost.destroy();
    for (const room of this.rooms) room.destroy();
    this.rooms = [];
  }
}
