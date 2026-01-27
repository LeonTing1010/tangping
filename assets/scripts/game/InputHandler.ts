/**
 * 梦魇宿舍 - 输入处理器
 * 处理触摸和点击输入
 */

import { _decorator, Component, Node, EventTouch, UITransform, Vec3, Camera } from 'cc';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

@ccclass('InputHandler')
export class InputHandler extends Component {
    @property(Node)
    public gameCanvas: Node | null = null;

    @property(Camera)
    public mainCamera: Camera | null = null;

    protected onLoad(): void {
        this.bindEvents();
    }

    protected onDestroy(): void {
        this.unbindEvents();
    }

    private bindEvents(): void {
        if (this.gameCanvas) {
            this.gameCanvas.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }

    private unbindEvents(): void {
        if (this.gameCanvas) {
            this.gameCanvas.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }

    private onTouchEnd(event: EventTouch): void {
        const touchPos = event.getUILocation();

        // 转换为游戏世界坐标
        const worldPos = this.convertToGameCoords(touchPos.x, touchPos.y);

        // 传递给游戏管理器处理
        GameManager.getInstance()?.handleClick(worldPos.x, worldPos.y);
    }

    /**
     * 将屏幕坐标转换为游戏坐标
     */
    private convertToGameCoords(screenX: number, screenY: number): Vec3 {
        if (this.gameCanvas && this.mainCamera) {
            const transform = this.gameCanvas.getComponent(UITransform);
            if (transform) {
                // 将屏幕坐标转换为节点本地坐标
                const worldPos = new Vec3(screenX, screenY, 0);
                return worldPos;
            }
        }
        return new Vec3(screenX, screenY, 0);
    }
}
