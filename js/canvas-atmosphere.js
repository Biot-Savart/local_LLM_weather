/**
 * Dynamic Canvas Atmosphere Engine
 * Real-time particle physics, procedural sky rendering, day/night cycles,
 * interactive rain/ripples, lightning bolts, 3D snowflakes, god rays, lens flares, and shooting stars.
 */
class CanvasAtmosphere {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		if (!this.canvas) return;
		this.ctx = this.canvas.getContext('2d');

		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.dpr = Math.min(window.devicePixelRatio || 1, 2);

		this.weatherType = 'sunny'; // 'sunny', 'starry', 'clouds', 'overcast', 'fog', 'rain_light', 'rain_medium', 'rain_heavy', 'snow', 'thunderstorm'
		this.isDay = true;
		this.cloudCover = 20; // 0 - 100
		this.windSpeed = 10; // km/h
		this.windDirection = 90; // degrees

		// Particles & objects
		this.raindrops = [];
		this.ripples = [];
		this.snowflakes = [];
		this.stars = [];
		this.shootingStars = [];
		this.clouds = [];
		this.lightningBolts = [];
		this.lightningFlash = 0; // 0 to 1

		// Mouse interactivity
		this.mouse = {
			x: this.width / 2,
			y: this.height / 2,
			targetX: this.width / 2,
			targetY: this.height / 2,
			active: false,
		};

		// Animation loop timer
		this.lastTime = performance.now();
		this.sunRayAngle = 0;
		this.running = true;

		this.initCanvas();
		this.initEventListeners();
		this.initScene();
		this.animate();
	}

	initCanvas() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = this.width * this.dpr;
		this.canvas.height = this.height * this.dpr;
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		this.ctx.scale(this.dpr, this.dpr);
	}

	initEventListeners() {
		window.addEventListener('resize', () => {
			this.initCanvas();
			this.initScene();
		});

		window.addEventListener('mousemove', (e) => {
			this.mouse.targetX = e.clientX;
			this.mouse.targetY = e.clientY;
			this.mouse.active = true;
		});

		window.addEventListener('mouseleave', () => {
			this.mouse.active = false;
		});

		window.addEventListener(
			'touchmove',
			(e) => {
				if (e.touches.length > 0) {
					this.mouse.targetX = e.touches[0].clientX;
					this.mouse.targetY = e.touches[0].clientY;
					this.mouse.active = true;
				}
			},
			{ passive: true },
		);
	}

	initScene() {
		// Generate Stars (for night conditions)
		this.stars = [];
		const starCount = Math.floor((this.width * this.height) / 3200);
		for (let i = 0; i < starCount; i++) {
			this.stars.push({
				x: Math.random() * this.width,
				y: Math.random() * (this.height * 0.8),
				radius: Math.random() * 1.5 + 0.4,
				baseAlpha: Math.random() * 0.7 + 0.3,
				twinkleSpeed: Math.random() * 0.03 + 0.01,
				twinkleOffset: Math.random() * Math.PI * 2,
				color: ['#ffffff', '#e0f2fe', '#fef08a', '#e9d5ff'][
					Math.floor(Math.random() * 4)
				],
			});
		}

		// Generate Clouds
		this.clouds = [];
		const cloudCount = 8;
		for (let i = 0; i < cloudCount; i++) {
			this.clouds.push({
				x: Math.random() * this.width,
				y: Math.random() * (this.height * 0.5),
				radius: Math.random() * 90 + 70,
				speed: Math.random() * 0.15 + 0.05,
				opacity: Math.random() * 0.25 + 0.15,
				scale: Math.random() * 0.6 + 0.8,
			});
		}

		// Raindrops
		this.raindrops = [];
		const rainCount = this.weatherType.includes('heavy')
			? 450
			: this.weatherType.includes('medium') ||
				  this.weatherType === 'thunderstorm'
				? 260
				: 120;
		for (let i = 0; i < rainCount; i++) {
			this.raindrops.push({
				x: Math.random() * (this.width + 200) - 100,
				y: Math.random() * this.height,
				len: Math.random() * 22 + 15,
				speed: Math.random() * 9 + 18,
				opacity: Math.random() * 0.4 + 0.2,
				thickness: Math.random() * 1.5 + 0.8,
			});
		}

		// Snowflakes
		this.snowflakes = [];
		const snowCount = 180;
		for (let i = 0; i < snowCount; i++) {
			this.snowflakes.push({
				x: Math.random() * (this.width + 100) - 50,
				y: Math.random() * this.height,
				z: Math.random() * 0.8 + 0.2, // Depth 0.2 to 1
				radius: Math.random() * 3 + 1,
				speedY: Math.random() * 1.2 + 0.6,
				swaySpeed: Math.random() * 0.02 + 0.01,
				swayAmount: Math.random() * 1.5 + 0.5,
				swayOffset: Math.random() * Math.PI * 2,
				opacity: Math.random() * 0.6 + 0.3,
			});
		}
	}

	setAtmosphere(
		weatherType,
		isDay = true,
		cloudCover = 20,
		windSpeed = 10,
		windDirection = 90,
	) {
		this.weatherType = weatherType;
		this.isDay = isDay;
		this.cloudCover = cloudCover;
		this.windSpeed = windSpeed;
		this.windDirection = windDirection;
		this.initScene();
	}

	drawSkyGradient() {
		const ctx = this.ctx;
		const grad = ctx.createLinearGradient(0, 0, 0, this.height);

		if (this.isDay) {
			if (this.weatherType === 'thunderstorm') {
				grad.addColorStop(0, '#0f172a');
				grad.addColorStop(0.4, '#1e293b');
				grad.addColorStop(1, '#334155');
			} else if (
				this.weatherType.startsWith('rain') ||
				this.weatherType === 'overcast'
			) {
				grad.addColorStop(0, '#1e293b');
				grad.addColorStop(0.5, '#334155');
				grad.addColorStop(1, '#475569');
			} else if (this.weatherType === 'snow') {
				grad.addColorStop(0, '#1e293b');
				grad.addColorStop(0.5, '#3b506b');
				grad.addColorStop(1, '#64748b');
			} else if (this.weatherType === 'fog') {
				grad.addColorStop(0, '#334155');
				grad.addColorStop(0.6, '#64748b');
				grad.addColorStop(1, '#94a3b8');
			} else if (this.cloudCover > 50) {
				grad.addColorStop(0, '#1e3a5f');
				grad.addColorStop(0.5, '#2563eb');
				grad.addColorStop(1, '#38bdf8');
			} else {
				// Bright Sunny Day
				grad.addColorStop(0, '#0284c7');
				grad.addColorStop(0.4, '#38bdf8');
				grad.addColorStop(0.8, '#7dd3fc');
				grad.addColorStop(1, '#bae6fd');
			}
		} else {
			// Night Sky
			if (this.weatherType === 'thunderstorm') {
				grad.addColorStop(0, '#020617');
				grad.addColorStop(0.5, '#0f172a');
				grad.addColorStop(1, '#1e1b4b');
			} else if (
				this.weatherType.startsWith('rain') ||
				this.weatherType === 'overcast'
			) {
				grad.addColorStop(0, '#020617');
				grad.addColorStop(0.5, '#0f172a');
				grad.addColorStop(1, '#1e293b');
			} else {
				// Clear Starry Night
				grad.addColorStop(0, '#030712');
				grad.addColorStop(0.4, '#090d23');
				grad.addColorStop(0.8, '#0f172a');
				grad.addColorStop(1, '#1e1b4b');
			}
		}

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, this.width, this.height);

		// Lightning ambient screen flash
		if (this.lightningFlash > 0.01) {
			ctx.fillStyle = `rgba(224, 231, 255, ${this.lightningFlash * 0.6})`;
			ctx.fillRect(0, 0, this.width, this.height);
			this.lightningFlash *= 0.88;
		}
	}

	drawSunAndGodRays(time) {
		const ctx = this.ctx;
		const sunX = this.width * 0.82;
		const sunY = this.height * 0.18;

		// Mouse parallax offset
		const offsetX = (this.mouse.x - this.width / 2) * 0.02;
		const offsetY = (this.mouse.y - this.height / 2) * 0.02;
		const currentX = sunX + offsetX;
		const currentY = sunY + offsetY;

		// God Rays (Volumetric light beams)
		ctx.save();
		ctx.translate(currentX, currentY);
		this.sunRayAngle += 0.0012;
		ctx.rotate(this.sunRayAngle);

		const rayCount = 12;
		for (let i = 0; i < rayCount; i++) {
			const angle = (i * Math.PI * 2) / rayCount;
			const rayLength = Math.max(this.width, this.height) * 1.3;
			const rayWidth = Math.PI / (rayCount * 1.8);

			const rayGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, rayLength);
			rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.14)');
			rayGrad.addColorStop(0.4, 'rgba(253, 224, 71, 0.06)');
			rayGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');

			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, rayLength, angle - rayWidth / 2, angle + rayWidth / 2);
			ctx.closePath();
			ctx.fillStyle = rayGrad;
			ctx.fill();
		}
		ctx.restore();

		// Outer Glow
		const glowGrad = ctx.createRadialGradient(
			currentX,
			currentY,
			10,
			currentX,
			currentY,
			160,
		);
		glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
		glowGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.6)');
		glowGrad.addColorStop(0.6, 'rgba(251, 191, 36, 0.25)');
		glowGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');

		ctx.fillStyle = glowGrad;
		ctx.beginPath();
		ctx.arc(currentX, currentY, 160, 0, Math.PI * 2);
		ctx.fill();

		// Solid Sun Core
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(currentX, currentY, 32, 0, Math.PI * 2);
		ctx.shadowColor = '#fef08a';
		ctx.shadowBlur = 40;
		ctx.fill();
		ctx.shadowBlur = 0;

		// Lens Flare Discs towards mouse/center
		const dx = this.width / 2 - currentX;
		const dy = this.height / 2 - currentY;
		const flares = [
			{ dist: 0.35, size: 14, color: 'rgba(254, 240, 138, 0.2)' },
			{ dist: 0.65, size: 30, color: 'rgba(56, 189, 248, 0.15)' },
			{ dist: 0.9, size: 45, color: 'rgba(236, 72, 153, 0.1)' },
			{ dist: 1.2, size: 20, color: 'rgba(168, 85, 247, 0.15)' },
		];

		flares.forEach((f) => {
			const fx = currentX + dx * f.dist;
			const fy = currentY + dy * f.dist;
			ctx.fillStyle = f.color;
			ctx.beginPath();
			ctx.arc(fx, fy, f.size, 0, Math.PI * 2);
			ctx.fill();
		});
	}

	drawStars(time) {
		const ctx = this.ctx;
		this.stars.forEach((star) => {
			const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
			const alpha = Math.max(0.1, star.baseAlpha + twinkle * 0.3);

			ctx.fillStyle = star.color;
			ctx.globalAlpha = alpha;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.globalAlpha = 1;

		// Shooting Stars (Meteors)
		if (Math.random() < 0.007 && this.shootingStars.length < 2) {
			this.shootingStars.push({
				x: Math.random() * this.width * 0.8 + this.width * 0.1,
				y: Math.random() * (this.height * 0.4),
				len: Math.random() * 90 + 70,
				speed: Math.random() * 12 + 14,
				angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
				progress: 0,
				maxProgress: Math.random() * 30 + 20,
			});
		}

		for (let i = this.shootingStars.length - 1; i >= 0; i--) {
			const ss = this.shootingStars[i];
			ss.progress += 1;
			const curX = ss.x + Math.cos(ss.angle) * ss.speed * ss.progress;
			const curY = ss.y + Math.sin(ss.angle) * ss.speed * ss.progress;
			const tailX = curX - Math.cos(ss.angle) * ss.len;
			const tailY = curY - Math.sin(ss.angle) * ss.len;

			const alpha = 1 - ss.progress / ss.maxProgress;
			const grad = ctx.createLinearGradient(tailX, tailY, curX, curY);
			grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
			grad.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.85})`);

			ctx.strokeStyle = grad;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(tailX, tailY);
			ctx.lineTo(curX, curY);
			ctx.stroke();

			if (ss.progress >= ss.maxProgress) {
				this.shootingStars.splice(i, 1);
			}
		}
	}

	drawClouds() {
		const ctx = this.ctx;
		const isDark =
			!this.isDay ||
			this.weatherType.startsWith('rain') ||
			this.weatherType === 'thunderstorm';
		const cloudColor = isDark
			? 'rgba(30, 41, 59, 0.45)'
			: 'rgba(255, 255, 255, 0.35)';

		this.clouds.forEach((cloud) => {
			cloud.x += cloud.speed * (1 + this.windSpeed * 0.02);
			if (cloud.x - cloud.radius * 2 > this.width) {
				cloud.x = -cloud.radius * 2;
				cloud.y = Math.random() * (this.height * 0.5);
			}

			ctx.fillStyle = cloudColor;
			ctx.beginPath();
			ctx.arc(cloud.x, cloud.y, cloud.radius * cloud.scale, 0, Math.PI * 2);
			ctx.arc(
				cloud.x + cloud.radius * 0.6,
				cloud.y - cloud.radius * 0.2,
				cloud.radius * 0.8 * cloud.scale,
				0,
				Math.PI * 2,
			);
			ctx.arc(
				cloud.x - cloud.radius * 0.6,
				cloud.y + cloud.radius * 0.1,
				cloud.radius * 0.7 * cloud.scale,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		});
	}

	drawFog() {
		const ctx = this.ctx;
		const time = performance.now() * 0.0003;
		const layers = 3;

		for (let l = 0; l < layers; l++) {
			ctx.fillStyle = this.isDay
				? 'rgba(241, 245, 249, 0.22)'
				: 'rgba(71, 85, 105, 0.28)';
			ctx.beginPath();
			ctx.moveTo(0, this.height);

			const waveFreq = 0.0025 + l * 0.001;
			const waveAmp = 25 + l * 15;
			const baseY = this.height * (0.45 + l * 0.18);

			for (let x = 0; x <= this.width; x += 15) {
				const y = baseY + Math.sin(x * waveFreq + time * (l + 1)) * waveAmp;
				ctx.lineTo(x, y);
			}
			ctx.lineTo(this.width, this.height);
			ctx.closePath();
			ctx.fill();
		}
	}

	drawRain() {
		const ctx = this.ctx;
		const windTilt = (this.windSpeed / 50) * 8;

		// Mouse influence on rain angle
		let mouseTilt = 0;
		if (this.mouse.active) {
			mouseTilt = ((this.mouse.x - this.width / 2) / (this.width / 2)) * 3;
		}
		const totalTilt = windTilt + mouseTilt;

		ctx.strokeStyle = this.isDay
			? 'rgba(186, 230, 253, 0.65)'
			: 'rgba(147, 197, 253, 0.5)';

		this.raindrops.forEach((drop) => {
			ctx.lineWidth = drop.thickness;
			ctx.beginPath();
			ctx.moveTo(drop.x, drop.y);
			ctx.lineTo(drop.x + totalTilt * (drop.len / 10), drop.y + drop.len);
			ctx.stroke();

			drop.x += totalTilt;
			drop.y += drop.speed;

			// When hitting bottom or ground, create water splash ripple
			if (drop.y > this.height - 40) {
				if (Math.random() < 0.28 && this.ripples.length < 35) {
					this.ripples.push({
						x: drop.x,
						y: this.height - Math.random() * 30 - 5,
						radius: 1,
						maxRadius: Math.random() * 14 + 6,
						alpha: 0.6,
					});
				}
				drop.y = -drop.len;
				drop.x = Math.random() * (this.width + 200) - 100;
			}
		});

		// Draw Water Splash Ripples
		for (let i = this.ripples.length - 1; i >= 0; i--) {
			const rip = this.ripples[i];
			rip.radius += 0.7;
			rip.alpha *= 0.94;

			ctx.save();
			ctx.beginPath();
			ctx.ellipse(
				rip.x,
				rip.y,
				rip.radius * 2,
				rip.radius * 0.6,
				0,
				0,
				Math.PI * 2,
			);
			ctx.strokeStyle = `rgba(186, 230, 253, ${rip.alpha})`;
			ctx.lineWidth = 1.2;
			ctx.stroke();
			ctx.restore();

			if (rip.alpha <= 0.03 || rip.radius >= rip.maxRadius) {
				this.ripples.splice(i, 1);
			}
		}
	}

	drawSnow(time) {
		const ctx = this.ctx;
		ctx.fillStyle = '#ffffff';

		this.snowflakes.forEach((flake) => {
			const sway =
				Math.sin(time * flake.swaySpeed + flake.swayOffset) * flake.swayAmount;
			const windPush = (this.windSpeed / 30) * flake.z;

			flake.x += sway + windPush;
			flake.y += flake.speedY * flake.z * 1.6;

			if (flake.y > this.height) {
				flake.y = -10;
				flake.x = Math.random() * (this.width + 100) - 50;
			}

			ctx.globalAlpha = flake.opacity * flake.z;
			ctx.beginPath();
			ctx.arc(flake.x, flake.y, flake.radius * flake.z, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.globalAlpha = 1;
	}

	triggerLightning() {
		this.lightningFlash = 1.0;
		const startX = Math.random() * this.width * 0.8 + this.width * 0.1;
		const bolt = [];
		let curX = startX;
		let curY = 0;
		bolt.push({ x: curX, y: curY });

		while (curY < this.height * 0.75) {
			curY += Math.random() * 25 + 10;
			curX += (Math.random() - 0.5) * 45;
			bolt.push({ x: curX, y: curY });
		}
		this.lightningBolts.push({ segments: bolt, alpha: 1.0 });

		// Secondary branch
		if (Math.random() < 0.6) {
			const branchIndex = Math.floor(bolt.length / 2);
			const branchStart = bolt[branchIndex];
			const branch = [{ x: branchStart.x, y: branchStart.y }];
			let bx = branchStart.x;
			let by = branchStart.y;
			for (let i = 0; i < 6; i++) {
				by += Math.random() * 20 + 8;
				bx += (Math.random() - 0.3) * 35;
				branch.push({ x: bx, y: by });
			}
			this.lightningBolts.push({ segments: branch, alpha: 0.8 });
		}
	}

	drawLightning() {
		const ctx = this.ctx;
		// Periodically generate lightning in thunderstorm mode
		if (Math.random() < 0.012) {
			this.triggerLightning();
		}

		for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
			const bolt = this.lightningBolts[i];
			bolt.alpha *= 0.85;

			ctx.save();
			ctx.strokeStyle = `rgba(224, 231, 255, ${bolt.alpha})`;
			ctx.lineWidth = 3;
			ctx.shadowColor = '#93c5fd';
			ctx.shadowBlur = 18;

			ctx.beginPath();
			bolt.segments.forEach((pt, idx) => {
				if (idx === 0) ctx.moveTo(pt.x, pt.y);
				else ctx.lineTo(pt.x, pt.y);
			});
			ctx.stroke();
			ctx.restore();

			if (bolt.alpha <= 0.02) {
				this.lightningBolts.splice(i, 1);
			}
		}
	}

	animate(now = 0) {
		if (!this.running) return;

		// Smooth mouse inertia
		this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.06;
		this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.06;

		// 1. Sky Gradient & Background
		this.drawSkyGradient();

		// 2. Clear Sky / Celestial bodies
		if (this.weatherType === 'sunny' && this.isDay) {
			this.drawSunAndGodRays(now);
		} else if (
			this.weatherType === 'starry' ||
			(!this.isDay &&
				!this.weatherType.startsWith('rain') &&
				this.weatherType !== 'thunderstorm')
		) {
			this.drawStars(now);
		}

		// 3. Clouds & Fog
		if (
			this.cloudCover > 20 ||
			this.weatherType === 'clouds' ||
			this.weatherType === 'overcast'
		) {
			this.drawClouds();
		}
		if (this.weatherType === 'fog') {
			this.drawFog();
		}

		// 4. Precipitation
		if (
			this.weatherType.startsWith('rain') ||
			this.weatherType === 'thunderstorm'
		) {
			this.drawRain();
		}
		if (this.weatherType === 'snow') {
			this.drawSnow(now);
		}

		// 5. Thunderstorm lightning
		if (this.weatherType === 'thunderstorm') {
			this.drawLightning();
		}

		requestAnimationFrame((t) => this.animate(t));
	}
}

// Attach to window
window.CanvasAtmosphere = CanvasAtmosphere;
