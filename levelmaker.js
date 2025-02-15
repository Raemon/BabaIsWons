import {removeAllAdjectives} from "./rules/adjective.js"
import {wordMasks} from './rules/ruleService.js'
import {executeRules} from "./rules/rules.js"
import {drawGameState, gameHandler, updateRuleUI, changeMoveYou, move, removeObj} from "./game.js"
import * as undo from "./undo.js";

// Constants
const defaultObj = "wall";

// State
window.makemode = "object";
window.globalId = 1;

// Caches and loading queue
const levelMetadataCache = new Map();
const worldLevelsCache = new Map();
let loadingQueue = [];
let isProcessingQueue = false;

// Cache management functions
async function preloadWorldLevels(worldName) {
  if (worldLevelsCache.has(worldName)) return;
  
  const worldLevels = window.worlds[worldName];
  const levels = [];
  
  for (const levelId of worldLevels) {
    try {
      const [metadata, levelData] = await Promise.all([
        getLevelMetadata(levelId),
        netService.getGameState(levelId)
      ]);
      
      if (metadata && levelData) {
        levels.push({ id: levelId, metadata, data: levelData });
      }
    } catch (e) {
      console.error(`Failed to preload level ${levelId}:`, e);
    }
  }
  
  worldLevelsCache.set(worldName, levels);
}

function queueWorldForLoading(worldName, priority = false) {
  if (priority) {
    // Remove if already in queue and add to front
    loadingQueue = loadingQueue.filter(w => w !== worldName);
    loadingQueue.unshift(worldName);
  } else if (!loadingQueue.includes(worldName)) {
    loadingQueue.push(worldName);
  }
  
  // Start processing queue if not already running
  if (!isProcessingQueue) {
    processLoadingQueue();
  }
}

async function processLoadingQueue() {
  if (isProcessingQueue || loadingQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (loadingQueue.length > 0) {
    const worldName = loadingQueue.shift();
    await preloadWorldLevels(worldName);
  }
  
  isProcessingQueue = false;
}

function showFeedback(message, isError = false) {
  const feedback = $('<div class="feedback"></div>').text(message);
  feedback.css({
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '10px 20px',
    backgroundColor: isError ? '#f44336' : '#4CAF50',
    color: 'white',
    borderRadius: '5px',
    zIndex: 1000
  });
  $('body').append(feedback);
  setTimeout(() => feedback.fadeOut('slow', function() { $(this).remove(); }), 3000);
}

function showConfigPopup(levelId, levelName) {
  const configEntry = {
    id: levelId,
    name: levelName,
    description: 'Custom level' // Optional default description
  };
  
  let configString = "{\n";
  for (const key in configEntry) {
    configString += `      ${key}: `;
    const value = configEntry[key];
    if (typeof value === 'string') {
      configString += `"${value}"`;
    } else {
      configString += `${value}`;
    }
    configString += ",\n";
  }
  configString = configString.slice(0, -2) + "\n    }";
  configString += ",\n    ";

  const popup = $(`
    <div class="modal config-popup visible">
      <div class="modal-content" style="max-width: 600px;">
        <span class="close">×</span>
        <h3 style="margin-top: 0;">Level saved successfully!</h3>
        <div style="margin: 20px 0;">
          <p>Add this to your config.js file:</p>
          <pre style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px; margin: 10px 0; white-space: pre-wrap;">${configString}</pre>
          <button class="copy-button play-button">Copy to Clipboard</button>
        </div>
      </div>
    </div>
  `);

  // Add to body
  $('body').append(popup);

  // Setup copy button
  popup.find('.copy-button').click(async () => {
    try {
      await navigator.clipboard.writeText(configString);
      const btn = popup.find('.copy-button');
      btn.text('Copied!');
      setTimeout(() => btn.text('Copy to Clipboard'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Setup close button
  popup.find('.close').click(() => {
    popup.removeClass('visible');
    setTimeout(() => popup.remove(), 300);
  });

  // Auto dismiss after 10 seconds
  setTimeout(() => {
    if (popup.hasClass('visible')) {
      popup.removeClass('visible');
      setTimeout(() => popup.remove(), 300);
    }
  }, 10000);
}

async function getLevelMetadata(levelId) {
  if (levelMetadataCache.has(levelId)) {
    return levelMetadataCache.get(levelId);
  }
  
  try {
    const data = await netService.getGameState(levelId);
    const metadata = {
      id: levelId,
      name: data.name || 'Unnamed Level',
      size: data.size
    };
    levelMetadataCache.set(levelId, metadata);
    return metadata;
  } catch (e) {
    console.error(`Failed to load metadata for level ${levelId}:`, e);
    return null;
  }
}

async function createWorldPreview(worldName) {
  // Create world preview container
  const container = $(`
    <div class="world-section">
      <h3>${worldName}</h3>
      <div class="world-preview">
        <img src="img/${worldName.toLowerCase().replace(/ /g, '')}.png" alt="${worldName}">
        <span class="number-of-levels-text">${window.worlds[worldName].length} levels</span>
      </div>
    </div>
  `);

  // Create a separate popup for levels
  const levelsPopup = $(`
    <div class="world-levels" style="display:none; position: fixed; background: white; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; z-index: 1000;">
      <div class="world-levels-content">
        <div class="loading world-loading" style="padding: 20px; text-align: center;">Loading levels...</div>
      </div>
    </div>
  `).appendTo('body');

  // Start loading levels immediately
  loadWorldLevels(worldName, levelsPopup.find('.world-levels-content'));

  // Click handler for world preview
  container.find('.world-preview').click(function(e) {
    e.stopPropagation();
    
    // Hide all other popups
    $('.world-levels').not(levelsPopup).hide();
    
    // Position popup next to world preview
    const previewRect = this.getBoundingClientRect();
    levelsPopup.css({
      top: previewRect.top + window.scrollY + 'px',
      left: (previewRect.right + 20) + 'px'
    });

    // Show/hide popup
    levelsPopup.fadeToggle(200);
  });

  // Click outside to close popup
  $(document).on('click', function(e) {
    if (!$(e.target).closest('.world-levels, .world-preview').length) {
      levelsPopup.fadeOut(200);
    }
  });

  return container;
}

async function loadWorldLevels(worldName, container) {
  // Create a levels list container
  const levelsList = $('<div class="levels-list"></div>').css({
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '15px',
    maxHeight: '400px',
    overflowY: 'auto'
  });
  container.empty().append(levelsList);

  // Function to create a level entry
  const createLevelEntry = (levelData, metadata, index) => {
    const levelEntry = $(`
      <div class="level-entry" data-id="${metadata.id}" style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; padding: 8px;">
        <span style="min-width: 30px; color: #666;">${index + 1}.</span>
        <span style="flex-grow: 1;">${metadata.name}</span>
        <div class="level-actions" style="display: flex; gap: 5px;">
          <button class="clone-button" style="padding: 4px 8px;">Clone & Edit</button>
          <button class="play-button" style="padding: 4px 8px;">Play</button>
        </div>
      </div>
    `);

    levelEntry.find('.clone-button').click(async (e) => {
      e.stopPropagation();
      await cloneAndEditLevel(levelData);
    });

    levelEntry.find('.play-button').click((e) => {
      e.stopPropagation();
      window.open(
        window.location.protocol + "//" + window.location.hostname +
        (window.location.port ? ':' + window.location.port: '') +
        "?levelid=" + metadata.id,
        '_blank'
      );
    });

    return levelEntry;
  };

  // Try to use cached data first
  if (worldLevelsCache.has(worldName)) {
    const cachedLevels = worldLevelsCache.get(worldName);
    cachedLevels.forEach((level, index) => {
      levelsList.append(createLevelEntry(level.data, level.metadata, index));
    });
    return;
  }

  // Otherwise load all levels in parallel
  const worldLevels = window.worlds[worldName];
  const loadedLevels = new Array(worldLevels.length);
  
  // Create promises for all level loads
  const loadPromises = worldLevels.map(async (levelId, index) => {
    try {
      const [metadata, levelData] = await Promise.all([
        getLevelMetadata(levelId),
        netService.getGameState(levelId)
      ]);
      
      if (!metadata || !levelData) return;
      
      // Store in array at correct position
      loadedLevels[index] = { data: levelData, metadata: { ...metadata, id: levelId } };
      
      // Add to UI if container still exists
      if (container.closest('body').length) {
        // Find correct position to insert
        const entry = createLevelEntry(levelData, metadata, index);
        const existingEntries = levelsList.children();
        
        if (index < existingEntries.length) {
          $(existingEntries[index]).before(entry);
        } else {
          levelsList.append(entry);
        }
      }
    } catch (e) {
      console.error(`Failed to load level ${levelId}:`, e);
    }
  });

  // Cache levels once all are loaded
  Promise.all(loadPromises).then(() => {
    const validLevels = loadedLevels.filter(l => l);
    if (validLevels.length > 0) {
      worldLevelsCache.set(worldName, validLevels);
    }
  });

  // Position the container next to the world preview
  const worldPreview = container.closest('.world-section').find('.world-preview');
  const worldRect = worldPreview[0].getBoundingClientRect();
  
  container.css({
    position: 'fixed',
    top: worldRect.top + 'px',
    left: (worldRect.right + 20) + 'px',
    width: '400px',
    backgroundColor: 'white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    zIndex: 1000
  });
}

async function loadOfficialLevels() {
  const container = $('#official-levels').empty();
  
  // Create and append world sections first
  for (let worldName in window.worlds) {
    const worldSection = await createWorldPreview(worldName);
    container.append(worldSection);
    
    // Queue this world for background loading
    queueWorldForLoading(worldName);
  }
}

async function loadCustomLevels() {
  const container = $('#custom-levels').empty();
  const customLevels = JSON.parse(localStorage.getItem('customLevels') || '[]');
  
  if (customLevels.length === 0) {
    container.append('<p>No custom levels yet. Create and save a level to see it here!</p>');
    return;
  }

  for (const level of customLevels) {
    const metadata = await getLevelMetadata(level.id);
    if (!metadata) continue;

    const card = $(`
      <div class="level-card" data-id="${level.id}">
        <h3>${metadata.name}</h3>
        <div class="meta">Created: ${new Date(level.created).toLocaleDateString()}</div>
        <button class="edit-button">Edit</button>
        <button class="play-button">Play</button>
      </div>
    `);

    card.find('.edit-button').click((e) => {
      e.stopPropagation();
      loadLevelForEditing(level.id);
    });

    card.find('.play-button').click((e) => {
      e.stopPropagation();
      window.open(
        "?levelid=" + level.id,
        '_blank'
      );
    });

    container.append(card);
  }
}

async function loadLevelForEditing(levelId) {
  $('.loading').show();
  try {
    const levelData = await netService.getGameState(levelId);
    window.gamestate = levelData;
    $("#levelname").val(levelData.name || "Untitled");
    $("#xsize").val(levelData.size.x);
    $("#ysize").val(levelData.size.y);
    $("#zsize").val(levelData.size.z);
    drawGameState();
    hideBrowseModal();
    showFeedback('Level loaded for editing');
  } catch (e) {
    console.error('Failed to load level:', e);
    showFeedback('Failed to load level', true);
  } finally {
    $('.loading').hide();
  }
}

async function cloneAndEditLevel(levelData) {
  // Remove ID to create new level
  delete levelData._id;
  levelData.name = levelData.name + ' - Copy';
  
  try {
    $('.loading').show();
    const ret = await netService.makeNewLevel(levelData);
    const newId = ret._id;
    
    // Add to custom levels
    addToCustomLevels(newId, levelData.name);
    
    // Load for editing
    loadLevelForEditing(newId);
    showFeedback('Level cloned successfully!');
  } catch (e) {
    console.error('Failed to clone level:', e);
    showFeedback('Failed to clone level', true);
  } finally {
    $('.loading').hide();
  }
}

function showBrowseModal() {
  $('.browse-modal').show().addClass('visible');
}

function hideBrowseModal() {
  $('.browse-modal').removeClass('visible');
  setTimeout(() => $('.browse-modal').hide(), 300);
}

$(document).ready(function(){
  initializeGrid();

  // Mode toggles
  $("#objbutton").click(function (){
    window.makemode = "object"; 
    $(this).addClass("selected"); 
    $("#wordbutton").removeClass("selected");
  });

  $("#wordbutton").click(function (){
    window.makemode = "word"; 
    $(this).addClass("selected"); 
    $("#objbutton").removeClass("selected");
  });

  // Editor actions
  $("#save").click(function (){save();});
  $("#savecloud").click(function (){savecloud();});
  $("#cloneCloud").click(function (){cloneLevel();});
  $("#testbutton").click(function (){testlevel();});
  $("#load").click(function (){load();});
  $("#browselevels").click(async function() {
    showBrowseModal();
    await loadOfficialLevels();
  });

  // Tab switching
  $('.tab-button').click(async function() {
    $('.tab-button').removeClass('selected');
    $(this).addClass('selected');
    $('.tab-content').hide();
    
    const tab = $(this).data('tab');
    $(`#${tab}-levels`).show();
    
    if (tab === 'custom') {
      await loadCustomLevels();
    } else if (tab === 'official' && $('#official-levels').is(':empty')) {
      await loadOfficialLevels();
    }
  });

  // Modal close button
  $('.close').click(function() {
    hideBrowseModal();
  });

  // Close modal when clicking outside content
  $('.browse-modal').click(function(e) {
    if (e.target === this) {
      hideBrowseModal();
    }
  });

  // Context menu prevention
  $("#gamebody").on('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });

  $("#gamebody").mousedown(function (event) {
    // Calculate offset relative to gamebody
    const rect = $(this).offset();
    const offsetX = event.pageX - rect.left;
    const offsetY = event.pageY - rect.top;
    placeObject({ offsetX, offsetY, button: event.button, target: event.target });
  });

  // Initial setup
  window.setTimeout(function(){
    var levelcode = get("levelcode");
    var scrubbedGameState = scrubGameState(gamestate)
    levelcode.value = JSON.stringify(scrubbedGameState);
    $("#xsize").val(gamestate.size.x);
    $("#ysize").val(gamestate.size.y);
    $("#zsize").val(gamestate.size.z);
    $("#levelname").val("Untitled");
    changeBaseGameFunctions();
  }, 500);
});

function initializeGrid() {
  const main = $("#gamebody");
  const width = main.width();
  const height = main.height();
  const gridx = width / gamestate.size.x / gamestate.size.z;
  const gridy = height / gamestate.size.y;
  const gridz = width / gamestate.size.z;

  const gridContainer = $('<div class="grid-container"></div>');
  main.append(gridContainer);

  for (let j = 0; j < gamestate.size.z; j++) {
    for (let i = 0; i < gamestate.size.x; i++) {
      gridContainer.append($(`<div class="gridline gridx${i}" style="left:${i*gridx + j*gridz}px;top:0;width:${gridx}px;height:${height}px"></div>`));
    }
  }

  for (let i = 0; i < gamestate.size.y; i++) {
    gridContainer.append($(`<div class="gridline gridy${i}" style="left:0;top:${i*gridy}px;width:${width}px;height:${gridy}px"></div>`));
  }
}

function placeObject(event) {
  undo.push(JSON.stringify(gamestate));
  const gridpos = pointToGrid(event);

  if (event.button == 0) { // Left click
    const existingData = event.target.gamedata;
    const objName = $('#objname').val() || defaultObj;
    
    // Remove existing object if it exists
    if (existingData) {
      removeObj(existingData);
    }

    // Create new object
    const newObj = {
      name: makemode === "object" ? (wordMasks.n.indexOf(objName) >= 0 ? objName : defaultObj) : objName,
      x: gridpos.x,
      y: gridpos.y,
      z: gridpos.z,
      id: "id"+globalId++,
      dir: $('#objdir').val() || 'r'
    };

    if (makemode == "object") {
      gamestate.objects.push(newObj);
    } else if (makemode == "word") {
      gamestate.words.push(newObj);
    }

  } else if (event.button == 2) { // Right click
    if (event.target.gamedata) {
      removeObj(event.target.gamedata);
    }
    event.preventDefault();
    return false;
  }

  drawGameState();
}

async function testlevel() {
  // Check for level name
  const levelName = $("#levelname").val().trim();
  if (!levelName) {
    showFeedback('Please enter a level name before testing', true);
    $("#levelname").focus();
    return;
  }

  // Save if not already saved
  if (!gamestate.levelId) {
    $('.loading').show();
    try {
      window.gamestate.name = levelName;
      const ret = await netService.makeNewLevel(window.gamestate);
      gamestate.levelId = ret["_id"];
      showFeedback('Level saved successfully!');
      
      // Add to custom levels
      addToCustomLevels(gamestate.levelId, levelName);
    } catch (e) {
      console.error('Failed to save level:', e);
      showFeedback('Failed to save level', true);
      $('.loading').hide();
      return;
    }
    $('.loading').hide();
  }

  // Open in new tab
  window.open(
    window.location.protocol + "//" + window.location.hostname + 
    (window.location.port ? ':' + window.location.port: '') + 
    "?levelid=" + gamestate.levelId,
    '_blank'
  );
}

function addToCustomLevels(id, name) {
  const customLevels = JSON.parse(localStorage.getItem('customLevels') || '[]');
  customLevels.push({
    id,
    name,
    created: new Date().toISOString()
  });
  localStorage.setItem('customLevels', JSON.stringify(customLevels));
}

function changeBaseGameFunctions(){
  changeMoveYou(function(dir) {
    undo.push(JSON.stringify(gamestate));
    move(window.selectedObj, dir);
    executeRules(gameHandler);
    updateRuleUI();
  });
}

function moveAllDir(dir) {
  for(var obj of gamestate.objects) {
    obj.y += dir.y;
    obj.x += dir.x;
  }
  for(var obj of gamestate.words) {
    obj.y += dir.y;
    obj.x += dir.x;
  }
  drawGameState();
}

function scrubGameState(gamestate) {
  var scrubbed = JSON.parse(JSON.stringify(gamestate));
  removeAllAdjectives(scrubbed, true);
  return scrubbed;
}

function pointToGrid(event) {
  var main = $("#gamebody"),
      width = $(main).width(),
      height = $(main).height(),
      x = Math.floor((event.offsetX % (width / gamestate.size.z))/ (width / gamestate.size.z / gamestate.size.x)),
      z = Math.floor(event.offsetX / (width / gamestate.size.z)),
      y = Math.floor((event.offsetY - 5) * gamestate.size.y / height),
      ret = {x: x, y: y, z: z};
  return ret;
}

function save() {
  // Check for level name
  const levelName = $("#levelname").val().trim();
  if (!levelName) {
    showFeedback('Please enter a level name before saving', true);
    $("#levelname").focus();
    return;
  }

  window.gamestate.name = levelName;
  var file = new Blob(["window.leveldata="+JSON.stringify(scrubGameState(gamestate))], {type: "text"});

  var a = document.createElement("a"),
      url = URL.createObjectURL(file);
  a.href = url;
  a.download = "level"+gamestate.levelId+".js";
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
  }, 0);
  showFeedback('Level downloaded successfully!');
}

async function savecloud() {
  // Validate level name
  const levelName = $("#levelname").val().trim();
  if (!levelName) {
    showFeedback('Please enter a level name before saving', true);
    $("#levelname").focus();
    return;
  }

  // Update gamestate
  window.gamestate.name = levelName;
  window.gamestate.size.x = $("#xsize").val();
  window.gamestate.size.y = $("#ysize").val();
  window.gamestate.size.z = $("#zsize").val();

  // Show loading indicator
  $('.loading').show();

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const communityLevelId = urlParams.get("levelid");
    let newId;

    if (!communityLevelId) {
      const ret = await netService.makeNewLevel(window.gamestate);
      newId = ret["_id"];
      addToCustomLevels(newId, levelName);
    } else {
      await netService.setGameState(window.gamestate, communityLevelId);
      newId = communityLevelId;
    }

    // Update URL without page reload
    window.history.pushState(
      {}, '', 
      window.location.pathname + "?levelid=" + newId
    );
    gamestate.levelId = newId;
    showConfigPopup(newId, levelName);

  } catch (e) {
    console.error('Failed to save level:', e);
    showFeedback('Failed to save level', true);
  } finally {
    $('.loading').hide();
  }
}

function load() {
  var levelcode = JSON.parse(get("levelcode").value);
  window.gamestate = levelcode;
  drawGameState();
}

async function cloneLevel() {
  const oldId = window.gamestate["_id"];
  delete window.gamestate["_id"];
  $('.loading').show();
  
  try {
    const ret = await netService.makeNewLevel(window.gamestate);
    const newId = ret["_id"];
    
    // Add to custom levels
    addToCustomLevels(newId, window.gamestate.name + ' (Clone)');
    
    // Open cloned level in new tab
    window.open(
      window.location.pathname + "?levelid=" + newId,
      '_blank'
    );
    showFeedback('Level cloned successfully!');
  } catch (e) {
    console.error('Failed to clone level:', e);
    showFeedback('Failed to clone level', true);
  } finally {
    $('.loading').hide();
  }
  
  // Restore the original ID
  window.gamestate["_id"] = oldId;
}
