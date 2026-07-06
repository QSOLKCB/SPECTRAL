#!/usr/bin/env python3
"""
Simplified M87* E8 Fractal Sonification (fast version)
Sonifies spin-asymmetry data from Bernshteyn+ 2026 using:
- E8-inspired 8 partial additive chords (φ + √2 ratios + triality phases)
- Weierstrass fractal turbulence matching paper's a1 fluctuations
- 432 Hz tuning
- Data: 13 spin values → chords with pitch/volume from μ(a1) and data-fit
- Observed a1 accents as bright events
- Background fractal texture for GRMHD/MAD turbulence
- Stereo asymmetry from a1
"""

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import gaussian_filter1d

SR = 22050
DUR = 55
T = np.linspace(0, DUR, int(SR * DUR), endpoint=False)
PHI = (1 + np.sqrt(5)) / 2
SQRT2 = np.sqrt(2)

def midi_to_f(m): return 432 * 2**((m-69)/12)

SPINS = np.array([-0.97,-0.9375,-0.85,-0.75,-0.5,-0.25,0.,0.25,0.5,0.75,0.85,0.9375,0.97])
MUS = np.array([0.653,0.609,0.567,0.485,0.382,0.324,0.278,0.378,0.525,0.573,0.630,0.645,0.675])
SIGS = np.array([0.203,0.178,0.193,0.210,0.188,0.168,0.181,0.172,0.201,0.209,0.213,0.220,0.198])

def fitness(a): return 0.1 + 0.32*np.exp(-((abs(a)-0.55)**2)/0.9) + 0.1*(abs(a)/0.97)

def weier(t, n=5, a=0.6, b=2.1, sd=42):
    np.random.seed(sd)
    s = np.zeros_like(t)
    ph = np.random.uniform(0,2*np.pi)
    for k in range(n):
        s += (a**k) * np.sin((b**k)*t*2*np.pi*0.75 + ph*(k+1))
    return s / n

def e8_ratios():
    r = np.array([1.0, PHI*0.5, SQRT2*0.72, 1.5, PHI, PHI+0.45, 1.88, 2.4])
    np.random.seed(42)
    return r * (1 + np.random.uniform(-0.006,0.006,8)*(1+np.arange(8)*0.04))

OBS_T = {9:0.41, 22:0.69, 36:0.53}  # observed a1 times

print("Building M87 E8 sonification (fast)...")

L = np.zeros(len(T))
R = np.zeros(len(T))

# Background turbulence (MAD plasma + fractal)
np.random.seed(2026)
bg = weier(T, n=5, a=0.52, b=2.4, sd=7) + 0.6*weier(T*0.4, n=4, a=0.45, b=2.9, sd=11)
bg = gaussian_filter1d(bg, sigma=SR*1.2) * 0.28
gasym = 0.38 + 0.16*np.tanh((T-25)/18)
bg *= (0.5 + 0.5*gasym)
bg = np.tanh(bg*1.6)*0.22
w = 0.28 + 0.45*gasym
L += bg * (0.55 + 0.45*w)
R += bg * (0.55 - 0.45*w)

# 13 E8 chords
ctimes = np.linspace(4.5, 48, 13)
cdur = 3.2
for i, (a, mu, sg) in enumerate(zip(SPINS, MUS, SIGS)):
    t0 = ctimes[i]
    msk = (T >= t0) & (T < t0+cdur)
    if not np.any(msk): continue
    ts = T[msk]
    tr = ts - t0
    basef = midi_to_f(47 + int(16*(mu-0.27)/0.4))
    rats = e8_ratios()
    pamps = np.array([0.95,0.82,0.7,0.62,0.52,0.46,0.4,0.36]) * (0.5 + 0.5*mu)
    sd = int(1000*mu + 400*sg) % 100000
    fmod = weier(tr, n=5, a=0.55+0.1*sg, b=2.0, sd=sd)
    fs = basef * rats[:,None]
    phs = 2*np.pi*fs*ts + (np.arange(8)[:,None]*np.pi/3.6)
    amps = pamps[:,None] * (0.6 + 0.4*(1 + fmod*(0.3+0.7*sg)))
    prts = amps * np.sin(phs)
    pans = 0.5 + 0.3*(mu-0.5)*np.sin(2*np.pi*0.02*tr + np.arange(8)[:,None]*0.6)
    ll = np.sum(prts*(1-pans),0)
    rr = np.sum(prts*pans,0)
    env = np.ones(len(ts))
    atk = max(2,int(0.06*SR)); rel = max(2,int(0.1*SR))
    env[:atk] = np.linspace(0,1,atk)**1.6
    env[-rel:] = np.linspace(1,0,rel)**1.6
    env *= (0.8 + 0.2*weier(tr+6, n=3, a=0.65, b=1.5, sd=sd+3))
    v = 0.18 * fitness(a) * (0.6 + 0.4*mu)
    L[msk] += ll*env*v
    R[msk] += rr*env*v

# Observed accents
for to, a1 in OBS_T.items():
    msk = (T >= to-0.05) & (T < to+1.6)
    if not np.any(msk): continue
    ts = T[msk]; tr = ts-to
    fb = midi_to_f(56 + int(14*(a1-0.3)))
    rats = e8_ratios()
    sig = np.zeros(len(ts))
    for j,r in enumerate(rats):
        f = fb * r * (1+0.008*np.sin(2*np.pi*4*tr))
        sig += (0.85-0.07*j)*(0.35+0.65*a1) * np.sin(2*np.pi*f*tr + j*1.0)
    env = np.exp(-4*(tr)) * (1 + 0.35*weier(tr, n=3, a=0.48, b=2.8, sd=99))
    env[:max(1,int(0.015*SR))] = np.linspace(0,1,max(1,int(0.015*SR)))**0.6
    sig *= env * 0.38
    pan = 0.62 if a1>0.5 else 0.42
    L[msk] += sig*(1-pan)*1.05
    R[msk] += sig*pan

# Low drone (nonzero spin favored)
dr = 0.07*np.sin(2*np.pi*27*T) * (0.55 + 0.35*np.tanh((T-30)/20))
dr += 0.035*np.sin(2*np.pi*27*PHI*T) * (0.4 + 0.25*weier(T*0.15, n=3, a=0.6, b=1.7, sd=5))
L += dr*0.65
R += dr*0.65

# Normalize + fades
mx = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-6)
L /= mx*1.08; R /= mx*1.08
fi = int(1.2*SR); fo=fi
L[:fi] *= np.linspace(0,1,fi)**2; R[:fi] *= np.linspace(0,1,fi)**2
L[-fo:] *= np.linspace(1,0,fo)**2; R[-fo:] *= np.linspace(1,0,fo)**2

out = np.stack([L,R],1).astype(np.float32)
wavfile.write("/home/workdir/artifacts/M87_E8_Fractal_Sonification.wav", SR, (out*32767).astype(np.int16))
print("✓ Wrote /home/workdir/artifacts/M87_E8_Fractal_Sonification.wav")
print(f"  {DUR}s @ {SR}Hz stereo | E8 8-partial chords + Weierstrass fractal turbulence")
print("  Data mapped: spin sequence → pitch/brightness/volume from μ + KS-fit proxy; observed a1 as spatial accents")