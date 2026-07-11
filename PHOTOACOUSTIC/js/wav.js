(function (root) {
  "use strict";
  const PA = root.PHOTOACOUSTIC;
  const C = PA.Core;

  function fourCC(view, offset) {
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
  }
  function quantizePcm16(value) {
    if (!Number.isFinite(value)) throw new TypeError("Non-finite audio sample");
    if (value <= -1) return -32768;
    if (value >= 1) return 32767;
    const scaled = value < 0 ? value * 32768 : value * 32767;
    return scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  }
  function pcmBytes(samples) {
    const out = new Uint8Array(samples.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < samples.length; i += 1) view.setInt16(i * 2, samples[i], true);
    return out;
  }
  function encodePcm16(samples, sampleRate, channels) {
    if (!(samples instanceof Int16Array)) throw new TypeError("PCM writer requires Int16Array");
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError("Invalid sample rate");
    if (!Number.isInteger(channels) || channels < 1 || channels > 8 || samples.length % channels) throw new RangeError("Invalid channel layout");
    const pcm = pcmBytes(samples);
    const wav = new Uint8Array(44 + pcm.length);
    const view = new DataView(wav.buffer);
    function writeText(offset, text) { for (let i=0;i<text.length;i+=1) view.setUint8(offset+i,text.charCodeAt(i)); }
    writeText(0,"RIFF"); view.setUint32(4,36+pcm.length,true); writeText(8,"WAVE");
    writeText(12,"fmt "); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*channels*2,true); view.setUint16(32,channels*2,true); view.setUint16(34,16,true);
    writeText(36,"data"); view.setUint32(40,pcm.length,true); wav.set(pcm,44);
    return {wavBytes:wav,pcmBytes:pcm};
  }
  function validate(bytes) {
    try { parse(bytes, {decode:false}); return true; } catch (_) { return false; }
  }

  function parse(input, options) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const decode = !options || options.decode !== false;
    if (bytes.length < 44) throw new Error("WAV is shorter than the canonical header");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (fourCC(view,0)!=="RIFF" || fourCC(view,8)!=="WAVE") throw new Error("Only RIFF/WAVE files are supported");
    const declared = view.getUint32(4,true) + 8;
    if (declared < 12 || declared > bytes.length) throw new Error("Truncated or invalid RIFF container");
    let offset=12, format=null, dataOffset=-1, dataSize=0;
    while (offset + 8 <= declared) {
      const id=fourCC(view,offset), size=view.getUint32(offset+4,true), body=offset+8;
      if (body + size > declared) throw new Error("Truncated WAV chunk: "+id);
      if (id === "fmt ") {
        if (format) throw new Error("Multiple fmt chunks are not canonical");
        if (size < 16) throw new Error("Invalid fmt chunk");
        format={audioFormat:view.getUint16(body,true),channels:view.getUint16(body+2,true),sampleRate:view.getUint32(body+4,true),byteRate:view.getUint32(body+8,true),blockAlign:view.getUint16(body+12,true),bitsPerSample:view.getUint16(body+14,true)};
      } else if (id === "data") { if(dataOffset>=0)throw new Error("Multiple data chunks are not canonical");dataOffset=body;dataSize=size; }
      const next=body+size+(size&1);if(next>declared)throw new Error("Missing RIFF padding byte");offset=next;
    }
    if (!format || dataOffset < 0) throw new Error("WAV requires fmt and data chunks");
    const f=format;
    if (![1,3].includes(f.audioFormat)) throw new Error("Unsupported WAV codec; use PCM or IEEE Float");
    if (f.channels<1 || f.channels>8) throw new Error("WAV channel count must be 1–8");
    if (f.sampleRate<8000 || f.sampleRate>192000) throw new Error("WAV sample rate must be 8–192 kHz");
    const validBits=f.audioFormat===1?[8,16,24,32]:[32,64];
    if (!validBits.includes(f.bitsPerSample)) throw new Error("Unsupported WAV bit depth");
    const bytesPerSample=f.bitsPerSample/8, expectedAlign=f.channels*bytesPerSample;
    if (f.blockAlign!==expectedAlign || f.byteRate!==f.sampleRate*expectedAlign) throw new Error("Inconsistent WAV alignment or byte rate");
    if (dataSize % expectedAlign) throw new Error("WAV data is not frame aligned");
    const frames=dataSize/expectedAlign;
    if (!frames) throw new Error("WAV contains no audio frames");
    const metadata={format:f.audioFormat===1?"pcm":"float",channels:f.channels,sampleRate:f.sampleRate,bitsPerSample:f.bitsPerSample,frames,duration:frames/f.sampleRate,strictCompatible:f.audioFormat===1};
    if (!decode) return metadata;
    const mono=new Float64Array(frames), monoQ15=new Int32Array(frames);
    function pcmValue(at) {
      if (f.audioFormat===3) {
        const value=f.bitsPerSample===32?view.getFloat32(at,true):view.getFloat64(at,true);
        if (!Number.isFinite(value)) throw new Error("Float WAV contains a non-finite sample");
        return {float:C.clamp(value,-1,1),q15:quantizePcm16(value)};
      }
      if (f.bitsPerSample===8) { const raw=view.getUint8(at)-128; return {float:raw/128,q15:raw*256}; }
      if (f.bitsPerSample===16) { const raw=view.getInt16(at,true); return {float:raw/32768,q15:raw}; }
      if (f.bitsPerSample===24) {
        let raw=view.getUint8(at)|(view.getUint8(at+1)<<8)|(view.getUint8(at+2)<<16); if(raw&0x800000) raw|=0xff000000;
        return {float:raw/8388608,q15:C.clampInt(C.roundDiv(raw,256),-32768,32767)};
      }
      const raw=view.getInt32(at,true); return {float:raw/2147483648,q15:C.clampInt(C.roundDiv(raw,65536),-32768,32767)};
    }
    for(let frame=0;frame<frames;frame+=1){
      let sum=0,sumQ=0; const base=dataOffset+frame*expectedAlign;
      for(let channel=0;channel<f.channels;channel+=1){const value=pcmValue(base+channel*bytesPerSample);sum+=value.float;sumQ+=value.q15;}
      mono[frame]=sum/f.channels; monoQ15[frame]=C.roundDiv(sumQ,f.channels);
    }
    return Object.assign(metadata,{samples:mono,samplesQ15:monoQ15});
  }

  function resampleFloat(input, sourceRate, targetRate) {
    if(sourceRate===targetRate) return new Float64Array(input);
    const length=Math.max(2,Math.round(input.length*targetRate/sourceRate)), out=new Float64Array(length);
    for(let i=0;i<length;i+=1){const position=i*sourceRate/targetRate;const index=Math.floor(position),fraction=position-index;const a=input[Math.min(index,input.length-1)],b=input[Math.min(index+1,input.length-1)];out[i]=a+(b-a)*fraction;}
    return out;
  }
  function resampleStrict(input, sourceRate, targetRate) {
    if(sourceRate===targetRate) return new Int32Array(input);
    const length=Number((BigInt(input.length)*BigInt(targetRate)+BigInt(sourceRate)/2n)/BigInt(sourceRate)),out=new Int32Array(Math.max(2,length));
    for(let i=0;i<out.length;i+=1){const numerator=BigInt(i)*BigInt(sourceRate),index=Number(numerator/BigInt(targetRate)),fraction=Number(numerator%BigInt(targetRate));const a=input[Math.min(index,input.length-1)],b=input[Math.min(index+1,input.length-1)];out[i]=C.roundDiv(a*(targetRate-fraction)+b*fraction,targetRate);}
    return out;
  }

  const crcTable=new Uint32Array(256);
  for(let n=0;n<256;n+=1){let c=n;for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&0xff]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  function zip(entries) {
    const normalized=entries.map(entry=>({name:String(entry.name),nameBytes:C.utf8(entry.name),bytes:entry.bytes instanceof Uint8Array?entry.bytes:new Uint8Array(entry.bytes)})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
    const locals=[],centrals=[];let offset=0;
    for(const entry of normalized){
      const crc=crc32(entry.bytes),local=new Uint8Array(30+entry.nameBytes.length+entry.bytes.length),lv=new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,0,true);lv.setUint16(12,0x0021,true);lv.setUint32(14,crc,true);lv.setUint32(18,entry.bytes.length,true);lv.setUint32(22,entry.bytes.length,true);lv.setUint16(26,entry.nameBytes.length,true);lv.setUint16(28,0,true);local.set(entry.nameBytes,30);local.set(entry.bytes,30+entry.nameBytes.length);locals.push(local);
      const central=new Uint8Array(46+entry.nameBytes.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0x0021,true);cv.setUint32(16,crc,true);cv.setUint32(20,entry.bytes.length,true);cv.setUint32(24,entry.bytes.length,true);cv.setUint16(28,entry.nameBytes.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);central.set(entry.nameBytes,46);centrals.push(central);offset+=local.length;
    }
    const centralSize=centrals.reduce((sum,value)=>sum+value.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,normalized.length,true);ev.setUint16(10,normalized.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
    return C.concatBytes(...locals,...centrals,end);
  }

  PA.Audio = Object.freeze({quantizePcm16,pcmBytes,encodePcm16,validate,parse,resampleFloat,resampleStrict,crc32,zip});
})(window);
