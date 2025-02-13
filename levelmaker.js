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
    changeBaseGameFunctions();
  }, 3000);
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

    // Create new object if not right click
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

function testlevel() {
  window.open(window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '')+"?levelid="+gamestate.levelId);
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
  window.gamestate.name = $("#levelname").val();
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
}

async function savecloud() {
  window.gamestate.name = $("#levelname").val();
  window.gamestate.size.x = $("#xsize").val();
  window.gamestate.size.y = $("#ysize").val();
  window.gamestate.size.z = $("#zsize").val();
  var urlParams = new URLSearchParams(window.location.search);
  var communityLevelId = urlParams.get("levelid");
  if (!communityLevelId) {
    var ret = await netService.makeNewLevel(window.gamestate);
    window.location = window.location.pathname + "?levelid="+ret["_id"];
  } else {
    try {
      await netService.setGameState(window.gamestate, communityLevelId);
      window.location = window.location.pathname + "?levelid="+communityLevelId;
    } catch (e) {
      console.log(e);
    }
  }
}

function load() {
  var levelcode = JSON.parse(get("levelcode").value);
  window.gamestate = levelcode;
  drawGameState();
}

async function cloneLevel() {
  delete window.gamestate["_id"];
  var ret = await netService.makeNewLevel(window.gamestate);
  window.location = window.location.pathname + "?levelid="+ret["_id"];
}
