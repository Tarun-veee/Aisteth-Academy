/**
 * Generates local demo PCM WAV files for offline audio discrimination training.
 * Creates rhythmic lub-dub pulses (Clear S1/S2) and noisy/friction artifact audio.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWavBuffer(sampleRate, durationSec, sampleGenerator) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const blockAlign = 2; // 16-bit mono = 2 bytes
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // numChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bitsPerSample (16)

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = sampleGenerator(t);
    // Clamp to -1.0 .. +1.0
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

const sampleRate = 22050;
const duration = 6.0; // 6 seconds demo

// 1. Clear Normal S1-S2 Heart Sound (approx 72 BPM -> period ~ 0.83s)
// S1 (lub) at t=0, S2 (dub) at t=0.3s
function normalHeartSound(t) {
  const period = 0.833;
  const cycleT = t % period;
  let signal = 0;

  // S1 (Lub): 60-80 Hz decaying sine wave
  if (cycleT >= 0 && cycleT < 0.12) {
    const env = Math.sin((cycleT / 0.12) * Math.PI);
    signal += 0.85 * env * Math.sin(2 * Math.PI * 65 * cycleT);
  }

  // S2 (Dub): 85-110 Hz slightly higher pitch, shorter duration
  if (cycleT >= 0.28 && cycleT < 0.38) {
    const dt = cycleT - 0.28;
    const env = Math.sin((dt / 0.10) * Math.PI);
    signal += 0.70 * env * Math.sin(2 * Math.PI * 95 * dt);
  }

  // Very slight quiet baseline
  signal += (Math.random() - 0.5) * 0.01;
  return signal;
}

// 2. Noisy Recording (Severe clothing friction & room noise)
function noisyRecording(t) {
  let signal = normalHeartSound(t) * 0.3; // Muffled heartbeat
  // Heavy friction noise bursts
  const friction = (Math.random() - 0.5) * 0.6 * Math.sin(t * 12);
  signal += friction + (Math.random() - 0.5) * 0.25;
  return signal;
}

// 3. Faint Recording (Poor diaphragm contact / weak acoustic capture)
function faintRecording(t) {
  let signal = normalHeartSound(t) * 0.15; // Barely audible
  signal += (Math.random() - 0.5) * 0.08; // Ambient room noise dominates
  return signal;
}

const outDir = path.resolve(__dirname, '../public/assets/audio');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'demo_clear_normal_s1s2.mp3'), createWavBuffer(sampleRate, duration, normalHeartSound));
fs.writeFileSync(path.join(outDir, 'demo_noisy_recording.mp3'), createWavBuffer(sampleRate, duration, noisyRecording));
fs.writeFileSync(path.join(outDir, 'demo_faint_recording.mp3'), createWavBuffer(sampleRate, duration, faintRecording));

console.log('Successfully generated offline demo audio files in public/assets/audio/');
