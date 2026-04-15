import Phaser from "phaser";
import { EditorScene } from "./scenes/EditorScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#111827",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [EditorScene],
});

// ─── Resize ───

window.addEventListener("resize", () => {
  const container = document.getElementById("game-container");
  if (container) {
    game.scale.resize(container.clientWidth, container.clientHeight);
  }
});
