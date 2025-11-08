## 🎛️ Producer.ai Preset Pack --- "E8 Spectral Algebraics"

``` yaml
preset_pack:
  name: "E8 Spectral Algebraics"
  author: "Trent_Slade / QSOL IMC"
  version: "1.0"
  category: "Quantum / Fractal / Generative"
  color: "#8844ff"
  icon: "∞"
  description: |
    A tri-preset suite capturing the harmonic geometry of the E8 Fractal Power Module.
    Each preset uses φ-scaled frequency ladders, ternary qutrit morphing, and Coxeter-plane rotation
    to produce infinite, non-repeating pads, pulses, and drones. Tuned to the spectral signatures
    of the “Quantum Drift” demo from the Spectral Algebraics series.

  macros_default:
    PhiDrift: 0.02
    PhaseGain: 0.25
    AmpGain: 0.20
    TernaryBias: 0.10
    CosmicDepth: 5
    EnergyFlow: 1.0
    EntropyBloom: 0.02

  routing:
    - from: "E8_Fractal_Power.qutrit_morph"
      to: "Synth.waveshape"
    - from: "E8_Fractal_Power.node_phase"
      to: "Delay.feedback"
    - from: "E8_Fractal_Power.node_amplitude"
      to: "Reverb.mix"
    - from: "E8_Fractal_Power.stereo_out"
      to: "Master.audio_in"

  automation_groups:
    - name: "E8 Motion"
      color: "#7b3aff"
      params: ["PhiDrift", "CoxeterPhase", "EntropyBloom"]
    - name: "Spectral Shape"
      color: "#ffb84d"
      params: ["PhaseGain", "AmpGain", "TernaryBias"]
    - name: "Energy Domain"
      color: "#3ad7ff"
      params: ["CosmicDepth", "EnergyFlow"]

  presets:
    - name: "Coxeter Orbit"
      color: "#7b3aff"
      description: |
        Smooth φ-scaled pad orbiting within the Coxeter plane.
        Subtle rotation of E8 torus angles creates evolving stereo shimmer.
      macros:
        PhiDrift: 0.025
        CoxeterPhase: 0.785
        TernaryBias: 0.12
        EntropyBloom: 0.015
        CosmicDepth: 5
        PhaseGain: 0.22
        AmpGain: 0.18
      automation:
        PhiDrift:
          curve: sine
          rate: 0.02
        EntropyBloom:
          curve: noise
          depth: 0.005

    - name: "φ-Pulse Grit"
      color: "#ff6b00"
      description: |
        Rhythmic fractal texture emphasizing φ-scaled subharmonics and metallic edges.
        Great for motion beds and hybrid percussion.
      macros:
        CosmicDepth: 4
        PhaseGain: 0.35
        AmpGain: 0.22
        TernaryBias: -0.10
        PhiDrift: 0.02
        EntropyBloom: 0.010
      automation:
        PhaseGain:
          curve: ramp
          rate: 0.1
        TernaryBias:
          curve: step
          values: [-0.1, 0.0, 0.1]

    - name: "E8 Pad Swell"
      color: "#44ffaa"
      description: |
        Expansive stereo pad with continuous spectral ascent.
        Gentle qutrit morphing produces rich, shimmering highs.
      macros:
        CosmicDepth: 7
        PhiDrift: 0.03
        EntropyBloom: 0.02
        PhaseGain: 0.25
        AmpGain: 0.18
        TernaryBias: 0.10
      automation:
        PhiDrift:
          curve: slow_sine
          rate: 0.015
        EnergyFlow:
          curve: pulse
          rate: 0.05
```
