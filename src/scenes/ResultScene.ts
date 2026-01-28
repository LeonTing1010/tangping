/**
 * 结算场景
 */

import Phaser from 'phaser';
import { GAME_CONFIG, COLORS } from '../config/GameConfig';

interface ResultData {
  victory: boolean;
  survivalTime: number;
  kills: number;
  beeReward: number;
}

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    this.drawBackground();
    this.createResult();
    this.createButtons();
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.corridor);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Dramatic overlay
    const color = this.resultData.victory ? 0x1b5e20 : 0x4a0000;
    g.fillStyle(color, 0.4);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
  }

  private createResult(): void {
    const centerX = GAME_CONFIG.width / 2;
    const { victory, survivalTime, kills, beeReward } = this.resultData;

    // Result panel
    this.add.rectangle(centerX, 250, 350, 350, 0x000000, 0.85)
      .setStrokeStyle(3, victory ? 0x4CAF50 : 0xf44336);

    // Title
    const titleText = victory ? '胜利!' : '失败';
    const titleColor = victory ? '#4CAF50' : '#f44336';
    this.add.text(centerX, 100, titleText, {
      fontSize: '48px',
      color: titleColor,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Sub-title
    const subText = victory ? '成功存活3分钟!' : '你的房间被攻破了...';
    this.add.text(centerX, 160, subText, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Stats
    const minutes = Math.floor(survivalTime / 60);
    const seconds = Math.floor(survivalTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const stats = [
      `存活时间: ${timeStr}`,
      `击杀猛鬼: ${kills}`,
      '',
      `获得蜜蜂币: +${beeReward}`
    ];

    this.add.text(centerX, 280, stats.join('\n'), {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5);

    // Bee coin icon
    this.add.text(centerX, 380, `+${beeReward}`, {
      fontSize: '32px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  private createButtons(): void {
    const centerX = GAME_CONFIG.width / 2;

    // Retry button
    this.createButton(centerX, 500, '再来一局', 0x4CAF50, () => {
      this.scene.start('GameScene');
    });

    // Back to menu
    this.createButton(centerX, 580, '返回主菜单', 0x607D8B, () => {
      this.scene.start('StartScene');
    });

    // Talent button
    this.createButton(centerX, 660, '升级天赋', 0x2196F3, () => {
      this.scene.start('TalentScene');
    });
  }

  private createButton(x: number, y: number, text: string, color: number, callback: () => void): void {
    const btn = this.add.rectangle(x, y, 200, 50, color)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y, text, {
      fontSize: '18px',
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
}
