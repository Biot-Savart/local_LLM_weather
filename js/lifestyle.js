/**
 * Smart Lifestyle & Activity Indices Engine
 * Multi-parameter weather calculations for Running, Stargazing, BBQ, Car Wash, Laundry, and UV Protection.
 */
class LifestyleEngine {
	constructor() {}

	/**
	 * Calculate all lifestyle activity indices
	 */
	calculateIndices(current, daily, airQualityData = null, moonData = null) {
		const temp = current.temperature_2m || 20;
		const humidity = current.relative_humidity_2m || 50;
		const wind = current.wind_speed_10m || 10;
		const cloud = current.cloud_cover || 20;
		const rain = (current.precipitation || 0) + (current.rain || 0);
		const uv = current.uv_index || 0;
		const isDay = current.is_day === 1 || current.is_day === true;
		const aqi = airQualityData?.current?.us_aqi || 40;

		return {
			running: this.calcRunningScore(temp, humidity, wind, rain, aqi),
			stargazing: this.calcStargazingScore(cloud, rain, isDay, moonData),
			bbq: this.calcBBQScore(temp, wind, rain, cloud, isDay),
			carWash: this.calcCarWashScore(daily, rain),
			laundry: this.calcLaundryScore(temp, humidity, wind, rain, isDay),
			uv: this.calcUVIndex(uv),
		};
	}

	calcRunningScore(temp, humidity, wind, rain, aqi) {
		let score = 100;
		// Temp penalty: ideal is 12°C - 20°C
		if (temp < 12) score -= (12 - temp) * 3;
		if (temp > 20) score -= (temp - 20) * 4;
		// Humidity penalty
		if (humidity > 70) score -= (humidity - 70) * 0.8;
		// Wind penalty
		if (wind > 20) score -= (wind - 20) * 1.8;
		// Rain penalty
		if (rain > 0) score -= rain > 2 ? 60 : 35;
		// AQI penalty
		if (aqi > 75) score -= (aqi - 75) * 0.4;

		score = Math.max(5, Math.min(100, Math.round(score)));

		let status = 'Excellent';
		let advice = 'Great conditions for a run or workout.';
		let color = '#10b981';

		if (score < 40) {
			status = 'Poor';
			advice = 'Unfavorable weather or air quality for intense running.';
			color = '#ef4444';
		} else if (score < 70) {
			status = 'Moderate';
			advice = 'Fair conditions; stay hydrated and monitor exertion.';
			color = '#f59e0b';
		}

		return { score, status, advice, color, icon: 'fa-person-running' };
	}

	calcStargazingScore(cloud, rain, isDay, moonData) {
		if (isDay) {
			return {
				score: 15,
				status: 'Daytime',
				advice: 'Wait until after sunset for celestial viewing.',
				color: '#64748b',
				icon: 'fa-binoculars',
			};
		}

		let score = 100;
		// Cloud penalty (heavy)
		score -= cloud * 0.85;
		// Rain penalty
		if (rain > 0) score = 0;
		// Moon illumination penalty
		if (moonData) {
			score -= (moonData.illuminationPercent / 100) * 20;
		}

		score = Math.max(5, Math.min(100, Math.round(score)));

		let status = 'Superb';
		let advice =
			'Crystal clear skies, exceptional visibility for planets & stars.';
		let color = '#38bdf8';

		if (score < 40) {
			status = 'Poor';
			advice = 'Heavy cloud cover or overcast conditions blocking stars.';
			color = '#ef4444';
		} else if (score < 70) {
			status = 'Fair';
			advice = 'Scattered clouds; bright constellations and moon visible.';
			color = '#f59e0b';
		}

		return { score, status, advice, color, icon: 'fa-binoculars' };
	}

	calcBBQScore(temp, wind, rain, cloud, isDay) {
		let score = 100;
		if (temp < 16) score -= (16 - temp) * 4;
		if (temp > 34) score -= (temp - 34) * 3;
		if (wind > 15) score -= (wind - 15) * 3.5;
		if (rain > 0) score -= 65;
		if (!isDay) score -= 15;

		score = Math.max(5, Math.min(100, Math.round(score)));

		let status = 'Ideal';
		let advice = 'Perfect weather for BBQ, picnic, or outdoor dining.';
		let color = '#10b981';

		if (score < 40) {
			status = 'Not Recommended';
			advice =
				'Wind, chill, or precipitation makes outdoor grilling difficult.';
			color = '#ef4444';
		} else if (score < 70) {
			status = 'Decent';
			advice = 'Acceptable conditions, but keep a windbreak handy.';
			color = '#f59e0b';
		}

		return { score, status, advice, color, icon: 'fa-utensils' };
	}

	calcCarWashScore(daily, currentRain) {
		let score = 95;
		if (currentRain > 0) {
			score = 10;
		} else if (daily && daily.precipitation_probability_max) {
			const todayProb = daily.precipitation_probability_max[0] || 0;
			const tomorrowProb = daily.precipitation_probability_max[1] || 0;

			score -= todayProb * 0.5;
			score -= tomorrowProb * 0.4;
		}

		score = Math.max(5, Math.min(100, Math.round(score)));

		let status = 'Recommended';
		let advice = 'Dry forecast ahead, your vehicle will stay clean.';
		let color = '#10b981';

		if (score < 45) {
			status = 'Delay Washing';
			advice = 'Rain predicted soon; save the wash for later in the week.';
			color = '#ef4444';
		} else if (score < 75) {
			status = 'Fair';
			advice = 'Slight rain risk, but okay for a quick rinse.';
			color = '#f59e0b';
		}

		return { score, status, advice, color, icon: 'fa-car' };
	}

	calcLaundryScore(temp, humidity, wind, rain, isDay) {
		let score = 90;
		if (rain > 0) score = 10;
		else {
			// High temp speeds drying
			if (temp > 22) score += 10;
			else if (temp < 15) score -= (15 - temp) * 3;
			// High humidity slows drying
			if (humidity > 60) score -= (humidity - 60) * 0.9;
			// Gentle wind speeds drying
			if (wind > 10 && wind < 30) score += 8;
			if (!isDay) score -= 25;
		}

		score = Math.max(5, Math.min(100, Math.round(score)));

		let status = 'Fast Dry';
		let advice = 'Optimal drying conditions outside with sun and breeze.';
		let color = '#10b981';

		if (score < 45) {
			status = 'Dry Indoors';
			advice = 'High moisture or rain risk outside; dry clothes inside.';
			color = '#ef4444';
		} else if (score < 75) {
			status = 'Moderate';
			advice = 'Acceptable outdoor drying, will take several hours.';
			color = '#f59e0b';
		}

		return { score, status, advice, color, icon: 'fa-shirt' };
	}

	calcUVIndex(uv) {
		const uvVal = Number(uv) || 0;
		let level = 'Low';
		let advice = 'No protection required. Safe to stay outside.';
		let color = '#10b981';

		if (uvVal >= 11) {
			level = 'Extreme';
			advice =
				'Take full precautions: SPF 50+, sunglasses, hat, avoid midday sun.';
			color = '#8b5cf6';
		} else if (uvVal >= 8) {
			level = 'Very High';
			advice = 'Extra protection required. Seek shade during midday hours.';
			color = '#ef4444';
		} else if (uvVal >= 6) {
			level = 'High';
			advice = 'Protection essential: Wear SPF 30+, hat, and sunglasses.';
			color = '#f97316';
		} else if (uvVal >= 3) {
			level = 'Moderate';
			advice = 'Wear sun protection if outside for extended periods.';
			color = '#f59e0b';
		}

		return {
			score: uvVal,
			level,
			advice,
			color,
			icon: 'fa-sun',
		};
	}
}

// Global lifestyle instance
window.lifestyle = new LifestyleEngine();
