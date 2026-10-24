import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestSchema, queryCatalog, payload } from '../scripts/catalog-core.mjs';
import { platformPackage } from '../scripts/runtime.mjs';

const cli = fileURLToPath(new URL('../scripts/catalog.mjs', import.meta.url));
const ok = body => ({ structuredContent: { status_code: 200, body } });
const discovery = { structuredContent: { session_id: 'private-session', sm4_key: 'private-key' } };

test('invalid and mixed requests are rejected before any network call', async () => {
  for (const request of [{}, {keyword:'x',product_ids:['1']}, {keyword:'x',limit:11},
    {product_ids:[123]}, {product_ids:['1'],limit:1}, {keyword:'x',checkout:true}]) {
    let calls = 0;
    await assert.rejects(queryCatalog(request, async () => { calls++; }));
    assert.equal(calls, 0);
  }
  assert.equal(requestSchema.parse({keyword:'  支架  '}).keyword, '支架');
});

test('each query discovers its own session, deduplicates, caps and strips extra data', async () => {
  const calls = [];
  const result = await queryCatalog({keyword:'支架',limit:2}, async (name, args) => {
    calls.push({name,args});
    if (name === 'utp_discover') return discovery;
    return ok({sm4_key:'private-key', products:[
      {id:'1',title:'A',price_range:{min:{currency:'CNY',amount:499}},secret:'private-key'},
      {id:'1',title:'duplicate'}, {id:'javascript:bad'},
      {id:'2',title:'B',price_range:{min:{currency:'USD',amount:100}}}, {id:'3'}]});
  });
  assert.deepEqual(calls.map(c=>c.name), ['utp_discover','utp_catalog_search']);
  assert.equal(calls[1].args.session_id,'private-session');
  assert.equal(calls[1].args.limit,2);
  assert.deepEqual(result.products.map(p=>p.id),['1','2']);
  assert.equal(result.products[0].referenceMinCents,499);
  assert.equal(result.products[1].referenceMinCents,null);
  assert.doesNotMatch(JSON.stringify(result), /private-session|private-key|sm4_key|secret/);
});

test('detail calls stay read-only, deduplicate IDs, preserve unknown consumer prices', async () => {
  const calls=[];
  const result=await queryCatalog({product_ids:['1','1','2']}, async (name,args) => {
    calls.push({name,args});
    if(name==='utp_discover') return discovery;
    return ok({product:{id:args.product_id,title:'test',b2b_pricing:{moq:2},metadata:{freeShipping:'N',secret:'hidden'},
      variants:[{id:'sku-1',title:'黑色',price:{currency:'CNY',amount:1096},stock:2,secret:'hidden'},
      {id:'sku-2',price:{currency:'CNY',amount:-1}}]}});
  });
  assert.deepEqual(calls.map(c=>c.name),['utp_discover','utp_catalog_product','utp_catalog_product']);
  assert.deepEqual(calls.slice(1).map(c=>c.args),[
    {session_id:'private-session',product_id:'1'},{session_id:'private-session',product_id:'2'}]);
  assert.equal(result.products[0].providerMoq,2);
  assert.equal(result.products[0].variants[0].referenceUnitCents,1096);
  assert.equal(result.products[0].variants[1].referenceUnitCents,null);
  assert.equal(result.products[0].consumerUnitCents,null);
  assert.equal(result.products[0].landedTotalCents,null);
  assert.doesNotMatch(JSON.stringify(result),/hidden|private-session/);
});

test('business errors and malformed responses are never interpreted as empty success', async () => {
  assert.throws(()=>payload({isError:true}),/UPSTREAM_TOOL_ERROR/);
  assert.throws(()=>payload({structuredContent:{status_code:403,body:{products:[]}}}),/UPSTREAM_HTTP_403/);
  assert.throws(()=>payload({content:[{type:'text',text:'session=secret'}]}),/INVALID_BUSINESS_PAYLOAD/);
  await assert.rejects(queryCatalog({keyword:'x'},async name=>name==='utp_discover'?discovery:ok({})),/INVALID_PRODUCTS/);
  await assert.rejects(queryCatalog({keyword:'x'},async()=>({structuredContent:{}})),/MISSING_SESSION/);
});

test('structured, plain JSON and fenced JSON response forms are understood', () => {
  const envelope={status_code:200,body:{products:[]}};
  for (const response of [ok({products:[]}),
    {content:[{type:'text',text:JSON.stringify(envelope)}]},
    {content:[{type:'text',text:'```json\n'+JSON.stringify(envelope)+'\n```'}]}]) {
    assert.deepEqual(payload(response),{products:[]});
  }
});

test('supported platform mappings are explicit; unsupported systems fail clearly', () => {
  for(const [os,arch] of [['darwin','arm64'],['darwin','x64'],['linux','arm64'],['linux','x64'],['win32','x64']]) {
    assert.equal(platformPackage(os,arch),`@ut-protocol/utp-${os}-${arch}`);
  }
  assert.throws(()=>platformPackage('win32','arm64'),/UNSUPPORTED_PLATFORM/);
});

test('CLI works from another cwd with spaces and produces safe JSON errors', () => {
  const cwd=mkdtempSync(join(tmpdir(),'1688 test '));
  try {
    const help=execFileSync(process.execPath,[cli,'--help'],{cwd,encoding:'utf8'});
    assert.match(help,/--request/);
    const input=join(cwd,'request file.json');
    writeFileSync(input,'\uFEFF'+JSON.stringify({keyword:'x',checkout:'DO_NOT_LEAK'}));
    const bad=spawnSync(process.execPath,[cli,'--request',input],{cwd,encoding:'utf8'});
    assert.equal(bad.status,1); assert.equal(bad.stdout,'');
    assert.deepEqual(JSON.parse(bad.stderr),{ok:false,error:'SCHEMA_VALIDATION_FAILED'});
    writeFileSync(input,JSON.stringify({image_path:'missing.jpg'}));
    const missing=spawnSync(process.execPath,[cli,'--request',input],{cwd,encoding:'utf8'});
    assert.equal(missing.status,1);
    assert.equal(JSON.parse(missing.stderr).error,'IMAGE_FILE_NOT_FOUND');
  } finally { rmSync(cwd,{recursive:true,force:true}); }
});
