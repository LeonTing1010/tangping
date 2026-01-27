/**
 * 游戏主场景
 */

import Phaser from 'phaser';
import {
  GameState, GAME_CONFIG, ROOM_LAYOUTS, COLORS, BUILDING_CONFIGS, BED_CONFIGS, DOOR_CONFIGS
} from '../config/GameConfig';
import { Room } from '../objects/Room';
import { Ghost } from '../objects/Ghost';
import { AIPlayer } from '../objects/AIPlayer';
import { SaveManager } from '../utils/SaveManager';

export class GameScene extends Phaser.Scene {
  state: GameState = GameState.SELECTING;

  rooms: Room[] = [];
  ghosts: Ghost[] = [];
  aiPlayers: AIPlayer[] = [];

  playerRoom: Room | null = null;
  gold: number = 0;
  wave: number = 0;
  kills: number = 0;

  selectionTimer: number = 0;
  gameTimer: number = 0;
  spawnTimer: number = 0;

  // UI elements
  timerText!: Phaser.GameObjects.Text;
  goldText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;
  messageText!: Phaser.GameObjects.Text;
  statusText!: Phaser.GameObjects.Text;

  // Buttons
  upgradePanel!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.state = GameState.SELECTING;
    this.gold = SaveManager.getStartGoldBonus();
    this.wave = 0;
    this.kills = 0;
    this.selectionTimer = GAME_CONFIG.selectionTime;
    this.gameTimer = 0;
    this.spawnTimer = GAME_CONFIG.ghostDelay;

    this.drawBackground();
    this.createRooms();
    this.createUI();
    this.assignAIPlayers();

    this.input.on('pointerdown', this.handleClick, this);
  }

  private drawBackground(): void {
    const g = this.add.graphics();

    // Main corridor
    g.fillStyle(COLORS.corridor);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Corridor floor pattern
    g.fillStyle(COLORS.corridorFloor);
    for (let y = 0; y < GAME_CONFIG.height; y += 40) {
      for (let x = 0; x < GAME_CONFIG.width; x += 40) {
        if ((Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0) {
          g.fillRect(x, y, 40, 40);
        }
      }
    }
  }

  private createRooms(): void {
    this.rooms = [];
    for (const layout of ROOM_LAYOUTS) {
      const room = new Room(this, layout);
      this.rooms.push(room);
    }
  }

  private createUI(): void {
    const style = { fontSize: '16px', color: '#ffffff', fontFamily: 'Arial' };
    const boldStyle = { fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' };

    // Top bar
    this.add.rectangle(GAME_CONFIG.width / 2, 25, GAME_CONFIG.width - 20, 40, 0x000000, 0.7)
      .setStrokeStyle(2, 0x4a6fa5);

    this.timerText = this.add.text(20, 15, '', boldStyle);
    this.goldText = this.add.text(GAME_CONFIG.width - 20, 15, '', { ...boldStyle, color: '#ffd700' })
      .setOrigin(1, 0);
    this.waveText = this.add.text(GAME_CONFIG.width / 2, 15, '', style).setOrigin(0.5, 0);

    // Message area
    this.messageText = this.add.text(GAME_CONFIG.width / 2, 55, '', {
      fontSize: '14px', color: '#ffeb3b', fontFamily: 'Arial'
    }).setOrigin(0.5, 0);

    // Status text (bottom)
    this.statusText = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 50, '', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Arial', backgroundColor: '#333333',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5, 0);

    // Upgrade panel (hidden initially)
    this.createUpgradePanel();

    this.updateUI();
  }

  private createUpgradePanel(): void {
    this.upgradePanel = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height - 120);
    this.upgradePanel.setVisible(false);

    const bg = this.add.rectangle(0, 0, 300, 80, 0x000000, 0.85)
      .setStrokeStyle(2, 0x4a6fa5);

    const btnStyle = { fontSize: '12px', color: '#ffffff', backgroundColor: '#2d4a5e', padding: { x: 8, y: 4 } };

    const bedBtn = this.add.text(-100, -15, '升级床', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeBed());

    const doorBtn = this.add.text(0, -15, '升级门', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.upgradeDoor());

    const turretBtn = this.add.text(100, -15, '建炮台', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.buildTurret());

    const infoText = this.add.text(0, 20, '', { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5);

    this.upgradePanel.add([bg, bedBtn, doorBtn, turretBtn, infoText]);
    this.upgradePanel.setData('infoText', infoText);
    this.upgradePanel.setData('bedBtn', bedBtn);
    this.upgradePanel.setData('doorBtn', doorBtn);
    this.upgradePanel.setData('turretBtn', turretBtn);
  }

  private assignAIPlayers(): void {
    this.aiPlayers = [];
    const availableRooms = this.rooms.filter(r => r.ownerId < 0);

    for (let i = 0; i < 4 && i < availableRooms.length; i++) {
      const ai = new AIPlayer(i);
      ai.setRoom(availableRooms[i]);
      ai.gold = 20;
      this.aiPlayers.push(ai);
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const { x, y } = pointer;

    if (this.state === GameState.SELECTING) {
      for (const room of this.rooms) {
        if (room.ownerId < 0 && room.contains(x, y)) {
          this.selectRoom(room);
          return;
        }
      }
    } else if (this.state === GameState.PLAYING && this.playerRoom) {
      const cell = this.playerRoom.getCellAt(x, y);
      if (cell && cell !== this.playerRoom.grid[0] && !cell.building) {
        this.showBuildMenu(cell);
      }
    }
  }

  private selectRoom(room: Room): void {
    this.playerRoom = room;
    room.setOwner(0, '玩家', true);

    this.state = GameState.PLAYING;
    this.showMessage('选择成功！准备防御猛鬼！');
    this.upgradePanel.setVisible(true);
    this.updateUpgradePanel();
  }

  private showBuildMenu(_cell: { col: number; row: number }): void {
    // For simplicity, auto-build turret on cell click
    this.buildTurret();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    switch (this.state) {
      case GameState.SELECTING:
        this.updateSelecting(dt);
        break;
      case GameState.PLAYING:
        this.updatePlaying(dt);
        break;
    }

    this.updateUI();
  }

  private updateSelecting(dt: number): void {
    this.selectionTimer -= dt;
    if (this.selectionTimer <= 0) {
      // Auto-select random empty room
      const empty = this.rooms.filter(r => r.ownerId < 0);
      if (empty.length > 0) {
        this.selectRoom(empty[Math.floor(Math.random() * empty.length)]);
      }
    }
  }

  private updatePlaying(dt: number): void {
    this.gameTimer += dt;

    // Gold generation
    if (this.playerRoom) {
      this.gold += this.playerRoom.getGoldPerSec() * dt;
    }

    // AI players
    for (const ai of this.aiPlayers) {
      ai.update(dt);
    }

    // Ghost spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnGhostWave();
      this.spawnTimer = GAME_CONFIG.ghostSpawnInterval;
    }

    // Update ghosts
    for (const ghost of this.ghosts) {
      if (ghost.isDead) continue;

      const brokenRoom = ghost.update(dt, this.rooms);
      if (brokenRoom) {
        this.handleRoomBroken(brokenRoom);
      }

      // Turret attacks
      this.processTurretAttacks(ghost, dt);
    }

    // Remove dead ghosts
    this.ghosts = this.ghosts.filter(g => {
      if (g.isDead) {
        g.destroy();
        this.kills++;
        this.gold += GAME_CONFIG.killReward;
        return false;
      }
      return true;
    });

    // Victory check
    if (this.gameTimer >= GAME_CONFIG.survivalTime) {
      this.endGame(true);
    }

    this.updateUpgradePanel();
  }

  private spawnGhostWave(): void {
    this.wave++;
    const count = 1 + Math.floor(this.wave / 3);

    for (let i = 0; i < count; i++) {
      const x = 150 + Math.random() * 150;
      const y = -30 - i * 50;
      const ghost = new Ghost(this, x, y, this.wave);
      this.ghosts.push(ghost);
    }

    this.showMessage(`第 ${this.wave} 波猛鬼来袭！`);
  }

  private processTurretAttacks(ghost: Ghost, dt: number): void {
    for (const room of this.rooms) {
      for (const turret of room.turrets) {
        if (!turret.config.range || !turret.config.damage) continue;

        const cell = room.grid.find(c => c.building === turret);
        if (!cell) continue;

        const dx = ghost.x - cell.x;
        const dy = ghost.y - cell.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

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
    if (room.isPlayerRoom) {
      this.endGame(false);
    } else {
      const ai = this.aiPlayers.find(a => a.room === room);
      if (ai) {
        const msg = ai.die();
        this.showMessage(msg);
      }
    }
  }

  private upgradeBed(): void {
    if (!this.playerRoom) return;
    if (this.playerRoom.bedLevel >= BED_CONFIGS.length - 1) return;

    const cost = BED_CONFIGS[this.playerRoom.bedLevel + 1].cost;
    if (this.gold >= cost) {
      this.gold -= cost;
      this.playerRoom.upgradeBed();
      this.showMessage(`床已升级至 ${BED_CONFIGS[this.playerRoom.bedLevel].name}`);
    }
  }

  private upgradeDoor(): void {
    if (!this.playerRoom) return;
    if (this.playerRoom.doorLevel >= DOOR_CONFIGS.length - 1) return;

    const cost = DOOR_CONFIGS[this.playerRoom.doorLevel + 1].cost;
    if (this.gold >= cost) {
      this.gold -= cost;
      this.playerRoom.upgradeDoor();
      this.showMessage(`门已升级至 ${DOOR_CONFIGS[this.playerRoom.doorLevel].name}`);
    }
  }

  private buildTurret(): void {
    if (!this.playerRoom) return;

    const cell = this.playerRoom.getEmptyCell();
    if (!cell) {
      this.showMessage('没有空位了！');
      return;
    }

    const cost = BUILDING_CONFIGS.turret.cost;
    if (this.gold >= cost) {
      this.gold -= cost;
      this.playerRoom.buildAt(cell, BUILDING_CONFIGS.turret);
      this.showMessage('炮台建造完成！');
    }
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
    if (this.state === GameState.SELECTING) {
      this.timerText.setText(`选房: ${Math.ceil(this.selectionTimer)}s`);
      this.waveText.setText('点击选择房间');
    } else {
      const remaining = Math.max(0, GAME_CONFIG.survivalTime - this.gameTimer);
      this.timerText.setText(`存活: ${Math.ceil(remaining)}s`);
      this.waveText.setText(`波次: ${this.wave}`);
    }

    this.goldText.setText(`金币: ${Math.floor(this.gold)}`);

    if (this.playerRoom && this.state === GameState.PLAYING) {
      const dps = this.playerRoom.getDPS().toFixed(1);
      const gps = this.playerRoom.getGoldPerSec().toFixed(1);
      this.statusText.setText(`DPS: ${dps} | 产出: ${gps}/s | 击杀: ${this.kills}`);
    }
  }

  private updateUpgradePanel(): void {
    if (!this.playerRoom || !this.upgradePanel.visible) return;

    const bedCost = this.playerRoom.bedLevel < BED_CONFIGS.length - 1
      ? BED_CONFIGS[this.playerRoom.bedLevel + 1].cost : 0;
    const doorCost = this.playerRoom.doorLevel < DOOR_CONFIGS.length - 1
      ? DOOR_CONFIGS[this.playerRoom.doorLevel + 1].cost : 0;
    const turretCost = BUILDING_CONFIGS.turret.cost;

    const bedBtn = this.upgradePanel.getData('bedBtn') as Phaser.GameObjects.Text;
    const doorBtn = this.upgradePanel.getData('doorBtn') as Phaser.GameObjects.Text;
    const turretBtn = this.upgradePanel.getData('turretBtn') as Phaser.GameObjects.Text;
    const infoText = this.upgradePanel.getData('infoText') as Phaser.GameObjects.Text;

    bedBtn.setText(bedCost > 0 ? `床 $${bedCost}` : '床 MAX');
    doorBtn.setText(doorCost > 0 ? `门 $${doorCost}` : '门 MAX');
    turretBtn.setText(`炮台 $${turretCost}`);

    const doorHP = `门HP: ${Math.floor(this.playerRoom.doorHP)}/${this.playerRoom.doorMaxHP}`;
    const bedLv = `床Lv${this.playerRoom.bedLevel + 1}`;
    infoText.setText(`${doorHP} | ${bedLv}`);
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
    for (const room of this.rooms) room.destroy();
    for (const ghost of this.ghosts) ghost.destroy();
    this.rooms = [];
    this.ghosts = [];
    this.aiPlayers = [];
  }
}
