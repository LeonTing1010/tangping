# 梦魇宿舍 - 躺平塔防

基于 Phaser 3 + TypeScript + Vite 的躺平塔防 H5 单机游戏。

## 项目结构

```
tangping/
├── src/
│   ├── config/
│   │   └── GameConfig.ts     # 游戏配置常量
│   ├── objects/
│   │   ├── Room.ts           # 房间类
│   │   ├── Ghost.ts          # 猛鬼AI类
│   │   └── AIPlayer.ts       # AI玩家类
│   ├── scenes/
│   │   ├── StartScene.ts     # 开始场景
│   │   ├── GameScene.ts      # 游戏主场景
│   │   ├── ResultScene.ts    # 结算场景
│   │   └── TalentScene.ts    # 天赋场景
│   ├── utils/
│   │   └── SaveManager.ts    # 本地存储管理
│   └── main.ts               # 游戏入口
├── index.html                # HTML入口
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 核心功能

### 1. 建筑升级系统
- **床升级**: 破旧木床 → 席梦思 → 智能按摩床 → 豪华太空舱
- **门升级**: 木门 → 铁门 → 钢门 → 钛合金门（含护甲系统）
- **防御建筑**: 炮塔、发电机、陷阱、摇钱草

### 2. 猛鬼AI状态机
- **IDLE**: 在走廊徘徊
- **ATTACK**: 选择房间攻击门
- **RETREAT**: 血量低于20%时撤回出生点回血

### 3. 动态难度
- 猛鬼属性随波次递增（HP/攻击力 +10%/波）
- 每15秒生成新波次
- 每3波多生成一只猛鬼

### 4. 假多人系统
- 4个AI队友自动占房、升级
- 队友死亡广播提示
- 模拟多人竞争压力

### 5. 本地存储
- 蜜蜂币持久化
- 天赋等级保存
- 游戏统计记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

浏览器会自动打开 http://localhost:3000

### 3. 构建发布

```bash
npm run build
```

构建产物在 `dist/` 目录下，可直接部署到静态服务器。

### 4. 预览构建

```bash
npm run preview
```

## 配置说明

### GameConfig.ts
所有游戏数值配置都在 `GameConfig.ts` 中，包括：
- 床/门升级配置
- 建筑配置
- 猛鬼配置
- 游戏时间配置
- 房间布局配置

### SaveManager.ts
使用 `localStorage` 进行本地存储：
```typescript
import { SaveManager } from './utils/SaveManager';

// 读取蜜蜂币
const coins = SaveManager.beeCoins;

// 升级天赋
SaveManager.upgradeTalent('startGold');

// 记录游戏结果
SaveManager.recordGame(survivalTime, kills, beeReward);
```

## 数值公式

### 金币产出
```
每秒金币 = 床产出 + 建筑产出
床产出 = BED_CONFIGS[bedLevel].goldPerSec
```

### 难度递增
```
猛鬼HP = baseHP * (1 + wave * 0.1)
猛鬼攻击 = baseDamage * (1 + wave * 0.1)
```

### 伤害计算
```
实际伤害 = max(1, 猛鬼攻击 - 门护甲)
```

## 技术栈

- **Phaser 3**: 游戏框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具

## License

MIT
