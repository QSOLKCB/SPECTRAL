(function defineEngineRegistry(S) {
  "use strict";

  const engines = new Map();

  function normalizeField(field, rawValue) {
    const value = rawValue == null || rawValue === "" ? field.default : rawValue;
    if (field.type === "select") {
      const text = String(value);
      if (!field.options.some(option => option.value === text)) throw new RangeError("Invalid value for " + field.id);
      return text;
    }
    if (field.type === "boolean") return value === true || value === "true" || value === "1" || value === 1;
    const scale = field.scale || 1;
    const scaled = S.Core.decimalToScaled(value, scale);
    const minimum = S.Core.decimalToScaled(field.min, scale);
    const maximum = S.Core.decimalToScaled(field.max, scale);
    if (scaled < minimum || scaled > maximum) throw new RangeError(field.label + " is outside its supported range");
    return scaled;
  }

  function normalizeParameters(engine, raw) {
    const normalized = {};
    for (const field of engine.parameterSchema) normalized[field.id] = normalizeField(field, raw[field.id]);
    return normalized;
  }

  function validateNormalizedParameters(engine, candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new TypeError("Manifest parameters must be a canonical object");
    const expectedKeys = engine.parameterSchema.map(field => field.id).sort();
    const actualKeys = Object.keys(candidate).sort();
    if (expectedKeys.join("\0") !== actualKeys.join("\0")) throw new TypeError("Manifest parameter schema does not match the engine version");
    const normalized = {};
    for (const field of engine.parameterSchema) {
      const value = candidate[field.id];
      if (field.type === "select") {
        if (typeof value !== "string" || !field.options.some(option => option.value === value)) throw new RangeError("Invalid normalized value for " + field.id);
      } else if (field.type === "boolean") {
        if (typeof value !== "boolean") throw new TypeError("Invalid normalized boolean for " + field.id);
      } else {
        const scale = field.scale || 1;
        const minimum = S.Core.decimalToScaled(field.min, scale);
        const maximum = S.Core.decimalToScaled(field.max, scale);
        if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError("Invalid normalized integer for " + field.id);
      }
      normalized[field.id] = value;
    }
    return normalized;
  }

  function register(engine) {
    const required = ["id", "name", "version", "description", "parameterSchema", "supportedModes", "presets", "buildPlan"];
    for (const key of required) if (!(key in engine)) throw new TypeError("Engine is missing " + key);
    if (!/^[a-z0-9_]+$/.test(engine.id)) throw new TypeError("Engine ID must be canonical snake_case");
    if (engines.has(engine.id)) throw new Error("Duplicate engine ID: " + engine.id);
    const descriptor = Object.freeze(Object.assign({}, engine, {
      parameterSchema: Object.freeze(engine.parameterSchema.map(field => Object.freeze(field))),
      supportedModes: Object.freeze(engine.supportedModes.slice()),
      presets: Object.freeze(engine.presets.map(preset => Object.freeze(preset)))
    }));
    engines.set(engine.id, descriptor);
    return descriptor;
  }

  function get(id) {
    const engine = engines.get(id);
    if (!engine) throw new Error("Unknown engine: " + id);
    return engine;
  }

  function list() {
    return Array.from(engines.values());
  }

  function defaults(engine) {
    const output = {};
    for (const field of engine.parameterSchema) output[field.id] = field.default;
    return output;
  }

  function displayParameters(engine, normalized) {
    const output = {};
    for (const field of engine.parameterSchema) {
      const value = normalized[field.id];
      if (field.type === "select" || field.type === "boolean") output[field.id] = value;
      else if ((field.scale || 1) === 1) output[field.id] = String(value);
      else output[field.id] = (value / field.scale).toFixed(12).replace(/\.?0+$/, "");
    }
    return output;
  }

  S.Engines.Registry = Object.freeze({ register, get, list, defaults, normalizeParameters, validateNormalizedParameters, displayParameters });
})(window.SPECTRAL);
