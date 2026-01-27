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
│   ├── scenes/                # 场景文件
│   ├── prefabs/               # 预制体
│   ├── resources/             # 动态加载资源
│   └── textures/              # 纹理资源
├── h5-backup/                 # H5原型版本备份
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

## 使用方式

### 在 Cocos Creator 中打开
1. 打开 Cocos Creator 3.8.x
2. 选择"打开项目"
3. 选择本项目根目录

### 创建场景
1. 新建场景 `MainScene`
2. 添加 Canvas 节点
3. 挂载 `GameManager` 组件
4. 挂载 `GameUI` 组件
5. 挂载 `InputHandler` 组件

### 创建预制体
需要创建以下预制体：
- `RoomPrefab`: 房间节点
- `GhostPrefab`: 猛鬼节点
- `ProjectilePrefab`: 投射物节点

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
