/**
 * 游戏主场景 - 动态追逐版
 */

import Phaser from 'phaser';
import {
  GameState, GAME_CONFIG, ROOM_LAYOUTS, COLORS, BUILDING_CONFIGS, BED_CONFIGS, DOOR_CONFIGS
} from '../config/GameConfig';
import { Room } from '../objects/Room';
import { Ghost } from '../objects/Ghost';
import { Player, PlayerState } from '../objects/Player';
import { SaveManager } from '../utils/SaveManager';

export class GameScene extends Phaser.Scene {
  state: GameState = GameState.PLAYING;

  player!: Player;
  rooms: Room[] = [];
  ghosts: Ghost[] = [];

  wave: number = 0;
  kills: number = 0;
  gameTimer: number = 0;
  spawnTimer: number = 0;

  // Map dimensions
  mapWidth: number = GAME_CONFIG.mapWidth;
  mapHeight: number = GAME_CONFIG.mapHeight;

  // Virtual Joystick
  joystickBase!: Phaser.GameObjects.Arc;
  joystickThumb!: Phaser.GameObjects.Arc;
  joystickPointer: Phaser.Input.Pointer | null = null;
  joystickStartX: number = 0;
  joystickStartY: number = 0;

  // UI (fixed to camera)
  uiContainer!: Phaser.GameObjects.Container;
  timerText!: Phaser.GameObjects.Text;
  goldText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;
  messageText!: Phaser.GameObjects.Text;
  stateText!: Phaser.GameObjects.Text;

  // Interaction button
  lieDownBtn!: Phaser.GameObjects.Container;
  getUpBtn!: Phaser.GameObjects.Container;
  nearbyRoom: Room | null = null;

  // Upgrade panel
  upgradePanel!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.state = GameState.PLAYING;
    this.wave = 0;
    this.kills = 0;
    this.gameTimer = 0;
    this.spawnTimer = GAME_CONFIG.ghostDelay;

    // Set world bounds larger than camera
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    this.drawMap();
    this.createRooms();
    this.createPlayer();
    this.setupCamera();
    this.createJoystick();
    this.createUI();
    this.createInteractionButtons();

    // Input events
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    // Keyboard controls (alternative)
    this.input.keyboard?.on('keydown-SPACE', () => this.toggleLieDown());
  }

  private drawMap(): void {
    const g = this.add.graphics();

    // Dark corridor background
    g.fillStyle(COLORS.corridor);
    g.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // Checkered floor pattern
    g.fillStyle(COLORS.corridorFloor, 0.5);
    for (let y = 0; y < this.mapHeight; y += 50) {
      for (let x = 0; x < this.mapWidth; x += 50) {
        if ((Math.floor(x / 50) + Math.floor(y / 50)) % 2 === 0) {
          g.fillRect(x, y, 50, 50);
        }
      }
    }

    // Map border
    g.lineStyle(4, 0x4a6fa5);
    g.strokeRect(2, 2, this.mapWidth - 4, this.mapHeight - 4);
  }

  private createRooms(): void {
    this.rooms = [];
    for (const layout of ROOM_LAYOUTS) {
      const room = new Room(this, layout);
      this.rooms.push(room);
    }
  }

  private createPlayer(): void {
    // Start player in center of map
    const startX = this.mapWidth / 2;
    const startY = this.mapHeight / 2;
    this.player = new Player(this, startX, startY);
    this.player.gold = SaveManager.getStartGoldBonus();
  }

  private setupCamera(): void {
    // Camera follows player with smooth lerp
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  private createJoystick(): void {
    // Fixed position on screen (bottom-left)
    const baseX = 100;
    const baseY = GAME_CONFIG.height - 120;

    this.joystickBase = this.add.circle(baseX, baseY, 60, 0x000000, 0.4)
      .setStrokeStyle(3, 0x4a6fa5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.joystickThumb = this.add.circle(baseX, baseY, 30, 0x4a6fa5, 0.8)
      .setScrollFactor(0)
      .setDepth(1001);
  }

  private createUI(): void {
    // UI container (fixed to camera)
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(900);

    // Top bar background
    const topBar = this.add.rectangle(GAME_CONFIG.width / 2, 30, GAME_CONFIG.width - 20, 50, 0x000000, 0.7)
      .setStrokeStyle(2, 0x4a6fa5);

    // Timer
    this.timerText = this.add.text(20, 20, '', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
    });

    // Gold
    this.goldText = this.add.text(GAME_CONFIG.width - 20, 20, '', {
      fontSize: '18px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(1, 0);

    // Wave
    this.waveText = this.add.text(GAME_CONFIG.width / 2, 20, '', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial'
    }).setOrigin(0.5, 0);

    // Message
    this.messageText = this.add.text(GAME_CONFIG.width / 2, 65, '', {
      fontSize: '14px', color: '#ffeb3b', fontFamily: 'Arial'
    }).setOrigin(0.5, 0);

    // Player state indicator
    this.stateText = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 200, '', {
      fontSize: '16px', color: '#4CAF50', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.uiContainer.add([topBar, this.timerText, this.goldText, this.waveText, this.messageText, this.stateText]);

    // Upgrade panel
    this.createUpgradePanel();
  }

  private createUpgradePanel(): void {
    this.upgradePanel = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height - 60)
      .setScrollFactor(0)
      .setDepth(950)
      .setVisible(false);

    const bg = this.add.rectangle(0, 0, 320, 70, 0x000000, 0.85)
      .setStrokeStyle(2, 0x4a6fa5);

    const btnStyle = { fontSize: '13px', color: '#ffffff', backgroundColor: '#2d5a2d', padding: { x: 10, y: 6 } };

    const bedBtn = this.add.text(-110, -10, '床 $50', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeBed());

    const doorBtn = this.add.text(0, -10, '门 $30', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeDoor());

    const turretBtn = this.add.text(110, -10, '炮台 $50', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.buildTurret());

    const infoText = this.add.text(0, 22, '', { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5);

    this.upgradePanel.add([bg, bedBtn, doorBtn, turretBtn, infoText]);
    this.upgradePanel.setData('bedBtn', bedBtn);
    this.upgradePanel.setData('doorBtn', doorBtn);
    this.upgradePanel.setData('turretBtn', turretBtn);
    this.upgradePanel.setData('infoText', infoText);
  }

  private createInteractionButtons(): void {
    // "Lie Down" button
    this.lieDownBtn = this.add.container(GAME_CONFIG.width - 80, GAME_CONFIG.height - 150)
      .setScrollFactor(0)
      .setDepth(950)
      .setVisible(false);

    const lieBtn = this.add.rectangle(0, 0, 100, 50, 0x4CAF50)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.lieDown());

    const lieTxt = this.add.text(0, 0, '躺平', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.lieDownBtn.add([lieBtn, lieTxt]);

    // "Get Up" button
    this.getUpBtn = this.add.container(GAME_CONFIG.width - 80, GAME_CONFIG.height - 150)
      .setScrollFactor(0)
      .setDepth(950)
      .setVisible(false);

    const upBtn = this.add.rectangle(0, 0, 100, 50, 0xff9800)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.getUp());

    const upTxt = this.add.text(0, 0, '起床', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.getUpBtn.add([upBtn, upTxt]);
  }

  // ========== INPUT HANDLING ==========

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Check if touching joystick area
    const jx = this.joystickBase.x;
    const jy = this.joystickBase.y;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, jx, jy);

    if (dist < 80) {
      this.joystickPointer = pointer;
      this.joystickStartX = jx;
      this.joystickStartY = jy;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
      const dx = pointer.x - this.joystickStartX;
      const dy = pointer.y - this.joystickStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 50;

      if (dist > maxDist) {
        this.joystickThumb.x = this.joystickStartX + (dx / dist) * maxDist;
        this.joystickThumb.y = this.joystickStartY + (dy / dist) * maxDist;
      } else {
        this.joystickThumb.x = pointer.x;
        this.joystickThumb.y = pointer.y;
      }

      // Apply velocity to player
      const vx = (this.joystickThumb.x - this.joystickStartX) / maxDist;
      const vy = (this.joystickThumb.y - this.joystickStartY) / maxDist;
      this.player.setVelocity(vx, vy);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
      this.joystickPointer = null;
      this.joystickThumb.x = this.joystickBase.x;
      this.joystickThumb.y = this.joystickBase.y;
      this.player.setVelocity(0, 0);
    }
  }

  // ========== GAME ACTIONS ==========

  private toggleLieDown(): void {
    if (this.player.state === PlayerState.MOVING && this.nearbyRoom) {
      this.lieDown();
    } else if (this.player.state === PlayerState.LYING_DOWN) {
      this.getUp();
    }
  }

  private lieDown(): void {
    if (!this.nearbyRoom || this.nearbyRoom.ownerId >= 0) return;
    if (this.player.state !== PlayerState.MOVING) return;

    this.player.lieDown(this.nearbyRoom);
    this.showMessage('开始躺平！金币产出中...');
  }

  private getUp(): void {
    if (this.player.state !== PlayerState.LYING_DOWN) return;

    this.player.getUp();
    this.showMessage('起床了！小心猎梦者追击！');
  }

  private upgradeBed(): void {
    if (!this.player.currentRoom) return;
    if (this.player.currentRoom.bedLevel >= BED_CONFIGS.length - 1) return;

    const cost = BED_CONFIGS[this.player.currentRoom.bedLevel + 1].cost;
    if (this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.currentRoom.upgradeBed();
      this.showMessage(`床已升级！产出: ${this.player.currentRoom.getGoldPerSec()}/s`);
    }
  }

  private upgradeDoor(): void {
    if (!this.player.currentRoom) return;
    if (this.player.currentRoom.doorLevel >= DOOR_CONFIGS.length - 1) return;

    const cost = DOOR_CONFIGS[this.player.currentRoom.doorLevel + 1].cost;
    if (this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.currentRoom.upgradeDoor();
      this.showMessage(`门已升级！HP: ${this.player.currentRoom.doorMaxHP}`);
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
    }
  }

  // ========== UPDATE LOOP ==========

  update(_time: number, delta: number): void {
    if (this.state !== GameState.PLAYING) return;

    const dt = delta / 1000;
    this.gameTimer += dt;

    // Update player
    this.player.update(dt, this.mapWidth, this.mapHeight);

    // Check nearby rooms for interaction
    this.checkNearbyRooms();

    // Spawn ghosts
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnGhostWave();
      this.spawnTimer = GAME_CONFIG.ghostSpawnInterval;
    }

    // Update ghosts
    for (const ghost of this.ghosts) {
      if (ghost.isDead) continue;

      const brokenRoom = ghost.update(dt, this.player, this.rooms, this.mapWidth, this.mapHeight);
      if (brokenRoom) {
        this.handleRoomBroken(brokenRoom);
      }

      // Check player collision (game over if caught while moving)
      if (ghost.checkPlayerCollision(this.player)) {
        this.handlePlayerCaught();
        return;
      }

      // Turret attacks
      this.processTurretAttacks(ghost, dt);
    }

    // Remove dead ghosts
    this.ghosts = this.ghosts.filter(g => {
      if (g.isDead) {
        g.destroy();
        this.kills++;
        this.player.gold += GAME_CONFIG.killReward;
        return false;
      }
      return true;
    });

    // Victory check
    if (this.gameTimer >= GAME_CONFIG.survivalTime) {
      this.endGame(true);
    }

    this.updateUI();
  }

  private checkNearbyRooms(): void {
    if (this.player.state === PlayerState.LYING_DOWN) {
      this.lieDownBtn.setVisible(false);
      this.getUpBtn.setVisible(true);
      this.upgradePanel.setVisible(true);
      this.updateUpgradePanel();
      return;
    }

    // Find empty room near player
    this.nearbyRoom = null;
    for (const room of this.rooms) {
      if (room.ownerId >= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        room.doorX, room.doorY
      );

      if (dist < 80) {
        this.nearbyRoom = room;
        break;
      }
    }

    this.lieDownBtn.setVisible(this.nearbyRoom !== null);
    this.getUpBtn.setVisible(false);
    this.upgradePanel.setVisible(false);
  }

  private spawnGhostWave(): void {
    this.wave++;
    const count = 1 + Math.floor(this.wave / 4);

    for (let i = 0; i < count; i++) {
      // Spawn at random edge of map
      let x: number, y: number;
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0: x = 50; y = 100 + Math.random() * (this.mapHeight - 200); break; // Left
        case 1: x = this.mapWidth - 50; y = 100 + Math.random() * (this.mapHeight - 200); break; // Right
        case 2: x = 100 + Math.random() * (this.mapWidth - 200); y = 50; break; // Top
        default: x = 100 + Math.random() * (this.mapWidth - 200); y = this.mapHeight - 50; break; // Bottom
      }

      const ghost = new Ghost(this, x, y, this.wave);
      this.ghosts.push(ghost);
    }

    this.showMessage(`第 ${this.wave} 波猎梦者出现！`);
  }

  private processTurretAttacks(ghost: Ghost, dt: number): void {
    for (const room of this.rooms) {
      if (room.ownerId < 0) continue;

      for (const turret of room.turrets) {
        if (!turret.config.range || !turret.config.damage) continue;

        const cell = room.grid.find(c => c.building === turret);
        if (!cell) continue;

        const dist = Phaser.Math.Distance.Between(ghost.x, ghost.y, cell.x, cell.y);

        if (dist <= turret.config.range) {
          turret.attackTimer += dt;
          if (turret.attackTimer >= (turret.config.attackSpeed || 1)) {
            turret.attackTimer = 0;
            ghost.takeDamage(turret.config.damage);
          }
        }
      }
    }
  }

  private handleRoomBroken(room: Room): void {
    if (room === this.player.currentRoom) {
      // Player was in the room - forced out but invincible
      this.player.getUp();
      this.showMessage('门被破坏了！快逃！');
    }
    room.clearOwner();
  }

  private handlePlayerCaught(): void {
    this.showMessage('被猎梦者抓住了！');
    this.endGame(false);
  }

  private showMessage(text: string): void {
    this.messageText.setText(text);
    this.time.delayedCall(3000, () => {
      if (this.messageText.text === text) {
        this.messageText.setText('');
      }
    });
  }

  private updateUI(): void {
    const remaining = Math.max(0, GAME_CONFIG.survivalTime - this.gameTimer);
    this.timerText.setText(`存活: ${Math.ceil(remaining)}s`);
    this.goldText.setText(`金币: ${Math.floor(this.player.gold)}`);
    this.waveText.setText(`波次: ${this.wave} | 击杀: ${this.kills}`);

    // State indicator
    if (this.player.state === PlayerState.LYING_DOWN) {
      this.stateText.setText(`躺平中 +${this.player.goldPerSec.toFixed(1)}/s`);
      this.stateText.setColor('#4CAF50');
    } else if (this.player.isInvincible()) {
      this.stateText.setText('无敌中...');
      this.stateText.setColor('#00ffff');
    } else {
      this.stateText.setText('移动中 (危险!)');
      this.stateText.setColor('#ff5722');
    }
  }

  private updateUpgradePanel(): void {
    if (!this.player.currentRoom) return;

    const room = this.player.currentRoom;
    const bedCost = room.bedLevel < BED_CONFIGS.length - 1 ? BED_CONFIGS[room.bedLevel + 1].cost : 0;
    const doorCost = room.doorLevel < DOOR_CONFIGS.length - 1 ? DOOR_CONFIGS[room.doorLevel + 1].cost : 0;
    const turretCost = BUILDING_CONFIGS.turret.cost;

    const bedBtn = this.upgradePanel.getData('bedBtn') as Phaser.GameObjects.Text;
    const doorBtn = this.upgradePanel.getData('doorBtn') as Phaser.GameObjects.Text;
    const turretBtn = this.upgradePanel.getData('turretBtn') as Phaser.GameObjects.Text;
    const infoText = this.upgradePanel.getData('infoText') as Phaser.GameObjects.Text;

    bedBtn.setText(bedCost > 0 ? `床 $${bedCost}` : '床 MAX');
    doorBtn.setText(doorCost > 0 ? `门 $${doorCost}` : '门 MAX');
    turretBtn.setText(`炮台 $${turretCost}`);

    infoText.setText(`门HP: ${Math.floor(room.doorHP)}/${room.doorMaxHP} | 床Lv${room.bedLevel + 1}`);
  }

  private endGame(victory: boolean): void {
    this.state = victory ? GameState.VICTORY : GameState.GAMEOVER;

    const beeReward = Math.floor(this.gameTimer / GAME_CONFIG.beeRewardRate) + this.kills;
    SaveManager.recordGame(this.gameTimer, this.kills, beeReward);

    this.scene.start('ResultScene', {
      victory,
      survivalTime: this.gameTimer,
      kills: this.kills,
      beeReward
    });
  }

  shutdown(): void {
    if (this.player) this.player.destroy();
    for (const room of this.rooms) room.destroy();
    for (const ghost of this.ghosts) ghost.destroy();
    this.rooms = [];
    this.ghosts = [];
  }
}
