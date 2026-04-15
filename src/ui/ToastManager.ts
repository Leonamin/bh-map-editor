import Phaser from "phaser";

const TOAST_DURATION = 2000; // ms
const TOAST_FADE_DURATION = 400; // ms
const TOAST_HEIGHT = 32;
const TOAST_GAP = 6;
const TOAST_PADDING_X = 16;
const TOAST_FONT_SIZE = 13;

type ToastColor = "info" | "success" | "warn" | "error";

const TOAST_COLORS: Record<ToastColor, { bg: number; border: number; text: string }> = {
  info: { bg: 0x1e3a5f, border: 0x3b82f6, text: "#93c5fd" },
  success: { bg: 0x14532d, border: 0x22c55e, text: "#86efac" },
  warn: { bg: 0x422006, border: 0xf59e0b, text: "#fde68a" },
  error: { bg: 0x450a0a, border: 0xef4444, text: "#fca5a5" },
};

interface ToastEntry {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent;
}

/**
 * ToastManager — 순수 Phaser GameObject 기반 토스트 알림.
 * 에디터 하단 중앙에 표시되며, 자동으로 사라집니다.
 */
export class ToastManager {
  private scene: Phaser.Scene;
  private toasts: ToastEntry[] = [];
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000);
  }

  /**
   * 토스트를 표시합니다.
   * @param message - 표시할 메시지
   * @param color - 토스트 색상 타입 (기본: info)
   * @param duration - 표시 시간 ms (기본: 2000)
   */
  show(message: string, color: ToastColor = "info", duration = TOAST_DURATION): void {
    const palette = TOAST_COLORS[color];

    const bg = this.scene.add
      .rectangle(0, 0, 200, TOAST_HEIGHT, palette.bg, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, palette.border, 0.8);

    const text = this.scene.add
      .text(TOAST_PADDING_X, TOAST_HEIGHT / 2, message, {
        fontFamily: "monospace",
        fontSize: `${TOAST_FONT_SIZE}px`,
        color: palette.text,
      })
      .setOrigin(0, 0.5);

    // 배경 너비를 텍스트에 맞게 조정
    const textWidth = text.width;
    bg.setSize(textWidth + TOAST_PADDING_X * 2, TOAST_HEIGHT);

    const toastContainer = this.scene.add.container(0, 0);
    toastContainer.add([bg, text]);

    // 시작 위치: 화면 하단 아래 (보이지 않음)
    const targetY = this.getTargetY();
    const screenWidth = this.scene.scale.width;
    const x = (screenWidth - bg.width) / 2;

    toastContainer.setPosition(x, targetY + TOAST_HEIGHT + 10);
    toastContainer.setAlpha(0);

    this.container.add(toastContainer);

    // 슬라이드업 + 페이드인 트윈
    this.scene.tweens.add({
      targets: toastContainer,
      y: targetY,
      alpha: 1,
      duration: 200,
      ease: "Power2",
    });

    // 기존 토스트 위치 위로 밀기
    this.shiftExistingToasts(1);

    // 자동 닫기 타이머
    const timer = this.scene.time.delayedCall(duration, () => {
      this.dismissToast(toastContainer);
    });

    this.toasts.push({ container: toastContainer, bg, text, timer });
  }

  /** 특정 메시지에 대한 편의 메서드들 */
  info(message: string, duration?: number): void {
    this.show(message, "info", duration);
  }

  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  warn(message: string, duration?: number): void {
    this.show(message, "warn", duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  /** 모든 토스트를 즉시 제거합니다. */
  clearAll(): void {
    for (const toast of this.toasts) {
      toast.timer.remove(false);
      toast.container.destroy(true);
    }
    this.toasts = [];
  }

  /** 리사이즈 시 토스트 위치 재계산 */
  relayout(): void {
    // 활성 토스트들을 아래에서부터 다시 배치
    let index = 0;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      const targetY = this.getTargetY() - index * (TOAST_HEIGHT + TOAST_GAP);
      const screenWidth = this.scene.scale.width;
      const x = (screenWidth - toast.bg.width) / 2;
      toast.container.setPosition(x, targetY);
      index++;
    }
  }

  destroy(): void {
    this.clearAll();
    this.container.destroy(true);
  }

  // ─── Private ───

  private dismissToast(toastContainer: Phaser.GameObjects.Container): void {
    const index = this.toasts.findIndex((t) => t.container === toastContainer);
    if (index === -1) return;

    // 페이드아웃 + 슬라이드다운
    this.scene.tweens.add({
      targets: toastContainer,
      y: "+=20",
      alpha: 0,
      duration: TOAST_FADE_DURATION,
      ease: "Power2",
      onComplete: () => {
        toastContainer.destroy(true);
      },
    });

    this.toasts.splice(index, 1);

    // 나머지 토스트 위치 재조정
    this.repositionToasts();
  }

  private getTargetY(): number {
    const screenHeight = this.scene.scale.height;
    // 상태바(28px) 위에 표시
    return screenHeight - 28 - TOAST_HEIGHT - 8;
  }

  private shiftExistingToasts(count: number): void {
    for (let i = 0; i < this.toasts.length; i++) {
      const toast = this.toasts[i];
      const currentY = toast.container.y;
      this.scene.tweens.add({
        targets: toast.container,
        y: currentY - count * (TOAST_HEIGHT + TOAST_GAP),
        duration: 200,
        ease: "Power2",
      });
    }
  }

  private repositionToasts(): void {
    // 남은 토스트들을 올바른 위치로 재배치
    for (let i = 0; i < this.toasts.length; i++) {
      const toast = this.toasts[i];
      const targetY = this.getTargetY() - (this.toasts.length - 1 - i) * (TOAST_HEIGHT + TOAST_GAP);
      this.scene.tweens.add({
        targets: toast.container,
        y: targetY,
        duration: 200,
        ease: "Power2",
      });
    }
  }
}
