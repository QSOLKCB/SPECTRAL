(function runSelfTests(S) {
  "use strict";

  const tests = [];
  const results = [];
  const goldenJobs = {};
  const ENGINE_GOLDENS = {
    omi_xor_ring:{pcm:"6544979802056a93301b4d0d7cd8f5fda1e66c9149b4fbed3acbc424efb5342f",wav:"9e8455b66c96ab4ff880aa9e719030eb0e98f59b162e40ba8c532d27ac840b6a",fingerprint:"5aa2d3f9c31c2d753f04657c2afafd94a1a2970c1924bfe84aa2a0bd64d85cc0",contract:"c7fceb67fb84511e178d2bbb3385f430bc1366000461a1151762b7044f1b7324"},
    e8_cosmovirus:{pcm:"58333109e2f5c9750e5ce7f28f422f8736a2d30256302fef073ea4657c9bab13",wav:"1a2b3e8d0f064f0e96c92c773c2dd285f54033163816ded008c28c7281a367ff",fingerprint:"7fdb27131d27d07028f1ae78f392a2b59c7658c17099ba3edb8c318525a44626",contract:"64c572d78f0113b507ae2ebfa0a41146951be73ced2aa36b8a3d1652d70f8956"},
    e8_bell:{pcm:"9766c64bb1b921bbe54a7f9c232249e94f1cc7f37326b0a3e0b607f55a0522d1",wav:"4b3d8acff3b5bd8f885810b6b1f597f948f8818ec63435624ba362118f30e197",fingerprint:"28bd411bcd5c2ab78b8c14cfa83c8090dea917156616df25292692b2f5082b5b",contract:"5d02bd167a94a0982e21a3450d807f66deb0a9d2e31696fc03fa5f5cf3ef4d5d"},
    spectral_algebraics:{pcm:"1fbd27c5f77dff721fc500270f8636c2b35225f504f322a97cb9e899ec262852",wav:"4905d091f8e67cb4feed6d1b5f4dfb810b05cd765ca7f0452456f8bb39944698",fingerprint:"578a237cb465ac9b504988d7cc7d41d77374cdba717f5cf00dc455436e742f46",contract:"f977563e7bc4d6d931c640afa3a3815f04fb0776fade231f88991a09258186d2"},
    qec_triality:{pcm:"12706e870788e4552c66448d20fa226acf320c4f2a1bca2639294472edc2793f",wav:"6ea57deaa8347fa75b35eb9dc1f48ab9b1ccaac7a77293c8012d5c41be493220",fingerprint:"c50268084e95b7906b8ed6f68b38f565827d84273fd2737fda9dd3ebfdedaa6f",contract:"3a24c79dd595eddc810fe7d1963280de54698b19a0c31d5a2518e5f5e7d622f8"},
    data_mapper:{pcm:"a94a065eb3e99b22347f5142693dfbd4666322bb4c425679b0960f67324be139",wav:"84e3ded8b0b884a696e616e9449d1422afed6d9599c8b4ef728a0b3dd34d9fbf",fingerprint:"84725445e678b428831b9e0026741d865d7bae84f800c64d13c4e19822b16049",contract:"de457a45515cc253e2ea43067c7189153e1337dbc3e4c835e0c97ab131240cc8"}
  };
  const SOURCE_GOLDENS = {
    csv:{source:"c555114456549d92ff28f1e6b12f7abfc655108749c8ddde84d462cb641e5896",pcm:"cc758d00cc8500a1d95667dedfdee1b3123e1e37d4135b35fab9b33017f28645",wav:"f5b881e4312fb2c83028f205b8933ed9376ce29bf4142c198b0f70cf74d83e3e",contract:"41d91a4cd7fd031d424adafa1ccd7a60893d7af274be76c805dcecabd67d4297"},
    json:{source:"20390618a25847c22ba4f83bfe87ed2a2d4bd6b3d35a9d6509b3d8b49381d390",pcm:"0a70487e23d4c9780b67a3386060ff9a4e2df0d08e5d3c2272f4b87a20d41525",wav:"391cd9e11bc2e17f1588cb9cc3a4463efc6a8f76fad95073283adba1ae56c040",contract:"18dca732b85ca1ca19789e5cfd4412acbdc9a340919878cda63aac964c98c00a"},
    text:{source:"fffa714f5e8c762a3a9f932ce3edeba772ad87b7a36b74ebba718cd1c0c63830",pcm:"9dafdc7382c86e8056bf7763df36c918947c8dec0c24d3849d359d164b064f76",wav:"6a42abf607c0fb189e0afb2f2a61f0218e5e82893f0fc504da0e477db30cb993",contract:"2048ca49c3c663e62f65ce25881e25400bfd96e3cb9fc87d3b984df7db65b27b"},
    binary:{source:"da2cb6ad175bc966de5e79c6e16777f8a98b610c2424a894132df2815be50677",pcm:"82a08e809474caeca5b4910388a9e9acd04c7ede7632adc11f64da828bee33d0",wav:"38765fd7275b2fb9dd6c5bf57be417db3dea5d90dc493bf3987c7fefec38a0bf",contract:"7f672bd6fea27bc78835993b92a1a3898969f03e8d22fcc36aea67da54d5a08a"}
  };
  const add = (name, fn) => tests.push({ name, fn });
  const equal = (actual, expected, message) => {
    if (actual !== expected) throw new Error((message ? message + ": " : "") + "expected " + String(expected) + ", received " + String(actual));
  };
  const bytesEqual = (actual, expected) => {
    equal(actual.length, expected.length, "byte length");
    for (let i = 0; i < actual.length; i += 1) if (actual[i] !== expected[i]) throw new Error("first byte difference at " + i + ": expected " + expected[i] + ", received " + actual[i]);
  };
  const rejects = fn => {
    let rejected = false;
    try { fn(); } catch (_) { rejected = true; }
    if (!rejected) throw new Error("expected operation to reject invalid input");
  };

  add("SHA-256 · empty known answer", () => equal(S.Core.sha256Hex(new Uint8Array(0)), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
  add("SHA-256 · abc known answer", () => equal(S.Core.sha256Hex(S.Core.utf8("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  add("SHA-256 · Web Crypto agreement when available", async () => {
    const bytes = S.Core.utf8("SPECTRAL-WEB-CRYPTO-CROSSCHECK");
    const web = await S.Core.webCryptoSha256Hex(bytes);
    if (web === null) return "SKIP: Web Crypto is unavailable for this file origin";
    equal(web, S.Core.sha256Hex(bytes));
  });
  add("UTF-8 · Unicode and null bytes", () => equal(S.Core.toHex(S.Core.utf8("φ·E8\0")), "cf86c2b7453800"));
  add("Canonical JSON · recursive key ordering", () => equal(S.Core.stableStringify({b:1,a:{z:0,y:[3,2,1]}}), '{"a":{"y":[3,2,1],"z":0},"b":1}'));
  add("Canonical JSON · rejects floats and negative zero", () => { rejects(() => S.Core.stableStringify({x:1.5})); rejects(() => S.Core.stableStringify({x:-0})); });
  add("Canonical JSON · preserves own __proto__ keys without pollution", () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":1},"x":2}');
    equal(S.Core.stableStringify(hostile), '{"__proto__":{"polluted":1},"x":2}');
    equal({}.polluted, undefined);
  });
  add("Canonical decimal · explicit half-away rounding", () => { equal(S.Core.decimalToScaled("0.125", 100), 13); equal(S.Core.decimalToScaled("-0.125", 100), -13); equal(S.Core.decimalToScaled("1.2e2", 1000), 120000); });
  add("Input adapters · ignore labels and quoted string numerals", () => {
    equal(Array.from(S.Core.Input.extractJsonNumerics('{"label":"E8","values":[1.5,-2]}')).join(","), "1500000,-2000000");
    equal(Array.from(S.Core.Input.extractTabularNumerics('name,value\n"E8","1.25"\nrow2,-3', ",")).join(","), "1250000,-3000000");
    equal(S.Core.Input.classify("ambiguous.dat", "text/plain"), "binary");
  });
  add("PRNG · deterministic known answer", () => {
    const seed = S.Core.sha256Bytes(S.Core.utf8("SPECTRAL-PRNG-KAT"));
    const generator = new S.Core.Xoshiro128ss(seed);
    equal([generator.nextUint32(),generator.nextUint32(),generator.nextUint32(),generator.nextUint32()].join(","), "2961537440,1645118927,1540585684,1636501801");
  });
  add("WAV writer · hand-built PCM16 vector", () => {
    const encoded = S.Audio.Wav.encodePcm16(new Int16Array([-32768,-1,0,1,32767]), 8000, 1);
    equal(encoded.wavBytes.length, 54);
    equal(S.Core.sha256Hex(encoded.wavBytes), "19720469d8ea90b29b143393c9138abc454576338bd507d992fc654c56909692");
    equal(S.Audio.Wav.validate(encoded.wavBytes), true);
    bytesEqual(encoded.wavBytes.slice(44), new Uint8Array([0,128,255,255,0,0,1,0,255,127]));
  });
  add("ZIP writer · fixed bytes and lexical order", () => {
    const first = S.Audio.Zip.create([{name:"b.txt",bytes:S.Core.utf8("B")},{name:"a.txt",bytes:S.Core.utf8("A")}]);
    const second = S.Audio.Zip.create([{name:"a.txt",bytes:S.Core.utf8("A")},{name:"b.txt",bytes:S.Core.utf8("B")}]);
    bytesEqual(first, second);
    equal(S.Core.sha256Hex(first), "e0ee77a8a9c4be04da7b96c2259b9d6a1342a268ec6e3d116596f749aca497c0");
  });
  add("Engine registry · all initial engines present", () => {
    const ids = S.Engines.Registry.list().map(engine => engine.id).sort().join(",");
    equal(ids, "data_mapper,e8_bell,e8_cosmovirus,image_scan,omi_xor_ring,qec_triality,spectral_algebraics");
  });
  add("Image Scan · strict claim is rejected", () => equal(S.Engines.Registry.get("image_scan").supportedModes.includes(S.MODES.CANONICAL_STRICT), false));
  add("Canonical Strict · per-engine golden vectors", async () => {
    for (const [id, expected] of Object.entries(ENGINE_GOLDENS)) {
      const engine = S.Engines.Registry.get(id);
      const job = await S.Provenance.render({engineId:id,mode:S.MODES.CANONICAL_STRICT,seed:"ENGINE-GOLDEN-v2",mutationIndex:0,durationSeconds:1,profileId:engine.defaultExportProfile,parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]});
      goldenJobs[id] = job;
      equal(job.pcmHash, expected.pcm, id + " PCM");
      equal(job.wavHash, expected.wav, id + " WAV");
      equal(job.fingerprintHash, expected.fingerprint, id + " fingerprint");
      equal(job.contractHash, expected.contract, id + " contract");
    }
  });
  add("Canonical Strict · every strict engine repeats and mutates", async () => {
    for (const id of Object.keys(ENGINE_GOLDENS)) {
      const engine = S.Engines.Registry.get(id);
      const base = {engineId:id,mode:S.MODES.CANONICAL_STRICT,seed:"ENGINE-GOLDEN-v2",durationSeconds:1,profileId:engine.defaultExportProfile,parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]};
      const repeated = await S.Provenance.render(Object.assign({}, base, {mutationIndex:0}));
      const mutated = await S.Provenance.render(Object.assign({}, base, {mutationIndex:1}));
      bytesEqual(repeated.wavBytes, goldenJobs[id].wavBytes);
      equal(repeated.contractHash, goldenJobs[id].contractHash, id + " repeat contract");
      if (mutated.wavHash === repeated.wavHash || mutated.contractHash === repeated.contractHash) throw new Error(id + " mutation retained identity");
    }
  });
  add("Canonical Strict · CSV, JSON, text, and binary source goldens", async () => {
    const bytes = new Uint8Array([0,1,2,127,128,255]);
    const fixtures = {
      csv:S.Core.Input.fromText("time,value\n0,1.25\n1,-2.5\n2,4.0\n", "fixture.csv"),
      json:S.Core.Input.fromText('{"series":[0.125,2,-3.5],"label":"E8"}', "fixture.json"),
      text:S.Core.Input.fromText("φ 1.0 -0.25 8e-2\n", "fixture.txt"),
      binary:{name:"fixture.bin",type:"application/octet-stream",kind:"binary",size:bytes.length,bytes,hash:S.Core.sha256Hex(bytes),numeric:Int32Array.from(bytes,value=>value*1000000),text:null,image:null}
    };
    const engine = S.Engines.Registry.get("data_mapper");
    for (const [name, source] of Object.entries(fixtures)) {
      const expected = SOURCE_GOLDENS[name];
      equal(source.hash, expected.source, name + " source");
      const job = await S.Provenance.render({engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"SOURCE-GOLDEN-v2",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(engine),source,priorJobs:[]});
      equal(job.pcmHash, expected.pcm, name + " PCM");
      equal(job.wavHash, expected.wav, name + " WAV");
      equal(job.contractHash, expected.contract, name + " contract");
    }
  });
  add("Replay Safe · synthetic Image Scan renders locally", async () => {
    const pixels = new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
    const source = {name:"synthetic.png",type:"image/png",kind:"image",size:4,bytes:new Uint8Array([1,2,3,4]),hash:S.Core.sha256Hex(new Uint8Array([1,2,3,4])),numeric:new Int32Array([54213000,182376000,18411000,255000000]),text:null,image:{width:2,height:2,pixels}};
    const engine = S.Engines.Registry.get("image_scan");
    const job = await S.Provenance.render({engineId:engine.id,mode:S.MODES.REPLAY_SAFE,seed:"IMAGE-KAT",mutationIndex:0,durationSeconds:1,profileId:engine.defaultExportProfile,parameters:S.Engines.Registry.defaults(engine),source,priorJobs:[]});
    equal(S.Audio.Wav.validate(job.wavBytes), true);
    if (!job.wavHash || !job.contractHash) throw new Error("image render did not produce identities");
  });
  add("Canonical Strict · generic engines map raw image bytes, not decoded pixels", async () => {
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
    const makeSource = numeric => ({name:"fixture.png",type:"image/png",kind:"image",size:bytes.length,bytes,hash:S.Core.sha256Hex(bytes),numeric,text:null,image:{width:2,height:2,pixels:new Uint8ClampedArray(16)}});
    for (const id of ["data_mapper","qec_triality"]) {
      const engine = S.Engines.Registry.get(id);
      const base = {engineId:id,mode:S.MODES.CANONICAL_STRICT,seed:"IMAGE-RAW-BYTE-KAT",mutationIndex:0,durationSeconds:1,profileId:engine.defaultExportProfile,parameters:S.Engines.Registry.defaults(engine),priorJobs:[]};
      const dark = await S.Provenance.render(Object.assign({}, base, {source:makeSource(new Int32Array([0,0,0,0]))}));
      const light = await S.Provenance.render(Object.assign({}, base, {source:makeSource(new Int32Array([255000000,255000000,255000000,255000000]))}));
      equal(dark.recipeHash, light.recipeHash, id + " recipe");
      equal(dark.wavHash, light.wavHash, id + " WAV");
    }
  });
  add("Canonical Strict · repeated render is byte-identical", async () => {
    const request = {engineId:"omi_xor_ring",mode:S.MODES.CANONICAL_STRICT,seed:"KAT-STRICT",mutationIndex:7,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(S.Engines.Registry.get("omi_xor_ring")),source:null,priorJobs:[]};
    const first = await S.Provenance.render(request);
    const second = await S.Provenance.render(request);
    bytesEqual(first.pcmBytes, second.pcmBytes);
    bytesEqual(first.wavBytes, second.wavBytes);
    equal(first.contractHash, second.contractHash);
    equal(S.Core.stableStringify(first.contract), S.Core.stableStringify(second.contract));
  });
  add("Render control · cancellation fails without partial artifacts", async () => {
    const engine = S.Engines.Registry.get("omi_xor_ring");
    const parameters = S.Engines.Registry.defaults(engine);
    parameters.orbit_lanes = "16";
    const controller = new AbortController();
    const pending = S.Provenance.render({engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"KAT-CANCEL",mutationIndex:0,durationSeconds:4,profileId:"archive",parameters,source:null,priorJobs:[],signal:controller.signal});
    setTimeout(() => controller.abort(), 0);
    let cancelled = false;
    try { await pending; } catch (error) { cancelled = error.name === "AbortError"; }
    if (!cancelled) throw new Error("render did not cancel through the deterministic yield boundary");
  });
  add("Mutation · changes PCM, WAV, fingerprint, and contract", async () => {
    const base = {engineId:"data_mapper",mode:S.MODES.CANONICAL_STRICT,seed:"KAT-MUTATION",durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(S.Engines.Registry.get("data_mapper")),source:S.Core.Input.fromText("1,2,3,5,8,13", "fixture.csv"),priorJobs:[]};
    const zero = await S.Provenance.render(Object.assign({}, base, {mutationIndex:0}));
    const one = await S.Provenance.render(Object.assign({}, base, {mutationIndex:1}));
    if (zero.wavHash === one.wavHash || zero.pcmHash === one.pcmHash || zero.contractHash === one.contractHash || zero.fingerprintHash === one.fingerprintHash) throw new Error("mutation retained an identity-bearing hash");
  });
  add("Determinism mode · changes recipe and contract identity", async () => {
    const base = {engineId:"e8_bell",seed:"KAT-MODE",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(S.Engines.Registry.get("e8_bell")),source:null,priorJobs:[]};
    const strict = await S.Provenance.render(Object.assign({}, base, {mode:S.MODES.CANONICAL_STRICT}));
    const replay = await S.Provenance.render(Object.assign({}, base, {mode:S.MODES.REPLAY_SAFE}));
    if (strict.recipeHash === replay.recipeHash || strict.contractHash === replay.contractHash) throw new Error("mode did not participate in identity");
  });
  add("Manifest replay · verifies exact strict identity", async () => {
    const source = S.Core.Input.fromText("error_rate,a,b\n0.1,1,2\n0.01,2,3", "qec.csv");
    const request = {engineId:"qec_triality",mode:S.MODES.CANONICAL_STRICT,seed:"KAT-REPLAY",mutationIndex:2,durationSeconds:1,profileId:"suno_seed",parameters:S.Engines.Registry.defaults(S.Engines.Registry.get("qec_triality")),source,priorJobs:[]};
    const original = await S.Provenance.render(request);
    const replayed = await S.Provenance.replay(JSON.parse(S.Core.prettyStable(original.manifest)), source, []);
    equal(replayed.wavHash, original.wavHash);
    equal(replayed.contractHash, original.contractHash);
  });
  add("Manifest replay · rejects changed source bytes", async () => {
    const source = S.Core.Input.fromText("1,2,3", "data.csv");
    const request = {engineId:"data_mapper",mode:S.MODES.CANONICAL_STRICT,seed:"KAT-SOURCE",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(S.Engines.Registry.get("data_mapper")),source,priorJobs:[]};
    const original = await S.Provenance.render(request);
    let rejected = false;
    try { await S.Provenance.replay(original.manifest, S.Core.Input.fromText("1,2,4", "data.csv"), []); } catch (_) { rejected = true; }
    if (!rejected) throw new Error("changed source was accepted");
  });
  add("Manifest replay · rejects noncanonical normalized parameters", async () => {
    const engine = S.Engines.Registry.get("e8_bell");
    const original = await S.Provenance.render({engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"KAT-PARAM-TAMPER",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]});
    const tampered = JSON.parse(S.Core.prettyStable(original.manifest));
    tampered.recipe.parameters.tuning_hz = 432000.5;
    let rejected = false;
    try { await S.Provenance.replay(tampered, null, []); } catch (_) { rejected = true; }
    if (!rejected) throw new Error("noncanonical normalized parameter was accepted");
  });
  add("Manifest replay · authenticates every receipt layer", async () => {
    const engine = S.Engines.Registry.get("omi_xor_ring");
    const original = await S.Provenance.render({engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"KAT-RECEIPT-TAMPER",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]});
    const mutators = [
      manifest => { manifest.recipe_sha256 = "0".repeat(64); },
      manifest => { manifest.manifest_core_sha256 = "1".repeat(64); },
      manifest => { manifest.contract.backend = "tampered-backend"; },
      manifest => { manifest.artifacts.fingerprint_json.sha256 = "2".repeat(64); }
    ];
    for (const mutate of mutators) {
      const tampered = JSON.parse(S.Core.prettyStable(original.manifest));
      mutate(tampered);
      let rejected = false;
      try { await S.Provenance.replay(tampered, null, []); } catch (_) { rejected = true; }
      if (!rejected) throw new Error("tampered receipt was accepted");
    }
  });
  add("Local catalog · observation cannot alter deterministic artifacts", async () => {
    const engine = S.Engines.Registry.get("e8_bell");
    const request = {engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"KAT-CATALOG-ISOLATION",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]};
    const first = await S.Provenance.render(request);
    const second = await S.Provenance.render(Object.assign({}, request, {priorJobs:[first]}));
    equal(first.manifestCoreHash, second.manifestCoreHash);
    bytesEqual(first.bundleBytes, second.bundleBytes);
    equal(first.catalogObservation.exact_prior_wav_match, false);
    equal(second.catalogObservation.exact_prior_wav_match, true);
  });
  add("Derivative lineage · updates manifest and ZIP without mutating seed contract", async () => {
    const engine = S.Engines.Registry.get("e8_bell");
    const job = await S.Provenance.render({engineId:engine.id,mode:S.MODES.CANONICAL_STRICT,seed:"KAT-LINEAGE",mutationIndex:0,durationSeconds:1,profileId:"archive",parameters:S.Engines.Registry.defaults(engine),source:null,priorJobs:[]});
    const contractBefore = job.contractHash;
    const manifestBefore = job.manifestCoreHash;
    const bundleBefore = S.Core.sha256Hex(job.bundleBytes);
    const attached = S.Provenance.attachDerivative(job, "derivative.wav", new Uint8Array([82,73,70,70,1,2,3,4]), "User arrangement / production", "self-test");
    equal(job.contractHash, contractBefore);
    if (job.manifestCoreHash === manifestBefore) throw new Error("manifest core did not change");
    if (S.Core.sha256Hex(job.bundleBytes) === bundleBefore) throw new Error("bundle did not change");
    equal(job.derivation.derivatives.length, 1);
    equal(job.derivation.derivatives[0].sha256, attached.derivative.sha256);
    equal(job.manifest.artifacts.derivation_graph_json.sha256, S.Core.sha256Hex(S.Provenance.outputBytes(job.derivation)));
    const replayed = await S.Provenance.replay(JSON.parse(S.Core.prettyStable(job.manifest)), null, []);
    equal(S.Core.stableStringify(replayed.derivation), S.Core.stableStringify(job.derivation));
    equal(replayed.manifestCoreHash, job.manifestCoreHash);
  });
  add("IndexedDB · isolated full-job ArrayBuffer round trip", async () => {
    const status = await S.Storage.Database.selfTestRoundTrip();
    if (!status.supported && window.__SPECTRAL_NON_BROWSER_HARNESS__) return "SKIP: non-browser harness";
    if (!status.supported) throw new Error("This file origin does not provide required IndexedDB persistence");
    if (!status.passed) throw new Error(status.reason || "IndexedDB round trip failed");
  });
  add("IndexedDB · survives a real reload of this file page", async () => {
    if (window.__SPECTRAL_NON_BROWSER_HARNESS__) return "SKIP: non-browser harness";
    const marker = "#spectral-idb-reload-verify";
    if (location.hash === marker) {
      const verified = await S.Storage.Database.verifyReloadSelfTest();
      if (!verified.supported || !verified.passed) throw new Error(verified.reason || "IndexedDB reload verification failed");
      try { history.replaceState(null, "", location.href.slice(0, -marker.length)); } catch (_) { /* Hash cleanup is cosmetic. */ }
      return "Verified after page reload";
    }
    const prepared = await S.Storage.Database.prepareReloadSelfTest();
    if (!prepared.supported || !prepared.passed) throw new Error(prepared.reason || "Could not prepare IndexedDB reload test");
    location.hash = marker;
    location.reload();
    await new Promise(() => {});
  });
  add("Resource audit · no remote resources loaded", () => {
    const remote = performance.getEntriesByType("resource").map(entry => entry.name).filter(name => /^(?:https?|wss?):/i.test(name));
    equal(remote.length, 0, remote.join(", "));
  });

  function row(result) {
    const tr = document.createElement("tr");
    const detail = result.error ? "<pre>" + String(result.error.stack || result.error).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]) + "</pre>" : (result.note || "OK");
    tr.innerHTML = '<td class="' + (result.pass ? "pass" : "fail") + '">' + (result.pass ? (result.note && result.note.startsWith("SKIP") ? "SKIP" : "PASS") : "FAIL") + "</td><td>" + result.name + "</td><td>" + detail + "</td>";
    return tr;
  }

  window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("runtime").textContent = navigator.userAgent;
    for (const test of tests) {
      try {
        const note = await test.fn();
        results.push({name:test.name,pass:true,note:typeof note === "string" ? note : "OK"});
      } catch (error) {
        results.push({name:test.name,pass:false,error});
      }
      document.getElementById("results").appendChild(row(results[results.length - 1]));
      document.getElementById("counts").textContent = results.filter(result => result.pass).length + " / " + results.length;
    }
    const passed = results.every(result => result.pass);
    const status = document.getElementById("status");
    status.textContent = passed ? "ALL TESTS PASS" : "TEST FAILURE";
    status.className = "chip " + (passed ? "pass" : "fail");
    document.documentElement.dataset.testStatus = passed ? "pass" : "fail";
    window.__SPECTRAL_TEST_RESULT__ = {passed,total:results.length,failed:results.filter(result => !result.pass).map(result => result.name)};
  });
})(window.SPECTRAL);
