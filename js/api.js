/**
 * Weather API Service & Data Formatters
 * Open-Meteo (Forecast, Geocoding, Air Quality, Historical Archive)
 */
class WeatherAPI {
	constructor() {
		this.GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
		this.FORECAST_BASE = 'https://api.open-meteo.com/v1';
		this.AIR_QUALITY_BASE = 'https://air-quality-api.open-meteo.com/v1';
		this.ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1';

		// In-memory cache for API requests with 5-minute TTL
		this.cache = new Map();
		this.CACHE_TTL = 5 * 60 * 1000;
	}

	/**
	 * Cached fetch wrapper with error handling & timeout
	 */
	async fetchWithCache(url, cacheTime = this.CACHE_TTL) {
		const cached = this.cache.get(url);
		if (cached && Date.now() - cached.timestamp < cacheTime) {
			return cached.data;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 12000);

		try {
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(
					`HTTP error! status: ${response.status} (${response.statusText})`,
				);
			}

			const data = await response.json();
			this.cache.set(url, { data, timestamp: Date.now() });
			return data;
		} catch (err) {
			clearTimeout(timeoutId);
			if (err.name === 'AbortError') {
				throw new Error(
					'Network request timed out. Please check your connection.',
				);
			}
			throw err;
		}
	}

	/**
	 * Search locations by query string (autocomplete)
	 */
	async searchLocations(query) {
		if (!query || query.trim().length < 2) return [];
		const cleanQuery = encodeURIComponent(query.trim());
		const url = `${this.GEOCODING_BASE}/search?name=${cleanQuery}&count=10&language=en&format=json`;

		try {
			const data = await this.fetchWithCache(url, 60 * 1000);
			if (!data || !data.results) return [];

			return data.results.map((item) => ({
				id: item.id,
				name: item.name,
				admin1: item.admin1 || '',
				admin2: item.admin2 || '',
				country: item.country || '',
				country_code: item.country_code ? item.country_code.toUpperCase() : '',
				latitude: item.latitude,
				longitude: item.longitude,
				elevation: item.elevation,
				timezone: item.timezone || 'auto',
				population: item.population || null,
			}));
		} catch (err) {
			console.error('Location search error:', err);
			return [];
		}
	}

	/**
	 * Reverse geocode coordinates to city name
	 */
	async reverseGeocode(latitude, longitude) {
		try {
			// BigDataCloud client-side free reverse geocoding API
			const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				return {
					name:
						data.city ||
						data.locality ||
						data.principalSubdivision ||
						'Detected Location',
					admin1: data.principalSubdivision || '',
					country: data.countryName || '',
					country_code: (data.countryCode || '').toUpperCase(),
					latitude,
					longitude,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto',
				};
			}
		} catch (e) {
			console.warn('Reverse geocoding failed, using coordinates:', e);
		}
		return {
			name: `Location (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
			admin1: '',
			country: '',
			country_code: '',
			latitude,
			longitude,
			timezone: 'auto',
		};
	}

	/**
	 * Fetch complete 7-day forecast with current and hourly conditions
	 */
	async getForecast(latitude, longitude, timezone = 'auto') {
		const params = new URLSearchParams({
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			timezone: timezone,
			current: [
				'temperature_2m',
				'relative_humidity_2m',
				'apparent_temperature',
				'is_day',
				'precipitation',
				'rain',
				'showers',
				'snowfall',
				'weather_code',
				'cloud_cover',
				'pressure_msl',
				'surface_pressure',
				'wind_speed_10m',
				'wind_direction_10m',
				'wind_gusts_10m',
				'uv_index',
			].join(','),
			hourly: [
				'temperature_2m',
				'relative_humidity_2m',
				'dew_point_2m',
				'apparent_temperature',
				'precipitation_probability',
				'precipitation',
				'rain',
				'showers',
				'snowfall',
				'weather_code',
				'pressure_msl',
				'surface_pressure',
				'cloud_cover',
				'visibility',
				'wind_speed_10m',
				'wind_direction_10m',
				'wind_gusts_10m',
				'uv_index',
				'is_day',
			].join(','),
			daily: [
				'weather_code',
				'temperature_2m_max',
				'temperature_2m_min',
				'apparent_temperature_max',
				'apparent_temperature_min',
				'sunrise',
				'sunset',
				'uv_index_max',
				'precipitation_sum',
				'rain_sum',
				'showers_sum',
				'snowfall_sum',
				'precipitation_hours',
				'precipitation_probability_max',
				'wind_speed_10m_max',
				'wind_gusts_10m_max',
				'wind_direction_10m_dominant',
				'shortwave_radiation_sum',
			].join(','),
			forecast_days: '7',
		});

		const url = `${this.FORECAST_BASE}/forecast?${params.toString()}`;
		return await this.fetchWithCache(url, 2 * 60 * 1000);
	}

	/**
	 * Fetch Air Quality metrics (AQI, PM2.5, PM10, Ozone, NO2, SO2, CO, Pollen)
	 */
	async getAirQuality(latitude, longitude) {
		const params = new URLSearchParams({
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			current: [
				'us_aqi',
				'european_aqi',
				'pm2_5',
				'pm10',
				'ozone',
				'nitrogen_dioxide',
				'sulphur_dioxide',
				'carbon_monoxide',
				'dust',
				'alder_pollen',
				'birch_pollen',
				'grass_pollen',
				'ragweed_pollen',
			].join(','),
			hourly: [
				'us_aqi',
				'european_aqi',
				'pm2_5',
				'pm10',
				'ozone',
				'nitrogen_dioxide',
			].join(','),
			forecast_days: '3',
		});

		const url = `${this.AIR_QUALITY_BASE}/air-quality?${params.toString()}`;
		try {
			return await this.fetchWithCache(url, 5 * 60 * 1000);
		} catch (e) {
			console.warn('Air quality fetch failed:', e);
			return null;
		}
	}

	/**
	 * Fetch "This Day Last Year" historical weather comparison
	 */
	async getHistoricalComparison(latitude, longitude, timezone = 'auto') {
		try {
			const now = new Date();
			const lastYear = new Date(now);
			lastYear.setFullYear(now.getFullYear() - 1);

			const dateStr = lastYear.toISOString().split('T')[0];

			const params = new URLSearchParams({
				latitude: latitude.toString(),
				longitude: longitude.toString(),
				start_date: dateStr,
				end_date: dateStr,
				timezone: timezone,
				daily: [
					'weather_code',
					'temperature_2m_max',
					'temperature_2m_min',
					'apparent_temperature_max',
					'apparent_temperature_min',
					'precipitation_sum',
					'wind_speed_10m_max',
				].join(','),
				hourly: [
					'temperature_2m',
					'relative_humidity_2m',
					'weather_code',
					'surface_pressure',
				].join(','),
			});

			const url = `${this.ARCHIVE_BASE}/archive?${params.toString()}`;
			return await this.fetchWithCache(url, 60 * 60 * 1000);
		} catch (e) {
			console.warn('Historical archive fetch failed:', e);
			return null;
		}
	}

	/**
	 * Mapping WMO Weather interpretation codes
	 */
	getWeatherCodeInfo(code, isDay = 1) {
		const c = Number(code);
		const day = isDay === 1 || isDay === true;

		// Mapping table
		const weatherMap = {
			0: {
				label: 'Clear Sky',
				atmosphere: day ? 'sunny' : 'starry',
				icon: day ? 'sun' : 'moon',
				sound: day ? 'birds' : 'crickets',
				description: 'Crisp and completely clear skies',
			},
			1: {
				label: 'Mainly Clear',
				atmosphere: day ? 'sunny' : 'starry',
				icon: day ? 'sun' : 'moon',
				sound: day ? 'birds' : 'crickets',
				description: 'Mostly clear with faint drifting clouds',
			},
			2: {
				label: 'Partly Cloudy',
				atmosphere: 'clouds',
				icon: day ? 'cloud-sun' : 'cloud-moon',
				sound: day ? 'wind_gentle' : 'crickets',
				description: 'Scattered clouds with periodic sunshine',
			},
			3: {
				label: 'Overcast',
				atmosphere: 'overcast',
				icon: 'cloud',
				sound: 'wind_gentle',
				description: 'Heavy blanket of overcast cloud cover',
			},
			45: {
				label: 'Foggy',
				atmosphere: 'fog',
				icon: 'smog',
				sound: 'wind_gentle',
				description: 'Low visibility due to thick atmospheric fog',
			},
			48: {
				label: 'Depositing Rime Fog',
				atmosphere: 'fog',
				icon: 'smog',
				sound: 'wind_gentle',
				description: 'Freezing rime fog coating surfaces',
			},
			51: {
				label: 'Light Drizzle',
				atmosphere: 'rain_light',
				icon: 'cloud-rain',
				sound: 'rain_light',
				description: 'Gentle misting drizzle',
			},
			53: {
				label: 'Moderate Drizzle',
				atmosphere: 'rain_light',
				icon: 'cloud-rain',
				sound: 'rain_light',
				description: 'Steady fine drizzle droplets',
			},
			55: {
				label: 'Dense Drizzle',
				atmosphere: 'rain_medium',
				icon: 'cloud-rain',
				sound: 'rain_medium',
				description: 'Thick sustained drizzle',
			},
			56: {
				label: 'Freezing Drizzle',
				atmosphere: 'rain_light',
				icon: 'snowflake',
				sound: 'rain_light',
				description: 'Icy freezing drizzle precipitation',
			},
			57: {
				label: 'Dense Freezing Drizzle',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'rain_medium',
				description: 'Dense icy freezing drizzle',
			},
			61: {
				label: 'Slight Rain',
				atmosphere: 'rain_light',
				icon: 'cloud-rain',
				sound: 'rain_light',
				description: 'Gentle passing rainfall',
			},
			63: {
				label: 'Moderate Rain',
				atmosphere: 'rain_medium',
				icon: 'cloud-showers-heavy',
				sound: 'rain_medium',
				description: 'Steady, regular rainfall',
			},
			65: {
				label: 'Heavy Rain',
				atmosphere: 'rain_heavy',
				icon: 'cloud-showers-heavy',
				sound: 'rain_heavy',
				description: 'Torrential downpour with high accumulation',
			},
			66: {
				label: 'Light Freezing Rain',
				atmosphere: 'rain_light',
				icon: 'icicles',
				sound: 'rain_light',
				description: 'Raindrops that freeze on impact',
			},
			67: {
				label: 'Heavy Freezing Rain',
				atmosphere: 'snow',
				icon: 'icicles',
				sound: 'rain_heavy',
				description: 'Severe glaze ice conditions from freezing rain',
			},
			71: {
				label: 'Slight Snow Fall',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Light fluttering snowflakes',
			},
			73: {
				label: 'Moderate Snow Fall',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Steady swirling snowfall',
			},
			75: {
				label: 'Heavy Snow Fall',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Intense blizzard-like heavy snowfall',
			},
			77: {
				label: 'Snow Grains',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Small opaque ice granules falling',
			},
			80: {
				label: 'Slight Rain Showers',
				atmosphere: 'rain_light',
				icon: 'cloud-sun-rain',
				sound: 'rain_light',
				description: 'Intermittent brief rain showers',
			},
			81: {
				label: 'Moderate Rain Showers',
				atmosphere: 'rain_medium',
				icon: 'cloud-showers-heavy',
				sound: 'rain_medium',
				description: 'Passing vigorous rain showers',
			},
			82: {
				label: 'Violent Rain Showers',
				atmosphere: 'rain_heavy',
				icon: 'cloud-showers-heavy',
				sound: 'rain_heavy',
				description: 'Sudden burst of torrential rain showers',
			},
			85: {
				label: 'Slight Snow Showers',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Brief passing snow flurries',
			},
			86: {
				label: 'Heavy Snow Showers',
				atmosphere: 'snow',
				icon: 'snowflake',
				sound: 'snow_wind',
				description: 'Heavy burst of snow squalls',
			},
			95: {
				label: 'Thunderstorm',
				atmosphere: 'thunderstorm',
				icon: 'bolt',
				sound: 'thunder',
				description: 'Thunderstorm with lightning strikes & rainfall',
			},
			96: {
				label: 'Thunderstorm with Slight Hail',
				atmosphere: 'thunderstorm',
				icon: 'bolt',
				sound: 'thunder',
				description: 'Thunderstorm accompanied by small hail',
			},
			99: {
				label: 'Thunderstorm with Heavy Hail',
				atmosphere: 'thunderstorm',
				icon: 'bolt',
				sound: 'thunder',
				description: 'Severe thunderstorm with damaging hail',
			},
		};

		return (
			weatherMap[c] || {
				label: 'Partly Cloudy',
				atmosphere: 'clouds',
				icon: 'cloud',
				sound: 'wind_gentle',
				description: 'Typical atmospheric conditions',
			}
		);
	}

	/**
	 * Unit conversion helpers
	 */
	convertTemp(celsius, unit = 'c') {
		if (celsius === null || celsius === undefined || isNaN(celsius))
			return '--';
		if (unit === 'f') {
			return Math.round((celsius * 9) / 5 + 32);
		}
		return Math.round(celsius);
	}

	convertWind(kmh, unit = 'kmh') {
		if (kmh === null || kmh === undefined || isNaN(kmh)) return '--';
		switch (unit) {
			case 'mph':
				return (kmh * 0.621371).toFixed(1);
			case 'knots':
				return (kmh * 0.539957).toFixed(1);
			case 'ms':
				return (kmh / 3.6).toFixed(1);
			case 'kmh':
			default:
				return Math.round(kmh).toString();
		}
	}

	convertPrecip(mm, unit = 'mm') {
		if (mm === null || mm === undefined || isNaN(mm)) return '--';
		if (unit === 'inch') {
			return (mm * 0.0393701).toFixed(2);
		}
		return mm.toFixed(1);
	}

	convertPressure(hPa, unit = 'hPa') {
		if (hPa === null || hPa === undefined || isNaN(hPa)) return '--';
		if (unit === 'inHg') {
			return (hPa * 0.02953).toFixed(2);
		}
		return Math.round(hPa).toString();
	}

	getWindDirectionCompass(degrees) {
		if (degrees === null || degrees === undefined) return 'N';
		const directions = [
			'N',
			'NNE',
			'NE',
			'ENE',
			'E',
			'ESE',
			'SE',
			'SSE',
			'S',
			'SSW',
			'SW',
			'WSW',
			'W',
			'WNW',
			'NW',
			'NNW',
		];
		const idx = Math.round((degrees % 360) / 22.5) % 16;
		return directions[idx];
	}

	getCountryFlagEmoji(countryCode) {
		if (!countryCode || countryCode.length !== 2) return '🌐';
		const codePoints = countryCode
			.toUpperCase()
			.split('')
			.map((char) => 127397 + char.charCodeAt(0));
		return String.fromCodePoint(...codePoints);
	}
}

// Global API instance
window.weatherAPI = new WeatherAPI();
