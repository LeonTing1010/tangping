/**
 * 开始场景
 */

import Phaser from 'phaser';
import { GAME_CONFIG, COLORS } from '../config/GameConfig';
import { SaveManager } from '../utils/SaveManager';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  create(): void {
    this.drawBackground();
    this.createTitle();
    this.createButtons();
    this.createStats();
  }

  private drawBackground(): void {
    const g = this.add.graphics();

    // Dark corridor background
    g.fillStyle(COLORS.corridor);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Pattern
    g.fillStyle(COLORS.corridorFloor, 0.3);
    for (let y = 0; y < GAME_CONFIG.height; y += 60) {
      for (let x = 0; x < GAME_CONFIG.width; x += 60) {
        if ((Math.floor(x / 60) + Math.floor(y / 60)) % 2 === 0) {
          g.fillRect(x, y, 60, 60);
        }
      }
    }

    // Decorative ghosts
    this.drawGhost(80, 200, 0.4);
    this.drawGhost(370, 300, 0.3);
    this.drawGhost(120, 500, 0.25);
  }

  private drawGhost(x: number, y: number, alpha: number): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ghostIdle, alpha);
    g.fillCircle(x, y, 30);
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(x - 8, y - 5, 6);
    g.fillCircle(x + 8, y - 5, 6);
  }

  private createTitle(): void {
    // Title background
    this.add.rectangle(GAME_CONFIG.width / 2, 120, 300, 100, 0x000000, 0.7)
      .setStrokeStyle(3, 0x4a6fa5);

    this.add.text(GAME_CONFIG.width / 2, 90, '梦魇宿舍', {
      fontSize: '42px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(GAME_CONFIG.width / 2, 140, '躺平塔防', {
      fontSize: '24px',
      color: '#ffd700',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
  }

  private createButtons(): void {
    const centerX = GAME_CONFIG.width / 2;

    // Start button
    this.createButton(centerX, 280, '开始游戏', 0x4CAF50, () => {
      this.scene.start('GameScene');
    });

    // Talent button
    this.createButton(centerX, 360, '天赋系统', 0x2196F3, () => {
      this.scene.start('TalentScene');
    });

    // Instructions
    this.add.text(centerX, 450, '游戏说明', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showInstructions());
  }

  private createButton(x: number, y: number, text: string, color: number, callback: () => void): void {
    const btn = this.add.rectangle(x, y, 200, 50, color)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y, text, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setScale(1.05);
      txt.setScale(1.05);
    });
    btn.on('pointerout', () => {
      btn.setScale(1);
      txt.setScale(1);
    });
    btn.on('pointerdown', callback);
  }

  private createStats(): void {
    const coins = SaveManager.beeCoins;
    const stats = SaveManager.talents;

    // Bee coins display
    this.add.rectangle(GAME_CONFIG.width / 2, 550, 200, 40, 0x000000, 0.7)
      .setStrokeStyle(1, 0xffd700);

    this.add.text(GAME_CONFIG.width / 2, 550, `蜜蜂币: ${coins}`, {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Stats summary
    this.add.text(GAME_CONFIG.width / 2, 620, [
      `初始金币加成: +${stats.startGold * 5}`,
      `门HP加成: +${stats.doorHP * 20}`
    ].join('\n'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      align: 'center'
    }).setOrigin(0.5);
  }

  private showInstructions(): void {
    const overlay = this.add.rectangle(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.height / 2,
      GAME_CONFIG.width,
      GAME_CONFIG.height,
      0x000000, 0.9
    ).setInteractive();

    const panel = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2);

    const bg = this.add.rectangle(0, 0, 380, 500, 0x1a2530)
      .setStrokeStyle(2, 0x4a6fa5);

    const title = this.add.text(0, -220, '游戏说明', {
      fontSize: '24px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const content = this.add.text(0, -20, [
      '【动态追逐玩法】',
      '',
      '1. 用摇杆控制角色移动',
      '2. 找到空房间，点击"躺平"按钮',
      '3. 躺平时自动产出金币',
      '4. 升级床/门，建造炮台防御',
      '5. 存活3分钟即为胜利！',
      '',
      '⚠️ 危险提示:',
      '• 移动时被猎梦者碰到=死亡',
      '• 躺平时受门保护，但门会被攻破',
      '• 起床后有1.5秒无敌时间',
      '',
      '猎梦者行为:',
      '• 优先追击移动中的玩家',
      '• 玩家躺平后攻击房门',
      '• 随波次增强'
    ].join('\n'), {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      lineSpacing: 6
    }).setOrigin(0.5);

    const closeBtn = this.add.text(0, 210, '关闭', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#e53935',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
    });

    panel.add([bg, title, content, closeBtn]);
  }
}
