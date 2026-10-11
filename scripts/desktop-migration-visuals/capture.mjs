import { chromium, projectRoot, outputDirectory } from './common.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
process.chdir(projectRoot)
const [label = 'before', baseURL = 'http://127.0.0.1:15331', screenFilter = 'full'] = process.argv.slice(2)
const out = outputDirectory(label)
await mkdir(out, { recursive: true })
const now = 1791730800000
const createdAt = new Date(now).toISOString()
const workspace = { id: 'visual-workspace', name: 'Koda Design System', description: 'Shared component migration', createdAt, updatedAt: createdAt }
const repo = { id: 'visual-repo', name: 'koda', rootPath: '/visual/koda', defaultBranch: 'main', createdAt }
const worktrees = [
  { id: 'visual-worktree', repoId: repo.id, branch: 'design-system-migration', worktreePath: '/visual/koda', workspaceIds: JSON.stringify([workspace.id]), worktreeType: 'standard', state: 'active', derivedStatus: 'needs-review', unread: 1, activeSessionId: 'visual-session', intendedTargetBranch: 'main', createdAt, updatedAt: createdAt },
  { id: 'visual-worktree-2', repoId: repo.id, branch: 'sharing-permissions', worktreePath: '/visual/sharing', workspaceIds: JSON.stringify([workspace.id]), worktreeType: 'standard', state: 'active', derivedStatus: 'in-progress', unread: 0, createdAt, updatedAt: createdAt },
]
const session = { id: 'visual-session', worktreeId: worktrees[0].id, title: 'Migrate shared UI components', agentType: 'codex', model: 'default', permissionMode: 'default', status: 'completed', createdAt, updatedAt: createdAt }
const events = [
 {event:{type:'user',message:{content:'Migrate the workspace sidebar onto the shared design system and preserve its current appearance.'}}},
 {event:{type:'assistant',message:{content:'I checked the workspace rows and shared status labels. The migration keeps their behavior and keyboard navigation intact.'}}},
 {event:{type:'tool_use',tool_id:'visual-tool',tool:'shell',input:{command:'pnpm --filter desktop test'}}},
 {event:{type:'tool_result',tool_use_id:'visual-tool',tool:'shell',output:'Test Files  24 passed (24)\nTests       237 passed (237)'}},
 {event:{type:'result',result:'The sidebar now uses shared components. All existing tests passed.'}},
].map((e,index)=>({...e,id:`event-${index}`,index,timestamp:now+index*1000}))
const diff = { files:[{path:'src/components/Sidebar.tsx',status:'modified',additions:12,deletions:8,diff:'diff --git a/src/components/Sidebar.tsx b/src/components/Sidebar.tsx\n--- a/src/components/Sidebar.tsx\n+++ b/src/components/Sidebar.tsx\n@@ -1,3 +1,4 @@\n-import { Status } from "./Status"\n+import { NavItem, StatusDot } from "@koda/ui"\n \n-export function Sidebar() { return null }\n+export function Sidebar() {\n+  return <NavItem label="Workspace" />\n+}'},{path:'src/pages/WorkspaceList.tsx',status:'modified',additions:7,deletions:5},{path:'README.md',status:'modified',additions:3,deletions:0}], summary:{filesChanged:3,additions:22,deletions:13},mergeBase:'abc123',targetBranch:'main'}
const approval = {id:'visual-approval',sessionId:session.id,agentType:'codex',toolName:'shell',input:{command:'pnpm --filter desktop test',cwd:'/visual/koda'},reason:'Run the desktop tests to verify the shared component migration.',createdAt,expiresAt:new Date(now+3600000).toISOString()}
const question = {id:'visual-question',sessionId:session.id,agentType:'codex',questions:[{id:'scope',header:'Migration scope',question:'Which feature should we migrate next?',options:[{label:'Agent chat',description:'Messages, approval cards and composer.'},{label:'Workspace view',description:'Files, changes and the terminal.'}],multiSelect:false,allowOther:true}],createdAt,expiresAt:new Date(now+3600000).toISOString()}
const manifest={label,baseURL,sourceCommit:process.env.KODA_VISUAL_COMMIT||null,workingCopy:process.env.KODA_VISUAL_WORKING_COPY==='true',viewport:{width:1440,height:1000},captured:[],errors:[],unknownMethods:[],notes:['Deterministic browser-intercepted JSON-RPC fixture; no sidecar, secrets, env files, real user data or external services.','Terminal uses a mocked PTY session and browser WebSocket stream.']}
const browser=await chromium.launch({headless:true})
const themes={obsidian:'codex-dark',light:'codex-light',dim:'codex-dim',graphite:'koda-graphite'}
await Promise.all(Object.entries(themes).map(async ([theme,themeId])=>{
 const context=await browser.newContext({viewport:manifest.viewport,deviceScaleFactor:1,reducedMotion:'reduce',timezoneId:'UTC'})
 await context.addInitScript(({themeId,now})=>{ const OriginalDate=Date;class FixedDate extends OriginalDate { constructor(...args){super(...(args.length?args:[now]))} static now(){return now} };globalThis.Date=FixedDate;localStorage.setItem('minnetonka-active-theme',JSON.stringify(themeId));localStorage.setItem('koda-selected-workspace-id',JSON.stringify('visual-workspace'));localStorage.setItem('koda-user-name','Visual reviewer')},{themeId,now})
 const page=await context.newPage();page.setDefaultTimeout(8000)
 let state='normal'
 page.on('pageerror',error=>manifest.errors.push({theme,state,error:String(error),stack:error.stack,url:page.url()}))
 await page.route('**/rpc',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})
  const {id,method,params}=route.request().postDataJSON();let result
  switch(method){
   case 'ping':result='pong';break
   case 'workspace.list':result=[workspace,{...workspace,id:'visual-workspace-empty',name:'Personal',description:'Ideas and experiments'}];break
   case 'workspace.get':result=workspace;break
   case 'repo.list':result=[repo,{...repo,id:'visual-repo-2',name:'docs',rootPath:'/visual/docs'}];break
   case 'repo.get':result=repo;break
   case 'workspaceRepo.list':result=params?.workspaceId==='visual-workspace-empty'?[]:[{id:'visual-workspace-repo',workspaceId:workspace.id,repoId:repo.id,repoName:repo.name,repoRootPath:repo.rootPath,repoDefaultBranch:'main',createdAt}];break
   case 'worktree.list':case 'worktree.listAll':case 'worktree.listByWorkspace':result=params?.workspaceId==='visual-workspace-empty'?[]:worktrees;break
   case 'worktree.get':result=worktrees.find(w=>w.id===params?.worktreeId)||worktrees[0];break
   case 'worktree.getDiff':result=diff;break
   case 'session.list':result=[session];break
   case 'codex.get':case 'claude.get':result=session;break
   case 'codex.getMessages':case 'claude.getMessages':result=events;break
   case 'codex.models':case 'claude.models':result=[{id:'default',model:'default',displayName:'Default',isDefault:true},{id:'gpt-5.3-codex',model:'gpt-5.3-codex',displayName:'GPT-5.3 Codex'}];break
   case 'approval.list':result=state==='approval'?[approval]:[];break
   case 'question.list':result=state==='question'?[question]:[];break
   case 'collaboration.status':result={enabled:true,reachable:true,mode:'service',settings:{displayName:'Visual reviewer',serviceUrl:'https://collaboration.example.test'},serviceUrl:'https://collaboration.example.test',machineId:'visual-machine',name:'Visual reviewer',displayName:'Visual reviewer'};break
   case 'collaboration.list':result=[];break
   case 'pulse.status':result=null;break
   case 'pulse.listActive':case 'activity.list':case 'checkpoint.list':result=[];break
   case 'activity.getWorkspacesWithStatus':result=[{id:workspace.id,name:workspace.name,status:'idle',worktreeCount:2,activeSessionCount:0}];break
   case 'activity.unreadCount':result={count:0};break
   case 'fs.readDirectory':result=params?.path?.endsWith('/src')?[{name:'components',path:'/visual/koda/src/components',type:'directory'},{name:'main.tsx',path:'/visual/koda/src/main.tsx',type:'file'}]:[{name:'src',path:'/visual/koda/src',type:'directory'},{name:'README.md',path:'/visual/koda/README.md',type:'file'},{name:'package.json',path:'/visual/koda/package.json',type:'file'}];break
   case 'fs.readFile':result='# Koda\n\nA collaborative coding workspace.\n';break
   case 'github.getChecks':result={checks:[{id:'test',status:'success',name:'Desktop tests',state:'SUCCESS',bucket:'pass',workflow:'CI',link:'https://example.test/check/1'},{id:'build',status:'success',name:'Build',state:'SUCCESS',bucket:'pass',workflow:'CI',link:'https://example.test/check/2'}],commitSha:'abc123'};break
   case 'pty.create':result={sessionId:'visual-pty',pid:1234,cols:80,rows:24};break
   case 'pty.write':case 'pty.resize':case 'pty.close':result={success:true};break
   default: manifest.unknownMethods.push({method,params});result=[]
  }
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id,result})})
 })
 await page.routeWebSocket('**/ws',ws=>{setTimeout(()=>ws.send(JSON.stringify({jsonrpc:'2.0',method:'pty.data',params:{sessionId:'visual-pty',data:'\u001b[32mkoda\u001b[0m ~/design-system-migration\r\n$ pnpm --filter desktop test\r\n\u001b[32m✓ 237 tests passed\u001b[0m\r\n$ '}})),4200)})
 const shot=async(name)=>{await page.mouse.move(0,0);await page.waitForTimeout(500);await page.screenshot({path:resolve(out,`${theme}-${name}.png`),fullPage:true,animations:'disabled'});manifest.captured.push({theme,name,path:`${label}/${theme}-${name}.png`,url:page.url(),bodyFont:await page.locator('body').evaluate(node=>getComputedStyle(node).fontFamily),terminalMetrics:await page.getByTestId('terminal-viewport').evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,screenHeight:node.querySelector('.xterm-screen')?.getBoundingClientRect().height??0,rowHeight:node.querySelector('.xterm-rows>div')?.getBoundingClientRect().height??0,styles:Object.fromEntries(['.xterm','.xterm-rows','.xterm-char-measure-element'].map(selector=>{const target=node.querySelector(selector);return [selector,target?Object.fromEntries(['font-family','font-size','font-weight','line-height','letter-spacing','width','height'].map(property=>[property,getComputedStyle(target).getPropertyValue(property)])):null]})),measureHeight:node.querySelector('.xterm-char-measure-element')?.getBoundingClientRect().height??0}))),dialogStyles:await page.locator('[role=dialog]').evaluateAll(nodes=>nodes.map(n=>({className:n.className,boxShadow:getComputedStyle(n).boxShadow,background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderColor,secondaryText:[...n.querySelectorAll('.text-text-secondary')].map(label=>({text:label.textContent,color:getComputedStyle(label).color})),overlay:getComputedStyle(n.previousElementSibling).backgroundColor}))),themeAttribute:await page.locator('html').getAttribute('data-koda-theme'),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});const last=manifest.captured.at(-1);if(last.terminalMetrics.some(metric=>metric.height<80||metric.screenHeight<80))manifest.errors.push({theme,state,name,error:'Terminal viewport collapsed below the fixture minimum height',terminalMetrics:last.terminalMetrics});await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(`${label} ${theme} ${name}`)}
 const goto=async(path)=>{await page.goto(`${baseURL}${path}`);await page.waitForTimeout(4500)}
 try{
 if(screenFilter==='all'||screenFilter==='batch1'||screenFilter==='full'){
  await goto('/');await shot('workspace-list')
  await page.getByRole('button',{name:'[+] NEW',exact:true}).last().click();await shot('create-workspace');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:/ADD REPO TO WORKSPACE/}).click();await shot('add-repo');await page.keyboard.press('Escape')
 }
 if(screenFilter==='extras'||screenFilter==='full'){
  await goto('/workspace/visual-workspace/visual-worktree');await page.evaluate(()=>window.__koda_test.showNotification({type:'success',title:'Migration checks passed',message:'All workspace tests passed.',duration:60000}));await shot('toast');await goto('/');await page.getByTestId('join-workspace').click();await shot('join-workspace');await goto('/settings');await page.getByTestId('collaboration-display-name').scrollIntoViewIfNeeded();await shot('settings-collaboration')
 }
 if(screenFilter==='details'||screenFilter==='full'){
  await goto('/workspace/visual-workspace/visual-worktree');await page.getByTestId('diff-file-sidebar-tsx').click();await shot('workspace-diff-expanded');await page.getByTestId('right-sidebar').getByText(/^\[?FILES\]?$/).click();await page.getByTestId('file-item-src').click();await shot('workspace-files-expanded');await goto('/settings')
 }
 if(screenFilter!=='batch1'&&screenFilter!=='details'&&screenFilter!=='extras'){
  await goto('/workspace/visual-workspace/visual-worktree');await shot('agent-chat')
  state='approval';await page.getByTestId('approval-card').waitFor({state:'visible'});await shot('agent-approval')
  state='question';await page.getByTestId('question-card').waitFor({state:'visible'});await shot('agent-question');state='normal';await page.waitForTimeout(1200)
  await page.getByTestId('share-workspace').click();await shot('sharing');await page.keyboard.press('Escape')
  await page.getByTestId('right-sidebar').getByText(/^\[?FILES\]?$/).click();await shot('workspace-files')
  await page.getByTestId('right-sidebar').getByText(/^\[?CHECKS\]?$/).click();await shot('workspace-checks')
  await page.getByTestId('right-sidebar').getByText(/^\[?REVIEW\]?$/).first().click();await shot('workspace-review')
  await page.keyboard.press('Meta+k');await shot('command-palette');await page.keyboard.press('Escape')
  await goto('/settings');await shot('settings');await goto('/workspace/visual-workspace/visual-worktree?mode=interview');await shot('interview')
 }
 }catch(error){manifest.errors.push({theme,state,error:String(error),body:(await page.locator('body').innerText()).slice(0,2000)});console.error(theme,String(error));await page.screenshot({path:resolve(out,`${theme}-failure.png`)})}
 await context.close()
}))
await browser.close();manifest.unknownMethods=[...new Map(manifest.unknownMethods.map(v=>[v.method,v])).values()];await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({captured:manifest.captured.length,errors:manifest.errors,unknownMethods:manifest.unknownMethods},null,2))

if (manifest.errors.length || manifest.unknownMethods.length || manifest.captured.some(item => item.horizontalOverflow)) process.exitCode = 1
