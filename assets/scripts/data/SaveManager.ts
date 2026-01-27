/**
 * 梦魇宿舍 - 存档管理器
 * 使用 Cocos Creator 的 sys.localStorage 进行本地存储
 */

import { sys } from 'cc';
import { SaveData, TalentData } from './GameConfig';

const SAVE_KEY = 'nightmare_dorm_save';

export class SaveManager {
    private static _instance: SaveManager | null = null;
    private _saveData: SaveData;

    private constructor() {
        this._saveData = this.load();
    }

    public static getInstance(): SaveManager {
        if (!SaveManager._instance) {
            SaveManager._instance = new SaveManager();
        }
        return SaveManager._instance;
    }

    /**
     * 获取默认存档数据
     */
    private getDefaultSaveData(): SaveData {
        return {
            beeCoins: 0,
            talents: {
                startGold: 0,
                doorHP: 0
            },
            stats: {
                totalGames: 0,
                totalKills: 0,
                bestSurvivalTime: 0
            }
        };
    }

    /**
     * 从本地存储加载数据
     */
    public load(): SaveData {
        try {
            const dataStr = sys.localStorage.getItem(SAVE_KEY);
            if (dataStr) {
                const data = JSON.parse(dataStr) as SaveData;
                // 合并默认值，防止存档结构变化导致的问题
                return this.mergeSaveData(data);
            }
        } catch (e) {
            console.warn('SaveManager: 加载存档失败', e);
        }
        return this.getDefaultSaveData();
    }

    /**
     * 合并存档数据与默认值
     */
    private mergeSaveData(data: Partial<SaveData>): SaveData {
        const defaultData = this.getDefaultSaveData();
        return {
            beeCoins: data.beeCoins ?? defaultData.beeCoins,
            talents: {
                startGold: data.talents?.startGold ?? defaultData.talents.startGold,
                doorHP: data.talents?.doorHP ?? defaultData.talents.doorHP
            },
            stats: {
                totalGames: data.stats?.totalGames ?? defaultData.stats.totalGames,
                totalKills: data.stats?.totalKills ?? defaultData.stats.totalKills,
                bestSurvivalTime: data.stats?.bestSurvivalTime ?? defaultData.stats.bestSurvivalTime
            }
        };
    }

    /**
     * 保存数据到本地存储
     */
    public save(): void {
        try {
            const dataStr = JSON.stringify(this._saveData);
            sys.localStorage.setItem(SAVE_KEY, dataStr);
        } catch (e) {
            console.error('SaveManager: 保存存档失败', e);
        }
    }

    /**
     * 清除存档
     */
    public clear(): void {
        sys.localStorage.removeItem(SAVE_KEY);
        this._saveData = this.getDefaultSaveData();
    }

    // ========== Getter/Setter ==========

    public get beeCoins(): number {
        return this._saveData.beeCoins;
    }

    public set beeCoins(value: number) {
        this._saveData.beeCoins = Math.max(0, value);
        this.save();
    }

    public get talents(): TalentData {
        return this._saveData.talents;
    }

    public get stats() {
        return this._saveData.stats;
    }

    // ========== 天赋操作 ==========

    /**
     * 获取天赋升级费用
     */
    public getTalentCost(talentType: keyof TalentData): number {
        const level = this._saveData.talents[talentType];
        switch (talentType) {
            case 'startGold':
                return 10 + level * 5;
            case 'doorHP':
                return 15 + level * 8;
            default:
                return 999;
        }
    }

    /**
     * 升级天赋
     */
    public upgradeTalent(talentType: keyof TalentData): boolean {
        const cost = this.getTalentCost(talentType);
        if (this._saveData.beeCoins >= cost) {
            this._saveData.beeCoins -= cost;
            this._saveData.talents[talentType]++;
            this.save();
            return true;
        }
        return false;
    }

    /**
     * 获取开局金币加成
     */
    public getStartGoldBonus(): number {
        return this._saveData.talents.startGold * 5;
    }

    /**
     * 获取门血量加成
     */
    public getDoorHPBonus(): number {
        return this._saveData.talents.doorHP * 20;
    }

    // ========== 统计操作 ==========

    /**
     * 记录游戏结果
     */
    public recordGameResult(survivalTime: number, kills: number, beeReward: number): void {
        this._saveData.stats.totalGames++;
        this._saveData.stats.totalKills += kills;
        if (survivalTime > this._saveData.stats.bestSurvivalTime) {
            this._saveData.stats.bestSurvivalTime = survivalTime;
        }
        this._saveData.beeCoins += beeReward;
        this.save();
    }

    /**
     * 添加蜜蜂币（用于广告奖励等）
     */
    public addBeeCoins(amount: number): void {
        this._saveData.beeCoins += amount;
        this.save();
    }
}
