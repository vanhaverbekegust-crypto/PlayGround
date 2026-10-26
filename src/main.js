import './style.css'
import { Game } from './game.js'

const host = document.getElementById('game-root')

try {
  const game = new Game(host)
  window.__smashKarts = game
  window.__smashKartsDebug = () => ({
    state: game.state,
    timeLeft: game.timeLeft,
    player: {
      x: game.player.position.x,
      z: game.player.position.z,
      health: game.player.health,
      kills: game.player.kills,
      alive: game.player.alive
    },
    karts: game.karts.length,
    projectiles: game.projectiles.projectiles.length,
    drawCalls: game.renderer.info.render.calls
  })
} catch (error) {
  console.error(error)
  const panel = document.createElement('div')
  panel.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#0a0818;color:#fff6da;font-family:system-ui;text-align:center;padding:24px;z-index:99'
  panel.innerHTML = `<div><h1 style="font-family:Arial Black,sans-serif">WebGL unavailable</h1><p>Smash Karts IO needs a browser with WebGL enabled.</p><pre style="max-width:80vw;overflow:auto;opacity:.6">${String(error?.message ?? error)}</pre></div>`
  document.body.appendChild(panel)
}
