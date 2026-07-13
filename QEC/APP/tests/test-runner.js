(function(){
  "use strict";
  var Q=window.QECLab,tests=[],results=[];
  function add(name,fn){tests.push({name:name,fn:fn});}
  function assert(value,message){if(!value)throw new Error(message||"Assertion failed");}
  function equal(a,b,message){if(a!==b)throw new Error((message||"Values differ")+": "+a+" !== "+b);}
  function rejects(fn){var failed=false;try{fn();}catch(e){failed=true;}assert(failed,"Expected rejection");}
  function bytesToText(bytes){return new TextDecoder().decode(bytes);}
  var BASE={mode:"canonical_strict",state:"bell_phi_plus",code:"steane_7",noise:"depolarizing",decoder:"minimum_weight",errorRate:11.5,cycles:8,iterations:8,mutation:2026,texture:"harmonic_glass",tuning:432,tempo:140,duration:.5,width:72,intensity:70,drone:true};

  add("SHA-256 · standard abc vector",function(){equal(Q.sha256Hex("abc"),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");});
  add("Canonical JSON · object keys are sorted",function(){equal(Q.canonical({z:1,a:{d:2,b:3}}),'{"a":{"b":3,"d":2},"z":1}');});
  add("Model registry · nine QEC paths",function(){equal(Object.keys(Q.CODES).length,9);});
  add("State registry · ten named signatures",function(){equal(Object.keys(Q.STATES).length,10);});
  add("Stabilizer dimensions · every binary row matches n",function(){Object.keys(Q.CODES).forEach(function(id){var m=Q.CODES[id];if(m.radix===2)m.checks.forEach(function(c){equal(c.operators.length,m.n,id+" "+c.label);});});});
  add("Render identity · repeated strict render is byte-identical",function(){var a=Q.renderExperiment(BASE),b=Q.renderExperiment(BASE);equal(a.hashes.wav,b.hashes.wav);equal(a.hashes.eventStream,b.hashes.eventStream);});
  add("Frozen golden · canonical WAV identity",function(){equal(Q.renderExperiment(BASE).hashes.wav,"e28f7e2485583105dcbcbe22891a81034290872b290da8fa86e5d1844e7fbbb9");});
  add("Mutation identity · mutation changes WAV",function(){var a=Q.renderExperiment(BASE),b=Q.renderExperiment(Object.assign({},BASE,{mutation:2027}));assert(a.hashes.wav!==b.hashes.wav);});
  add("Tempo identity · tempo changes PCM",function(){var a=Q.renderExperiment(BASE),b=Q.renderExperiment(Object.assign({},BASE,{tempo:147}));assert(a.hashes.wav!==b.hashes.wav);});
  add("Texture identity · oscillator texture changes PCM",function(){var a=Q.renderExperiment(BASE),b=Q.renderExperiment(Object.assign({},BASE,{texture:"industrial_pauli"}));assert(a.hashes.wav!==b.hashes.wav);});
  add("Mode contract · Replay Safe label is retained",function(){equal(Q.renderExperiment(Object.assign({},BASE,{mode:"replay_safe"})).settings.mode,"replay_safe");});
  add("WAV structure · RIFF/WAVE and stereo PCM",function(){var r=Q.renderExperiment(BASE),t=bytesToText(r.wav.slice(0,12));assert(t.indexOf("RIFF")===0&&t.slice(8)==="WAVE");equal(new DataView(r.wav.buffer).getUint16(22,true),2);});
  add("WAV duration · frame count follows requested duration",function(){var r=Q.renderExperiment(BASE);equal((r.wav.length-44)/4,22050);});
  add("CSV parser · canonical columns",function(){var rows=Q.parseDataset("cycle,qubit,error,syndrome,correction,residual\n0,2,X,101,X,I\n","x.csv");equal(rows.length,1);equal(rows[0].qubit,2);});
  add("TSV parser · tab delimiter",function(){var rows=Q.parseDataset("cycle\tqubit\terror\tsyndrome\n1\t3\tZ\t011\n","x.tsv");equal(rows[0].error,"Z");});
  add("JSON parser · events wrapper",function(){var rows=Q.parseDataset('{"events":[{"round":2,"site":1,"pauli":"Y","checks":"11"}]}',"x.json");equal(rows[0].cycle,2);equal(rows[0].qubit,1);});
  add("Dataset render · supplied event identity is deterministic",function(){var rows=Q.parseDataset("cycle,qubit,error,syndrome,correction,residual\n0,1,X,11,X,I\n","x.csv"),d={name:"x.csv",rows:rows,byteHash:Q.sha256Hex("fixture")};var a=Q.renderExperiment(BASE,d),b=Q.renderExperiment(BASE,d);equal(a.hashes.wav,b.hashes.wav);equal(a.recipe.source.kind,"local_dataset");});
  add("Manifest authentication · valid manifest passes",function(){assert(Q.verifyManifest(Q.renderExperiment(BASE).manifest));});
  add("Manifest authentication · recipe tamper fails closed",function(){var m=JSON.parse(JSON.stringify(Q.renderExperiment(BASE).manifest));m.recipe.settings.tempoBpm=99;assert(!Q.verifyManifest(m));});
  add("Observation receipt · hashes bind WAV, events, and recipe",function(){var r=Q.renderExperiment(BASE);equal(r.receipt.wavHash,r.hashes.wav);equal(r.receipt.eventHash,r.hashes.eventStream);equal(r.receipt.recipeHash,r.hashes.recipe);});
  add("Replay · authenticated generated experiment matches",function(){var r=Q.renderExperiment(BASE),p=Q.replay(r.manifest);equal(p.hashes.wav,r.hashes.wav);});
  add("Replay · tampered manifest rejects",function(){var m=JSON.parse(JSON.stringify(Q.renderExperiment(BASE).manifest));m.summary.errors++;rejects(function(){Q.replay(m);});});
  add("Replay · dataset identity is required",function(){var rows=Q.parseDataset("cycle,qubit,error,syndrome,correction,residual\n0,1,X,11,X,I\n","x.csv"),d={name:"x.csv",rows:rows,byteHash:Q.sha256Hex("fixture")},r=Q.renderExperiment(BASE,d);rejects(function(){Q.replay(r.manifest);});});
  add("ZIP writer · PK signature and deterministic bytes",function(){var files=[{name:"a.txt",bytes:Q.textBytes("A")}],a=Q.zipStore(files),b=Q.zipStore(files);equal(a[0],0x50);equal(a[1],0x4b);equal(Q.sha256Hex(a),Q.sha256Hex(b));});
  add("Qutrit path · modulo-three render is valid",function(){var r=Q.renderExperiment(Object.assign({},BASE,{state:"qutrit_fourier",code:"qutrit_repetition_3",noise:"qutrit_shift",decoder:"mod3_lookup"}));equal(r.simulation.radix,3);assert(r.wav.length>44);});
  add("All code paths · each model renders and authenticates",function(){Object.keys(Q.CODES).forEach(function(code){var m=Q.CODES[code],r=Q.renderExperiment(Object.assign({},BASE,{code:code,state:m.radix===3?"qutrit_fourier":"plus",noise:m.radix===3?"qutrit_shift":"depolarizing",decoder:m.radix===3?"mod3_lookup":"minimum_weight",cycles:2,duration:.25}));assert(Q.verifyManifest(r.manifest),code);});});
  add("Event schema · normalized observation fields exist",function(){var e=Q.renderExperiment(BASE).simulation.events[0];["cycle","qubit","error","syndrome","correction","residual"].forEach(function(k){assert(Object.prototype.hasOwnProperty.call(e,k),k);});});
  add("Scientific boundary · manifest rejects physical-measurement framing",function(){var b=Q.renderExperiment(BASE).manifest.boundary;assert(/not physical measurement/i.test(b));});

  function row(result){var li=document.createElement("li");li.className=result.pass?"test-pass":"test-fail";li.innerHTML='<span class="mark">'+(result.pass?"✓":"×")+'</span><div><strong></strong><div class="detail"></div></div><span class="outcome">'+(result.pass?"PASS":"FAIL")+'</span>';li.querySelector("strong").textContent=result.name;li.querySelector(".detail").textContent=result.pass?(result.note||"Contract satisfied"):result.error.message;return li;}
  window.addEventListener("DOMContentLoaded",function(){
    document.getElementById("runtime").textContent=navigator.userAgent;
    tests.forEach(function(test){try{var note=test.fn();results.push({name:test.name,pass:true,note:note});}catch(error){results.push({name:test.name,pass:false,error:error});}document.getElementById("results").appendChild(row(results[results.length-1]));document.getElementById("counts").textContent=results.filter(function(r){return r.pass;}).length+" / "+results.length;});
    var passed=results.every(function(r){return r.pass;}),status=document.getElementById("status");status.textContent=passed?"ALL TESTS PASS":"TEST FAILURE";status.className="chip "+(passed?"pass":"fail");document.documentElement.dataset.testStatus=passed?"pass":"fail";window.__QEC_LAB_TEST_RESULT__={passed:passed,total:results.length,failed:results.filter(function(r){return !r.pass;}).map(function(r){return r.name;})};
  });
})();
