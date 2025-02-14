// TODO: pull stack?, x is y is z
import * as rules from "./rules/rules.js"
import {getDirCoordsFromDir,findAtPosition, updateObjPosition, isOutside} from "./gameService.js"
import {applyAdjectives,removeAdjectives} from "./rules/adjective.js"
import * as undo from "./undo.js";
import {loadAudio, playSfx} from "./music/sfx.js"
window.gamestate = {
    words:[],
    objects:[],
    levelId:1,
    size: {x: 24, y: 18, z: 1},
    solution: [],
    group:[]
}
window.globalId = 1;
window.selectedObj = {};
window.movesToExecute = [];
export let gameHandler = {removeObj:removeObj,makeThing:makeThing,move:move,runDeferredMoves:runDeferredMoves,triggerWin:triggerWin, makeNewObjectFromOld:makeNewObjectFromOld};
window.restart = function() {
  var currentLevelId = gamestate.levelId;
  var currentMoves = gamestate.moveCount;
  if (currentLevelId) {
    loadLevel(currentLevelId, true, currentMoves + 1);
  } else {
    location.reload();
  }
}

window.onload = async function () {
  var urlParams = new URLSearchParams(window.location.search);
  var levelnum = Math.floor(urlParams.get("level"));
  var communityLevelId = urlParams.get("levelid");
  if (levelnum) {
    loadPremadeLevel(levelnum);
  } else if (communityLevelId) {
    loadCommunityLevel(communityLevelId);
    levelnum = 1;
  }
  
  $("#nextlevellink").click(e=>{loadLevel(findLevelByIndex(gamestate.levelId, 1)); e.preventDefault();return false;});
  $("#prevlevellink").click(e=>{loadLevel(findLevelByIndex(gamestate.levelId, -1)); e.preventDefault();return false;});
  
  $(".close").click(function() {$(".modal").removeClass("visible"); setTimeout(() => $(".modal").hide(), 300);})
  
  $("#worldselect").click(async function() {
    $(".modal").show();
    setTimeout(() => $(".modal").addClass("visible"), 10);
    
    if ($('#official-levels').is(':empty')) {
      await loadWorlds();
    }
  });
  
  // Tab switching
  $('.tab-button').click(async function() {
    $('.tab-button').removeClass('selected');
    $(this).addClass('selected');
    $('.tab-content').hide();
    
    const tab = $(this).data('tab');
    const tabContent = $(`#${tab}-levels`);
    tabContent.show();
    
    if (tab === 'custom' && tabContent.is(':empty')) {
      await loadCustomLevels();
    }
  });
  
  setWindowSize();
  $(".ctlleft")[0] && ($(".ctlleft")[0].addEventListener('touchstart',function (e) { e.preventDefault(); moveYou({ x: -1, y: 0, z: 0 }); },false));
  $(".ctlright")[0]&& ($(".ctlright")[0].addEventListener('touchstart',function (e) { e.preventDefault(); moveYou({ x: 1, y: 0, z: 0 }); },false));
  $(".ctlup")[0]&& ($(".ctlup")[0].addEventListener('touchstart',function (e) { e.preventDefault(); moveYou({ x: 0, y: -1, z: 0 }); },false));
  $(".ctldown")[0]&& ($(".ctldown")[0].addEventListener('touchstart',function (e) { e.preventDefault(); moveYou({ x: 0, y: 1, z: 0 }); },false));
  $(".ctlspace")[0]&& ($(".ctlspace")[0].addEventListener('touchstart',function (e){ e.preventDefault(); gamewait(); },false));
  $(".ctlz")[0]&& ($(".ctlz")[0].addEventListener('touchstart',function (e) { e.preventDefault(); undo.undo(gameHandler); },false));

  $("body").keydown(function (event) {
    pressKey(event);
  });
  window.setInterval(function () {
    for (var obj of gamestate.objects) {
      if (obj.win) {
        particle(obj, "yellow", 2, 0.07);
      }
      if (obj.tele) {
        particle(obj, "teal", 2, 0.07);
      }
    }
  }, 700);
}
window.pressKey = function(event) {
  gamestate.solution.push(event.keyCode);
  if (event.keyCode == 37) {
    moveYou({ x: -1, y: 0, z: 0 });
  }
  else if (event.keyCode == 39) {
    moveYou({ x: 1, y: 0, z: 0 });
  }
  else if (event.keyCode == 38) {
    moveYou({ x: 0, y: -1, z: 0 });
  }
  else if (event.keyCode == 40) {
    moveYou({ x: 0, y: 1, z: 0 });
  } else if (event.keyCode == 87) {
    moveYou({ x: 0, y: 0, z: 1 });
  } else if (event.keyCode == 83) {
    moveYou({ x: 0, y: 0, z: -1 });
  } else if (event.keyCode == 32) {
    gamewait();
  } else if (event.keyCode == 90) {
    undo.undo(gameHandler);
  }
}
function gamewait() {
  window.movesToExecute = [];
  rules.executeRules(gameHandler);
  updateRuleUI();
}
let triggerWinImplFn = triggerWinImpl;
export function changeTriggerWin(newWinFn) {
  triggerWinImplFn = newWinFn;
}
async function triggerWin(obj) {
  triggerWinImplFn(obj);
}
async function triggerWinImpl(obj) {
  if (!gamestate.wonAlready) {
    gamestate.wonAlready = true;
    var solution = clone(gamestate.solution);
    particle(obj, "yellow", 100, 0.3);
    playSfx("win");
    /*var origGameState = await netService.getGameState(gamestate.levelId);
    origGameState.solution = solution;
    await netService.setGameState(origGameState, gamestate.levelId);*/
    window.setTimeout(function () {
      loadLevel(findLevelByIndex(gamestate.levelId, 1));
    }, 1500);
  }
}
function findLevelByIndex(levelid, adder) {
  var worlds = window.worlds;
  var joinedLevels = [];
  for (var worldname in worlds) {
    joinedLevels = joinedLevels.concat(worlds[worldname]);
  }
  return joinedLevels[joinedLevels.indexOf(levelid) + adder];
}
async function tmp() {
  var worlds = window.worlds;
  var joinedLevels = [];
  for (var worldname in worlds) {
    joinedLevels = joinedLevels.concat(worlds[worldname]);
  }

  var backup = [];
  for (var lvl of joinedLevels) {
    var ret = await netService.getGameState(lvl);
    backup.push(ret);

  }
  var file = new Blob(["window.leveldata="+JSON.stringify(backup)], {type: "text"});

  var a = document.createElement("a"),
          url = URL.createObjectURL(file);
  a.href = url;
  a.download = "levelbackup.js";
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
  }, 0);
}
function loadPremadeLevel(levelnum) {
  var levelTag = document.createElement("script");
  levelTag.type="text/javascript";
  levelTag.onload = function() {
    makeGameState(levelnum || 1);
    setWindowSize();
    drawGameState();
  };
  levelTag.src=`levels/level${levelnum}.js`;
  $("head")[0].appendChild(levelTag);
}
// Level browser functions
async function loadWorlds() {
  // Only load world headers first
  const container = $('#official-levels').empty();
  
  for (let worldName in window.worlds) {
    const displayName = worldName === "???" ? worldName :
                       worldName.replace(/([A-Z])/g, ' $1').trim(); // Add spaces before capitals
    
    const firstLevelId = window.worlds[worldName][0];
    const worldSection = $(`
      <div class="level-card">
        <img src="img/${worldName.toLowerCase().replace(/ /g, '')}.png" alt="${displayName}">
        <h3>${displayName}</h3>
        <div class="meta">${window.worlds[worldName].length} levels</div>
        <button class="play-button" onclick="loadLevel('${firstLevelId}')">Start World</button>
      </div>
    `);

    container.append(worldSection);
  }
}

async function loadWorldLevels(worldName, container) {
  const worldLevels = window.worlds[worldName];
  container.empty();
  
  for (const levelId of worldLevels) {
    try {
      const levelData = await netService.getGameState(levelId);
      const levelCard = $(`
        <div class="level-card" data-id="${levelId}">
          <h3>${levelData.name || 'Unnamed Level'}</h3>
          <button class="play-button" onclick="loadLevel('${levelId}')">Play Level</button>
        </div>
      `);
      container.append(levelCard);
    } catch (e) {
      console.error(`Failed to load level ${levelId}:`, e);
    }
  }
}

async function loadCustomLevels() {
  const container = $('#custom-levels').empty();
  const customLevels = JSON.parse(localStorage.getItem('customLevels') || '[]');
  
  if (customLevels.length === 0) {
    container.append(`
      <div class="empty-state">
        <p>No custom levels yet!</p>
        <a href="levelmaker.html" target="_blank" class="create-level-button">
          Create Your First Level
        </a>
      </div>
    `);
    return;
  }

  // Create a grid similar to worlds
  const grid = $('<div class="level-grid"></div>');
  container.append(grid);

  for (const level of customLevels) {
    try {
      const levelData = await netService.getGameState(level.id);
      const card = $(`
        <div class="level-card" data-id="${level.id}">
          <h3>${level.name}</h3>
          <div class="meta">Created: ${new Date(level.created).toLocaleDateString()}</div>
          <button class="play-button" onclick="loadLevel('${level.id}')">Play Level</button>
          <a href="levelmaker.html?levelid=${level.id}" target="_blank" class="edit-button">Edit</a>
        </div>
      `);
      grid.append(card);
    } catch (e) {
      console.error(`Failed to load custom level ${level.id}:`, e);
    }
  }
}

window.loadLevel = function(levelId, isRestart, preserveMoves) { // window level so it can be triggered from the HTML page
  var refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + '?levelid='+levelId;
  window.history.pushState({ path: refresh }, '', refresh);
  loadAudio(levelId);
  loadCommunityLevel(levelId, isRestart, preserveMoves);
  $(".modal").removeClass("visible");
  setTimeout(() => $(".modal").hide(), 300);
}
async function loadCommunityLevel(communityLevelId, isRestart, preserveMoves) {
  var comgamestate = await netService.getGameState(communityLevelId);
  window.gamestate = comgamestate;
  comgamestate.levelId = communityLevelId;
  initGameState(comgamestate, isRestart);
  if (isRestart && preserveMoves !== undefined) {
    gamestate.moveCount = preserveMoves;
    updateMoveDisplay();
  }
  setWindowSize();
  drawGameState();

  for (var lvl in window.worlds) {
    if (~window.worlds[lvl].indexOf(communityLevelId)) {
      $("#gamebody").css("background-color",window.colorMapping[lvl])
    }
  }
}
function setWindowSize() {
  var container = $('#gamebody');
  var width = container.width();
  var height = container.height();
  
  // Calculate cell size that would fit in width and height
  var cellFromWidth = width / (gamestate.size.x * gamestate.size.z);
  var cellFromHeight = height / gamestate.size.y;
  
  // Use the smaller cell size to ensure squares fit in both dimensions
  var cellSize = Math.min(cellFromWidth, cellFromHeight);
  
  // Calculate new dimensions based on cell size
  var newWidth = cellSize * gamestate.size.x * gamestate.size.z;
  var newHeight = cellSize * gamestate.size.y;
  
  // Apply new dimensions
  container.css({
    "width": newWidth + "px",
    "height": newHeight + "px"
  });
}
function changeObj(obj, newName) {
  var objdiv = $("#"+obj.id);
  objdiv.removeClass(obj.name);
  objdiv.addClass(newName);
  obj.name = newName;
}
function changeToText(obj) {
  removeObj(obj)
  var newObj = deepClone(obj);
  removeAdjectives(newObj);
  gamestate.words.push(newObj);
  makeThing($("#gamebody"), newObj, null, null, null, "id"+globalId++, false);
}
export function removeObj(obj) {
  for (var i=gamestate.objects.length-1;i>=0;i--) {
    if (gamestate.objects[i] == obj) {
      gamestate.objects.splice(i, 1);
    }
  }
  for (var i=gamestate.words.length-1;i>=0;i--) {
    if (gamestate.words[i] == obj) {
      gamestate.words.splice(i, 1);
    }
  }
  $("#"+obj.id).remove();
  if(obj.has) {
    for(var h of obj.has) {
      makeNewObjectFromOld(obj, h, h == "text");
    }
    applyAdjectives();
  }
  // particle(obj, "#733", 10, 0.1);
}
function makeNewObjectFromOld(oldObj, newName, isWord) {
  var newObj = deepClone(oldObj);
  removeAdjectives(newObj);
  if (isWord) {
    gamestate.words.push(newObj);
  } else {
    gamestate.objects.push(newObj);
    newObj.name = newName;
  }
  makeThing($("#gamebody"), newObj, null, null, null, "id"+globalId++, !isWord);
  return newObj;
}
function makeGameState(level) {
    if (window.leveldata) {
      gamestate = window.leveldata;
    }
    gamestate.levelId=level;
    initGameState(gamestate);
}
export function drawGameState() {
  $("#levelname").val(gamestate.name).html(gamestate.name);
  updateMoveDisplay();
  var main = $("#gamebody");
  main[0].innerHTML = "";
  var width = main.width(),
    height = main.height(),
    gridx = width / gamestate.size.x / gamestate.size.z,
    gridy = height / gamestate.size.y,
    gridz = width / gamestate.size.z;
  globalId = 1;
  var runningLeft = gridz;
  for (var i = 0; i < gamestate.size.z - 1; i++) {
    makesq("div", main[0], "tier tier" + (i + 1), runningLeft, 0, width - runningLeft, height);
    runningLeft += gridz;
  }
  for (var j=0;j<gamestate.size.z;j++) {
    for (var i=0;i<gamestate.size.x;i++) {
      makesq("div", main[0], "gridline gridx"+i, i*gridx + j*gridz,0,gridx,height);
    }
  }
  for (var i=0;i<gamestate.size.y;i++) {
    makesq("div", main[0], "gridline gridy"+i, 0,i*gridy,width,gridy);
  }
  drawControlHints(main);
  for (var obj of gamestate.objects) {
    obj.dir = obj.dir || "r";
    makeThing(main, obj, gridx, gridy, gridz, "id"+globalId++, true);
  }
  for (var obj of gamestate.words) {
    makeThing(main, obj, gridx, gridy, gridz, "id"+globalId++, false);
  }
  rules.executeRules(gameHandler);
  runDeferredMoves();
}
function makeThing(parent, thing, gridx, gridy, gridz, globalId, isObject) {
  if (!gridx) {
    var width = parent.width(),
    height = parent.height();
    gridx = width / gamestate.size.x / gamestate.size.z;
    gridy = height / gamestate.size.y;
    gridz = width / gamestate.size.z;
  }
  var displayClass = isObject ? thing.name : "gameword " + thing.name+"word";
  if (rules.isAdjective(thing.name)) {
    displayClass += " action";
  }
  thing.z = thing.z || 0;
  var objdiv = makesq("div", parent[0], displayClass + " block "+thing.dir,
    (gridx * thing.x) + (thing.z * gridz) +"px",
    gridy * thing.y +"px",
    gridx+"px",
    gridy+"px");
  objdiv.id = globalId;
  thing.id = globalId;
  if (!isObject) {
    objdiv.innerHTML = thing.name;
    objdiv.style["font-size"] = fontMapping(gridx);
  }
  objdiv.gamedata = thing;
}
function runDeferredMoves(){
  for (var moveEx of movesToExecute) {

    moveEx.obj.x = moveEx.pos.x + moveEx.dir.x;
    moveEx.obj.y = moveEx.pos.y + moveEx.dir.y;
    moveEx.obj.z = moveEx.pos.z + moveEx.dir.z;
    updateObjPosition(moveEx.obj, moveEx.facing);
  }
  window.movesToExecute = [];
}
let moveYouImplFn = moveYouImpl;
export function changeMoveYou(moveYouFn) {
  moveYouImplFn = moveYouFn;
}
export function updateMoveDisplay() {
  const moves = gamestate.moveCount || 0;
  const totalWeeks = moves;
  const money = moves * 5000;
  
  let years = Math.floor(totalWeeks / 52);
  let remainingWeeks = totalWeeks % 52;
  let months = Math.floor(remainingWeeks / 4);
  remainingWeeks = remainingWeeks % 4;
  
  let timeText = [];
  if (years > 0) {
    timeText.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    timeText.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (remainingWeeks > 0) {
    timeText.push(`${remainingWeeks} ${remainingWeeks === 1 ? 'week' : 'weeks'}`);
  }
  if (timeText.length === 0) {
    timeText.push('0 weeks');
  }
  
  const formattedMoney = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(money);

  $("#movecount").html(`${timeText.join(', ')}, ${formattedMoney}`);
}

export function moveYou(dir) {
  moveYouImplFn(dir);
  updateMoveDisplay();
}
function moveYouImpl(dir) {
  playSfx("walk");
  loadAudio(gamestate.levelId);
  var concatStuff = gamestate.objects.concat(gamestate.words);
  var yous = concatStuff.filter(o => o.you);
  gamestate.moveCount++;
  undo.push(JSON.stringify(gamestate));
  window.movesToExecute = [];
  if(gamestate.empty.you) {
    var pushes = concatStuff.filter(c => c.push);
    for (var p of pushes) {
      var findEmpty = findAtPosition(p.x - dir.x, p.y - dir.y, p.z - dir.z);
      if (findEmpty.length == 0) {
        move(p, dir);
      }
    }
    runDeferredMoves();
    rules.executeRules(gameHandler);
    runDeferredMoves();
    updateRuleUI();
  }
  if (yous.length > 0) {
    $(".gridline").css("outline","1px solid #111");
    for(var obj of yous) {
      if(move(obj, dir)) {
        particle(obj, "white", 1, 0.01);
      }
      if(gamestate.size.z > 1){
        $(".gridline.gridx"+(obj.x + dir.x)).css("outline","1px solid #522");
        $(".gridline.gridy"+(obj.y + dir.y)).css("outline","1px solid #522");
      }
    }
    runDeferredMoves();
    rules.executeRules(gameHandler);
    runDeferredMoves();
    updateRuleUI();
  }
}
export function move(gameobj,dir, cantPull, lookForward) {

  var newPositionObjs = findAtPosition(gameobj.x + dir.x, gameobj.y + dir.y, gameobj.z + dir.z, false, false, lookForward),
      findStopChain = [gameobj];
  var lockKeyCombos = rules.getLockKeyCombos(gameobj, newPositionObjs);
  if (lockKeyCombos.length > 0) {
    removeObj(gameobj);
    removeObj(lockKeyCombos[0].o2);// A key should only unlock one door
    return true; // If a door is unlocked there will be a space to move into where the door once stood (unless there's also a stop obj there? TODO)
  }
  if(gameobj.swap) {
    if (isOutside(gameobj.x+dir.x, gameobj.y+dir.y, gameobj.z + dir.z)) {
      if (gameobj.move) {
        reverseDir(gameobj);
      }
      return false;
    }
    for (var newPosObj of newPositionObjs) {
      newPosObj.x = gameobj.x;
      newPosObj.y = gameobj.y;
      newPosObj.z = gameobj.z;
      updateObjPosition(newPosObj, getDirCoordsFromDir(newPosObj));
    }
  }
  else if(findIsStop(dir, gameobj.x, gameobj.y, gameobj.z, findStopChain, lookForward)) {
    if (gameobj.move) {
      reverseDir(gameobj);
    } else {
      for (var i = findStopChain.length - 1; i >= 0; i--) {
        var find = findStopChain[i];
        if (find.weak) {
          removeObj(find);
          var other = findStopChain[i + 1];
          if (other && other.weak) {
            removeObj(other);
          }
        }
      }
    }
    return false;
  }

  newPositionObjs = findAtPosition(gameobj.x + dir.x, gameobj.y + dir.y, gameobj.z + dir.z, false, false, true);
  if (gamestate.empty.push && newPositionObjs.length == 0) {
    newPositionObjs.push({ x: gameobj.x + dir.x, y: gameobj.y + dir.y, z: gameobj.z + dir.z, push: true, empty: true });
  }
  for(var pushObj of newPositionObjs) {
    if (canPush(pushObj) /*&& !pushObj.you*/ && !pushObj.swap) { // TODO: make a move stack rather than assuming its you that instigated the push action
      move(pushObj, dir, true);
    }
    if (pushObj.swap) {
      pushObj.x = gameobj.x;
      pushObj.y = gameobj.y;
      pushObj.z = gameobj.z;
      updateObjPosition(pushObj, getDirCoordsFromDir(pushObj));
    }
  }
  var behindPositionObjs = findAtPosition(gameobj.x - dir.x, gameobj.y - dir.y, gameobj.z - dir.z);
  if (gamestate.empty.pull && behindPositionObjs.length == 0) {
    behindPositionObjs.push({ x: gameobj.x - dir.x, y: gameobj.y - dir.y, z: gameobj.z - dir.z, pull: true, empty: true });
  }
  window.movesToExecute.push({obj: gameobj, dir: dir, pos: deepClone(gameobj), facing: dir});
  if (gamestate.empty.open && newPositionObjs.length == 0 && gameobj.shut) {
    removeObj(gameobj);
    gamestate.empty.has && gamestate.empty.has.forEach(h=>{
      makeNewObjectFromOld(gameobj, h, h == "text");
    })
  }
  !cantPull && pullChain(behindPositionObjs, dir);
  return true;
}
function pullChain(list, dir) {
  var behindPositionObjs = [];
  for(var beh of list) {
    if (beh.pull) {
      move(beh, dir, false, true);
    }
  }
  behindPositionObjs.length > 0 && pullChain(behindPositionObjs, dir);
}
function reverseDir(obj) {
  if (obj.dir == "r") obj.dir = "l";
  else if (obj.dir == "l") obj.dir = "r";
  else if (obj.dir == "u") obj.dir = "d";
  else if (obj.dir == "d") obj.dir = "u";
}
function findIsStop(dir, x, y, z, findChain, lookForward) {
  if (isOutside(x+dir.x, y+dir.y, z + dir.z)) {
    return true;
  }
  var nextObjs = findAtPosition(x + dir.x, y + dir.y, z + dir.z, false, false, lookForward);
  if (gamestate.empty.push && nextObjs.length == 0) {
    nextObjs.push({ x: x + dir.x, y: y + dir.y, z: z + dir.z, push: true });
  }
  if (gamestate.empty.pull && nextObjs.length == 0 && !findChain[findChain.length-1].empty && !lookForward) {
    return true;
  }
  if(nextObjs.length == 0) return false;
  for (var obj of nextObjs) {
    findChain && findChain.push(obj);
    if (obj.push || (obj.you && obj.stop)) return findIsStop(dir, x + dir.x, y + dir.y, z + dir.z, findChain);
    if ((obj.stop || obj.pull) && !obj.you && !(obj.shut && findChain[findChain.length-2].open)) return true; // TODO: shut weirdness?
  }
  return false;
}

function isStop(obj) {
  return obj.stop || obj.pull;
}
function canPush(obj) {
  if(obj.push)
    return true;
  return false;
}
function fontMapping(gridx) {
  return gridx/2.7+"px";
}
function drawControlHints(main) {
  if (gamestate.levelId >= 18 && gamestate.levelId <= 21) {
    makesq("h2", main[0], "controlInfo", 10, 0).innerHTML = "{ Press W and S to navigate between planes }";
  }
  else if (gamestate.levelId >= 1 && gamestate.levelId <= 1) {
    makesq("h2", main[0], "controlInfo", 10, 0).innerHTML = "{ Press &#8592; &#8593; &#8594; &#8595; to move }";
  }
  else if (gamestate.levelId >= 4 && gamestate.levelId <= 4) {
    makesq("h2", main[0], "controlInfo", 10, 0).innerHTML = "{ Press Z to undo }";
  }
  else if (gamestate.levelId >= 11 && gamestate.levelId <= 11) {
    makesq("h2", main[0], "controlInfo", 10, 0).innerHTML = "{ Press Space Bar to wait }";
  }
}
window.runSolution = function(ind) {
  ind = ind || 0;
  window.pressKey({keyCode:savedSolution[ind]});
  window.setTimeout(()=>{runSolution(ind+1);}, 300);
}
export function updateRuleUI() {
  if (config.updateRuleUI) {
    var body = $("#ruleUI");
    body.html("");
    var simple = rules.convertRulesToSimple();
    for (var rule of simple) {
      $(`<span>${rule}</span><br/>`).appendTo(body);
    }
  }
}
export function initGameState(gs, isRestart) {
  gs.empty = {};
  gs.size.z = gs.size.z || 1;
  window.savedSolution = gs.solution;
  gs.solution = [];
  gs.group = [];
  if (!isRestart) {
    gs.moveCount = 0;
  }
}
