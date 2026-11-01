// Security regressions for SPECTRAL's 2026-11-01 Daybreak Blue scan.
// Node built-ins only, isolated VM contexts; no browser, network or exploits.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

function loadQEC() {
  const ctx = { window: {}, document: { getElementById: () => null }, TextEncoder, TextDecoder };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'QEC/APP/app.js'), 'utf8'), ctx);
  return ctx.window.QECLab;
}
function loadInput() {
  class TestFile {
    constructor(name, size) { this.name = name; this.size = size; this.type = 'application/octet-stream'; this.reads = 0; }
    async arrayBuffer() { this.reads++; throw Error('oversized file was read'); }
  }
  const core = {
    decimalToScaled: text => Math.round(Number(text) * 1000000),
    sha256Hex: bytes => crypto.createHash('sha256').update(bytes).digest('hex'),
    utf8: s => new TextEncoder().encode(s),
  };
  const ctx = { window: { SPECTRAL: {Core:core}}, File: TestFile, TextDecoder };
  vm.runInNewContext(fs.readFileSync(path.join(root,'APP/js/core/input.js'),'utf8'),ctx);
  return {Input:core.Input,TestFile};
}
function loadDSP() {
  const ctx = {window:{RB420:{}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'rb-420/js/dsp.js'),'utf8'),ctx);
  return ctx.window.RB420.DSP;
}

test('QEC rejects high, fractional, unsafe and negative cycles before simulation', () => {
  const Q = loadQEC();
  for (const bad of ['1000000000','1.5','-1','9007199254740992']) {
    assert.throws(() => Q.parseDataset('cycle,qubit,error,syndrome\n'+bad+',0,X,11\n','example.csv'), /cycle/);
  }
  assert.throws(() => Q.datasetSimulation({code:'steane_7',cycles:8},
    [{cycle:1e9,qubit:0,error:'X',correction:'X',residual:'I',syndrome:'11'}]), /cycle/);
});
test('QEC rejects conflicting events and syndrome, preserves canonical valid rows', () => {
  const Q=loadQEC(),source='cycle,qubit,error,syndrome,correction,residual\n0,1,X,11,X,I\n';
  const rows=Q.parseDataset(source,'dataset.csv');
  const sim=Q.datasetSimulation({code:'steane_7',cycles:8},rows);
  assert.equal(sim.events.length,1);
  assert.equal(sim.cycles[0].residual[1],0);
  assert.throws(()=>Q.datasetSimulation({code:'steane_7',cycles:8},[rows[0],rows[0]]),/Duplicate/);
  assert.throws(()=>Q.datasetSimulation({code:'steane_7',cycles:8},[
    rows[0],{...rows[0],qubit:2,syndrome:'10'}
  ]),/Conflicting/);
});
test('QEC CSV neutralizes spreadsheet formulas, quoted CR, and leaves regular values',()=>{
  const Q=loadQEC();
  const make=s=>Q.eventsCsv([{cycle:0,qubit:0,error:'X',syndrome:s,correction:'I',residual:'I'}]);
  for(const input of ['=1+1',' +2','\t@SUM(A1:A2)','\r=5','-3+4']){
    assert.match(make(input),/,\"?'/);
  }
  assert.match(make('a\r\nb'),/"a\r\nb"/);
  assert.match(make('011'),/,011,/);
});
test('QEC replay cannot identify raw input bytes from decoded text alone',()=>{
  const Q=loadQEC();
  const a=new Uint8Array([0xff]), b=new Uint8Array([0xfe]);
  const enc=new TextDecoder('utf8',{fatal:false});
  assert.equal(enc.decode(a),enc.decode(b));
  assert.notEqual(Q.sha256Hex(a),Q.sha256Hex(b));
  const source=fs.readFileSync(path.join(root,'QEC/APP/app.js'),'utf8');
  assert.match(source,/file\.arrayBuffer\(\)/);
  assert.match(source,/byteHash:sha256Hex\(bytes\)/);
  assert.doesNotMatch(source,/file\.text\(\)\.then/);
});
test('Workbench enforces pre-read limits and stops numeric tokenization',async()=>{
  const {Input,TestFile}=loadInput();
  const oversized=new TestFile('evil.bin',3*1024*1024);
  await assert.rejects(Input.fromFile(oversized),/byte budget/);
  assert.equal(oversized.reads,0);
  assert.deepEqual(Array.from(Input.extractDecimalTokens('1.25 -2e0')), [1250000,-2000000]);
  assert.deepEqual(Array.from(Input.extractJsonNumerics('{"numbers":[1.5,-2],"label":"123"}')),[1500000,-2000000]);
  assert.equal(Input.extractDecimalTokens('1 '.repeat(270000)).length,262144);
  assert.throws(()=>Input.fromText('x'.repeat(4*1024*1024+1),'big.txt'),/byte budget/);
});
test('RB-420 caps decoded PCM before allocating Web Audio buffers',()=>{
  const DSP=loadDSP();
  assert.throws(()=>DSP.assertImportPCM(3000001,44100,2),/budget/);
  assert.throws(()=>DSP.assertImportPCM(500,1,2),/budget/);
  let called=false;
  assert.throws(()=>DSP.audioBufferFromPCM({
    createBuffer(){called=true;throw Error('allocated');}
  },{left:{length:3000001},right:{length:3000001},sampleRate:44100}),/budget/);
  assert.equal(called,false);
  const app=fs.readFileSync(path.join(root,'rb-420/app.js'),'utf8');
  assert.match(app,/sampleName\.textContent = sample \? sample\.name/);
  assert.match(app,/validateImportedProject\(data\)/);
  assert.match(app,/decodeImportedSamples\(data\.samples\)/);
});

test('Workbench binary boundary keeps every admitted byte and the v2 tone-plan source', async () => {
  const {Input,TestFile}=loadInput();
  const bytes=Uint8Array.from({length:300000},(_,i)=>i%256);
  const file=new TestFile('source.bin',bytes.length);
  file.arrayBuffer=async function(){this.reads++;return bytes.buffer.slice(0);};
  const source=await Input.fromFile(file);
  assert.equal(file.reads,1);
  assert.equal(source.numeric.length,300000);
  assert.equal(source.numeric[262144],0);
  assert.equal(source.numeric[262145],1000000);
  assert.equal(source.numeric[299999],223000000);
  assert.equal(source.hash,'5576a58a474142a55f619be58eea2c14d7d7937cb99d5ef600a704fcde5ddbd8');
  assert.equal(source.bytes.length,300000);
  // Previously accepted sources must not change engine output under version 2.0.0.
  const code=fs.readFileSync(path.join(root,'APP/js/engines/data.js'),'utf8');
  assert.match(code,/id: "qec_triality"/);
  assert.match(code,/version: "2\.0\.0"/);
});

test('RB-420 rejects aggregate overflow on admission, not after saving', () => {
  const DSP=loadDSP();
  const sample={pcmLeft:{length:705600},sampleRate:44100,frames:705600};
  const samples=[sample,sample];
  const old=Array.from(samples);
  assert.equal(DSP.assertProjectSampleBudget(samples,null,-1,2000000),1411200);
  assert.throws(
    ()=>DSP.assertProjectSampleBudget(samples,sample,2,2000000),
    /total frame budget/
  );
  assert.equal(samples.length,2);
  assert.equal(samples[0],old[0]);
  assert.equal(samples[1],old[1]);
  // Replacement checks only the resulting total, not the previous duplicate.
  assert.equal(DSP.assertProjectSampleBudget(samples,sample,1,2000000),1411200);
  const code=fs.readFileSync(path.join(root,'rb-420/app.js'),'utf8');
  assert.match(code,/assertProjectSampleBudget\(state\.samples, sample, index, MAX_PROJECT_SAMPLE_FRAMES\);[\s\S]*?state\.samples\[index\] = sample/);
  assert.match(code,/function saveProject\(\)[\s\S]*?assertProjectSampleBudget\(state\.samples, null, -1, MAX_PROJECT_SAMPLE_FRAMES\)/);
});

test('QEC CSV export covers actual whitespace, tabs, CR and newline', () => {
  const Q=loadQEC();
  function cell(s){return Q.eventsCsv([{cycle:0,qubit:0,error:'X',syndrome:s,correction:'I',residual:'I'}]);}
  assert.match(cell(' +2'),/,\x27 \+2,/);
  assert.match(cell('\t=SUM(1)'),/,\x27\t=SUM\(1\),/);
  assert.match(cell('line1\nline2'),/,"line1\nline2",/);
  assert.match(cell('line1\rline2'),/,"line1\rline2",/);
});

test('RB-420 refuses tiny compressed 60-second audio BEFORE Web Audio decoding', async () => {
  const DSP=loadDSP(), tiny=new Uint8Array(60*1024), file={name:'60s.mp3',size:tiny.length};
  let decoded=0, probed=0;
  const context={decodeAudioData(){decoded++; throw Error('must not decode rejected file');}};
  await assert.rejects(
    DSP.decodeCompressedAudioBounded(file,tiny.buffer,context,async()=>{probed++;return 60;}),
    /30-second duration budget/
  );
  assert.equal(probed,1);
  assert.equal(decoded,0);
  for (const bad of [Infinity,NaN,0,-1]) {
    await assert.rejects(
      DSP.decodeCompressedAudioBounded(file,tiny.buffer,context,async()=>bad),
      /duration budget/
    );
  }
  assert.equal(decoded,0);
  const output={length:44100,sampleRate:44100,numberOfChannels:2,duration:1};
  const safe=await DSP.decodeCompressedAudioBounded(file,tiny.buffer,{
    async decodeAudioData(){decoded++;return output;}
  },async()=>1);
  assert.equal(safe,output);
  assert.equal(decoded,1);
  const app=fs.readFileSync(path.join(root,'rb-420/app.js'),'utf8');
  assert.match(app,/DSP\.decodeCompressedAudioBounded\(\s*file, bytes, engine\.context, probeCompressedDuration/);
  assert.doesNotMatch(app,/engine\.context\.decodeAudioData\(bytes\.slice/);
});

test('QEC enforces column ceiling before copying rows or amplifying allocations',()=>{
  const Q=loadQEC();
  const head=Array.from({length:1000},(_,i)=>'unknown_'+i).join(',');
  const row='0,'.repeat(999)+'0';
  const hostile=head+'\n'+Array(250).fill(row).join('\n')+'\n';
  assert.ok(Buffer.byteLength(hostile,'utf8')<2*1024*1024);
  assert.throws(()=>Q.parseDataset(hostile,'columns.csv'),/column limit/);
  assert.throws(()=>Q.parseDataset(
    'cycle,qubit,error,syndrome\n0,0,X,1'+',x'.repeat(1000)+'\n','columns.csv'
  ),/column limit/);
  const valid=Q.parseDataset(
    'cycle,qubit,error,syndrome,unknown,extra\n0,1,X,11,abc,def\n','valid.csv'
  );
  assert.equal(valid.length,1);
  assert.equal(valid[0].qubit,1);
  assert.equal(Object.hasOwn(valid[0],'unknown'),false);
});

test('QEC raw-byte identity is explicitly versioned; legacy BOM identity is not silently replayed',()=>{
  const Q=loadQEC();
  assert.equal(Q.VERSION,'1.1.0');
  const sourceText='cycle,qubit,error,syndrome,correction,residual\n0,1,X,11,X,I\n';
  const original=new TextEncoder().encode(sourceText);
  const bytes=new Uint8Array(original.length+3);
  bytes.set([0xef,0xbb,0xbf]);bytes.set(original,3);
  const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  const previousHash=Q.sha256Hex(new TextEncoder().encode(text));
  const rawHash=Q.sha256Hex(bytes);
  assert.notEqual(previousHash,rawHash);
  const data={name:'bom.csv',rows:Q.parseDataset(text,'bom.csv'),byteHash:rawHash};
  const rendered=Q.renderExperiment({code:'steane_7',cycles:2,duration:0.25},data);
  assert.equal(rendered.recipe.source.byteHash,rawHash);
  assert.equal(rendered.recipe.source.byteHashPolicy,'raw-selected-file-bytes/v1');
  assert.equal(rendered.recipe.engineVersion,'1.1.0');
  assert.equal(Q.replay(rendered.manifest,data).hashes.wav,rendered.hashes.wav);

  const legacy=JSON.parse(JSON.stringify(rendered.manifest));
  legacy.engineVersion='1.0.0';
  legacy.recipe.engineVersion='1.0.0';
  legacy.recipe.source.byteHash=previousHash;
  delete legacy.recipe.source.byteHashPolicy;
  const toHash=JSON.parse(JSON.stringify(legacy));
  delete toHash.integrityHash;
  legacy.integrityHash=Q.sha256Hex(Q.canonical(toHash));
  assert.equal(Q.verifyManifest(legacy),true);
  assert.throws(()=>Q.replay(legacy,data),/archived historical runtime/);
});

test('QEC shipped engine badge matches runtime, recipe and manifest versions', () => {
  const Q = loadQEC();
  const html = fs.readFileSync(path.join(root, 'QEC/APP/index.html'), 'utf8');
  const badge = html.match(/<span class="chip">ENGINE · (\\d+\\.\\d+\\.\\d+)<\\/span>/);
  assert.ok(badge, 'Shipped QEC engine version badge must exist');
  const result = Q.renderExperiment({code: 'steane_7', cycles: 2, duration: 0.25});
  assert.equal(badge[1], Q.VERSION, 'Visible badge differs from engine runtime');
  assert.equal(badge[1], result.recipe.engineVersion, 'Visible badge differs from recipe identity');
  assert.equal(badge[1], result.manifest.engineVersion, 'Visible badge differs from manifest identity');
});
