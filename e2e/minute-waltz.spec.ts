import {test,expect} from "@playwright/test";
test("Minute Waltz library, quests, both score views, reload and offline assets",async({page,context})=>{
 await page.goto("/");await page.getByRole("button",{name:"Pieces",exact:true}).click();
 await page.getByRole("button",{name:"Practice Chopin · Minute Waltz (Op. 64 No. 1)",exact:true}).click();
 await page.getByRole("button",{name:/Start first quest/}).click();await page.getByRole("button",{name:"Use simulated input"}).click();
 await page.getByRole("button",{name:"Sheet music",exact:true}).click();await expect(page.getByLabel("Highlighted bar 1",{exact:true})).toBeVisible();
 await expect(page.locator(".stage-feedback")).toContainText("Your turn");
 await page.locator(".stage").click({position:{x:10,y:80}});
 for(const key of ["y","g","y","k","u","g","y","u","y","k","u"]){await page.keyboard.press(key);await page.waitForTimeout(500);}
 await expect(page.locator(".quest-dock strong")).toHaveText("1 / 10 completed runs");
 await page.getByRole("button",{name:"Sheet only",exact:true}).click();await expect(page.locator(".stage")).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Pause practice"})).toHaveCount(0);await page.getByRole("button",{name:"Restart",exact:true}).click();
 await page.screenshot({path:"test-results/minute-waltz-sheet-only.png"});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await expect(page.getByRole("heading",{name:/Minute Waltz/}).first()).toBeVisible();
 await context.setOffline(true);
 const cached=await page.evaluate(async()=>{const r=await fetch("/scores/minute-waltz/system-25.png");return r.ok&&(await r.blob()).size>1000;});expect(cached).toBe(true);
});
test("returning workspace receives new bundle without losing selection",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open("cadence-piano");r.onsuccess=()=>{const db=r.result;const tx=db.transaction(["songs","settings"],"readwrite");tx.objectStore("songs").delete("chopin-minute-waltz");tx.objectStore("settings").delete("bundled-piece:chopin-minute-waltz");tx.objectStore("settings").put({key:"lastPiece",value:"beethoven-pathetique-ii"});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});});
 await page.reload();await expect(page.getByRole("heading",{name:/Pathétique/}).first()).toBeVisible();await page.getByRole("button",{name:"Pieces",exact:true}).click();await expect(page.getByRole("button",{name:"Practice Chopin · Minute Waltz (Op. 64 No. 1)",exact:true})).toBeVisible();
});
test("Minute Waltz final-system loop stays aligned at changed speed",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:"Pieces",exact:true}).click();await page.getByRole("button",{name:"Practice Chopin · Minute Waltz (Op. 64 No. 1)",exact:true}).click();
 await page.getByRole("button",{name:"Listen",exact:true}).click();await page.getByRole("button",{name:"Sheet music",exact:true}).click();
 await page.getByLabel("Playback speed").selectOption("50");await page.getByRole("button",{name:"Passages",exact:true}).click();await page.getByLabel("Loop last bar").selectOption("140");await page.getByLabel("Loop first bar").selectOption("140");await page.getByRole("button",{name:"Apply loop",exact:true}).click();await page.keyboard.press("Escape");await page.getByRole("button",{name:"Start practice",exact:true}).click();
 await expect(page.getByLabel("Highlighted bar 140",{exact:true})).toBeVisible();await page.waitForTimeout(3000);await expect(page.getByLabel("Highlighted bar 140",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Sheet only",exact:true}).click();await expect(page.getByAltText("Score page 5, bars 136–140")).toBeInViewport();await page.screenshot({path:"test-results/minute-waltz-final-loop.png"});
});
