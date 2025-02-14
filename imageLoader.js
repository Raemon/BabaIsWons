// List of all image files in img/ and imgnew/ directories
const imgFiles = {
    gif: [
        'baba', 'babaword', 'bolt', 'crab', 'crabword', 'defeatword', 'door', 'doorword',
        'flag', 'flagword', 'floatword', 'ghost', 'ghostword', 'grass', 'grassword',
        'hotword', 'iceword', 'isword', 'jelly', 'jellyword', 'keke', 'kekeword',
        'key', 'keyword', 'lava', 'lavaword', 'love', 'loveword', 'meltword', 'moon',
        'moonword', 'openword', 'pushword', 'rock', 'rockword', 'rose', 'roseword',
        'shutword', 'sinkword', 'star', 'starword', 'stopword', 'wall', 'wallword',
        'water', 'waterword', 'wind', 'winword', 'youword'
    ],
    png: [
        'baba', 'babad', 'babal', 'babar', 'babau', 'babaword', 'belt', 'beltword',
        'blueword', 'boltd', 'boltr', 'box', 'boxword', 'chasm', 'crab', 'crabword',
        'deepforest', 'defeatword', 'door', 'doorword', 'downword', 'favicon', 'fire',
        'flag', 'flagword', 'floatword', 'flower', 'flowergarden', 'flowerword',
        'forestoffall', 'ghost', 'grass', 'grassword', 'hotword', 'ice', 'iceword',
        'isword', 'jelly', 'jellyword', 'keked', 'kekel', 'keker', 'kekeu', 'kekeword',
        'key', 'keyword', 'kidlevels', 'lava', 'lavaword', 'leftword', 'love', 'loveword',
        'meltword', 'moon', 'moonword', 'moreword', 'mountaintop', 'moveword', 'mushroom',
        'mushroomword', 'openword', 'overworld', 'pullword', 'pushword', 'question',
        'redword', 'rightword', 'rock', 'rockettrip', 'rockword', 'rose', 'rosered',
        'roseredword', 'roseword', 'shiftword', 'shutword', 'sinkword', 'skulld',
        'skullword', 'solitaryisland', 'star', 'starword', 'stopword', 'teleword',
        'templeruins', 'thelake', 'threed', 'tree', 'treeword', 'upword',
        'volcaniccavern', 'wall', 'wallword', 'water', 'waterword', 'weakword',
        'winword', 'youword'
    ]
};

function applyDynamicStyles() {
    const styleSheet = document.createElement('style');
    const styles = [];

    // Process animated GIF sprites first
    imgFiles.gif.forEach(name => {
        // Add regular class
        styles.push(`.${name} { background-image: url("imgnew/${name}.gif"); }`);
        
        // Add word class if it ends with 'word'
        if (name.endsWith('word')) {
            styles.push(`.gameword.${name} { background-image: url("imgnew/${name}.gif"); color: transparent; }`);
        }
    });

    // Process PNG sprites for those without GIF versions
    imgFiles.png.forEach(name => {
        // Only add if there's no GIF version
        if (!imgFiles.gif.includes(name)) {
            // Add regular class
            styles.push(`.${name} { background-image: url("img/${name}.png"); }`);
            
            // Add word class if it ends with 'word'
            if (name.endsWith('word')) {
                styles.push(`.gameword.${name} { background-image: url("img/${name}.png"); color: transparent; }`);
            }
        }
    });

    styleSheet.textContent = styles.join('\n');
    document.head.appendChild(styleSheet);
}

// Call this when the document is ready
document.addEventListener('DOMContentLoaded', applyDynamicStyles);