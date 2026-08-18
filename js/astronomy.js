/**
 * Astronomy & Solar Cycle Engine
 * Computes exact Solar Arc, Golden Hour, Day Length, Sun Elevation,
 * and Synodic Moon Phase with interactive visual SVG lunar disk rendering.
 */
class AstronomyEngine {
	constructor() {
		this.LUNAR_CYCLE = 29.53058867; // Synodic month in days
		// Reference New Moon date: Jan 11, 2024, 11:57 UTC
		this.KNOWN_NEW_MOON = new Date('2024-01-11T11:57:00Z').getTime();
	}

	/**
	 * Calculate Moon Phase & Illumination Percentage
	 */
	getMoonPhase(targetDate = new Date()) {
		const timeDiff = targetDate.getTime() - this.KNOWN_NEW_MOON;
		const daysSince = timeDiff / (1000 * 60 * 60 * 24);
		const cyclePos =
			((daysSince % this.LUNAR_CYCLE) + this.LUNAR_CYCLE) % this.LUNAR_CYCLE;
		const phaseRatio = cyclePos / this.LUNAR_CYCLE; // 0 to 1

		// Illumination: 0 (new moon) -> 1 (full moon) -> 0
		const illumination = (1 - Math.cos(phaseRatio * 2 * Math.PI)) / 2;
		const illuminationPercent = Math.round(illumination * 100);

		let phaseName = 'New Moon';
		let phaseIcon = '🌑';

		if (phaseRatio < 0.03 || phaseRatio > 0.97) {
			phaseName = 'New Moon';
			phaseIcon = '🌑';
		} else if (phaseRatio < 0.22) {
			phaseName = 'Waxing Crescent';
			phaseIcon = '🌒';
		} else if (phaseRatio < 0.28) {
			phaseName = 'First Quarter';
			phaseIcon = '🌓';
		} else if (phaseRatio < 0.47) {
			phaseName = 'Waxing Gibbous';
			phaseIcon = '🌔';
		} else if (phaseRatio < 0.53) {
			phaseName = 'Full Moon';
			phaseIcon = '🌕';
		} else if (phaseRatio < 0.72) {
			phaseName = 'Waning Gibbous';
			phaseIcon = '🌖';
		} else if (phaseRatio < 0.78) {
			phaseName = 'Last Quarter';
			phaseIcon = '🌗';
		} else {
			phaseName = 'Waning Crescent';
			phaseIcon = '🌘';
		}

		return {
			phaseRatio,
			illuminationPercent,
			phaseName,
			phaseIcon,
			daysIntoCycle: cyclePos.toFixed(1),
		};
	}

	/**
	 * Render SVG Lunar Disc showing visual lighting and crater texture
	 */
	renderMoonSVG(phaseRatio, size = 64) {
		// phaseRatio 0 to 1
		const r = size / 2 - 2;
		const cx = size / 2;
		const cy = size / 2;

		// Draw base dark moon disc with craters
		let pathD = '';
		const isWaxing = phaseRatio <= 0.5;
		// Normalize k from -1 (New) to 1 (Full) to -1 (New)
		const k = Math.cos(phaseRatio * 2 * Math.PI);
		const sweep = isWaxing ? 1 : 0;

		// Outer semi-circle + inner elliptical arc
		const rx = Math.abs(r * k);
		const innerSweep = (isWaxing && k <= 0) || (!isWaxing && k > 0) ? 0 : 1;

		pathD = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`;

		return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="moon-svg-disc">
        <defs>
          <radialGradient id="moonDarkGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </radialGradient>
          <radialGradient id="moonLightGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="60%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#cbd5e1" />
          </radialGradient>
          <filter id="moonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Dark Body -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#moonDarkGrad)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
        <!-- Subtle Craters -->
        <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.2}" r="${r * 0.15}" fill="rgba(15,23,42,0.4)" />
        <circle cx="${cx + r * 0.25}" cy="${cy + r * 0.3}" r="${r * 0.2}" fill="rgba(15,23,42,0.35)" />
        <circle cx="${cx - r * 0.1}" cy="${cy + r * 0.4}" r="${r * 0.12}" fill="rgba(15,23,42,0.3)" />

        <!-- Illuminated portion -->
        ${phaseRatio > 0.02 && phaseRatio < 0.98 ? `<path d="${pathD}" fill="url(#moonLightGrad)" filter="url(#moonGlow)" />` : ''}
        ${phaseRatio >= 0.48 && phaseRatio <= 0.52 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#moonLightGrad)" filter="url(#moonGlow)" />` : ''}
      </svg>
    `;
	}

	/**
	 * Calculate Solar Arc & Timeline metrics
	 */
	calculateSolarMetrics(sunriseISO, sunsetISO, currentTime = new Date()) {
		if (!sunriseISO || !sunsetISO) {
			return {
				progress: 0.5,
				isDay: true,
				sunriseTime: '--:--',
				sunsetTime: '--:--',
				dayDuration: '--',
				goldenHourMorning: '--:--',
				goldenHourEvening: '--:--',
				statusText: 'Daylight cycle',
			};
		}

		const sunrise = new Date(sunriseISO);
		const sunset = new Date(sunsetISO);
		const current = new Date(currentTime);

		const sunriseMs = sunrise.getTime();
		const sunsetMs = sunset.getTime();
		const currentMs = current.getTime();

		const isDay = currentMs >= sunriseMs && currentMs <= sunsetMs;
		const dayLengthMs = Math.max(1, sunsetMs - sunriseMs);
		const dayLengthHours = (dayLengthMs / (1000 * 60 * 60)).toFixed(1);

		// Progress along the arc (0 at sunrise, 0.5 at noon, 1.0 at sunset, or mapped across 24h)
		let progress = 0;
		if (isDay) {
			progress = (currentMs - sunriseMs) / dayLengthMs;
		} else if (currentMs < sunriseMs) {
			progress = 0; // Pre-dawn
		} else {
			progress = 1; // Post-dusk
		}
		progress = Math.max(0, Math.min(1, progress));

		// Golden hour windows (~1 hour after sunrise & ~1 hour before sunset)
		const ghMorning = new Date(sunriseMs + 60 * 60 * 1000);
		const ghEvening = new Date(sunsetMs - 60 * 60 * 1000);

		const formatTime = (d) => {
			return d.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		};

		let statusText = '';
		if (isDay) {
			const remainingMs = sunsetMs - currentMs;
			const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
			const remMins = Math.floor(
				(remainingMs % (1000 * 60 * 60)) / (1000 * 60),
			);
			statusText = `${remHours}h ${remMins}m daylight left`;
		} else {
			statusText = 'Night time';
		}

		return {
			progress,
			isDay,
			sunriseTime: formatTime(sunrise),
			sunsetTime: formatTime(sunset),
			dayDuration: `${dayLengthHours} hrs`,
			goldenHourMorning: formatTime(ghMorning),
			goldenHourEvening: formatTime(ghEvening),
			statusText,
		};
	}

	/**
	 * Render SVG Solar Arc with responsive curved trajectory and glowing sun position
	 */
	renderSolarArcSVG(solarMetrics, width = 320, height = 130) {
		const { progress, isDay, sunriseTime, sunsetTime } = solarMetrics;

		const startX = 35;
		const endX = width - 35;
		const baseY = height - 28;
		const arcHeight = height - 55;

		// Semi-elliptical curve coordinates
		const pathD = `M ${startX} ${baseY} Q ${width / 2} ${baseY - arcHeight * 2} ${endX} ${baseY}`;

		// Calculate position along quadratic bezier curve: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
		const t = Math.max(0, Math.min(1, progress));
		const p0x = startX,
			p0y = baseY;
		const p1x = width / 2,
			p1y = baseY - arcHeight * 2;
		const p2x = endX,
			p2y = baseY;

		const sunX = Math.round(
			(1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x,
		);
		const sunY = Math.round(
			(1 - t) * (1 - t) * p0y + 2 * (1 - t) * t * p1y + t * t * p2y,
		);

		return `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="solar-arc-svg">
        <defs>
          <linearGradient id="arcTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
            <stop offset="50%" stop-color="#fbbf24" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#f97316" stop-opacity="0.3" />
          </linearGradient>
          <radialGradient id="sunDotGlow">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="50%" stop-color="#fef08a" />
            <stop offset="100%" stop-color="#f59e0b" />
          </radialGradient>
          <filter id="solarGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Horizon Line -->
        <line x1="20" y1="${baseY}" x2="${width - 20}" y2="${baseY}" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-dasharray="4,4" />

        <!-- Celestial Arc -->
        <path d="${pathD}" fill="none" stroke="url(#arcTrackGrad)" stroke-width="3" stroke-linecap="round" />

        <!-- Sunrise / Sunset Labels -->
        <text x="${startX}" y="${baseY + 20}" fill="rgba(255,255,255,0.7)" font-size="12" font-family="system-ui" text-anchor="middle">
          🌅 ${sunriseTime}
        </text>
        <text x="${endX}" y="${baseY + 20}" fill="rgba(255,255,255,0.7)" font-size="12" font-family="system-ui" text-anchor="middle">
          🌇 ${sunsetTime}
        </text>

        <!-- Sun Orb on Track -->
        ${
					isDay
						? `
          <g filter="url(#solarGlow)">
            <circle cx="${sunX}" cy="${sunY}" r="12" fill="rgba(251,191,36,0.35)" />
            <circle cx="${sunX}" cy="${sunY}" r="7" fill="url(#sunDotGlow)" />
          </g>
        `
						: `
          <!-- Moon Orb during night -->
          <circle cx="${width / 2}" cy="${baseY - 40}" r="8" fill="#e2e8f0" opacity="0.6" />
        `
				}
      </svg>
    `;
	}
}

// Global astronomy instance
window.astronomy = new AstronomyEngine();
