# Browser-Native APP Instructions

The authoritative contributor instructions for this directory are in [`AGENTS.md`](AGENTS.md).

SPECTRAL APP 2.0 is a dependency-free, client-only DHTML application opened directly through `file://`. Earlier Python, NumPy, Pillow, localhost API, filesystem-artifact, and pytest architecture notes are obsolete for `APP/` and must not be reintroduced.

The non-negotiable source of truth is:

```text
generated PCM bytes → canonical WAV bytes → hashes → observation contract
```

Read `README.md` for the user architecture and `AGENTS.md` before changing implementation or strict golden vectors.
