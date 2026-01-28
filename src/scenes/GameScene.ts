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

    // Wall texture
    g.clear();
    g.fillStyle(0x1a2e2e);
    g.fillRect(0, 0, 16, 16);
    g.lineStyle(1, 0x2d4d4d);
    g.strokeRect(0, 0, 16, 16);
    g.generateTexture('wall', 16, 16);

    // Floor texture
    g.clear();
    g.fillStyle(0x0a1414);
    g.fillRect(0, 0, 64, 64);
    g.lineStyle(1, 0x0f1f1f);
    g.strokeRect(0, 0, 32, 32);
    g.strokeRect(32, 32, 32, 32);
    g.generateTexture('floor', 64, 64);

    // Door horizontal
    g.clear();
    g.fillStyle(0xd97706);
    g.fillRect(0, 0, 50, 12);
    g.generateTexture('door_h', 50, 12);

    // Door vertical
    g.clear();
    g.fillStyle(0xd97706);
    g.fillRect(0, 0, 12, 50);
    g.generateTexture('door_v', 12, 50);

    // Bed
    g.clear();
    g.fillStyle(0x475569);
    g.fillRect(2, 4, 36, 22);
    g.fillStyle(0x94a3b8);
    g.fillRect(4, 6, 14, 18);
    g.generateTexture('bed', 40, 30);

    // Player
    g.clear();
    g.fillStyle(0xebc49d);
    g.fillCircle(16, 16, 12);
    g.fillStyle(0x4b3621);
    g.fillRect(4, 4, 24, 8);
    g.lineStyle(1.5, 0x000000);
    g.strokeRect(8, 12, 6, 6);
    g.strokeRect(18, 12, 6, 6);
    g.generateTexture('player', 32, 32);

    // Ghost
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xff0000);
    g.fillCircle(10, 14, 4);
    g.fillCircle(22, 14, 4);
    g.generateTexture('ghost', 32, 32);

    // Tower
    g.clear();
    g.fillStyle(0x4ade80);
    g.fillTriangle(16, 2, 2, 30, 30, 30);
    g.generateTexture('tower', 32, 32);

    // Bullet
    g.clear();
    g.fillStyle(0x4ade80);
    g.fillCircle(4, 4, 4);
    g.generateTexture('bullet', 8, 8);

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

    // Input handling - click to move
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  private createBackground(): void {
    // Tile background
    const bg = this.add.tileSprite(
      this.mapWidth / 2, this.mapHeight / 2,
      this.mapWidth, this.mapHeight,
      'floor'
    ).setDepth(-2);

    // Map border
    const g = this.add.graphics();
    g.lineStyle(4, 0x4a6fa5);
    g.strokeRect(2, 2, this.mapWidth - 4, this.mapHeight - 4);
  }

  private createRooms(): void {
    this.rooms = [];
    for (const layout of ROOM_LAYOUTS) {
      const room = new Room(this, layout, this.walls, this.doors, this.beds);
      this.rooms.push(room);
    }
  }

  private createPlayer(): void {
    // Start in corridor between rooms (not inside any room)
    // Room layouts: center rooms are at x:280-440, corridor is around x:200 or x:500
    this.player = new Player(this, this.mapWidth / 2, 50);
    this.player.gold = SaveManager.getStartGoldBonus();
  }

  private spawnGhost(): void {
    if (this.ghostSpawned) return;
    this.ghostSpawned = true;

    this.wave++;
    // Spawn at bottom of map in corridor
    const x = this.mapWidth / 2;
    const y = this.mapHeight - 50;

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
      if (this.player.state === PlayerState.MOVING && !this.player.isInvincible()) {
        this.endGame(false, '被猎梦者抓住了！');
      }
    });

    this.physics.add.overlap(this.ghost, this.beds, (ghost, bed) => {
      const b = bed as Phaser.Physics.Arcade.Sprite;
      const room = b.getData('room') as Room;
      if (this.player.state === PlayerState.LYING_DOWN && this.player.currentRoom === room) {
        this.endGame(false, '猎梦者闯入了你的房间！');
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
        this.showMessage('开始躺平！自动关门中...');
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
    if (this.gameState !== GameState.PLAYING) return;

    // Don't move if clicking UI area
    if (pointer.y > GAME_CONFIG.height - 120) return;

    // If lying down, handle build
    if (this.player.state === PlayerState.LYING_DOWN) {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.handleBuild(worldPoint.x, worldPoint.y);
      return;
    }

    // Move to clicked position
    const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.player.moveTo(worldPoint.x, worldPoint.y);
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
      if (this.player.state === PlayerState.MOVING && !this.player.isInvincible()) {
        this.endGame(false, '被猎梦者抓住了！');
      }
    });

    this.physics.add.overlap(this.ghost, this.beds, (ghost, bed) => {
      const b = bed as Phaser.Physics.Arcade.Sprite;
      const room = b.getData('room') as Room;
      if (this.player.state === PlayerState.LYING_DOWN && this.player.currentRoom === room) {
        this.endGame(false, '猎梦者闯入了你的房间！');
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
