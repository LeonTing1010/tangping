/**
 * 梦魇宿舍 - 游戏配置
 * Cocos Creator + TypeScript
 */

// ========== 游戏状态枚举 ==========
export enum GameState {
    SELECTING = 'selecting',
    PLAYING = 'playing',
    PAUSED = 'paused',
    GAMEOVER = 'gameover',
    VICTORY = 'victory'
}

// ========== 猛鬼AI状态枚举 ==========
export enum GhostState {
    IDLE = 'idle',
    ATTACK = 'attack',
    RETREAT = 'retreat'
}

// ========== 建筑类型枚举 ==========
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
    icon: string;
    cost: number;
    damage?: number;
    range?: number;
    attackSpeed?: number;
    goldPerSec?: number;
    slowPercent?: number;
    bonus?: number;
}

export interface TalentData {
    startGold: number;
    doorHP: number;
}

export interface SaveData {
    beeCoins: number;
    talents: TalentData;
    stats: {
        totalGames: number;
        totalKills: number;
        bestSurvivalTime: number;
    };
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
    turret: {
        type: BuildingType.TURRET,
        name: '弹弓炮台',
        icon: 'turret',
        cost: 50,
        damage: 5,
        range: 150,
        attackSpeed: 1.5
    },
    generator: {
        type: BuildingType.GENERATOR,
        name: '发电机',
        icon: 'generator',
        cost: 80,
        bonus: 0.3
    },
    trap: {
        type: BuildingType.TRAP,
        name: '陷阱',
        icon: 'trap',
        cost: 40,
        slowPercent: 0.5,
        damage: 2
    },
    plant: {
        type: BuildingType.PLANT,
        name: '摇钱草',
        icon: 'plant',
        cost: 30,
        goldPerSec: 1
    }
};

// ========== 猛鬼配置 ==========
export const GHOST_CONFIG = {
    baseHP: 50,
    baseDamage: 10,
    baseSpeed: 40,
    attackSpeed: 1.5,
    retreatThreshold: 0.2,
    healRate: 20
};

// ========== 游戏全局配置 ==========
export const GAME_CONFIG = {
    // 时间设置
    selectionTime: 25,          // 选房时间
    ghostDelay: 30,             // 鬼出现延迟
    survivalTime: 180,          // 生存目标时间
    ghostSpawnInterval: 15,     // 鬼生成间隔

    // 难度设置
    difficultyScale: 0.1,       // 每波难度增量

    // 网格设置
    gridSize: 50,               // 格子大小

    // 奖励设置
    killReward: 5,              // 击杀基础奖励
    beeRewardRate: 10           // 蜜蜂币换算比例（存活秒数/10）
};

// ========== 房间布局配置 ==========
export const ROOM_LAYOUTS: RoomLayout[] = [
    { id: 1, x: 10, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
    { id: 2, x: 310, y: 60, width: 130, height: 160, gridCols: 2, gridRows: 3, doorSide: 'bottom' },
    { id: 3, x: 10, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'right' },
    { id: 4, x: 310, y: 340, width: 130, height: 180, gridCols: 2, gridRows: 3, doorSide: 'left' },
    { id: 5, x: 10, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' },
    { id: 6, x: 260, y: 570, width: 180, height: 120, gridCols: 3, gridRows: 2, doorSide: 'top' }
];

// ========== 颜色配置 ==========
export const COLORS = {
    floor: '#4a6fa5',
    floorLight: '#5d8ac7',
    corridor: '#1a2530',
    corridorFloor: '#2d4a5e',
    wall: '#0d1821',
    doorFrame: '#3d5c6e',
    roomBorder: '#1a2530',
    healthGood: '#4CAF50',
    healthMedium: '#ff9800',
    healthLow: '#f44336',
    gold: '#ffd700'
};

// ========== AI玩家名称配置 ==========
export const AI_PLAYER_NAMES = [
    { name: '躺平爸爸', icon: 'ai_1' },
    { name: '躺平皇帝', icon: 'ai_2' },
    { name: '躺平黄金', icon: 'ai_3' },
    { name: '躺平王者', icon: 'ai_4' }
];

// ========== 死亡消息配置 ==========
export const DEATH_MESSAGES = [
    '被猛鬼抓走了',
    '的门被破坏了',
    '惨遭淘汰',
    '躺平失败了'
];
