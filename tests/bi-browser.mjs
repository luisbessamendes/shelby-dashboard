import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {history} from './fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TEST_BASE_URL||'http://localhost:3001';
const output=path.resolve('outputs/bi-qa');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const records=history();
await context.route('**/rest/v1/**',route=>{
 assert.equal(route.request().method(),'GET');
 return route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('fact_store_month')?records:[])});
});
const requests=[],errors=[];
let fail=false, pending=null, deferred=false;
const reply={reply:'**Turnover** uses Gross Sales less VAT. [E1]\n\n| Measure | Current | Previous | Change |\n|---|---:|---:|---:|\n| Store EBITDAR | EUR 380 | EUR 300 | EUR 80 |\n\nNo cause is established.\n<script>window.injected=true</script>\n![Blocked remote image](https://example.com/should-not-load)',sources:[{id:'E1',tool:'query_metrics',period:'MONTHLY 2026-04',records:1,warnings:['Missing comparison records require review.']} ]};
await context.route('**/api/chat',async route=>{
 requests.push(route.request().postDataJSON());
 if(deferred){pending=route;return;}
 return route.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Test unavailable'}:reply)});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
async function question(text){
 await page.getByRole('textbox',{name:'Question for AI analyst'}).fill(text);
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.chat-input')?.disabled);
}
try{
 await page.goto(`${base}/segments`);
 await page.getByRole('heading',{name:'Segment Analysis',exact:true}).waitFor();
 await page.locator('.loading-spinner').waitFor({state:'hidden'});
 await page.getByRole('combobox',{name:'Dimension',exact:true}).selectOption('perimeter');
 await page.getByRole('button',{name:'Open AI Analyst Chat'}).click();
 await question('Explain Other Impact');
 assert.equal(requests.at(-1).report.dimension,'perimeter');
 await page.getByText('Sources (1)',{exact:true}).click();
 await page.getByText('Missing comparison records require review.',{exact:true}).waitFor();
 assert.equal(await page.locator('.chat-bubble table').count(),1);
 assert.equal(await page.locator('.chat-bubble script, .chat-bubble img').count(),0);
 await page.screenshot({path:path.join(output,'desktop.png')});
 await page.getByRole('button',{name:'Minimize chat'}).click();
 await page.getByRole('button',{name:'Restore AI Analyst Chat'}).click();
 assert.equal(await page.locator('.chat-message-assistant').count(),1);
 await page.getByRole('button',{name:'Minimize chat'}).click();
 await page.getByRole('link',{name:'Trend Analysis'}).click();
 await page.getByRole('combobox',{name:'Trend View',exact:true}).selectOption('ltm');
 await page.getByRole('button',{name:'Restore AI Analyst Chat'}).click();
 await question('Explain this trend');
 assert.equal(requests.at(-1).report.path,'/trends');
 assert.equal(requests.at(-1).report.trendBasis,'ltm');
 assert.match(requests.at(-1).messages[0].scope,/perimeter/);
 await page.getByRole('button',{name:'New chat'}).click();
 fail=true;await question('Retry test');
 await page.getByText('Test unavailable',{exact:true}).waitFor();
 fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.chat-input')?.disabled);
 assert.equal(await page.locator('.chat-message-user').count(),1);
 await page.getByRole('button',{name:'New chat'}).click();
 deferred=true;
 await page.getByRole('textbox',{name:'Question for AI analyst'}).fill('Cancel test');
 const requested=page.waitForRequest(r=>r.url().endsWith('/api/chat'));
 await page.getByRole('button',{name:'Send message',exact:true}).click();await requested;
 await page.getByRole('button',{name:'New chat'}).click();
 if(pending) await pending.fulfill({contentType:'application/json',body:JSON.stringify({reply:'STALE RESULT',sources:[]})}).catch(()=>{});
 deferred=false;
 await question('Fresh after cancel');
 assert.equal(await page.getByText('STALE RESULT',{exact:true}).count(),0);
 assert.equal(await page.locator('.chat-message-user').count(),1);
 for(const [route,label] of [['/overview','Portfolio Overview'],['/performance','Performance Table'],['/pnl','P&L Analysis'],['/margins','Margin Diagnostics'],['/rankings','Rankings & Outliers'],['/investment','Investment View'],['/upload','Data Upload']]){
  await page.getByRole('button',{name:'Minimize chat'}).click();
  await page.getByRole('link',{name:label}).click();
  await page.waitForURL(`**${route}`);
  await page.getByRole('button',{name:'Restore AI Analyst Chat'}).click();
  await question('Explain this report');assert.equal(requests.at(-1).report.path,route);
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'New chat'}).click();await question('Mobile table');
 await page.getByText('Sources (1)',{exact:true}).click();
 const bounds=await page.getByRole('dialog',{name:'Shelby AI Analyst'}).boundingBox();
 assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 const overflow=await page.locator('.chat-messages').evaluate(el=>el.scrollWidth-el.clientWidth);
 assert.ok(overflow<=1,'Chat must not scroll horizontally outside its table');
 await page.screenshot({path:path.join(output,'mobile.png')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,requests:requests.length,screenshots:output,errors}));
}finally{await browser.close();}
