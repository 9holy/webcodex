import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { build } from '../../frontend/node_modules/esbuild/lib/main.js';
const root=new URL('../../',import.meta.url), output=new URL('../../artifacts/selection-hidden-reveal/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const source=new URL('frontend/src/ui/selectionMotion.ts',root);
const bundle=await build({entryPoints:[source.pathname],bundle:true,format:'iife',globalName:'Selection',write:false,target:'es2022'});
const report={fixture:true,nativeBackend:false,sourceSha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),cssSha256:createHash('sha256').update(fs.readFileSync(new URL('frontend/src/ui/selectionMotion.css',root))).digest('hex'),browser:null,checks:[],errors:[],limitations:['Chromium Linux, synthetic real-layout DOM using exact candidate module and production selection CSS; not native WebView/backend.']};
let browser, page;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.WEBCODEX_SMOKE_BROWSER||undefined});report.browser=browser.version();
 page=await browser.newPage({viewport:{width:1000,height:650}});page.on('pageerror',error=>report.errors.push(error.message));
 await page.route('**/*',route=>{report.errors.push('Unexpected network request: '+route.request().url());return route.abort();});
 await page.setContent(`<!doctype html><html><head><style>${fs.readFileSync(new URL('frontend/src/ui/selectionMotion.css',root),'utf8')}\nbody{font:16px Arial;padding:40px} #group{display:flex;width:max-content;gap:12px} button{padding:12px 18px;border:1px solid gray;background:white;font:inherit} [hidden]{display:none!important} #panel{display:none}</style></head><body><h1>Selection hidden/reveal geometry</h1><div id="panel"><div id="group"><button id="a" aria-selected="true">Alpha</button><button id="b" aria-selected="false" hidden>Beta</button><button id="c" aria-selected="false">Gamma</button></div></div></body></html>`);
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{window.controller=Selection.createSelectionMotion(document.querySelector('#group'));document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>document.querySelectorAll('button').forEach(item=>item.setAttribute('aria-selected',String(item===button)))));});
 const settle=async()=>{await page.evaluate(async()=>{for(let n=0;n<4;n++)await new Promise(requestAnimationFrame);for(const animation of document.getAnimations())animation.finish();for(let n=0;n<2;n++)await new Promise(requestAnimationFrame);});};
 const check=async(name,expectedMirrors,selected,visible)=>{
  await settle();const state=await page.evaluate(()=>{const group=document.querySelector('#group'),plate=group.querySelector('[data-selection-motion-plate]'),foreground=group.querySelector('[data-selection-motion-foreground]');const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {items:[...group.querySelectorAll('button')].map(item=>({id:item.id,text:item.textContent,box:box(item),marked:item.hasAttribute('data-selection-motion-item'),selected:item.hasAttribute('data-selection-motion-selected')})),mirrors:[...foreground.querySelectorAll('[data-selection-motion-label]')].map(node=>({text:node.textContent,box:box(node)})),plate:box(plate),plateHidden:plate.hidden,foregroundHidden:foreground.hidden,inert:foreground.hasAttribute('inert'),ariaHidden:foreground.getAttribute('aria-hidden'),duplicateIds:foreground.querySelectorAll('[id],button,input,[role],[tabindex]').length};});
  assert.equal(state.mirrors.length,expectedMirrors,name);assert.equal(state.items.find(i=>i.selected)?.id,selected,name);assert(state.items.every(i=>i.marked),name);assert.equal(state.plateHidden,!visible,name);assert.equal(state.foregroundHidden,!visible,name);assert.equal(state.inert,true);assert.equal(state.ariaHidden,'true');assert.equal(state.duplicateIds,0);
  if(visible){const selectedItem=state.items.find(i=>i.id===selected);for(const key of ['x','y','width','height'])assert(Math.abs(state.plate[key]-selectedItem.box[key])<1.1,`${name} plate ${key}`);for(const mirror of state.mirrors){const item=state.items.find(i=>i.text===mirror.text);assert(item);for(const key of ['x','y','width','height'])assert(Math.abs(mirror.box[key]-item.box[key])<1.1,`${name} mirror ${key}`);}}
  report.checks.push({name,...state});
 };
 await check('initial hidden container',0,'a',false);
 await page.evaluate(()=>document.querySelector('#panel').style.display='block');await check('reveal mixed visibility',2,'a',true);
 await page.click('#c');await check('select visible item past hidden item',2,'c',true);
 await page.evaluate(()=>document.querySelector('#b').hidden=false);await check('reveal formerly hidden item',3,'c',true);
 await page.click('#b');await check('select newly revealed item',3,'b',true);
 await page.evaluate(()=>document.querySelector('#b').hidden=true);await check('hide selected item',2,'b',false);
 await page.evaluate(()=>document.querySelector('#b').textContent='Beta translated');
 await page.evaluate(()=>document.querySelector('#b').hidden=false);await check('reveal selected translated item',3,'b',true);
 for(let i=0;i<3;i++){await page.evaluate(()=>document.querySelector('#panel').style.display='none');await check(`hide cycle ${i}`,0,'b',false);await page.evaluate(()=>document.querySelector('#panel').style.display='block');await check(`reveal cycle ${i}`,3,'b',true);}
 await page.screenshot({path:new URL('revealed.png',output).pathname});
 await page.evaluate(()=>window.controller.destroy());await page.evaluate(()=>{document.querySelector('#panel').style.display='none';document.querySelector('#b').textContent='After destroy';document.querySelector('#panel').style.display='block';});await settle();
 const cleanup=await page.evaluate(()=>({overlays:document.querySelectorAll('[data-selection-motion-overlay]').length,markers:document.querySelectorAll('[data-selection-motion-item],[data-selection-motion-selected],[data-selection-motion]').length,buttons:document.querySelectorAll('button').length}));assert.deepEqual(cleanup,{overlays:0,markers:0,buttons:3});report.checks.push({name:'destroy after repeated reveal',...cleanup});assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error){report.errors.push(error.stack);report.passed=false;process.exitCode=1;if(page) await page.screenshot({path:new URL('failure.png',output).pathname}).catch(()=>{});}finally{await browser?.close();fs.writeFileSync(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,report:new URL('report.json',output).pathname}));}
