/**
 * Interactive Charts Manager (Chart.js Integration)
 * Renders hourly temperature curves, precipitation probabilities, wind speed curves, and AQI trends.
 */
class WeatherCharts {
	constructor() {
		this.hourlyChartInstance = null;
		this.currentTab = 'temp'; // 'temp' | 'wind' | 'aqi'
	}

	/**
	 * Initialize or update hourly chart
	 */
	renderHourlyChart(
		forecastData,
		airQualityData = null,
		unit = 'c',
		windUnit = 'kmh',
	) {
		const canvas = document.getElementById('hourlyChartCanvas');
		if (!canvas || !window.Chart) return;

		const hourly = forecastData.hourly;
		if (!hourly || !hourly.time) return;

		// Take next 24-36 hours
		const limit = 24;
		const labels = [];
		const temps = [];
		const feelsLike = [];
		const precipProb = [];
		const windSpeeds = [];
		const windGusts = [];
		const uvIndices = [];

		for (let i = 0; i < Math.min(limit, hourly.time.length); i++) {
			const d = new Date(hourly.time[i]);
			const hourStr = d.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
			labels.push(i === 0 ? 'Now' : hourStr);

			const rawTemp = hourly.temperature_2m[i];
			const rawFeels = hourly.apparent_temperature[i];
			temps.push(window.weatherAPI.convertTemp(rawTemp, unit));
			feelsLike.push(window.weatherAPI.convertTemp(rawFeels, unit));

			precipProb.push(hourly.precipitation_probability[i] || 0);

			const rawWind = hourly.wind_speed_10m[i];
			const rawGust = hourly.wind_gusts_10m
				? hourly.wind_gusts_10m[i]
				: rawWind;
			windSpeeds.push(Number(window.weatherAPI.convertWind(rawWind, windUnit)));
			windGusts.push(Number(window.weatherAPI.convertWind(rawGust, windUnit)));

			uvIndices.push(hourly.uv_index ? hourly.uv_index[i] : 0);
		}

		if (this.hourlyChartInstance) {
			this.hourlyChartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		// Create Gradients
		const tempGrad = ctx.createLinearGradient(0, 0, 0, 220);
		tempGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
		tempGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
		tempGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

		let datasets = [];

		if (this.currentTab === 'temp') {
			datasets = [
				{
					label: `Temperature (°${unit.toUpperCase()})`,
					data: temps,
					type: 'line',
					borderColor: '#f59e0b',
					backgroundColor: tempGrad,
					fill: true,
					tension: 0.4,
					pointRadius: 4,
					pointHoverRadius: 6,
					pointBackgroundColor: '#ffffff',
					pointBorderColor: '#f59e0b',
					pointBorderWidth: 2,
					yAxisID: 'y',
				},
				{
					label: `Feels Like (°${unit.toUpperCase()})`,
					data: feelsLike,
					type: 'line',
					borderColor: 'rgba(244, 114, 182, 0.7)',
					borderDash: [4, 4],
					pointRadius: 2,
					pointHoverRadius: 5,
					tension: 0.4,
					fill: false,
					yAxisID: 'y',
				},
				{
					label: 'Precipitation Chance (%)',
					data: precipProb,
					type: 'bar',
					backgroundColor: 'rgba(56, 189, 248, 0.55)',
					borderRadius: 4,
					barThickness: 12,
					yAxisID: 'y1',
				},
			];
		} else if (this.currentTab === 'wind') {
			datasets = [
				{
					label: `Wind Speed (${windUnit})`,
					data: windSpeeds,
					type: 'line',
					borderColor: '#38bdf8',
					backgroundColor: 'rgba(56, 189, 248, 0.2)',
					fill: true,
					tension: 0.35,
					pointRadius: 3,
					yAxisID: 'y',
				},
				{
					label: `Wind Gusts (${windUnit})`,
					data: windGusts,
					type: 'line',
					borderColor: '#a855f7',
					borderDash: [3, 3],
					pointRadius: 2,
					tension: 0.35,
					fill: false,
					yAxisID: 'y',
				},
			];
		} else if (this.currentTab === 'aqi') {
			datasets = [
				{
					label: 'UV Index',
					data: uvIndices,
					type: 'line',
					borderColor: '#f43f5e',
					backgroundColor: 'rgba(244, 63, 94, 0.25)',
					fill: true,
					tension: 0.4,
					pointRadius: 4,
					yAxisID: 'y',
				},
			];
		}

		this.hourlyChartInstance = new window.Chart(ctx, {
			data: {
				labels: labels,
				datasets: datasets,
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false,
				},
				plugins: {
					legend: {
						display: true,
						labels: {
							color: 'rgba(255, 255, 255, 0.85)',
							font: { size: 12, family: 'Inter, system-ui' },
							boxWidth: 12,
							padding: 15,
						},
					},
					tooltip: {
						backgroundColor: 'rgba(15, 23, 42, 0.9)',
						titleColor: '#ffffff',
						bodyColor: '#e2e8f0',
						borderColor: 'rgba(255, 255, 255, 0.15)',
						borderWidth: 1,
						padding: 12,
						cornerRadius: 8,
						titleFont: { size: 13, weight: 'bold' },
						bodyFont: { size: 12 },
					},
				},
				scales: {
					x: {
						grid: {
							color: 'rgba(255, 255, 255, 0.06)',
						},
						ticks: {
							color: 'rgba(255, 255, 255, 0.7)',
							font: { size: 11 },
						},
					},
					y: {
						position: 'left',
						grid: {
							color: 'rgba(255, 255, 255, 0.08)',
						},
						ticks: {
							color: 'rgba(255, 255, 255, 0.7)',
							font: { size: 11 },
						},
					},
					y1: {
						position: 'right',
						min: 0,
						max: 100,
						display: this.currentTab === 'temp',
						grid: {
							drawOnChartArea: false,
						},
						ticks: {
							color: 'rgba(56, 189, 248, 0.8)',
							callback: (val) => `${val}%`,
							font: { size: 11 },
						},
					},
				},
			},
		});
	}

	setTab(tab, forecastData, airQualityData, unit, windUnit) {
		this.currentTab = tab;
		this.renderHourlyChart(forecastData, airQualityData, unit, windUnit);
	}
}

// Global weather charts instance
window.weatherCharts = new WeatherCharts();
