/**
 * 梦魇宿舍 - 游戏配置
 * Phaser 3 + TypeScript
 */

// ========== 游戏状态 ==========
export enum GameState {
  SELECTING = 'selecting',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAMEOVER = 'gameover',
  VICTORY = 'victory'
}

// ========== 建筑类型 ==========
export enum BuildingType {
  BED = 'bed',
  TURRET = 'turret',
  GENERATOR = 'generator',
  TRAP = 'trap',
  PLANT = 'plant'
}

// ========== 接口定义 ==========
export interface BedConfig {
  name: string;
  goldPerSec: number;
  cost: number;
}

export interface DoorConfig {
  name: string;
  hp: number;
  armor: number;
  cost: number;
}

export interface BuildingConfig {
  type: BuildingType;
  name: string;
  cost: number;
  damage?: number;
  range?: number;
  attackSpeed?: number;
  goldPerSec?: number;
}

export interface RoomLayout {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  gridCols: number;
  gridRows: number;
  doorSide: 'top' | 'bottom' | 'left' | 'right';
}

export interface SaveData {
  beeCoins: number;
  talents: {
    startGold: number;
    doorHP: number;
  };
  stats: {
    totalGames: number;
    totalKills: number;
    bestTime: number;
  };
}

// ========== 床升级配置 ==========
export const BED_CONFIGS: BedConfig[] = [
  { name: '破旧木床', goldPerSec: 2, cost: 0 },
  { name: '席梦思', goldPerSec: 4, cost: 50 },
  { name: '智能按摩床', goldPerSec: 8, cost: 120 },
  { name: '豪华太空舱', goldPerSec: 15, cost: 250 }
];

// ========== 门升级配置 ==========
export const DOOR_CONFIGS: DoorConfig[] = [
  { name: '木门', hp: 100, armor: 0, cost: 0 },
  { name: '铁门', hp: 180, armor: 5, cost: 30 },
  { name: '钢门', hp: 300, armor: 15, cost: 80 },
  { name: '钛合金门', hp: 500, armor: 30, cost: 200 }
];

// ========== 建筑配置 ==========
export const BUILDING_CONFIGS: Record<string, BuildingConfig> = {
  turret: { type: BuildingType.TURRET, name: '弹弓炮台', cost: 50, damage: 5, range: 150, attackSpeed: 1.5 },
  generator: { type: BuildingType.GENERATOR, name: '发电机', cost: 80 },
  trap: { type: BuildingType.TRAP, name: '陷阱', cost: 40, damage: 2 },
  plant: { type: BuildingType.PLANT, name: '摇钱草', cost: 30, goldPerSec: 1 }
};

// ========== 游戏配置 ==========
export const GAME_CONFIG = {
  // 视口大小 (相机显示区域)
  width: 450,
  height: 800,

  // 地图大小 (实际游戏区域，比视口大)
  mapWidth: 800,
  mapHeight: 1200,

  gridSize: 50,

  // 玩家配置
  playerSpeed: 120,
  playerInvincibleTime: 1.5,

  // 游戏时间
  ghostDelay: 8,          // 开始后8秒出猛鬼
  survivalTime: 180,
  ghostSpawnInterval: 15, // 每15秒一波
  difficultyScale: 0.1,

  // 猛鬼配置
  ghostBaseHP: 60,
  ghostBaseDamage: 12,
  ghostSpeed: 50,
  ghostChaseSpeed: 75,    // 追击时更快
  ghostAttackSpeed: 1.5,
  ghostDetectionRange: 350,

  killReward: 8,
  beeRewardRate: 10
};

// ========== 房间布局 (更大地图) ==========
export const ROOM_LAYOUTS: RoomLayout[] = [
  // 左上区域
  { id: 1, x: 20, y: 100, width: 140, height: 160, gridCols: 2, gridRows: 3, doorSide: 'right' },
  { id: 2, x: 20, y: 320, width: 140, height: 160, gridCols: 2, gridRows: 3, doorSide: 'right' },

  // 右上区域
  { id: 3, x: 640, y: 100, width: 140, height: 160, gridCols: 2, gridRows: 3, doorSide: 'left' },
  { id: 4, x: 640, y: 320, width: 140, height: 160, gridCols: 2, gridRows: 3, doorSide: 'left' },

  // 中间区域
  { id: 5, x: 280, y: 200, width: 160, height: 140, gridCols: 3, gridRows: 2, doorSide: 'bottom' },
  { id: 6, x: 280, y: 480, width: 160, height: 140, gridCols: 3, gridRows: 2, doorSide: 'top' },

  // 下方区域
  { id: 7, x: 50, y: 700, width: 180, height: 140, gridCols: 3, gridRows: 2, doorSide: 'top' },
  { id: 8, x: 570, y: 700, width: 180, height: 140, gridCols: 3, gridRows: 2, doorSide: 'top' },

  // 最底部
  { id: 9, x: 280, y: 950, width: 240, height: 160, gridCols: 4, gridRows: 3, doorSide: 'top' }
];

// ========== AI玩家配置 ==========
export const AI_PLAYERS = [
  { name: '躺平爸爸', color: 0x8B4513 },
  { name: '躺平皇帝', color: 0xFFD700 },
  { name: '躺平黄金', color: 0xFFA500 },
  { name: '躺平王者', color: 0x9400D3 }
];

// ========== 死亡消息 ==========
export const DEATH_MESSAGES = [
  '被猛鬼抓走了',
  '的门被破坏了',
  '惨遭淘汰',
  '躺平失败了'
];

// ========== 颜色配置 ==========
export const COLORS = {
  floor: 0x4a6fa5,
  floorLight: 0x5d8ac7,
  corridor: 0x1a2530,
  corridorFloor: 0x2d4a5e,
  doorFrame: 0x3d5c6e,
  roomBorder: 0x1a2530,
  healthGood: 0x4CAF50,
  healthMedium: 0xff9800,
  healthLow: 0xf44336,
  gold: 0xffd700,
  ghostIdle: 0x7cb342,
  ghostAttack: 0xe53935,
  ghostRetreat: 0x9e9e9e
};
