// ==UserScript==
// @name         Permanent colors
// @namespace    KrzysztofKruk-FlyWire
// @version      0.1
// @description  Permanents colors for segments
// @author       Krzysztof Kruk
// @match        https://ngl.flywire.ai/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ChrisRaven/Flywire-Permanent-colors/main/permanentcolors.user.js
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/Flywire-Permanent-colors/main/permanentcolors.user.js
// @homepageURL  https://github.com/ChrisRaven/Flywire-Permanent-colors
// ==/UserScript==


(() => {
  if (globalThis.dockIsReady) return main()

  let script = document.createElement('script')
  script.src = 'https://chrisraven.github.io/FlyWire-Dock/Dock.js'
  document.head.appendChild(script)

  let wait = setInterval(() => {
    if (globalThis.dockIsReady) {
      clearInterval(wait)
      main()
    }
  }, 100)
})()


function main() {
  let dock = new Dock()

  dock.addAddon({})
}

