# 梦魇宿舍 - 躺平塔防

基于 Cocos Creator 3.x + TypeScript 的躺平塔防 H5 单机游戏。

## 项目结构

```
tangping/
├── assets/
│   ├── scripts/
│   │   ├── data/              # 数据配置
│   │   │   ├── GameConfig.ts  # 游戏配置常量
│   │   │   └── SaveManager.ts # 本地存储管理
│   │   ├── game/              # 游戏逻辑
│   │   │   ├── GameManager.ts # 游戏管理器（核心）
│   │   │   ├── Room.ts        # 房间组件
│   │   │   ├── Ghost.ts       # 猛鬼AI组件
│   │   │   ├── AIPlayer.ts    # AI玩家组件
│   │   │   └── InputHandler.ts # 输入处理
│   │   ├── ui/                # UI组件
│   │   │   └── GameUI.ts      # 游戏UI管理
│   │   └── utils/             # 工具类
│   │       └── EventManager.ts # 事件管理器
│   ├── scenes/                # 场景文件 (在IDE中创建)
│   ├── prefabs/               # 预制体 (在IDE中创建)
│   ├── resources/             # 动态加载资源
│   └── textures/              # 纹理资源
├── project.json               # Cocos Creator 项目配置
├── package.json
├── tsconfig.json
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

### 1. 安装 Cocos Creator
下载地址: https://www.cocos.com/creator-download
推荐版本: 3.8.x

### 2. 打开项目
1. 启动 Cocos Creator
2. 点击「打开项目」
3. 选择本项目根目录 (`tangping/`)
4. 等待编辑器加载

### 3. 创建主场景
1. 在 `assets/scenes/` 右键 → 新建 → Scene
2. 命名为 `MainScene`
3. 双击打开场景

### 4. 搭建游戏节点
```
Canvas (添加 GameManager, InputHandler 组件)
├── GameUI (添加 GameUI 组件)
│   ├── StartScreen
│   ├── GameScreen
│   └── ResultScreen
├── RoomContainer (房间父节点)
├── GhostContainer (猛鬼父节点)
└── ProjectileContainer (投射物父节点)
```

### 5. 创建预制体
在 `assets/prefabs/` 创建:
- `RoomPrefab`: 房间节点，添加 Room 组件
- `GhostPrefab`: 猛鬼节点，添加 Ghost 组件
- `ProjectilePrefab`: 投射物节点 (Sprite)

### 6. 发布
菜单 → 项目 → 构建发布
- Web Mobile: H5网页版
- 微信小游戏: 需要微信开发者工具
- 抖音小游戏: 需要抖音开发者工具

## 配置说明

### GameConfig.ts
所有游戏数值配置都在 `GameConfig.ts` 中，包括：
- 床/门升级配置
- 建筑配置
- 猛鬼配置
- 游戏时间配置
- 房间布局配置

### SaveManager.ts
使用 `cc.sys.localStorage` 进行本地存储：
```typescript
// 获取实例
const saveManager = SaveManager.getInstance();

// 读取蜜蜂币
const coins = saveManager.beeCoins;

// 升级天赋
saveManager.upgradeTalent('startGold');

// 记录游戏结果
saveManager.recordGameResult(survivalTime, kills, beeReward);
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

## License

MIT
