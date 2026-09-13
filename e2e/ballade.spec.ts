import { test, expect, type Page } from "@playwright/test";
import { keyGeometry, keyboardHeight } from "../src/ui/Roll";
import { black } from "../src/core/model";
const title = "Practice Chopin · Ballade No. 1 (Op. 23)";
async function openPiece(page: Page) {
  await page.goto("/");
  await page.getByRole("button",{name:"Pieces",exact:true}).click();
  await page.getByRole("button",{name:title,exact:true}).click();
}

test("Ballade supports real simulated note input, later quests, both score views and offline assets",async({page,context})=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await openPiece(page);
  await expect(page.getByRole("link",{name:/Paul Barton/})).toHaveAttribute("href","/pieces/chopin-ballade-1-barton.pdf");
  await expect(page.locator(".quest-overall")).toContainText("0 / 596");
  await page.getByRole("button",{name:/Start first quest/}).click();
  await page.getByRole("button",{name:"Use simulated input"}).click();
  await page.getByRole("button",{name:"Sheet music",exact:true}).click();
  await expect(page.getByLabel("Highlighted bar 1",{exact:true})).toBeVisible();
  for(const pitch of [48,51,56,58,60,56,63,70,72,68,75,82]) {
    await expect(page.locator(".stage-feedback")).toContainText("Your turn",{timeout:15000});
    const box=(await page.locator("canvas.roll").boundingBox())!;
    const key=keyGeometry(21,108,box.width).get(pitch)!;
    const y=black(pitch)?box.height-keyboardHeight(box.height)+15:box.height-10;
    await page.locator("canvas.roll").click({position:{x:key.x+key.width/2,y}});
    await page.waitForTimeout(250);
  }
  await expect(page.locator(".quest-run-label strong")).toHaveText("1 / 10 completed runs",{timeout:15000});
  await page.getByLabel("Choose checkpoint").selectOption("bars-208-208-right");
  await expect(page.getByLabel("Highlighted bar 208",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Sheet only",exact:true}).click();
  await expect(page.locator(".stage")).toHaveCount(0);
  await expect(page.getByAltText("Score page 14, bars 208–212")).toBeInViewport();
  await page.getByRole("button",{name:"Pause practice"}).click();
  await page.getByRole("button",{name:"Restart",exact:true}).click();
  await expect(page.getByLabel("Highlighted bar 208",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/ballade-sheet-only.png"});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading",{name:/Ballade No. 1/}).first()).toBeVisible();
  await expect(page.locator(".next-quest > strong")).toContainText("1 / 10");
  await context.setOffline(true);
  const cached=await page.evaluate(async()=>{
    const responses=await Promise.all(["/scores/ballade-1/system-60.png","/pieces/chopin-ballade-1-barton.pdf"].map(url=>fetch(url)));
    return responses.every(r=>r.ok);
  });
  expect(cached).toBe(true);
  expect(errors).toEqual([]);
});

test("Ballade final-bar loop follows source time at changed speed",async({page})=>{
  await openPiece(page);
  await page.getByRole("button",{name:"Listen",exact:true}).click();
  await page.getByRole("button",{name:"Sheet music",exact:true}).click();
  await page.getByLabel("Playback speed").selectOption("50");
  await page.getByRole("button",{name:"Passages",exact:true}).click();
  await page.getByLabel("Loop last bar").selectOption("264");
  await page.getByLabel("Loop first bar").selectOption("264");
  await page.getByRole("button",{name:"Apply loop",exact:true}).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Start practice",exact:true}).click();
  await expect(page.getByLabel("Highlighted bar 264",{exact:true})).toBeVisible();
  await page.waitForTimeout(6500);
  await expect(page.getByLabel("Highlighted bar 264",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Sheet only",exact:true}).click();
  await expect(page.getByAltText("Score page 17, bars 258–264")).toBeInViewport();
  await page.screenshot({path:"test-results/ballade-final-loop.png"});
});

test("returning library receives Ballade without changing the selected piece",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".quest-overall")).toBeVisible();
  await page.evaluate(async()=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open("cadence-piano");
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(["songs","settings"],"readwrite");
      tx.objectStore("songs").delete("chopin-ballade-1");
      tx.objectStore("settings").delete("bundled-piece:chopin-ballade-1");
      tx.objectStore("settings").put({key:"lastPiece",value:"beethoven-pathetique-ii"});
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
    request.onerror=()=>reject(request.error);
  }));
  await page.reload();
  await expect(page.getByRole("heading",{name:/Pathétique/}).first()).toBeVisible();
  await page.getByRole("button",{name:"Pieces",exact:true}).click();
  await expect(page.getByRole("button",{name:title,exact:true})).toBeVisible();
});
