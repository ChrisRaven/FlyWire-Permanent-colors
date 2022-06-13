// ==UserScript==
// @name         Permanent colors
// @namespace    KrzysztofKruk-FlyWire
// @version      0.1.1
// @description  Permanents colors for segments
// @author       Krzysztof Kruk
// @match        https://ngl.flywire.ai/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      services.itanna.io
// @updateURL    https://raw.githubusercontent.com/ChrisRaven/Flywire-Permanent-colors/main/permanentcolors.user.js
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/Flywire-Permanent-colors/main/permanentcolors.user.js
// @homepageURL  https://github.com/ChrisRaven/Flywire-Permanent-colors
// ==/UserScript==

const DEV = false;


if (unsafeWindow.dockIsReady) return main()

let script = document.createElement('script')
script.src = DEV ? 'http://127.0.0.1:5501/FlyWire-Dock/Dock.js' : 'https://chrisraven.github.io/FlyWire-Dock/Dock.js'
document.head.appendChild(script)

let wait = setInterval(() => {
  if (unsafeWindow.dockIsReady) {
    clearInterval(wait)
    main()
  }
}, 100)


let ids = { supervoxel: null, root: null }
let currentColorPatchId = 'permanent-colors-1'

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


function getSegmentId(x, y, z, callback) {
  GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://services.itanna.io/app/transform-service/query/dataset/flywire_190410/s/2/values_array_string_response',
    data: `{"x":[${x}],"y":[${y}],"z":[${z}]}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    onload: response => response && callback(JSON.parse(response.response).values[0][0])
  })
}

function getRootId(supervoxelId, callback) {
  let authToken = localStorage.getItem('auth_token')

  fetch(`https://prodv1.flywire-daf.com/segmentation/api/v1/table/fly_v31/node/${supervoxelId}/root?int64_as_str=1&middle_auth_token=${authToken}`)
    .then(response => response.json())
    .then(response => {
      if (!response) return
      ids.root = response.root_id
      saveIds()
      callback(ids.root)
    })
}


function stringToUint64(s) {
  if (!s) return { low: 0, high: 0 }

  const MAX_INT_LENGTH = 9
  const MAX_HEX_INT_LENGTH = 8

  if (s.length <= MAX_INT_LENGTH) return { low: +s, high: 0 }

  s = BigInt(s).toString(16)
  if (s.length % 2) {
    s = '0' + s
  }

  let low = s.substring(MAX_HEX_INT_LENGTH)
  let high = s.substring(0, s.length - low.length)

  low = parseInt(low, 16)
  high = high ? parseInt(high, 16) : 0

  return { low: low, high: high }
}


function rgbToObj(color) {
  let colorObj = color.substring(1)
  let r = parseInt(colorObj.substring(0, 2), 16)
  let g = parseInt(colorObj.substring(2, 4), 16)
  let b = parseInt(colorObj.substring(4, 6), 16)
  // color will always be below FFFFFFFF, so there's no need to convert it to Uint64
  return { low: r * 256 * 256 + g * 256 + b, high: 0 }
}


function changeColor(rootId, color) {
  let rootIdObj = stringToUint64(rootId)
  let graphLayer = viewer.layerManager.getLayerByName('Production-segmentation_with_graph')
  if (!graphLayer) {
    graphLayer = viewer.layerManager.getLayerByName('Sandbox-segmentation-FOR PRACTICE ONLY')
  }
  if (!graphLayer) {
    graphLayer = viewer.layerManager.getLayerByName('Testing-segmentation-FOR TEST TAKING ONLY')
  }
  let colors = graphLayer.layer_.displayState.segmentStatedColors

  colorObj = rgbToObj(color)
  colors.delete(rootIdObj)
  colors.set(rootIdObj, colorObj)
  graphLayer.layerChanged.dispatch()

  let waitUntilPanelVisible
  // we have to wait, until the right panel is visible or until refresh...
  let waitUntilPanelVisibleCallback = () => {
    let segmentButton = document.querySelector(`button[data-seg-id="${rootId}"]`)
    if (!segmentButton) return
    let colorSelector = segmentButton.nextSibling

    while (colorSelector && colorSelector.type !== 'color') {
      colorSelector = colorSelector.nextSibling
    }

    segmentButton.style.backgroundColor = color
    segmentButton.style.setProperty('--defBtnColor', color);
    segmentButton.style.setProperty('--actBtnColor', color);
    colorSelector.value = color
    clearInterval(waitUntilPanelVisible)
  }

  // ... but we can try to do the changing right away
  waitUntilPanelVisibleCallback()
  waitUntilPanelVisible = setTimeout(() => waitUntilPanelVisibleCallback, 1000)  
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
  let currentCoords = document
                        .querySelector('.neuroglancer-position-widget-input').value
                        .split(',')
                        .map(el => el.trim())
  let color = e.target.value

  getSegmentId(...currentCoords, (segmentId) => {
    ids.supervoxel = segmentId
    saveIds()
    getRootId(segmentId, rootId => changeColor(rootId, color))
  })
}


document.addEventListener('fetch', e => {
  let response = e.detail.response
  let url = e.detail.url
  if (!response || !url) return
  let color = document.getElementById(currentColorPatchId).value

  if (url.includes('split?') || url.includes('merge?')) {
    getRootId(ids.supervoxel, rootId => changeColor(rootId, color))
    
  }
  // new cell has been taken
  else if (url.includes('proofreading_drive?')) {
    ids = {
      supervoxel: response.supervoxel_id,
      root: response.root_id
    }
    saveIds()
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
