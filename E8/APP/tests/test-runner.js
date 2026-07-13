(function defineE8StudioTests(global) {
  "use strict";

  const S = global.E8STUDIO;
  const results = [];
  let running = false;

  function assert(condition, message) { if (!condition) throw new Error(message || "Assertion failed"); }
  function equal(actual, expected, message) { if (actual !== expected) throw new Error((message || "Values differ") + " · expected " + expected + ", received " + actual); }
  function bytesEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
    return true;
  }

  function renderResult(name, passed, detail) {
    const item = document.createElement("li"); item.className = passed ? "pass" : "fail";
    const badge = document.createElement("b"); badge.textContent = passed ? "PASS" : "FAIL";
    const text = document.createElement("span"); text.textContent = name + (detail ? " · " + detail : "");
    item.append(badge, text); document.getElementById("results").appendChild(item);
  }

  async function test(name, callback) {
    try { const detail = await callback(); results.push({ name, passed: true }); renderResult(name, true, detail || ""); }
    catch (error) { results.push({ name, passed: false, error }); renderResult(name, false, error.message || String(error)); }
    document.getElementById("progress").style.width = Math.min(100, Math.round(results.length / 17 * 100)) + "%";
  }

  async function run() {
    if (running) return;
    running = true; results.length = 0; document.getElementById("results").textContent = "";
    document.getElementById("status").textContent = "RUNNING"; document.getElementById("progress").style.width = "0";
    const params = S.Core.mergeParams({ duration_ms: 250 });

    await test("SHA-256 known answer", () => {
      equal(S.Core.sha256Hex(S.Core.utf8("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
      return "abc";
    });
    await test("Canonical JSON ordering", () => {
      equal(S.Core.stableStringify({ z: 1, a: { d: 2, b: 3 } }), '{"a":{"b":3,"d":2},"z":1}');
      let rejected = false; try { S.Core.stableStringify({ value: 0.5 }); } catch (_) { rejected = true; }
      assert(rejected, "Canonical JSON accepted a floating-point value");
    });
    await test("E8 root family cardinality", () => {
      equal(S.Core.ROOTS_DOUBLED.length, 240);
      equal(S.Core.ROOTS_DOUBLED.slice(0, 112).length, 112);
      equal(S.Core.ROOTS_DOUBLED.slice(112).length, 128);
      return "112 + 128 roots";
    });
    await test("E8 doubled-coordinate norm and parity", () => {
      const unique = new Set();
      S.Core.ROOTS_DOUBLED.forEach((root, index) => {
        equal(Array.from(root).reduce((sum, value) => sum + value * value, 0), 8, "Root norm failed at " + index);
        if (index >= 112) equal(Array.from(root).filter(value => value < 0).length % 2, 0, "Half-family parity failed at " + index);
        unique.add(Array.from(root).join(","));
      });
      equal(unique.size, 240, "Duplicate roots found");
    });
    await test("Strict φ-deep ladder golden vector", () => {
      const values = Array.from(S.Engine.baseFrequenciesStrict(params));
      equal(values.join(","), "3789,6130,9918,16048,25967,42016,67984,110000");
      return values.map(value => (value / 1000).toFixed(3)).join(" · ") + " Hz";
    });
    await test("PCM16 RIFF writer", () => {
      const encoded = S.Audio.encodePcm16(new Int16Array([0, 0, 32767, -32768]), 8000, 2);
      equal(encoded.wavBytes.length, 52); assert(S.Audio.validateWav(encoded.wavBytes), "WAV validation failed");
      equal(String.fromCharCode(...encoded.wavBytes.slice(0, 4)), "RIFF");
    });

    let strictA, strictB, replay, creativeA, creativeB;
    await test("Canonical Strict frozen render", async () => {
      strictA = await S.Provenance.renderJob(params, "sketch", S.MODES.STRICT, {});
      equal(strictA.identities.wav_sha256, "2bb9052e54bd323a5c316ba4171689e665dd426149201c73123ef6d345030b8b");
      return strictA.identities.wav_sha256.slice(0, 16) + "…";
    });
    await test("Repeated strict byte identity", async () => {
      strictB = await S.Provenance.renderJob(params, "sketch", S.MODES.STRICT, {});
      assert(bytesEqual(strictA.wavBytes, strictB.wavBytes), "Repeated WAV bytes differ");
      equal(strictA.identities.contract_sha256, strictB.identities.contract_sha256);
      equal(strictA.manifestCoreSha256, strictB.manifestCoreSha256);
    });
    await test("Mutation changes actual audio identity", async () => {
      const mutated = await S.Provenance.renderJob({ ...params, mutation_index: 1 }, "sketch", S.MODES.STRICT, {});
      assert(!bytesEqual(strictA.pcmBytes, mutated.pcmBytes), "Mutation left PCM unchanged");
      assert(strictA.identities.wav_sha256 !== mutated.identities.wav_sha256, "Mutation left WAV hash unchanged");
    });
    await test("Mode-domain recipe separation", async () => {
      replay = await S.Provenance.renderJob(params, "sketch", S.MODES.REPLAY, {});
      assert(strictA.recipeSha256 !== replay.recipeSha256, "Strict and Replay-Safe recipe identities collided");
      assert(strictA.contractSha256 !== replay.contractSha256, "Strict and Replay-Safe contracts collided");
    });
    await test("Replay-Safe runtime binding", () => {
      assert(replay.recipe.runtime_sha256, "Runtime hash is missing");
      equal(replay.recipe.runtime_sha256, S.Core.runtimeFingerprint().hash);
      equal(replay.contract.replay_requirements.scope, "same-recorded-runtime");
    });
    await test("Creative takes use fresh entropy", async () => {
      creativeA = await S.Provenance.renderJob(params, "sketch", S.MODES.CREATIVE, {});
      creativeB = await S.Provenance.renderJob(params, "sketch", S.MODES.CREATIVE, {});
      assert(creativeA.recipeSha256 !== creativeB.recipeSha256, "Creative recipe nonces matched");
      assert(creativeA.identities.wav_sha256 !== creativeB.identities.wav_sha256, "Creative WAV takes matched");
      equal(creativeA.recipe.creative_entropy.nonce_exported, false);
      equal(creativeA.contract.replay_requirements.exact_manifest_replay_supported, false);
    });
    await test("Manifest authentication rejects tampering", () => {
      const tampered = JSON.parse(JSON.stringify(strictA.manifest)); tampered.recipe.parameters.root_offset = 7;
      let rejected = false; try { S.Provenance.authenticateManifest(tampered); } catch (_) { rejected = true; }
      assert(rejected, "Tampered manifest was accepted");
    });
    await test("Strict manifest exact replay", async () => {
      const replayed = await S.Provenance.replayManifest(strictA.manifest, {});
      equal(replayed.identities.wav_sha256, strictA.identities.wav_sha256);
      equal(replayed.manifestCoreSha256, strictA.manifestCoreSha256);
    });
    await test("Trajectory receipt shape", () => {
      assert(strictA.trajectory.length >= 2, "Trajectory is empty");
      strictA.trajectory.forEach(point => {
        equal(point.theta_microturns.length, 8);
        point.theta_microturns.forEach(value => assert(Number.isSafeInteger(value) && value >= 0 && value < 1000000, "Invalid trajectory coordinate"));
      });
      return strictA.trajectory.length + " bounded points";
    });
    await test("Deterministic ZIP ordering", () => {
      const first = strictA.getZip(), second = strictB.getZip();
      assert(bytesEqual(first, second), "Repeated provenance ZIP bytes differ");
      equal(S.Core.sha256Hex(first), S.Core.sha256Hex(second));
    });
    await test("No remote production resources", () => {
      const remote = Array.from(document.querySelectorAll("[src],[href]")).map(node => node.getAttribute("src") || node.getAttribute("href")).filter(value => /^(?:https?:)?\/\//i.test(value || ""));
      equal(remote.length, 0, "Remote resource found: " + remote.join(", "));
    });

    const passed = results.filter(result => result.passed).length, failed = results.length - passed;
    document.getElementById("passed").textContent = passed;
    document.getElementById("failed").textContent = failed;
    document.getElementById("status").textContent = failed ? "FAILED" : "ALL PASS";
    document.getElementById("status").style.color = failed ? "#c66f68" : "#75b8ad";
    document.getElementById("progress").style.width = "100%";
    running = false;
  }

  global.addEventListener("DOMContentLoaded", () => {
    document.getElementById("run-tests").addEventListener("click", run);
    run();
  }, { once: true });
})(window);
