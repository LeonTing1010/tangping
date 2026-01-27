/**
 * 梦魇宿舍 - 游戏UI管理
 */

import { _decorator, Component, Node, Label, Button, Color, Vec3, tween, UIOpacity } from 'cc';
import { Room } from '../game/Room';
import { AIPlayer } from '../game/AIPlayer';
import { GameManager } from '../game/GameManager';
import { SaveManager } from '../data/SaveManager';
import { BED_CONFIGS, DOOR_CONFIGS, BUILDING_CONFIGS } from '../data/GameConfig';

const { ccclass, property } = _decorator;

interface GameResult {
    survivalTime: number;
    kills: number;
    gold: number;
    beeReward: number;
}

@ccclass('GameUI')
export class GameUI extends Component {
    // ========== 屏幕节点 ==========
    @property(Node)
    public startScreen: Node | null = null;

    @property(Node)
    public gameScreen: Node | null = null;

    @property(Node)
    public resultScreen: Node | null = null;

    // ========== 开始界面 ==========
    @property(Label)
    public beeCoinsLabel: Label | null = null;

    @property(Label)
    public talentGoldLevelLabel: Label | null = null;

    @property(Label)
    public talentGoldCostLabel: Label | null = null;

    @property(Label)
    public talentDoorLevelLabel: Label | null = null;

    @property(Label)
    public talentDoorCostLabel: Label | null = null;

    @property(Button)
    public startButton: Button | null = null;

    // ========== 游戏界面 ==========
    @property(Label)
    public goldLabel: Label | null = null;

    @property(Label)
    public dpsLabel: Label | null = null;

    @property(Label)
    public waveInfoLabel: Label | null = null;

    @property(Node)
    public playerIconsContainer: Node | null = null;

    @property(Node)
    public broadcastContainer: Node | null = null;

    @property(Node)
    public buildMenu: Node | null = null;

    @property(Node)
    public upgradePanel: Node | null = null;

    @property(Node)
    public floatingTextContainer: Node | null = null;

    // ========== 升级面板 ==========
    @property(Label)
    public upgradeTitleLabel: Label | null = null;

    @property(Label)
    public upgradeNameLabel: Label | null = null;

    @property(Label)
    public upgradeDescLabel: Label | null = null;

    @property(Label)
    public upgradeNextLabel: Label | null = null;

    @property(Label)
    public upgradeCostLabel: Label | null = null;

    @property(Button)
    public upgradeButton: Button | null = null;

    // ========== 结算界面 ==========
    @property(Label)
    public resultTitleLabel: Label | null = null;

    @property(Label)
    public resultMessageLabel: Label | null = null;

    @property(Label)
    public finalTimeLabel: Label | null = null;

    @property(Label)
    public finalKillsLabel: Label | null = null;

    @property(Label)
    public finalGoldLabel: Label | null = null;

    @property(Label)
    public finalBeeLabel: Label | null = null;

    @property(Button)
    public reviveButton: Button | null = null;

    @property(Button)
    public doubleButton: Button | null = null;

    @property(Button)
    public restartButton: Button | null = null;

    // ========== 预制体 ==========
    @property(Node)
    public playerIconPrefab: Node | null = null;

    @property(Node)
    public broadcastPrefab: Node | null = null;

    @property(Node)
    public floatingTextPrefab: Node | null = null;

    // ========== 内部状态 ==========
    private _currentUpgradeType: string = '';

    // ========== 生命周期 ==========

    protected onLoad(): void {
        this.initUI();
        this.bindEvents();
    }

    protected start(): void {
        this.showStartScreen();
    }

    // ========== 初始化 ==========

    private initUI(): void {
        // 隐藏所有屏幕
        this.startScreen?.setScale(Vec3.ONE);
        this.gameScreen?.setScale(Vec3.ZERO);
        this.resultScreen?.setScale(Vec3.ZERO);

        // 隐藏面板
        this.buildMenu?.setScale(Vec3.ZERO);
        this.upgradePanel?.setScale(Vec3.ZERO);
    }

    private bindEvents(): void {
        // 开始按钮
        this.startButton?.node.on(Button.EventType.CLICK, () => {
            GameManager.getInstance()?.startGame();
        });

        // 天赋按钮
        this.node.on('upgrade-talent-gold', () => {
            this.upgradeTalent('startGold');
        });

        this.node.on('upgrade-talent-door', () => {
            this.upgradeTalent('doorHP');
        });

        // 建造菜单按钮
        this.node.on('build-turret', () => this.buildItem('turret'));
        this.node.on('build-generator', () => this.buildItem('generator'));
        this.node.on('build-trap', () => this.buildItem('trap'));
        this.node.on('build-plant', () => this.buildItem('plant'));
        this.node.on('close-build', () => this.hideBuildMenu());

        // 升级面板按钮
        this.upgradeButton?.node.on(Button.EventType.CLICK, () => {
            this.doUpgrade();
        });

        this.node.on('close-upgrade', () => this.hideUpgradePanel());

        // 快捷按钮
        this.node.on('quick-bed', () => {
            const room = GameManager.getInstance()?.playerRoom;
            if (room) this.showUpgradePanel('bed', room);
        });

        this.node.on('quick-door', () => {
            const room = GameManager.getInstance()?.playerRoom;
            if (room) this.showUpgradePanel('door', room);
        });

        this.node.on('quick-build', () => this.showBuildMenu());

        // 结算界面按钮
        this.reviveButton?.node.on(Button.EventType.CLICK, () => {
            GameManager.getInstance()?.revive();
        });

        this.doubleButton?.node.on(Button.EventType.CLICK, () => {
            GameManager.getInstance()?.doubleReward();
            if (this.doubleButton) {
                this.doubleButton.interactable = false;
            }
        });

        this.restartButton?.node.on(Button.EventType.CLICK, () => {
            this.showStartScreen();
        });
    }

    // ========== 屏幕切换 ==========

    public showStartScreen(): void {
        this.startScreen?.setScale(Vec3.ONE);
        this.gameScreen?.setScale(Vec3.ZERO);
        this.resultScreen?.setScale(Vec3.ZERO);

        this.updateTalentUI();
    }

    public showGameScreen(): void {
        this.startScreen?.setScale(Vec3.ZERO);
        this.gameScreen?.setScale(Vec3.ONE);
        this.resultScreen?.setScale(Vec3.ZERO);

        this.hideBuildMenu();
        this.hideUpgradePanel();
    }

    public showResultScreen(isVictory: boolean, result: GameResult): void {
        this.startScreen?.setScale(Vec3.ZERO);
        this.gameScreen?.setScale(Vec3.ZERO);
        this.resultScreen?.setScale(Vec3.ONE);

        if (this.resultTitleLabel) {
            if (isVictory) {
                this.resultTitleLabel.string = '胜利!';
                this.resultTitleLabel.color = new Color(76, 175, 80);
            } else {
                this.resultTitleLabel.string = '游戏结束';
                this.resultTitleLabel.color = new Color(255, 107, 107);
            }
        }

        if (this.resultMessageLabel) {
            this.resultMessageLabel.string = isVictory
                ? '你成功存活到了最后!'
                : '你的门被猛鬼破坏了!';
        }

        if (this.finalTimeLabel) this.finalTimeLabel.string = `${result.survivalTime}`;
        if (this.finalKillsLabel) this.finalKillsLabel.string = `${result.kills}`;
        if (this.finalGoldLabel) this.finalGoldLabel.string = `${result.gold}`;
        if (this.finalBeeLabel) this.finalBeeLabel.string = `${result.beeReward}`;

        // 重置按钮状态
        if (this.doubleButton) {
            this.doubleButton.interactable = true;
        }
    }

    public hideResultScreen(): void {
        this.resultScreen?.setScale(Vec3.ZERO);
        this.gameScreen?.setScale(Vec3.ONE);
    }

    // ========== HUD更新 ==========

    public updateGold(gold: number): void {
        if (this.goldLabel) {
            this.goldLabel.string = `${Math.floor(gold)}`;
        }
    }

    public updateDPS(dps: number): void {
        if (this.dpsLabel) {
            this.dpsLabel.string = `${dps.toFixed(1)}/秒`;
        }
    }

    public updateWaveInfo(info: string): void {
        if (this.waveInfoLabel) {
            this.waveInfoLabel.string = info;
        }
    }

    public updatePlayerIcons(aiPlayers: AIPlayer[]): void {
        // 更新玩家图标显示
        // 实际实现需要根据UI结构调整
    }

    // ========== 天赋系统 ==========

    private updateTalentUI(): void {
        const saveManager = SaveManager.getInstance();

        if (this.beeCoinsLabel) {
            this.beeCoinsLabel.string = `${saveManager.beeCoins}`;
        }

        const talents = saveManager.talents;

        if (this.talentGoldLevelLabel) {
            this.talentGoldLevelLabel.string = `Lv.${talents.startGold}`;
        }
        if (this.talentGoldCostLabel) {
            this.talentGoldCostLabel.string = `${saveManager.getTalentCost('startGold')}`;
        }

        if (this.talentDoorLevelLabel) {
            this.talentDoorLevelLabel.string = `Lv.${talents.doorHP}`;
        }
        if (this.talentDoorCostLabel) {
            this.talentDoorCostLabel.string = `${saveManager.getTalentCost('doorHP')}`;
        }
    }

    private upgradeTalent(type: 'startGold' | 'doorHP'): void {
        const saveManager = SaveManager.getInstance();
        if (saveManager.upgradeTalent(type)) {
            this.updateTalentUI();
        }
    }

    // ========== 建造菜单 ==========

    public showBuildMenu(): void {
        this.buildMenu?.setScale(Vec3.ONE);
    }

    public hideBuildMenu(): void {
        this.buildMenu?.setScale(Vec3.ZERO);
    }

    private buildItem(type: string): void {
        GameManager.getInstance()?.buildItem(type);
        this.hideBuildMenu();
    }

    // ========== 升级面板 ==========

    public showUpgradePanel(type: string, room: Room): void {
        this._currentUpgradeType = type;
        this.upgradePanel?.setScale(Vec3.ONE);

        const gameManager = GameManager.getInstance();
        const gold = gameManager?.gold || 0;

        if (type === 'bed') {
            const current = room.getCurrentBedConfig();
            const next = room.getNextBedConfig();

            if (this.upgradeNameLabel) this.upgradeNameLabel.string = current.name;
            if (this.upgradeDescLabel) this.upgradeDescLabel.string = `产出: ${current.goldPerSec}金币/秒`;

            if (next) {
                if (this.upgradeNextLabel) this.upgradeNextLabel.string = `下一级: ${next.name} (${next.goldPerSec}金币/秒)`;
                if (this.upgradeCostLabel) this.upgradeCostLabel.string = `${next.cost}`;
                if (this.upgradeButton) this.upgradeButton.interactable = gold >= next.cost;
            } else {
                if (this.upgradeNextLabel) this.upgradeNextLabel.string = '已满级';
                if (this.upgradeButton) this.upgradeButton.interactable = false;
            }
        } else if (type === 'door') {
            const current = room.getCurrentDoorConfig();
            const next = room.getNextDoorConfig();

            if (this.upgradeNameLabel) this.upgradeNameLabel.string = current.name;
            if (this.upgradeDescLabel) {
                this.upgradeDescLabel.string = `血量: ${room.doorHP}/${room.doorMaxHP} 护甲: ${current.armor}`;
            }

            if (next) {
                if (this.upgradeNextLabel) {
                    this.upgradeNextLabel.string = `下一级: ${next.name} (HP:${next.hp} 护甲:${next.armor})`;
                }
                if (this.upgradeCostLabel) this.upgradeCostLabel.string = `${next.cost}`;
                if (this.upgradeButton) this.upgradeButton.interactable = gold >= next.cost;
            } else {
                if (this.upgradeNextLabel) this.upgradeNextLabel.string = '已满级';
                if (this.upgradeButton) this.upgradeButton.interactable = false;
            }
        }
    }

    public hideUpgradePanel(): void {
        this.upgradePanel?.setScale(Vec3.ZERO);
        this._currentUpgradeType = '';
    }

    private doUpgrade(): void {
        const gameManager = GameManager.getInstance();
        if (!gameManager) return;

        if (this._currentUpgradeType === 'bed') {
            gameManager.upgradeBed();
        } else if (this._currentUpgradeType === 'door') {
            gameManager.upgradeDoor();
        }

        this.hideUpgradePanel();
    }

    // ========== 广播消息 ==========

    public showBroadcast(message: string): void {
        if (!this.broadcastContainer) return;

        // 创建广播消息节点
        const msgNode = new Node('Broadcast');
        msgNode.setParent(this.broadcastContainer);

        const label = msgNode.addComponent(Label);
        label.string = message;
        label.fontSize = 24;
        label.color = new Color(255, 255, 255);

        const opacity = msgNode.addComponent(UIOpacity);

        // 动画：淡入 -> 等待 -> 淡出
        tween(opacity)
            .to(0.3, { opacity: 255 })
            .delay(2.4)
            .to(0.3, { opacity: 0 })
            .call(() => {
                msgNode.destroy();
            })
            .start();
    }

    // ========== 浮动文字 ==========

    public showFloatingText(pos: Vec3, text: string, colorHex: string): void {
        if (!this.floatingTextContainer) return;

        const textNode = new Node('FloatingText');
        textNode.setParent(this.floatingTextContainer);
        textNode.setPosition(pos);

        const label = textNode.addComponent(Label);
        label.string = text;
        label.fontSize = 20;

        // 解析颜色
        const color = new Color();
        color.fromHEX(colorHex);
        label.color = color;

        const opacity = textNode.addComponent(UIOpacity);

        // 向上漂浮并淡出
        tween(textNode)
            .by(1.5, { position: new Vec3(0, 50, 0) })
            .start();

        tween(opacity)
            .delay(1)
            .to(0.5, { opacity: 0 })
            .call(() => {
                textNode.destroy();
            })
            .start();
    }
}
