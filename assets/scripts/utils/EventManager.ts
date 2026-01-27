/**
 * 梦魇宿舍 - 事件管理器
 * 全局事件系统
 */

type EventCallback = (...args: any[]) => void;

export class EventManager {
    private static _instance: EventManager | null = null;
    private _events: Map<string, EventCallback[]> = new Map();

    private constructor() {}

    public static getInstance(): EventManager {
        if (!EventManager._instance) {
            EventManager._instance = new EventManager();
        }
        return EventManager._instance;
    }

    /**
     * 注册事件监听
     */
    public on(event: string, callback: EventCallback): void {
        if (!this._events.has(event)) {
            this._events.set(event, []);
        }
        this._events.get(event)!.push(callback);
    }

    /**
     * 移除事件监听
     */
    public off(event: string, callback: EventCallback): void {
        const callbacks = this._events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index >= 0) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    public emit(event: string, ...args: any[]): void {
        const callbacks = this._events.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    }

    /**
     * 清除所有事件
     */
    public clear(): void {
        this._events.clear();
    }
}

// 事件名称常量
export const GameEvents = {
    // 游戏流程
    GAME_START: 'game:start',
    GAME_OVER: 'game:over',
    GAME_VICTORY: 'game:victory',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',

    // 房间
    ROOM_SELECTED: 'room:selected',
    ROOM_DOOR_BROKEN: 'room:door_broken',
    ROOM_UPGRADED: 'room:upgraded',

    // 玩家
    PLAYER_DIED: 'player:died',
    PLAYER_GOLD_CHANGED: 'player:gold_changed',

    // 猛鬼
    GHOST_SPAWNED: 'ghost:spawned',
    GHOST_DIED: 'ghost:died',
    GHOST_ATTACKING: 'ghost:attacking',

    // UI
    UI_SHOW_BUILD_MENU: 'ui:show_build_menu',
    UI_SHOW_UPGRADE_PANEL: 'ui:show_upgrade_panel',
    UI_SHOW_BROADCAST: 'ui:show_broadcast'
};
