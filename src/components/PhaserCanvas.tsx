import { useEffect, useRef } from "react";
import { initPhaser } from "@/phaser/main";

/**
 * PhaserCanvas — Phaser 게임을 마운트하는 React 컴포넌트.
 *
 * 지정된 컨테이너 ID에 Phaser 캔버스를 생성하고,
 * 컴포넌트 언마운트 시 정리합니다.
 *
 * P0에서는 기존 Phaser 에디터를 그대로 마운트.
 * P1에서 EditorHud 제거 후 캔버스 전용으로 동작.
 */
export function PhaserCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof initPhaser> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 컨테이너에 고유 ID 부여
    const containerId = "phaser-container";
    containerRef.current.id = containerId;

    // Phaser 초기화
    gameRef.current = initPhaser(containerId);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}
    />
  );
}
