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

// Level metadata cache
const levelMetadataCache = new Map();

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
  const container = $(`
    <div class="world-section">
      <h3>${worldName}</h3>
      <div class="world-preview">
        <img src="img/${worldName.toLowerCase().replace(/ /g, '')}.png" alt="${worldName}">
        <span>${window.worlds[worldName].length} levels</span>
      </div>
      <div class="world-levels" style="display:none;"></div>
    </div>
  `);

  container.find('.world-preview').click(async function() {
    const levelsContainer = container.find('.world-levels');
    if (levelsContainer.is(':empty')) {
      levelsContainer.html('<div class="loading-indicator">Loading levels...</div>');
      levelsContainer.show();
      await loadWorldLevels(worldName, levelsContainer);
    } else {
      levelsContainer.toggle();
    }
  });

  return container;
}

async function loadWorldLevels(worldName, container) {
  const worldLevels = window.worlds[worldName];
  container.empty();
  
  for (const levelId of worldLevels) {
    const metadata = await getLevelMetadata(levelId);
    if (!metadata) continue;

    const levelCard = $(`
      <div class="level-card" data-id="${levelId}">
        <h3>${metadata.name}</h3>
        <button class="clone-button">Clone & Edit</button>
        <button class="play-button">Play</button>
      </div>
    `);

    levelCard.find('.clone-button').click(async (e) => {
      e.stopPropagation();
      const levelData = await netService.getGameState(levelId);
      await cloneAndEditLevel(levelData);
    });

    levelCard.find('.play-button').click((e) => {
      e.stopPropagation();
      window.open(
        window.location.protocol + "//" + window.location.hostname + 
        (window.location.port ? ':' + window.location.port: '') + 
        "?levelid=" + levelId,
        '_blank'
      );
    });

    container.append(levelCard);
  }
}

async function loadOfficialLevels() {
  const container = $('#official-levels').empty();
  
  for (let worldName in window.worlds) {
    const worldSection = await createWorldPreview(worldName);
    container.append(worldSection);
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
    showFeedback('Level saved successfully!');

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
