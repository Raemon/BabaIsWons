const playwright = require('playwright-core');

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:8000/game.html?levelid=70b15d82-eaa9-11ef-a278-0afffd82ddb9');
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: 'mobile_screenshot.png', fullPage: true });
  
  console.log('Screenshot saved to mobile_screenshot.png');
  
  await browser.close();
})();
