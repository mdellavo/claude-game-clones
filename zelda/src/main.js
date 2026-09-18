import { Game } from './game.js';
import { installTouchControls } from './ui/touch.js';

const start = () => {
  window.game = new Game(document.getElementById('game'));
  installTouchControls();
};

// Wait for the pixel font so canvas-drawn labels use it.
if (document.fonts && document.fonts.load) {
  Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]).then(start, start);
} else {
  start();
}
