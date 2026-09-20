import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {filters,history} from './fixtures.mjs';
const require=createRequire(import.meta.url);
const {runAnalyst,ANALYST_MODEL}=require('../src/lib/chat-runtime.ts');
const {createBiSession}=require('../src/lib/bi-tools.ts');
const {chatHistory}=require('../src/lib/chat-history.ts');
const {validateChatRequest}=require('../src/lib/bi-contract.ts');
const session=()=>createBiSession(history(),filters(),{path:'/overview'});
const call=(args={metrics:['grossSales']})=>({type:'function_call',name:'query_metrics',arguments:JSON.stringify(args),call_id:'call1'});
const response=(output,output_text='')=>({status:'completed',output,output_text,usage:{input_tokens:100,output_tokens:50}});

test('Responses integration uses approved model, medium reasoning, no storage and evidence on each question',async()=>{
 const requests=[];
 const client={responses:{create:async args=>{requests.push(structuredClone(args));return requests.length===1?response([call()]):response([],'Gross Sales are EUR 1,200. [E1]');}}};
 const result=await runAnalyst(client,session(),[{role:'user',content:'What are sales?'}]);
 assert.equal(requests[0].model,ANALYST_MODEL);assert.equal(ANALYST_MODEL,'gpt-5.6-sol');
 assert.equal(requests[0].store,false);assert.equal(requests[0].reasoning.effort,'medium');assert.equal(requests[0].tool_choice,'required');
 const tool=requests[1].input.find(i=>i.type==='function_call_output');
 assert.equal(JSON.parse(tool.output).totals[0].value,1200);
 assert.equal(result.sources[0].id,'E1');assert.equal(result.meta.tokens,300);assert.equal(result.meta.toolCalls,1);
});
test('invalid tool arguments return recoverable errors, not fabricated evidence',async()=>{
 let i=0;
 const client={responses:{create:async args=>{
  i++;if(i===1)return response([call({metrics:['invented']})]);
  if(i===2){assert.ok(JSON.parse(args.input.at(-1).output).error);return response([call()]);}
  return response([],'EUR 1,200 [E1]');
 }}};
 const result=await runAnalyst(client,session(),[{role:'user',content:'Sales?'}]);
 assert.equal(result.sources.length,1);assert.equal(result.meta.toolCalls,2);
});
test('rejects invented source citations, incomplete answers and answers without successful tools',async()=>{
 let i=0;
 const client={responses:{create:async()=>++i===1?response([call()]):response([],'Invented [E99]')}};
 await assert.rejects(runAnalyst(client,session(),[{role:'user',content:'Sales?'}]),/unverified source/);
 await assert.rejects(runAnalyst({responses:{create:async()=>({status:'incomplete',output:[]})}},session(),[{role:'user',content:'x'}]),/budget/);
 await assert.rejects(runAnalyst({responses:{create:async()=>response([],'Trust me')}},session(),[{role:'user',content:'x'}]),/verified answer/);
});
test('loop budget stops repeated lookups and preserves historical scope on follow-ups',async()=>{
 let n=0;
 const client={responses:{create:async args=>{n++;assert.ok(args.input.some(m=>m.role==='assistant'&&m.content.includes('2025')));return response([call()]);}}};
 await assert.rejects(runAnalyst(client,session(),[{role:'assistant',content:'Prior answer',scope:'YTD 2025'},{role:'user',content:'And now?'}]),/lookup limit/);
 assert.equal(n,8);
});

test('long conversation keeps recent turns inside request limits without losing latest question',()=>{
 const messages=Array.from({length:40},(_,i)=>({role:i%2?'assistant':'user',content:'a'.repeat(i%2?14000:1000),scope:'YTD July 2025'}));
 messages.push({role:'user',content:'And for 2026?',scope:'YTD July 2026'});
 const trimmed=chatHistory(messages);
 assert.equal(trimmed[0].role,'user');assert.equal(trimmed.at(-1).content,'And for 2026?');
 assert.ok(new TextEncoder().encode(JSON.stringify(trimmed)).length<46000);
 assert.ok(trimmed.some(m=>m.content.includes('shortened')));
 assert.ok(validateChatRequest({messages:trimmed,filters:filters()}));
});

test('financial answers require cited numerical evidence, not just definitions or unavailable tools',async()=>{
 for(const [tool,args,answer] of [
  ['query_metrics',{metrics:['grossSales']},'Gross Sales are EUR 999999'],
  ['get_metric_definitions',{metrics:['grossSales']},'Gross Sales are EUR 999999 [E1]'],
  ['get_pnl_report',{metrics:['grossSales'],year:2000},'Gross Sales are EUR 999999 [E1]'],
 ]){
  let n=0;
  const client={responses:{create:async()=>++n===1?response([{...call(args),name:tool}]):response([],answer)}};
  await assert.rejects(runAnalyst(client,session(),[{role:'user',content:'Sales?'}]),/numerical evidence/);
 }
});
