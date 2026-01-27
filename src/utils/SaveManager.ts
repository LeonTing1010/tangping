/**
 * 存档管理器
 */

import { SaveData } from '../config/GameConfig';

const SAVE_KEY = 'nightmare_dorm_save';

class SaveManagerClass {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private getDefault(): SaveData {
    return {
      beeCoins: 0,
      talents: { startGold: 0, doorHP: 0 },
      stats: { totalGames: 0, totalKills: 0, bestTime: 0 }
    };
  }

  load(): SaveData {
    try {
      const str = localStorage.getItem(SAVE_KEY);
      if (str) {
        return { ...this.getDefault(), ...JSON.parse(str) };
      }
    } catch (e) {
      console.warn('Load save failed:', e);
    }
    return this.getDefault();
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  get beeCoins(): number {
    return this.data.beeCoins;
  }

  set beeCoins(value: number) {
    this.data.beeCoins = Math.max(0, value);
    this.save();
  }

  get talents() {
    return this.data.talents;
  }

  getTalentCost(type: 'startGold' | 'doorHP'): number {
    return type === 'startGold'
      ? 10 + this.data.talents.startGold * 5
      : 15 + this.data.talents.doorHP * 8;
  }

  upgradeTalent(type: 'startGold' | 'doorHP'): boolean {
    const cost = this.getTalentCost(type);
    if (this.data.beeCoins >= cost) {
      this.data.beeCoins -= cost;
      this.data.talents[type]++;
      this.save();
      return true;
    }
    return false;
  }

  getStartGoldBonus(): number {
    return this.data.talents.startGold * 5;
  }

  getDoorHPBonus(): number {
    return this.data.talents.doorHP * 20;
  }

  recordGame(survivalTime: number, kills: number, beeReward: number): void {
    this.data.stats.totalGames++;
    this.data.stats.totalKills += kills;
    if (survivalTime > this.data.stats.bestTime) {
      this.data.stats.bestTime = survivalTime;
    }
    this.data.beeCoins += beeReward;
    this.save();
  }

  addBeeCoins(amount: number): void {
    this.data.beeCoins += amount;
    this.save();
  }
}

export const SaveManager = new SaveManagerClass();
