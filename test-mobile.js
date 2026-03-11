const { chromium, devices } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
  });
  const page = await context.newPage();
  
  await page.goto('http://127.0.0.1:8000/game.html?levelid=70b15d82-eaa9-11ef-a278-0afffd82ddb9');
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'mobile-test.png', fullPage: true });
  
  // Check positions and visibility
  const results = await page.evaluate(() => {
    const results = {};
    
    // 1. Check if Select World and Restart Timeline are below the puzzle
    const puzzle = document.querySelector('#gameCanvas');
    const selectWorld = document.querySelector('button[onclick*="selectWorld"]');
    const restartTimeline = document.querySelector('button[onclick*="restartTimeline"]');
    
    if (puzzle && selectWorld && restartTimeline) {
      const puzzleBottom = puzzle.getBoundingClientRect().bottom;
      const selectWorldTop = selectWorld.getBoundingClientRect().top;
      const restartTimelineTop = restartTimeline.getBoundingClientRect().top;
      results.buttonsBelow = selectWorldTop > puzzleBottom && restartTimelineTop > puzzleBottom;
      results.puzzleBottom = puzzleBottom;
      results.selectWorldTop = selectWorldTop;
      results.restartTimelineTop = restartTimelineTop;
    } else {
      results.buttonsBelow = 'elements not found';
    }
    
    // 2. Check if header shows 'Baba Is You'
    const header = document.querySelector('h1');
    results.headerText = header ? header.textContent.trim() : 'no header';
    results.headerVisible = header ? window.getComputedStyle(header).display !== 'none' : false;
    results.hasBabaIsYou = results.headerText.includes('Baba Is You');
    
    // 3. Check puzzle grid width vs viewport
    if (puzzle) {
      const puzzleRect = puzzle.getBoundingClientRect();
      results.puzzleWidth = puzzleRect.width;
      results.viewportWidth = window.innerWidth;
      results.horizontalOverflow = puzzleRect.right > window.innerWidth || puzzleRect.left < 0;
    }
    
    // 4. Check Research Costs position
    const researchCosts = document.querySelector('#researchCosts');
    if (researchCosts && puzzle) {
      const researchRect = researchCosts.getBoundingClientRect();
      const puzzleBottom = puzzle.getBoundingClientRect().bottom;
      results.researchBelowPuzzle = researchRect.top > puzzleBottom;
      results.researchTop = researchRect.top;
      results.researchOverlap = researchRect.top < puzzleBottom;
    } else {
      results.researchBelowPuzzle = 'elements not found';
    }
    
    return results;
  });
  
  console.log('\n=== MOBILE VIEWPORT TEST RESULTS ===\n');
  console.log('Test 1: Select World and Restart Timeline below puzzle');
  console.log('  Result:', results.buttonsBelow === true ? 'PASS' : 'FAIL');
  console.log('  Details:', JSON.stringify({
    puzzleBottom: results.puzzleBottom,
    selectWorldTop: results.selectWorldTop,
    restartTimelineTop: results.restartTimelineTop
  }, null, 2));
  
  console.log('\nTest 2: Header does NOT show "Baba Is You"');
  console.log('  Result:', !results.hasBabaIsYou ? 'PASS' : 'FAIL');
  console.log('  Details: Header text =', results.headerText);
  console.log('  Header visible:', results.headerVisible);
  
  console.log('\nTest 3: Puzzle grid fits within viewport (no horizontal overflow)');
  console.log('  Result:', results.horizontalOverflow === false ? 'PASS' : 'FAIL');
  console.log('  Details:', JSON.stringify({
    puzzleWidth: results.puzzleWidth,
    viewportWidth: results.viewportWidth
  }, null, 2));
  
  console.log('\nTest 4: Research Costs beneath puzzle without overlap');
  console.log('  Result:', results.researchBelowPuzzle === true && !results.researchOverlap ? 'PASS' : 'FAIL');
  console.log('  Details:', JSON.stringify({
    puzzleBottom: results.puzzleBottom,
    researchTop: results.researchTop,
    overlap: results.researchOverlap
  }, null, 2));
  
  console.log('\n=== Screenshot saved to mobile-test.png ===\n');
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
