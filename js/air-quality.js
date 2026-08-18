/**
 * Air Quality Index & Pollen Analyzer
 * Parses US AQI and European AQI, calculates health advisories, dominant pollutants, and pollen indices.
 */
class AirQualityEngine {
	constructor() {}

	/**
	 * Evaluate AQI status, color, and actionable health guidance
	 */
	getAQIStatus(usAqi) {
		const aqi = Number(usAqi) || 0;

		if (aqi <= 50) {
			return {
				level: 'Good',
				aqi: aqi,
				color: '#10b981', // Emerald 500
				bgGlow: 'rgba(16, 185, 129, 0.25)',
				badgeClass: 'aqi-good',
				statement:
					'Air quality is considered satisfactory, and air pollution poses little or no risk.',
				recommendation: 'Perfect day for outdoor exercise and ventilation.',
			};
		} else if (aqi <= 100) {
			return {
				level: 'Moderate',
				aqi: aqi,
				color: '#f59e0b', // Amber 500
				bgGlow: 'rgba(245, 158, 11, 0.25)',
				badgeClass: 'aqi-moderate',
				statement:
					'Air quality is acceptable; however, sensitive groups may experience minor effects.',
				recommendation:
					'Sensitive individuals should consider reducing intense outdoor exertion.',
			};
		} else if (aqi <= 150) {
			return {
				level: 'Unhealthy for Sensitive Groups',
				aqi: aqi,
				color: '#f97316', // Orange 500
				bgGlow: 'rgba(249, 115, 22, 0.25)',
				badgeClass: 'aqi-sensitive',
				statement:
					'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
				recommendation:
					'Children, elderly, and people with respiratory conditions should limit prolonged outdoor activities.',
			};
		} else if (aqi <= 200) {
			return {
				level: 'Unhealthy',
				aqi: aqi,
				color: '#ef4444', // Red 500
				bgGlow: 'rgba(239, 68, 68, 0.25)',
				badgeClass: 'aqi-unhealthy',
				statement:
					'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
				recommendation:
					'Avoid prolonged outdoor physical exertion. Keep windows closed.',
			};
		} else if (aqi <= 300) {
			return {
				level: 'Very Unhealthy',
				aqi: aqi,
				color: '#8b5cf6', // Violet 500
				bgGlow: 'rgba(139, 92, 246, 0.25)',
				badgeClass: 'aqi-very-unhealthy',
				statement:
					'Health alert: The risk of health effects is increased for everyone.',
				recommendation: 'Wear an N95 mask outdoors. Run air purifiers indoors.',
			};
		} else {
			return {
				level: 'Hazardous',
				aqi: aqi,
				color: '#881337', // Maroon
				bgGlow: 'rgba(136, 19, 55, 0.35)',
				badgeClass: 'aqi-hazardous',
				statement:
					'Health warning of emergency conditions: everyone is more likely to be affected.',
				recommendation:
					'Remain indoors with filtered air. Avoid any outdoor physical activity.',
			};
		}
	}

	/**
	 * Render SVG Radial Gauge Meter for AQI
	 */
	renderRadialGaugeSVG(aqiValue, size = 160) {
		const aqi = Math.max(0, Math.min(400, Number(aqiValue) || 0));
		const status = this.getAQIStatus(aqi);

		const radius = size * 0.4;
		const cx = size / 2;
		const cy = size / 2 + 10;
		const strokeWidth = 14;

		// 240 degree arc from 150 deg to 390 deg (-210 to 30)
		const startAngle = (150 * Math.PI) / 180;
		const totalArc = (240 * Math.PI) / 180;
		const normalizedVal = Math.min(1, aqi / 300);
		const endAngle = startAngle + totalArc * normalizedVal;

		const arcX1 = cx + radius * Math.cos(startAngle);
		const arcY1 = cy + radius * Math.sin(startAngle);

		const bgArcX2 = cx + radius * Math.cos(startAngle + totalArc);
		const bgArcY2 = cy + radius * Math.sin(startAngle + totalArc);

		const valX2 = cx + radius * Math.cos(endAngle);
		const valY2 = cy + radius * Math.sin(endAngle);

		const largeArcFlag = normalizedVal > 180 / 240 ? 1 : 0;

		const bgPath = `M ${arcX1} ${arcY1} A ${radius} ${radius} 0 1 1 ${bgArcX2} ${bgArcY2}`;
		const valPath =
			normalizedVal > 0.01
				? `M ${arcX1} ${arcY1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${valX2} ${valY2}`
				: '';

		return `
      <svg width="${size}" height="${size * 0.85}" viewBox="0 0 ${size} ${size}" class="aqi-gauge-svg">
        <defs>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${status.color}" flood-opacity="0.6" />
          </filter>
        </defs>

        <!-- Background Track -->
        <path d="${bgPath}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${strokeWidth}" stroke-linecap="round" />

        <!-- Colored Value Arc -->
        ${valPath ? `<path d="${valPath}" fill="none" stroke="${status.color}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#gaugeGlow)" />` : ''}

        <!-- Center Value & Status -->
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700" font-family="system-ui">
          ${aqi}
        </text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="${status.color}" font-size="13" font-weight="600" font-family="system-ui">
          ${status.level}
        </text>
      </svg>
    `;
	}
}

// Global air quality instance
window.airQuality = new AirQualityEngine();
