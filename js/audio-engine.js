/**
 * Procedural Weather Web Audio Engine
 * Pure mathematical sound synthesis (no external audio files required)
 * Synthesizes realistic rain, thunder rumbles, wind gusts, night crickets, and daytime bird chirps.
 */
class WeatherAudioEngine {
	constructor() {
		this.ctx = null;
		this.masterGain = null;
		this.currentMode = null;
		this.isPlaying = false;
		this.volume = 0.35;

		// Active sound nodes
		this.activeNodes = [];
		this.intervalTimers = [];
	}

	initAudioContext() {
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			this.ctx = new AudioCtx();

			this.masterGain = this.ctx.createGain();
			this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
			this.masterGain.connect(this.ctx.destination);
		}

		if (this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
	}

	setVolume(vol) {
		this.volume = Math.max(0, Math.min(1, vol));
		if (this.masterGain && this.ctx) {
			this.masterGain.gain.setTargetAtTime(
				this.volume,
				this.ctx.currentTime,
				0.05,
			);
		}
	}

	// Generate White/Pink Noise buffer
	createNoiseBuffer(type = 'pink', seconds = 4) {
		const bufferSize = this.ctx.sampleRate * seconds;
		const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
		const output = buffer.getChannelData(0);

		if (type === 'white') {
			for (let i = 0; i < bufferSize; i++) {
				output[i] = Math.random() * 2 - 1;
			}
		} else {
			// Pink noise using Paul Kellet's filter method
			let b0 = 0,
				b1 = 0,
				b2 = 0,
				b3 = 0,
				b4 = 0,
				b5 = 0,
				b6 = 0;
			for (let i = 0; i < bufferSize; i++) {
				const white = Math.random() * 2 - 1;
				b0 = 0.99886 * b0 + white * 0.0555179;
				b1 = 0.99332 * b1 + white * 0.0750759;
				b2 = 0.969 * b2 + white * 0.153852;
				b3 = 0.8665 * b3 + white * 0.3104856;
				b4 = 0.55 * b4 + white * 0.5329522;
				b5 = -0.7616 * b5 - white * 0.016898;
				output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
				b6 = white * 0.115926;
			}
		}
		return buffer;
	}

	stopAll() {
		this.intervalTimers.forEach((t) => clearInterval(t));
		this.intervalTimers = [];

		this.activeNodes.forEach((node) => {
			try {
				if (node.stop) node.stop();
				if (node.disconnect) node.disconnect();
			} catch (e) {}
		});
		this.activeNodes = [];
		this.isPlaying = false;
	}

	playWeatherSound(mode) {
		this.currentMode = mode;
		this.initAudioContext();
		this.stopAll();
		this.isPlaying = true;

		switch (mode) {
			case 'rain_light':
				this.startRainSound(0.25, 800);
				break;
			case 'rain_medium':
				this.startRainSound(0.5, 1200);
				this.startWindSound(0.15, 0.4);
				break;
			case 'rain_heavy':
				this.startRainSound(0.85, 2200);
				this.startWindSound(0.35, 0.8);
				break;
			case 'thunder':
			case 'thunderstorm':
				this.startRainSound(0.8, 1800);
				this.startWindSound(0.4, 0.9);
				this.startPeriodicThunder();
				break;
			case 'wind':
			case 'wind_gentle':
			case 'snow_wind':
				this.startWindSound(0.3, 0.5);
				break;
			case 'crickets':
			case 'starry':
				this.startCricketsSound();
				this.startWindSound(0.08, 0.2);
				break;
			case 'birds':
			case 'sunny':
				this.startBirdChirps();
				this.startWindSound(0.08, 0.2);
				break;
			default:
				this.startWindSound(0.1, 0.2);
				break;
		}
	}

	// --- Rain Generator ---
	startRainSound(intensity = 0.5, cutoff = 1200) {
		const noiseBuffer = this.createNoiseBuffer('pink', 5);
		const noiseSource = this.ctx.createBufferSource();
		noiseSource.buffer = noiseBuffer;
		noiseSource.loop = true;

		const lowpass = this.ctx.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

		const highpass = this.ctx.createBiquadFilter();
		highpass.type = 'highpass';
		highpass.frequency.setValueAtTime(150, this.ctx.currentTime);

		const gainNode = this.ctx.createGain();
		gainNode.gain.setValueAtTime(intensity * 0.4, this.ctx.currentTime);

		noiseSource.connect(highpass);
		highpass.connect(lowpass);
		lowpass.connect(gainNode);
		gainNode.connect(this.masterGain);

		noiseSource.start();
		this.activeNodes.push(noiseSource, lowpass, highpass, gainNode);
	}

	// --- Wind Generator ---
	startWindSound(intensity = 0.3, variationSpeed = 0.5) {
		const noiseBuffer = this.createNoiseBuffer('pink', 5);
		const noiseSource = this.ctx.createBufferSource();
		noiseSource.buffer = noiseBuffer;
		noiseSource.loop = true;

		const bandpass = this.ctx.createBiquadFilter();
		bandpass.type = 'bandpass';
		bandpass.frequency.setValueAtTime(380, this.ctx.currentTime);
		bandpass.Q.setValueAtTime(3.0, this.ctx.currentTime);

		// LFO to modulate wind whistling frequency
		const lfo = this.ctx.createOscillator();
		lfo.type = 'sine';
		lfo.frequency.setValueAtTime(variationSpeed, this.ctx.currentTime);

		const lfoGain = this.ctx.createGain();
		lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);

		lfo.connect(lfoGain);
		lfoGain.connect(bandpass.frequency);

		const gainNode = this.ctx.createGain();
		gainNode.gain.setValueAtTime(intensity * 0.35, this.ctx.currentTime);

		noiseSource.connect(bandpass);
		bandpass.connect(gainNode);
		gainNode.connect(this.masterGain);

		noiseSource.start();
		lfo.start();
		this.activeNodes.push(noiseSource, bandpass, lfo, lfoGain, gainNode);
	}

	// --- Thunder Generator ---
	triggerThunder() {
		if (!this.ctx || !this.isPlaying) return;
		const now = this.ctx.currentTime;

		// Sub-bass thump
		const osc = this.ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(70, now);
		osc.frequency.exponentialRampToValueAtTime(25, now + 1.8);

		const oscGain = this.ctx.createGain();
		oscGain.gain.setValueAtTime(0.7, now);
		oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

		osc.connect(oscGain);
		oscGain.connect(this.masterGain);
		osc.start(now);
		osc.stop(now + 2.3);

		// Rumbling Low-pass Noise Burst
		const noiseBuffer = this.createNoiseBuffer('pink', 3);
		const noiseSource = this.ctx.createBufferSource();
		noiseSource.buffer = noiseBuffer;

		const filter = this.ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(180, now);
		filter.frequency.linearRampToValueAtTime(80, now + 2.5);

		const noiseGain = this.ctx.createGain();
		noiseGain.gain.setValueAtTime(0.01, now);
		noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.15); // Fast attack
		noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0); // Long rumble decay

		noiseSource.connect(filter);
		filter.connect(noiseGain);
		noiseGain.connect(this.masterGain);

		noiseSource.start(now);
		noiseSource.stop(now + 3.2);
	}

	startPeriodicThunder() {
		this.triggerThunder();
		const interval = setInterval(
			() => {
				if (Math.random() < 0.6) {
					this.triggerThunder();
				}
			},
			7000 + Math.random() * 5000,
		);
		this.intervalTimers.push(interval);
	}

	// --- Crickets Sound Generator (Night) ---
	startCricketsSound() {
		const carrierFreq = 4800;
		const osc = this.ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(carrierFreq, this.ctx.currentTime);

		// Modulator for cricket chirping pulse
		const mod = this.ctx.createOscillator();
		mod.type = 'sawtooth';
		mod.frequency.setValueAtTime(32, this.ctx.currentTime);

		const modGain = this.ctx.createGain();
		modGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

		const mainGain = this.ctx.createGain();
		mainGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

		// Periodic chirp bursts
		const lfoPulse = this.ctx.createOscillator();
		lfoPulse.type = 'square';
		lfoPulse.frequency.setValueAtTime(2.5, this.ctx.currentTime);

		const pulseGain = this.ctx.createGain();
		pulseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

		lfoPulse.connect(pulseGain.gain);
		osc.connect(modGain);
		modGain.connect(mainGain);
		mainGain.connect(this.masterGain);

		osc.start();
		mod.start();
		lfoPulse.start();
		this.activeNodes.push(osc, mod, modGain, mainGain, lfoPulse, pulseGain);
	}

	// --- Bird Chirps Generator (Sunny Day) ---
	playBirdChirp() {
		if (!this.ctx || !this.isPlaying) return;
		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		osc.type = 'sine';

		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0.001, now);

		const startFreq = 2200 + Math.random() * 800;
		const endFreq = startFreq + (Math.random() > 0.5 ? 600 : -500);

		osc.frequency.setValueAtTime(startFreq, now);
		osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);
		osc.frequency.exponentialRampToValueAtTime(startFreq + 300, now + 0.22);

		gain.gain.linearRampToValueAtTime(0.06, now + 0.04);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

		osc.connect(gain);
		gain.connect(this.masterGain);

		osc.start(now);
		osc.stop(now + 0.3);
	}

	startBirdChirps() {
		this.playBirdChirp();
		const interval = setInterval(
			() => {
				if (Math.random() < 0.65) {
					this.playBirdChirp();
					if (Math.random() < 0.5) {
						setTimeout(() => this.playBirdChirp(), 250);
					}
				}
			},
			3500 + Math.random() * 3000,
		);
		this.intervalTimers.push(interval);
	}
}

// Global audio engine instance
window.weatherAudio = new WeatherAudioEngine();
