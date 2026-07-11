(function defineStorage(S) {
  "use strict";

  const DATABASE_NAME = "spectral-workbench-v2";
  const JOB_LIMIT = 24;
  let database = null;
  let persistent = false;
  const memory = { jobs: new Map(), presets: new Map() };

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }

  async function open() {
    if (database) return { persistent };
    if (typeof indexedDB === "undefined") return { persistent: false, reason: "IndexedDB is unavailable for this file origin." };
    try {
      const request = indexedDB.open(DATABASE_NAME, S.APP.databaseVersion);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("jobs")) {
          const jobs = db.createObjectStore("jobs", { keyPath: "id" });
          jobs.createIndex("localCreatedAt", "localCreatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("presets")) db.createObjectStore("presets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("contracts")) db.createObjectStore("contracts", { keyPath: "id" });
        if (!db.objectStoreNames.contains("fingerprints")) db.createObjectStore("fingerprints", { keyPath: "id" });
      };
      database = await requestPromise(request);
      const probe = { id: "__storage_probe__", value: "ok" };
      let transaction = database.transaction("presets", "readwrite");
      transaction.objectStore("presets").put(probe);
      await transactionPromise(transaction);
      transaction = database.transaction("presets", "readwrite");
      transaction.objectStore("presets").delete(probe.id);
      await transactionPromise(transaction);
      persistent = true;
      return { persistent: true };
    } catch (error) {
      database = null;
      persistent = false;
      return { persistent: false, reason: error.message || "IndexedDB rejected this file origin." };
    }
  }

  function serializableJob(job) {
    return {
      id: job.id,
      name: job.name,
      engineId: job.engineId,
      engineName: job.engineName,
      engineVersion: job.engineVersion,
      mode: job.mode,
      profileId: job.profileId,
      profileName: job.profileName,
      durationSeconds: job.durationSeconds,
      sampleRate: job.sampleRate,
      channels: job.channels,
      seed: job.seed,
      mutationIndex: job.mutationIndex,
      parameters: job.parameters,
      sourceDescriptor: job.sourceDescriptor,
      recipe: job.recipe,
      recipeHash: job.recipeHash,
      contract: job.contract,
      contractHash: job.contractHash,
      fingerprint: job.fingerprint,
      fingerprintHash: job.fingerprintHash,
      readiness: job.readiness,
      derivation: job.derivation,
      origin: job.origin,
      manifest: job.manifest,
      manifestCoreHash: job.manifestCoreHash,
      runtime: job.runtime,
      catalogObservation: job.catalogObservation,
      wavBytes: job.wavBytes.slice().buffer,
      pcmHash: job.pcmHash,
      wavHash: job.wavHash,
      localCreatedAt: job.localCreatedAt || new Date().toISOString()
    };
  }

  function rehydrate(job) {
    if (!job) return null;
    const copy = Object.assign({}, job);
    copy.wavBytes = job.wavBytes instanceof Uint8Array ? job.wavBytes : new Uint8Array(job.wavBytes);
    copy.pcmBytes = job.pcmBytes
      ? (job.pcmBytes instanceof Uint8Array ? job.pcmBytes : new Uint8Array(job.pcmBytes))
      : copy.wavBytes.slice(44);
    copy.bundleBytes = job.bundleBytes
      ? (job.bundleBytes instanceof Uint8Array ? job.bundleBytes : new Uint8Array(job.bundleBytes))
      : S.Audio.Zip.create([
          { name: "README_ORIGIN.txt", bytes: S.Core.utf8(copy.origin) },
          { name: "audio.wav", bytes: copy.wavBytes },
          { name: "derivation_graph.json", bytes: S.Provenance.outputBytes(copy.derivation) },
          { name: "fingerprint.json", bytes: S.Provenance.outputBytes(copy.fingerprint) },
          { name: "manifest.json", bytes: S.Provenance.outputBytes(copy.manifest) },
          { name: "upload_readiness.json", bytes: S.Provenance.outputBytes(copy.readiness) }
        ]);
    return copy;
  }

  async function saveJob(job) {
    const record = serializableJob(job);
    if (!persistent) {
      memory.jobs.set(record.id, record);
      return rehydrate(record);
    }
    let readTransaction = database.transaction("jobs", "readonly");
    const existing = await requestPromise(readTransaction.objectStore("jobs").getAll());
    await transactionPromise(readTransaction);
    const alreadyStored = existing.some(item => item.id === record.id);
    const overflow = Math.max(0, existing.length + (alreadyStored ? 0 : 1) - JOB_LIMIT);
    const victims = existing.filter(item => item.id !== record.id).sort((a, b) => String(a.localCreatedAt).localeCompare(String(b.localCreatedAt))).slice(0, overflow);
    let transaction = database.transaction(["jobs", "contracts", "fingerprints"], "readwrite");
    const jobStore = transaction.objectStore("jobs");
    const contractStore = transaction.objectStore("contracts");
    const fingerprintStore = transaction.objectStore("fingerprints");
    for (const old of victims) {
      jobStore.delete(old.id);
      contractStore.delete(old.contractHash);
      fingerprintStore.delete(old.fingerprintHash);
    }
    jobStore.put(record);
    contractStore.put({ id: record.contractHash, jobId: record.id, contract: record.contract });
    fingerprintStore.put({ id: record.fingerprintHash, jobId: record.id, wavHash: record.wavHash, fingerprint: record.fingerprint });
    await transactionPromise(transaction);
    return rehydrate(record);
  }

  async function listJobs() {
    let records;
    if (!persistent) records = Array.from(memory.jobs.values());
    else {
      const transaction = database.transaction("jobs", "readonly");
      records = await requestPromise(transaction.objectStore("jobs").getAll());
      await transactionPromise(transaction);
    }
    return records.map(rehydrate).sort((a, b) => String(b.localCreatedAt).localeCompare(String(a.localCreatedAt)));
  }

  async function getJob(id) {
    if (!persistent) return rehydrate(memory.jobs.get(id));
    const transaction = database.transaction("jobs", "readonly");
    const result = await requestPromise(transaction.objectStore("jobs").get(id));
    await transactionPromise(transaction);
    return rehydrate(result);
  }

  async function clearJobs() {
    if (!persistent) {
      memory.jobs.clear();
      return;
    }
    const transaction = database.transaction(["jobs", "contracts", "fingerprints"], "readwrite");
    transaction.objectStore("jobs").clear();
    transaction.objectStore("contracts").clear();
    transaction.objectStore("fingerprints").clear();
    await transactionPromise(transaction);
  }

  async function savePreset(preset) {
    if (!persistent) {
      memory.presets.set(preset.id, preset);
      return;
    }
    const transaction = database.transaction("presets", "readwrite");
    transaction.objectStore("presets").put(preset);
    await transactionPromise(transaction);
  }

  async function listPresets() {
    if (!persistent) return Array.from(memory.presets.values());
    const transaction = database.transaction("presets", "readonly");
    const result = await requestPromise(transaction.objectStore("presets").getAll());
    await transactionPromise(transaction);
    return result.filter(item => item.id !== "__storage_probe__");
  }

  async function deletePreset(id) {
    if (!persistent) {
      memory.presets.delete(id);
      return;
    }
    const transaction = database.transaction("presets", "readwrite");
    transaction.objectStore("presets").delete(id);
    await transactionPromise(transaction);
  }

  async function selfTestRoundTrip() {
    if (typeof indexedDB === "undefined") return { supported: false, passed: false, reason: "IndexedDB unavailable" };
    const testName = DATABASE_NAME + "-isolated-selftest";
    let testDb = null;
    try {
      await new Promise(resolve => {
        const deletion = indexedDB.deleteDatabase(testName);
        deletion.onsuccess = deletion.onerror = deletion.onblocked = () => resolve();
      });
      const openRequest = indexedDB.open(testName, 1);
      openRequest.onupgradeneeded = event => event.target.result.createObjectStore("roundtrip", { keyPath: "id" });
      testDb = await requestPromise(openRequest);
      const wavBytes = new Uint8Array([82,73,70,70,4,0,0,0,87,65,86,69]);
      const record = {
        id: "full-job-probe",
        contract: { contract_sha256: "a".repeat(64), mode: "canonical_strict" },
        fingerprint: { fingerprint_sha256: "b".repeat(64) },
        manifest: { schema: "spectral-manifest-v2" },
        wavBytes: wavBytes.buffer,
        pcmBytes: new Uint8Array([0,128,255,127]).buffer,
        bundleBytes: new Uint8Array([80,75,5,6]).buffer
      };
      let transaction = testDb.transaction("roundtrip", "readwrite");
      transaction.objectStore("roundtrip").put(record);
      await transactionPromise(transaction);
      testDb.close();
      testDb = await requestPromise(indexedDB.open(testName, 1));
      transaction = testDb.transaction("roundtrip", "readonly");
      const restored = await requestPromise(transaction.objectStore("roundtrip").get(record.id));
      await transactionPromise(transaction);
      const restoredWav = new Uint8Array(restored.wavBytes);
      if (restored.contract.contract_sha256 !== record.contract.contract_sha256 || restoredWav.length !== wavBytes.length) throw new Error("IndexedDB full-job fields changed during round trip");
      for (let i = 0; i < wavBytes.length; i += 1) if (restoredWav[i] !== wavBytes[i]) throw new Error("IndexedDB WAV bytes changed at offset " + i);
      testDb.close();
      testDb = null;
      await new Promise((resolve, reject) => {
        const deletion = indexedDB.deleteDatabase(testName);
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => reject(deletion.error || new Error("Could not delete isolated self-test database"));
        deletion.onblocked = () => reject(new Error("Isolated self-test database deletion was blocked"));
      });
      return { supported: true, passed: true };
    } catch (error) {
      if (testDb) testDb.close();
      return { supported: true, passed: false, reason: error.message || String(error) };
    }
  }

  async function prepareReloadSelfTest() {
    if (typeof indexedDB === "undefined") return { supported: false, passed: false, reason: "IndexedDB unavailable" };
    const name = DATABASE_NAME + "-reload-selftest";
    await new Promise(resolve => {
      const deletion = indexedDB.deleteDatabase(name);
      deletion.onsuccess = deletion.onerror = deletion.onblocked = () => resolve();
    });
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = event => event.target.result.createObjectStore("jobs", { keyPath: "id" });
    const db = await requestPromise(request);
    const sentinel = {
      id: "reload-probe",
      contractHash: "c".repeat(64),
      wavHash: "d".repeat(64),
      wavBytes: new Uint8Array([82,73,70,70,12,0,0,0,87,65,86,69,102,109,116,32]).buffer,
      pcmBytes: new Uint8Array([0,128,0,0,255,127]).buffer,
      bundleBytes: new Uint8Array([80,75,5,6]).buffer
    };
    const transaction = db.transaction("jobs", "readwrite");
    transaction.objectStore("jobs").put(sentinel);
    await transactionPromise(transaction);
    db.close();
    return { supported: true, passed: true };
  }

  async function verifyReloadSelfTest() {
    if (typeof indexedDB === "undefined") return { supported: false, passed: false, reason: "IndexedDB unavailable after reload" };
    const name = DATABASE_NAME + "-reload-selftest";
    let db = null;
    try {
      db = await requestPromise(indexedDB.open(name, 1));
      if (!db.objectStoreNames.contains("jobs")) throw new Error("Reload self-test store disappeared");
      const transaction = db.transaction("jobs", "readonly");
      const sentinel = await requestPromise(transaction.objectStore("jobs").get("reload-probe"));
      await transactionPromise(transaction);
      if (!sentinel || sentinel.contractHash !== "c".repeat(64) || sentinel.wavHash !== "d".repeat(64)) throw new Error("Reload sentinel metadata did not persist");
      const wav = new Uint8Array(sentinel.wavBytes);
      if (wav.length !== 16 || wav[0] !== 82 || wav[15] !== 32) throw new Error("Reload sentinel WAV bytes did not persist");
      db.close();
      db = null;
      await new Promise((resolve, reject) => {
        const deletion = indexedDB.deleteDatabase(name);
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => reject(deletion.error || new Error("Reload self-test cleanup failed"));
        deletion.onblocked = () => reject(new Error("Reload self-test cleanup was blocked"));
      });
      return { supported: true, passed: true };
    } catch (error) {
      if (db) db.close();
      return { supported: true, passed: false, reason: error.message || String(error) };
    }
  }

  S.Storage.Database = Object.freeze({ open, saveJob, listJobs, getJob, clearJobs, savePreset, listPresets, deletePreset, selfTestRoundTrip, prepareReloadSelfTest, verifyReloadSelfTest, isPersistent: () => persistent });
})(window.SPECTRAL);
