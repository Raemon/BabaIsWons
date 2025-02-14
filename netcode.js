window.netService = {
    getGameState: function () { },
    setGameState: function (gs, callback) { }
}

function PythonAnywhereService() {
    var MASTERURL = location.protocol+"//achamney.pythonanywhere.com/";
    var loadingCount = 0;

    const updateLoadingState = (show) => {
        if (show) {
            loadingCount++;
            // Only show loading on first request
            if (loadingCount === 1) {
                $(".loading:not(.world-loading)").show();
            }
        } else {
            loadingCount--;
            // Only hide loading when all requests are done
            if (loadingCount === 0) {
                $(".loading:not(.world-loading)").hide();
            }
        }
    };

    this.setGameState = async function (gamestate, levelId, callback) {
        var cacheBuster = Math.floor(Math.random()*10000);
        updateLoadingState(true);
        try {
            const result = await $.ajax({
                url: MASTERURL+"set/"+levelId+"?cb="+cacheBuster,
                type: "POST",
                data: JSON.stringify(gamestate),
                contentType: "application/json; charset=utf-8"
            });
            var uri = result["_id"];
            console.log(uri);
            if (callback) callback();
            return result;
        } finally {
            updateLoadingState(false);
        }
    }

    this.getGameState = async function(level) {
        var cacheBuster = Math.floor(Math.random()*10000);
        updateLoadingState(true);
        try {
            const ret = await $.get(MASTERURL+level+"?cb="+cacheBuster);
            return JSON.parse(ret);
        } finally {
            updateLoadingState(false);
        }
    }

    this.makeNewLevel = async function(gamestate) {
        updateLoadingState(true);
        try {
            const result = await $.ajax({
                url: MASTERURL+"make",
                type: "POST",
                data: JSON.stringify(gamestate),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            });
            var uri = result["_id"];
            console.log(uri);
            return result;
        } finally {
            updateLoadingState(false);
        }
    }
}
function JsonBoxyService() {
    var MASTERURL = "https://jsonboxy.herokuapp.com/box_048253cc19be56e86f59/";
    var loadingCount = 0; // Added loadingCount

    const updateLoadingState = (show) => { // Added updateLoadingState function
        if (show) {
            loadingCount++;
            // Only show loading on first request
            if (loadingCount === 1) {
                $(".loading:not(.world-loading)").show();
            }
        } else {
            loadingCount--;
            // Only hide loading when all requests are done
            if (loadingCount === 0) {
                $(".loading:not(.world-loading)").hide();
            }
        }
    };

    this.setGameState = async function (gamestate, levelId, callback) {
        var cacheBuster = Math.floor(Math.random()*10000);
        updateLoadingState(true); // Use updateLoadingState
        try {
            return await $.ajax({
                url: MASTERURL+levelId+"?cb="+cacheBuster,
                type: "PUT",
                data: JSON.stringify(gamestate),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (data, textStatus, jqXHR) {
                    updateLoadingState(false); // Use updateLoadingState
                    var uri = data["_id"];
                    console.log(uri);
                    if (callback)
                        callback();
                }
            });
        } finally {
            updateLoadingState(false); // Use updateLoadingState in finally block to ensure loading hides even on error
        }
    }
    this.getGameState = async function(level) {
        var cacheBuster = Math.floor(Math.random()*10000);
        updateLoadingState(true); // Use updateLoadingState
        try {
            var ret = await $.get(MASTERURL+level+"?cb="+cacheBuster);
            return JSON.parse(ret); // Parse JSON response
        } finally {
            updateLoadingState(false); // Use updateLoadingState in finally block
        }
    }
    this.makeNewLevel = async function(gamestate) {
        updateLoadingState(true); // Use updateLoadingState
        try {
            return await $.ajax({
                url: MASTERURL,
                type: "POST",
                data: JSON.stringify(gamestate),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (data, textStatus, jqXHR) {
                    updateLoadingState(false); // Use updateLoadingState
                    var uri = data["_id"];
                    console.log(uri);
                }
            });
        } finally {
            updateLoadingState(false); // Use updateLoadingState in finally block
        }
    }
}

window.netService = new PythonAnywhereService();/*JsonBoxyService();*/

function MockNetService() {
    this.getGameState = function () {
        if (gamestate.curPlayerName != myPlayer.name) {
            var player = gamestate.players.filter(p => p.name == gamestate.curPlayerName)[0];
            if (gamestate.time > 0) {
                var clueCard = gamestate.players[0].cards[0],
                    clueType = "clueColor",
                    clueDereference = "color",
                    cardInd = 0;
                while (clueCard[clueType]) {
                    if (clueType == "clueColor") {
                        clueType = "clueNumber";
                        clueDereference = "num";
                    } else {
                        clueType = "clueColor";
                        clueDereference = "color";
                        cardInd++;
                        if (cardInd == 4) {
                            break;
                        }
                        clueCard = gamestate.players[0].cards[cardInd];
                    }
                }
                for (var card of gamestate.players[0].cards) {
                    if (card[clueType] == clueCard[clueType]) {
                        card[clueType] = card[clueDereference];
                    }
                }
                gamestate.time--;
                advanceTurn();
            } else {
                var discardCard = player.cards[0];
                discardThisCard(discardCard);
            }

        }
        return gamestate;
    }
    this.setGameState = function () {

    }
}