/**
 * Weather Card Exporter & Social Snapshot Generator
 * Generates crisp 1200x630 (Twitter/OG standard) high-res graphical snapshot cards
 * for social sharing, image download, and clipboard copy.
 */
class WeatherCardExporter {
	constructor() {}

	/**
	 * Render offscreen canvas and generate image Blob / DataURL
	 */
	async generateCard(
		location,
		currentWeather,
		dailyWeather,
		airQuality,
		unit = 'c',
		windUnit = 'kmh',
	) {
		const width = 1200;
		const height = 630;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		const isDay = currentWeather.is_day === 1 || currentWeather.is_day === true;
		const codeInfo = window.weatherAPI.getWeatherCodeInfo(
			currentWeather.weather_code,
			isDay,
		);
		const tempVal = window.weatherAPI.convertTemp(
			currentWeather.temperature_2m,
			unit,
		);
		const feelsVal = window.weatherAPI.convertTemp(
			currentWeather.apparent_temperature,
			unit,
		);
		const windVal = window.weatherAPI.convertWind(
			currentWeather.wind_speed_10m,
			windUnit,
		);
		const maxTemp = dailyWeather
			? window.weatherAPI.convertTemp(dailyWeather.temperature_2m_max[0], unit)
			: tempVal;
		const minTemp = dailyWeather
			? window.weatherAPI.convertTemp(dailyWeather.temperature_2m_min[0], unit)
			: tempVal;

		// 1. Background atmospheric gradient
		const bgGrad = ctx.createLinearGradient(0, 0, width, height);
		if (isDay) {
			if (currentWeather.weather_code >= 95) {
				bgGrad.addColorStop(0, '#0f172a');
				bgGrad.addColorStop(1, '#334155');
			} else if (currentWeather.weather_code >= 51) {
				bgGrad.addColorStop(0, '#1e293b');
				bgGrad.addColorStop(1, '#3b82f6');
			} else {
				bgGrad.addColorStop(0, '#0284c7');
				bgGrad.addColorStop(0.5, '#0ea5e9');
				bgGrad.addColorStop(1, '#38bdf8');
			}
		} else {
			bgGrad.addColorStop(0, '#030712');
			bgGrad.addColorStop(0.5, '#0f172a');
			bgGrad.addColorStop(1, '#1e1b4b');
		}

		ctx.fillStyle = bgGrad;
		ctx.fillRect(0, 0, width, height);

		// 2. Ambient decorative glass circles
		ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
		ctx.beginPath();
		ctx.arc(width - 150, 150, 240, 0, Math.PI * 2);
		ctx.fill();

		ctx.beginPath();
		ctx.arc(100, height - 100, 180, 0, Math.PI * 2);
		ctx.fill();

		// 3. Glassmorphic Card Container
		const margin = 40;
		const cardW = width - margin * 2;
		const cardH = height - margin * 2;
		const cardX = margin;
		const cardY = margin;
		const radius = 28;

		ctx.save();
		ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
		ctx.lineWidth = 2;
		this.roundRect(ctx, cardX, cardY, cardW, cardH, radius);
		ctx.fill();
		ctx.stroke();
		ctx.restore();

		// 4. Header (App Branding & Location)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.font = '600 20px Inter, system-ui, sans-serif';
		ctx.fillText('ATMOSPHERE WEATHER SHOWCASE', cardX + 45, cardY + 55);

		// Date
		const nowStr = new Date().toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
		ctx.textAlign = 'right';
		ctx.fillText(nowStr, cardX + cardW - 45, cardY + 55);
		ctx.textAlign = 'left';

		// Location Name
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 52px Inter, system-ui, sans-serif';
		const locName = `${location.name || 'Location'}, ${location.country || ''}`;
		ctx.fillText(locName, cardX + 45, cardY + 125);

		// Weather condition badge
		ctx.fillStyle = '#38bdf8';
		ctx.font = '600 26px Inter, system-ui, sans-serif';
		ctx.fillText(
			`${codeInfo.label} • ${codeInfo.description}`,
			cardX + 45,
			cardY + 170,
		);

		// 5. Huge Temperature Display
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 118px Inter, system-ui, sans-serif';
		ctx.fillText(`${tempVal}°`, cardX + 45, cardY + 310);

		// Feels like & High/Low
		ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
		ctx.font = '500 22px Inter, system-ui, sans-serif';
		ctx.fillText(
			`Feels like ${feelsVal}°${unit.toUpperCase()}`,
			cardX + 50,
			cardY + 355,
		);
		ctx.fillText(
			`High: ${maxTemp}°  •  Low: ${minTemp}°`,
			cardX + 50,
			cardY + 390,
		);

		// 6. Metrics Grid on Right Side
		const gridX = cardX + 480;
		const gridY = cardY + 200;
		const gridW = cardW - 525;
		const gridH = 300;

		const metrics = [
			{ label: 'Wind Speed', value: `${windVal} ${windUnit}` },
			{
				label: 'Humidity',
				value: `${currentWeather.relative_humidity_2m || 0}%`,
			},
			{ label: 'UV Index', value: `${currentWeather.uv_index || 0} / 12` },
			{
				label: 'Air Quality (AQI)',
				value: airQuality?.current?.us_aqi
					? `${airQuality.current.us_aqi} (${window.airQuality.getAQIStatus(airQuality.current.us_aqi).level})`
					: 'Good',
			},
			{
				label: 'Pressure',
				value: `${Math.round(currentWeather.surface_pressure || 1013)} hPa`,
			},
			{ label: 'Cloud Cover', value: `${currentWeather.cloud_cover || 0}%` },
		];

		const cols = 2;
		const rows = 3;
		const cellW = gridW / cols;
		const cellH = gridH / rows;

		metrics.forEach((m, idx) => {
			const c = idx % cols;
			const r = Math.floor(idx / cols);
			const cx = gridX + c * cellW;
			const cy = gridY + r * cellH;

			// Metric Box
			ctx.save();
			ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
			ctx.lineWidth = 1;
			this.roundRect(ctx, cx, cy, cellW - 15, cellH - 15, 14);
			ctx.fill();
			ctx.stroke();
			ctx.restore();

			// Text
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.font = '500 16px Inter, system-ui, sans-serif';
			ctx.fillText(m.label, cx + 18, cy + 32);

			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 22px Inter, system-ui, sans-serif';
			ctx.fillText(m.value, cx + 18, cy + 65);
		});

		// 7. Footer tag
		ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
		ctx.font = '14px Inter, system-ui, sans-serif';
		ctx.fillText(
			'Powered by Open-Meteo & Atmosphere Engine • Live Weather Intelligence',
			cardX + 45,
			cardY + cardH - 30,
		);

		return canvas;
	}

	roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	async downloadCard(
		location,
		currentWeather,
		dailyWeather,
		airQuality,
		unit,
		windUnit,
	) {
		const canvas = await this.generateCard(
			location,
			currentWeather,
			dailyWeather,
			airQuality,
			unit,
			windUnit,
		);
		const link = document.createElement('a');
		link.download = `Weather-${(location.name || 'City').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}
}

// Global card exporter instance
window.cardExporter = new WeatherCardExporter();
