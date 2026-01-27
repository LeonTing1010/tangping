/**
 * 梦魇宿舍 - 躺平塔防
 * Phaser 3 + TypeScript 版本
 */

import Phaser from 'phaser';
import { GAME_CONFIG } from './config/GameConfig';
import { StartScene } from './scenes/StartScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { TalentScene } from './scenes/TalentScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  parent: 'game-container',
  backgroundColor: '#1a2530',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [StartScene, GameScene, ResultScene, TalentScene]
};

new Phaser.Game(config);
