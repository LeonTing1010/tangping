/**
 * 天赋场景
 */

import Phaser from 'phaser';
import { GAME_CONFIG, COLORS } from '../config/GameConfig';
import { SaveManager } from '../utils/SaveManager';

export class TalentScene extends Phaser.Scene {
  private coinsText!: Phaser.GameObjects.Text;
  private goldLevelText!: Phaser.GameObjects.Text;
  private doorLevelText!: Phaser.GameObjects.Text;
  private goldCostText!: Phaser.GameObjects.Text;
  private doorCostText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TalentScene' });
  }

  create(): void {
    this.drawBackground();
    this.createHeader();
    this.createTalentCards();
    this.createBackButton();
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.corridor);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    g.fillStyle(0x1a237e, 0.3);
    g.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
  }

  private createHeader(): void {
    const centerX = GAME_CONFIG.width / 2;

    this.add.rectangle(centerX, 60, GAME_CONFIG.width - 40, 80, 0x000000, 0.7)
      .setStrokeStyle(2, 0x4a6fa5);

    this.add.text(centerX, 40, '天赋系统', {
      fontSize: '28px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.coinsText = this.add.text(centerX, 80, '', {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.updateCoinsDisplay();
  }

  private createTalentCards(): void {
    const centerX = GAME_CONFIG.width / 2;

    // Start Gold Talent
    this.createTalentCard(
      centerX, 220,
      '初始金币',
      '每次游戏开始时额外获得金币',
      'startGold',
      (level: number) => `+${level * 5} 金币`
    );

    // Door HP Talent
    this.createTalentCard(
      centerX, 450,
      '门HP加成',
      '增加门的最大HP',
      'doorHP',
      (level: number) => `+${level * 20} HP`
    );
  }

  private createTalentCard(
    x: number,
    y: number,
    title: string,
    description: string,
    type: 'startGold' | 'doorHP',
    bonusText: (level: number) => string
  ): void {
    // Card background
    this.add.rectangle(x, y, 380, 180, 0x1a2530, 0.95)
      .setStrokeStyle(2, 0x4a6fa5);

    // Title
    this.add.text(x, y - 65, title, {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Description
    this.add.text(x, y - 35, description, {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Level display
    const levelText = this.add.text(x - 80, y + 10, '', {
      fontSize: '18px',
      color: '#4CAF50',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Bonus display
    const bonus = this.add.text(x + 80, y + 10, '', {
      fontSize: '16px',
      color: '#ffd700',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Upgrade button
    const btn = this.add.rectangle(x, y + 55, 160, 40, 0x4CAF50)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const costText = this.add.text(x, y + 55, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', () => {
      if (SaveManager.upgradeTalent(type)) {
        this.updateTalentDisplay(type, levelText, bonus, costText, bonusText);
        this.updateCoinsDisplay();
      }
    });

    // Store references
    if (type === 'startGold') {
      this.goldLevelText = levelText;
      this.goldCostText = costText;
    } else {
      this.doorLevelText = levelText;
      this.doorCostText = costText;
    }

    // Initial update
    this.updateTalentDisplay(type, levelText, bonus, costText, bonusText);
  }

  private updateTalentDisplay(
    type: 'startGold' | 'doorHP',
    levelText: Phaser.GameObjects.Text,
    bonusText: Phaser.GameObjects.Text,
    costText: Phaser.GameObjects.Text,
    getBonusText: (level: number) => string
  ): void {
    const level = SaveManager.talents[type];
    const cost = SaveManager.getTalentCost(type);

    levelText.setText(`等级: ${level}`);
    bonusText.setText(getBonusText(level));
    costText.setText(`升级 (${cost} 蜜蜂币)`);
  }

  private updateCoinsDisplay(): void {
    this.coinsText.setText(`蜜蜂币: ${SaveManager.beeCoins}`);
  }

  private createBackButton(): void {
    const btn = this.add.rectangle(GAME_CONFIG.width / 2, GAME_CONFIG.height - 80, 160, 45, 0x607D8B)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 80, '返回', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setScale(1.05);
      txt.setScale(1.05);
    });
    btn.on('pointerout', () => {
      btn.setScale(1);
      txt.setScale(1);
    });
    btn.on('pointerdown', () => {
      this.scene.start('StartScene');
    });
  }
}
