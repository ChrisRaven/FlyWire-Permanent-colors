// ==UserScript==
// @name         Permanent colors
// @namespace    KrzysztofKruk-FlyWire
// @version      0.1.9.2
// @description  Permanents colors for segments
// @author       Krzysztof Kruk
// @match        https://ngl.flywire.ai/*
// @match        https://edit.flywire.ai/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      services.itanna.io
// @updateURL    https://raw.githubusercontent.com/ChrisRaven/FlyWire-Permanent-colors/main/Permanent-colors.user.js
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/FlyWire-Permanent-colors/main/Permanent-colors.user.js
// @homepageURL  https://github.com/ChrisRaven/FlyWire-Permanent-colors
// ==/UserScript==

if (!document.getElementById('dock-script')) {
  let script = document.createElement('script')
  script.id = 'dock-script'
  script.src = typeof DEV !== 'undefined' && DEV ? 'http://127.0.0.1:5501/FlyWire-Dock/Dock.js' : 'https://chrisraven.github.io/FlyWire-Dock/Dock.js'
  document.head.appendChild(script)
}

let wait = setInterval(() => {
  if (unsafeWindow.dockIsReady) {
    unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest
    clearInterval(wait)
    main()
  }
}, 100)


let ids = { supervoxel: null, root: null }
let currentColorPatchId = 'permanent-colors-1'



function fix_segmentColors_2022_07_15() {
  if (Dock.ls.get('fix_segmentColors_2022_07_15') === 'fixed') return

  Object.entries(localStorage).forEach(entry => {
    if (entry[0].includes('neuroglancerSaveState_v2-')) {
      let e = JSON.parse(entry[1])
      if (e.state && e.state.layers) {
        e.state.layers.forEach(layer => {
          if (layer.type === 'segmentation_with_graph' && layer.segmentColors) {
            layer.segmentColors = {}
            localStorage.setItem(entry[0], JSON.stringify(e))
          }
        })
      }
    }
  })
  Dock.ls.set('fix_segmentColors_2022_07_15', 'fixed')
}

function main() {
  let dock = new Dock()

  dock.addAddon({
    name: 'Permanent colors',
    id: 'permanent-colors',
    html: generateHtml(),
    css: generateCss(),
    events: {
      '.permanent-colors-selector': {
        contextmenu: e => rightClickHandler(e),
        input: e => {
          e.preventDefault()
          updateColor(e)
        },
        change: e => saveColor(e)
      }
    }
  })

  let patch = Dock.ls.get('pc-patch-id')
  if (patch) {
    currentColorPatchId = patch
  }
  ids = getIds() || {}

  recolorPatches()
  restoreColors()

  fix_segmentColors_2022_07_15()
}


function saveColor(e) {
  Dock.ls.set('-pc-color-patch-' + e.target.id, e.target.value)
}

function restoreColors() {
  for (let i = 1; i <= 4; i++) {
    let color = Dock.ls.get('-pc-color-patch-permanent-colors-' + i)
    let patch = document.getElementById('permanent-colors-' + i)
    if (!color) {
      switch (i) {
        // it has to be 6-digits values because of the <input type="color"> specs
        case 1: color = '#FF0000'; break
        case 2: color = '#00FF00'; break
        case 3: color = '#0000FF'; break
        case 4: color = '#FFFF00'; break
      }
    }
    patch.value = color
    patch.parentElement.style.backgroundColor = color
  }
}


function recolorPatches() {
  document.querySelectorAll('.permanent-colors-wrapper').forEach(el => {
    el.style.backgroundColor = el.firstChild.value
    if (el.firstChild.id === currentColorPatchId) {
      el.classList.add('permanent-colors-wrapper-selected')
    }
  })
}


function getIds() {
  return Dock.ls.get('pc-ids', true)
}


function saveIds() {
  Dock.ls.set('pc-ids', ids, true)
}


function changeColor(rootId, color) {
  function updateColors() {
    const segmentButton = document.querySelector(`button[data-seg-id="${rootId}"]`)
    if (!segmentButton) return

    const colorSelector = segmentButton.parentElement.getElementsByClassName('segment-color-selector')[0]

    colorSelector.value = color
    const event = new Event('change')
    colorSelector.dispatchEvent(event)
    viewer.layerManager.layersChanged.dispatch()
  }

  Dock.addToRightTab('segmentation_with_graph', 'rendering', updateColors)
}


function updateColor(e) {
  changeColor(ids.root, e.target.value)
  e.target.parentElement.style.backgroundColor = e.target.value

}


function rightClickHandler(e) {
  e.preventDefault()
  changeColorByCoords(e)

  currentColorPatchId = e.target.id
  Dock.ls.set('pc-patch-id', currentColorPatchId)

  document.getElementsByClassName('permanent-colors-wrapper-selected')[0].classList.remove('permanent-colors-wrapper-selected')
  document.getElementById(currentColorPatchId).parentElement.classList.add('permanent-colors-wrapper-selected')
}

// manual changing
function changeColorByCoords(e) {
  let currentCoords = Dock.getCurrentCoords()  
  let color = e.target.value

  Dock.getSegmentId(currentCoords[0] * 4, currentCoords[1] * 4, currentCoords[2], (segmentId) => {
    ids.supervoxel = segmentId
    Dock.getRootId(segmentId, rootId => rootId && getRootIdCallback(rootId, color))
  })
}


function getRootIdCallback(rootId, color) {
  changeColor(rootId, color)
  ids.root = rootId
  saveIds()
}


document.addEventListener('fetch', e => {
  let response = e.detail.response
  let url = e.detail.url
  if (!response || !url) return
  if (!currentColorPatchId) return // FIXME: sometimes happens for an unknown reason
  let color = document.getElementById(currentColorPatchId).value
  if (url.includes('split?') || url.includes('merge?')) {
    Dock.getRootId(ids.supervoxel, rootId => rootId && getRootIdCallback(rootId, color))
  }
  // new cell has been claimed
  else if (url.includes('proofreading_drive?')) {
    ids = {
      supervoxel: response.supervoxel_id,
      root: response.root_id
    }
    saveIds()
    Dock.layers.getByType('segmentation_with_graph', false)[0].layer.displayState.segmentStatedColors.clear()
    // viewer.selectedLayer.layer.layer.displayState.segmentStatedColors.clear()
    changeColor(ids.root, color)
  }
})


function generateCss() {
  return /*css*/`
    .permanent-colors-wrapper {
      display: inline-block;
      border: 1px solid #777;
      background-color: yellow;
    }

    .permanent-colors-wrapper-selected {
      border-color: #eee;
    }

    #permanent-colors .permanent-colors-selector {
      width: 27px;
      height: 20px;
      border: none;
      box-shadow: none;
      background-color: transparent;
      position: relative;
      top: 0;
      padding: 0;
      opacity: 0;
    }
  `
}


function generateHtml() {
  return /*html*/`
    <span class="permanent-colors-wrapper"><input type="color" id="permanent-colors-1" class="permanent-colors-selector" value="#ff0000" /></span>
    <span class="permanent-colors-wrapper"><input type="color" id="permanent-colors-2" class="permanent-colors-selector" value="#00ff00" /></span>
    <span class="permanent-colors-wrapper"><input type="color" id="permanent-colors-3" class="permanent-colors-selector" value="#0000ff" /></span>
    <span class="permanent-colors-wrapper"><input type="color" id="permanent-colors-4" class="permanent-colors-selector" value="#ffff00" /></span>
  `
}
