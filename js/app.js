/**
 * Main Application Orchestrator & UI Controller
 */
class WeatherApp {
	constructor() {
		this.atmosphere = null;
		this.searchDebounceTimer = null;
		this.init();
	}

	async init() {
		// 1. Initialize Canvas Background Atmosphere
		this.atmosphere = new window.CanvasAtmosphere('weatherCanvas');

		// 2. Initialize Leaflet Map
		window.weatherMap.onLocationSelect = async (lat, lon) => {
			this.showLoading(true);
			const loc = await window.weatherAPI.reverseGeocode(lat, lon);
			await this.loadLocationWeather(loc);
		};

		// 3. Setup UI Event Listeners
		this.bindEvents();

		// 4. Render Saved Location Pills
		this.renderSavedLocations();

		// 5. Initial Geolocation / Fallback Load
		await this.autoDetectLocation();
	}

	/**
	 * Bind DOM Events
	 */
	bindEvents() {
		// Search input autocomplete
		const searchInput = document.getElementById('citySearchInput');
		const searchResults = document.getElementById('searchResultsDropdown');

		if (searchInput) {
			searchInput.addEventListener('input', (e) => {
				const q = e.target.value;
				clearTimeout(this.searchDebounceTimer);
				if (q.trim().length < 2) {
					searchResults.classList.remove('active');
					searchResults.innerHTML = '';
					return;
				}
				this.searchDebounceTimer = setTimeout(async () => {
					const results = await window.weatherAPI.searchLocations(q);
					this.renderSearchResults(results, searchResults);
				}, 250);
			});

			// Close dropdown when clicked outside
			document.addEventListener('click', (e) => {
				if (
					!searchInput.contains(e.target) &&
					!searchResults.contains(e.target)
				) {
					searchResults.classList.remove('active');
				}
			});
		}

		// Geolocation button
		const geoBtn = document.getElementById('currentLocationBtn');
		if (geoBtn) {
			geoBtn.addEventListener('click', () => this.autoDetectLocation(true));
		}

		// Save/Favorite button
		const saveLocBtn = document.getElementById('saveLocationBtn');
		if (saveLocBtn) {
			saveLocBtn.addEventListener('click', () => {
				if (window.state.currentLocation) {
					const isSaved = window.state.toggleSaveLocation(
						window.state.currentLocation,
					);
					this.updateSaveButtonState(isSaved);
					this.renderSavedLocations();
					this.showToast(
						isSaved ? 'Saved to favorite locations' : 'Removed from favorites',
					);
				}
			});
		}

		// Time Scrubber Slider
		const scrubber = document.getElementById('timeScrubber');
		const resetScrubberBtn = document.getElementById('resetScrubberBtn');

		if (scrubber) {
			scrubber.addEventListener('input', (e) => {
				const hourIdx = parseInt(e.target.value, 10);
				this.handleTimeScrubber(hourIdx);
			});
		}

		if (resetScrubberBtn) {
			resetScrubberBtn.addEventListener('click', () => {
				window.state.scrubberActive = false;
				scrubber.value = 0;
				document.getElementById('scrubberTimeDisplay').textContent =
					'Live (Now)';
				resetScrubberBtn.classList.remove('active');
				this.updateCurrentDisplay();
			});
		}

		// Chart tab switches
		document.querySelectorAll('.chart-tab-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				document
					.querySelectorAll('.chart-tab-btn')
					.forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');
				const tab = btn.dataset.tab;
				if (window.state.currentWeather) {
					window.weatherCharts.setTab(
						tab,
						window.state.currentWeather,
						window.state.airQuality,
						window.state.prefs.tempUnit,
						window.state.prefs.windUnit,
					);
				}
			});
		});

		// Audio Soundscape Controls
		const audioToggle = document.getElementById('audioToggleBtn');
		const audioVolSlider = document.getElementById('audioVolumeSlider');

		if (audioToggle) {
			audioToggle.addEventListener('click', () => {
				const isEnabled = !window.state.prefs.audioEnabled;
				window.state.setPref('audioEnabled', isEnabled);
				this.updateAudioState();
			});
		}

		if (audioVolSlider) {
			audioVolSlider.addEventListener('input', (e) => {
				const vol = parseFloat(e.target.value);
				window.state.setPref('audioVolume', vol);
				window.weatherAudio.setVolume(vol);
			});
		}

		// Export / Share Card Modal
		const exportBtn = document.getElementById('exportCardBtn');
		const exportModal = document.getElementById('exportModal');
		const closeExportModal = document.getElementById('closeExportModal');
		const downloadCardBtn = document.getElementById('downloadCardBtn');

		if (exportBtn && exportModal) {
			exportBtn.addEventListener('click', async () => {
				exportModal.classList.add('active');
				await this.previewExportCard();
			});
		}

		if (closeExportModal) {
			closeExportModal.addEventListener('click', () => {
				exportModal.classList.remove('active');
			});
		}

		if (downloadCardBtn) {
			downloadCardBtn.addEventListener('click', async () => {
				if (window.state.currentLocation && window.state.currentWeather) {
					await window.cardExporter.downloadCard(
						window.state.currentLocation,
						window.state.currentWeather.current,
						window.state.currentWeather.daily,
						window.state.airQuality,
						window.state.prefs.tempUnit,
						window.state.prefs.windUnit,
					);
					this.showToast('Weather snapshot downloaded!');
				}
			});
		}

		// City Comparison Tool Modal
		const compareBtn = document.getElementById('compareCitiesBtn');
		const compareModal = document.getElementById('compareModal');
		const closeCompareModal = document.getElementById('closeCompareModal');
		const compareSearchInput = document.getElementById('compareCitySearch');
		const compareSearchResults = document.getElementById(
			'compareSearchResults',
		);

		if (compareBtn && compareModal) {
			compareBtn.addEventListener('click', () => {
				compareModal.classList.add('active');
				this.renderComparisonView();
			});
		}

		if (closeCompareModal) {
			closeCompareModal.addEventListener('click', () => {
				compareModal.classList.remove('active');
			});
		}

		if (compareSearchInput) {
			compareSearchInput.addEventListener('input', (e) => {
				const q = e.target.value;
				if (q.trim().length < 2) {
					compareSearchResults.innerHTML = '';
					return;
				}
				setTimeout(async () => {
					const results = await window.weatherAPI.searchLocations(q);
					compareSearchResults.innerHTML = results
						.map(
							(loc) => `
            <div class="search-result-item" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${loc.name}" data-country="${loc.country}">
              <span>${window.weatherAPI.getCountryFlagEmoji(loc.country_code)} <b>${loc.name}</b>, ${loc.country}</span>
            </div>
          `,
						)
						.join('');

					compareSearchResults
						.querySelectorAll('.search-result-item')
						.forEach((item) => {
							item.addEventListener('click', async () => {
								const lat = parseFloat(item.dataset.lat);
								const lon = parseFloat(item.dataset.lon);
								const name = item.dataset.name;
								const country = item.dataset.country;

								const locObj = { name, country, latitude: lat, longitude: lon };
								const forecast = await window.weatherAPI.getForecast(lat, lon);
								window.state.comparisonLocation = locObj;
								window.state.comparisonWeather = forecast;
								compareSearchResults.innerHTML = '';
								compareSearchInput.value = '';
								this.renderComparisonView();
							});
						});
				}, 250);
			});
		}

		// Settings & Unit Switches
		const settingsBtn = document.getElementById('settingsBtn');
		const settingsModal = document.getElementById('settingsModal');
		const closeSettingsModal = document.getElementById('closeSettingsModal');

		if (settingsBtn && settingsModal) {
			settingsBtn.addEventListener('click', () =>
				settingsModal.classList.add('active'),
			);
		}
		if (closeSettingsModal) {
			closeSettingsModal.addEventListener('click', () =>
				settingsModal.classList.remove('active'),
			);
		}

		// Unit Radio/Select changes
		document.querySelectorAll('.unit-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const group = btn.dataset.unitGroup;
				const val = btn.dataset.unitVal;
				document
					.querySelectorAll(`.unit-btn[data-unit-group="${group}"]`)
					.forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');

				if (group === 'temp') window.state.setPref('tempUnit', val);
				if (group === 'wind') window.state.setPref('windUnit', val);
				if (group === 'precip') window.state.setPref('precipUnit', val);
				if (group === 'pressure') window.state.setPref('pressureUnit', val);

				this.refreshDisplays();
			});
		});

		// Modal background clicks to dismiss
		document.querySelectorAll('.modal-overlay').forEach((modal) => {
			modal.addEventListener('click', (e) => {
				if (e.target === modal) {
					modal.classList.remove('active');
				}
			});
		});

		// ESC key to dismiss modals
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				document
					.querySelectorAll('.modal-overlay.active')
					.forEach((m) => m.classList.remove('active'));
				if (searchResults) searchResults.classList.remove('active');
			}
		});
	}

	/**
	 * Auto Detect Browser Location or Fallback
	 */
	async autoDetectLocation(force = false) {
		this.showLoading(true);

		const savedLast = window.state.getLastLocation();
		if (savedLast && !force) {
			await this.loadLocationWeather(savedLast);
			return;
		}

		if ('geolocation' in navigator) {
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					const lat = position.coords.latitude;
					const lon = position.coords.longitude;
					const loc = await window.weatherAPI.reverseGeocode(lat, lon);
					await this.loadLocationWeather(loc);
				},
				async (err) => {
					console.warn(
						'Geolocation denied or failed, using default location:',
						err,
					);
					// Default to London or saved city
					const defaultLoc = window.state.savedLocations[0] || {
						name: 'London',
						country: 'United Kingdom',
						country_code: 'GB',
						latitude: 51.5074,
						longitude: -0.1278,
						timezone: 'Europe/London',
					};
					await this.loadLocationWeather(defaultLoc);
				},
				{ timeout: 8000, enableHighAccuracy: false },
			);
		} else {
			const defaultLoc = {
				name: 'Tokyo',
				country: 'Japan',
				country_code: 'JP',
				latitude: 35.6895,
				longitude: 139.6917,
				timezone: 'Asia/Tokyo',
			};
			await this.loadLocationWeather(defaultLoc);
		}
	}

	/**
	 * Load all weather components for a given location
	 */
	async loadLocationWeather(location) {
		this.showLoading(true);
		try {
			window.state.currentLocation = location;
			window.state.saveLastLocation(location);

			const lat = location.latitude;
			const lon = location.longitude;
			const tz = location.timezone || 'auto';

			// Parallel fetch forecast, air quality, historical archive
			const [forecastData, airData, historicalData] = await Promise.all([
				window.weatherAPI.getForecast(lat, lon, tz),
				window.weatherAPI.getAirQuality(lat, lon),
				window.weatherAPI.getHistoricalComparison(lat, lon, tz),
			]);

			window.state.currentWeather = forecastData;
			window.state.airQuality = airData;
			window.state.historicalWeather = historicalData;

			// Update Map view
			const tempStr = `${window.weatherAPI.convertTemp(forecastData.current.temperature_2m, window.state.prefs.tempUnit)}°`;
			window.weatherMap.setView(
				lat,
				lon,
				9,
				`${location.name}, ${location.country}`,
				tempStr,
			);

			// Render all widgets
			this.updateSaveButtonState(window.state.isLocationSaved(lat, lon));
			this.updateCurrentDisplay();
			this.renderDailyForecast();
			this.renderHourlyCards();
			this.renderAstronomy();
			this.renderAirQuality();
			this.renderLifestyle();
			this.renderHistoricalComparison();

			// Render Charts
			window.weatherCharts.renderHourlyChart(
				forecastData,
				airData,
				window.state.prefs.tempUnit,
				window.state.prefs.windUnit,
			);

			// Trigger Audio atmosphere if enabled
			this.updateAudioState();
		} catch (err) {
			console.error('Failed to load weather data:', err);
			this.showToast('Could not retrieve weather data. Please try again.');
		} finally {
			this.showLoading(false);
		}
	}

	/**
	 * Render search results dropdown
	 */
	renderSearchResults(results, container) {
		if (!results || results.length === 0) {
			container.innerHTML =
				'<div class="search-empty">No matching cities found</div>';
			container.classList.add('active');
			return;
		}

		container.innerHTML = results
			.map(
				(loc) => `
      <div class="search-result-item" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${loc.name}" data-admin="${loc.admin1}" data-country="${loc.country}" data-code="${loc.country_code}" data-tz="${loc.timezone}">
        <div class="search-item-flag">${window.weatherAPI.getCountryFlagEmoji(loc.country_code)}</div>
        <div class="search-item-info">
          <div class="search-item-name">${loc.name}</div>
          <div class="search-item-sub">${[loc.admin1, loc.country].filter(Boolean).join(', ')}</div>
        </div>
        <div class="search-item-coords">${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°</div>
      </div>
    `,
			)
			.join('');

		container.classList.add('active');

		// Add click listeners
		container.querySelectorAll('.search-result-item').forEach((item) => {
			item.addEventListener('click', async () => {
				const location = {
					name: item.dataset.name,
					admin1: item.dataset.admin,
					country: item.dataset.country,
					country_code: item.dataset.code,
					latitude: parseFloat(item.dataset.lat),
					longitude: parseFloat(item.dataset.lon),
					timezone: item.dataset.tz,
				};

				container.classList.remove('active');
				document.getElementById('citySearchInput').value = '';
				await this.loadLocationWeather(location);
			});
		});
	}

	/**
	 * Update Main Hero Display
	 */
	updateCurrentDisplay() {
		const loc = window.state.currentLocation;
		const forecast = window.state.currentWeather;
		if (!loc || !forecast) return;

		let current = forecast.current;
		let isLive = true;

		// If scrubber active, pick selected hour from hourly
		if (window.state.scrubberActive && forecast.hourly) {
			const idx = window.state.scrubberHourIndex;
			const h = forecast.hourly;
			isLive = false;
			current = {
				temperature_2m: h.temperature_2m[idx],
				apparent_temperature: h.apparent_temperature[idx],
				relative_humidity_2m: h.relative_humidity_2m[idx],
				weather_code: h.weather_code[idx],
				wind_speed_10m: h.wind_speed_10m[idx],
				wind_direction_10m: h.wind_direction_10m[idx],
				wind_gusts_10m: h.wind_gusts_10m
					? h.wind_gusts_10m[idx]
					: h.wind_speed_10m[idx],
				surface_pressure: h.surface_pressure[idx],
				uv_index: h.uv_index ? h.uv_index[idx] : 0,
				cloud_cover: h.cloud_cover[idx],
				precipitation: h.precipitation[idx],
				is_day: h.is_day ? h.is_day[idx] : 1,
			};
		}

		const { tempUnit, windUnit, precipUnit, pressureUnit } = window.state.prefs;
		const isDay = current.is_day === 1 || current.is_day === true;
		const codeInfo = window.weatherAPI.getWeatherCodeInfo(
			current.weather_code,
			isDay,
		);

		// Update Atmosphere Dynamic Canvas
		this.atmosphere.setAtmosphere(
			codeInfo.atmosphere,
			isDay,
			current.cloud_cover || 20,
			current.wind_speed_10m || 10,
			current.wind_direction_10m || 90,
		);

		// Update Hero elements
		const flag = window.weatherAPI.getCountryFlagEmoji(loc.country_code);
		document.getElementById('cityName').innerHTML = `${flag} ${loc.name}`;
		document.getElementById('cityCountry').textContent =
			[loc.admin1, loc.country].filter(Boolean).join(', ') || 'Global Location';

		document.getElementById('currentTemp').textContent =
			`${window.weatherAPI.convertTemp(current.temperature_2m, tempUnit)}°`;
		document.getElementById('currentConditionLabel').textContent =
			codeInfo.label;
		document.getElementById('currentConditionDesc').textContent =
			codeInfo.description;
		document.getElementById('feelsLikeTemp').textContent =
			`${window.weatherAPI.convertTemp(current.apparent_temperature, tempUnit)}°${tempUnit.toUpperCase()}`;

		// Daily High / Low
		if (forecast.daily) {
			const maxT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_max[0],
				tempUnit,
			);
			const minT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_min[0],
				tempUnit,
			);
			document.getElementById('heroHighLow').textContent =
				`H: ${maxT}°  •  L: ${minT}°`;
		}

		// Hero Metric Badges
		document.getElementById('windMetric').textContent =
			`${window.weatherAPI.convertWind(current.wind_speed_10m, windUnit)} ${windUnit}`;
		document.getElementById('windDirMetric').textContent =
			`${window.weatherAPI.getWindDirectionCompass(current.wind_direction_10m)} (${Math.round(current.wind_direction_10m || 0)}°)`;
		document.getElementById('humidityMetric').textContent =
			`${current.relative_humidity_2m || 0}%`;
		document.getElementById('uvMetric').textContent =
			`${current.uv_index || 0} (${window.lifestyle.calcUVIndex(current.uv_index).level})`;
		document.getElementById('pressureMetric').textContent =
			`${window.weatherAPI.convertPressure(current.surface_pressure, pressureUnit)} ${pressureUnit}`;
		document.getElementById('cloudMetric').textContent =
			`${current.cloud_cover || 0}%`;
		document.getElementById('precipMetric').textContent =
			`${window.weatherAPI.convertPrecip(current.precipitation || 0, precipUnit)} ${precipUnit}`;
	}

	/**
	 * Handle Time Scrubber slider input
	 */
	handleTimeScrubber(hourIdx) {
		const forecast = window.state.currentWeather;
		if (!forecast || !forecast.hourly || !forecast.hourly.time[hourIdx]) return;

		window.state.scrubberActive = true;
		window.state.scrubberHourIndex = hourIdx;

		const timeISO = forecast.hourly.time[hourIdx];
		const d = new Date(timeISO);
		const timeStr = d.toLocaleDateString([], {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});

		document.getElementById('scrubberTimeDisplay').textContent =
			hourIdx === 0 ? 'Live (Now)' : `Simulation: ${timeStr}`;
		document.getElementById('resetScrubberBtn').classList.add('active');

		this.updateCurrentDisplay();
	}

	/**
	 * Render 7-Day Forecast Grid Cards
	 */
	renderDailyForecast() {
		const daily = window.state.currentWeather?.daily;
		const container = document.getElementById('dailyForecastContainer');
		if (!daily || !container) return;

		const { tempUnit } = window.state.prefs;
		container.innerHTML = '';

		for (let i = 0; i < daily.time.length; i++) {
			const date = new Date(daily.time[i] + 'T00:00:00');
			const dayName =
				i === 0
					? 'Today'
					: date.toLocaleDateString(undefined, { weekday: 'short' });
			const dateStr = date.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			});
			const code = daily.weather_code[i];
			const info = window.weatherAPI.getWeatherCodeInfo(code, true);
			const maxT = window.weatherAPI.convertTemp(
				daily.temperature_2m_max[i],
				tempUnit,
			);
			const minT = window.weatherAPI.convertTemp(
				daily.temperature_2m_min[i],
				tempUnit,
			);
			const precipProb = daily.precipitation_probability_max
				? daily.precipitation_probability_max[i] || 0
				: 0;

			const card = document.createElement('div');
			card.className = `daily-card ${i === 0 ? 'active' : ''}`;
			card.innerHTML = `
        <div class="daily-day">${dayName}</div>
        <div class="daily-date">${dateStr}</div>
        <div class="daily-icon"><i class="fa-solid fa-${info.icon}"></i></div>
        <div class="daily-cond">${info.label}</div>
        <div class="daily-temps">
          <span class="daily-max">${maxT}°</span>
          <span class="daily-min">${minT}°</span>
        </div>
        ${precipProb > 10 ? `<div class="daily-precip"><i class="fa-solid fa-droplet"></i> ${precipProb}%</div>` : '<div class="daily-precip-empty"></div>'}
      `;
			container.appendChild(card);
		}
	}

	/**
	 * Render Hourly Horizontal Carousel
	 */
	renderHourlyCards() {
		const hourly = window.state.currentWeather?.hourly;
		const container = document.getElementById('hourlyCardsContainer');
		if (!hourly || !container) return;

		const { tempUnit, windUnit } = window.state.prefs;
		container.innerHTML = '';

		for (let i = 0; i < Math.min(24, hourly.time.length); i++) {
			const d = new Date(hourly.time[i]);
			const hourStr =
				i === 0
					? 'Now'
					: d.toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit',
							hour12: false,
						});
			const code = hourly.weather_code[i];
			const isDay = hourly.is_day ? hourly.is_day[i] : 1;
			const info = window.weatherAPI.getWeatherCodeInfo(code, isDay);
			const temp = window.weatherAPI.convertTemp(
				hourly.temperature_2m[i],
				tempUnit,
			);
			const rainProb = hourly.precipitation_probability[i] || 0;

			const item = document.createElement('div');
			item.className = 'hourly-card';
			item.innerHTML = `
        <div class="hourly-time">${hourStr}</div>
        <div class="hourly-icon"><i class="fa-solid fa-${info.icon}"></i></div>
        <div class="hourly-temp">${temp}°</div>
        <div class="hourly-rain">${rainProb > 0 ? `💧 ${rainProb}%` : ''}</div>
      `;
			container.appendChild(item);
		}
	}

	/**
	 * Render Astronomy (Solar Arc & Moon Phase)
	 */
	renderAstronomy() {
		const daily = window.state.currentWeather?.daily;
		const containerArc = document.getElementById('solarArcWrapper');
		const containerMoon = document.getElementById('moonPhaseWrapper');
		if (!daily || !containerArc || !containerMoon) return;

		const sunrise = daily.sunrise ? daily.sunrise[0] : null;
		const sunset = daily.sunset ? daily.sunset[0] : null;

		const solarMetrics = window.astronomy.calculateSolarMetrics(
			sunrise,
			sunset,
		);
		containerArc.innerHTML = window.astronomy.renderSolarArcSVG(solarMetrics);

		document.getElementById('dayDuration').textContent =
			solarMetrics.dayDuration;
		document.getElementById('goldenHour').textContent =
			`${solarMetrics.goldenHourMorning} / ${solarMetrics.goldenHourEvening}`;

		// Moon phase
		const moon = window.astronomy.getMoonPhase(new Date());
		containerMoon.innerHTML = `
      <div class="moon-visual">
        ${window.astronomy.renderMoonSVG(moon.phaseRatio, 72)}
      </div>
      <div class="moon-details">
        <div class="moon-name">${moon.phaseIcon} ${moon.phaseName}</div>
        <div class="moon-illum">${moon.illuminationPercent}% Illumination</div>
        <div class="moon-cycle">Day ${moon.daysIntoCycle} of 29.5-day cycle</div>
      </div>
    `;
	}

	/**
	 * Render Air Quality widget & Pollutant breakdown
	 */
	renderAirQuality() {
		const aqiData = window.state.airQuality;
		const container = document.getElementById('aqiGaugeContainer');
		const breakdownContainer = document.getElementById('aqiBreakdownContainer');
		if (!aqiData || !container) return;

		const usAqi = aqiData.current?.us_aqi || 35;
		const status = window.airQuality.getAQIStatus(usAqi);

		container.innerHTML = window.airQuality.renderRadialGaugeSVG(usAqi, 170);
		document.getElementById('aqiStatement').textContent = status.statement;
		document.getElementById('aqiRecommendation').textContent =
			status.recommendation;

		// Pollutants breakdown
		if (breakdownContainer && aqiData.current) {
			const cur = aqiData.current;
			const list = [
				{ name: 'PM2.5', val: `${cur.pm2_5?.toFixed(1) || '--'} µg/m³` },
				{ name: 'PM10', val: `${cur.pm10?.toFixed(1) || '--'} µg/m³` },
				{ name: 'Ozone (O₃)', val: `${cur.ozone?.toFixed(1) || '--'} µg/m³` },
				{
					name: 'NO₂',
					val: `${cur.nitrogen_dioxide?.toFixed(1) || '--'} µg/m³`,
				},
				{
					name: 'SO₂',
					val: `${cur.sulphur_dioxide?.toFixed(1) || '--'} µg/m³`,
				},
				{ name: 'CO', val: `${cur.carbon_monoxide?.toFixed(1) || '--'} µg/m³` },
			];

			breakdownContainer.innerHTML = list
				.map(
					(item) => `
        <div class="aqi-pollutant-box">
          <div class="pollutant-name">${item.name}</div>
          <div class="pollutant-val">${item.val}</div>
        </div>
      `,
				)
				.join('');
		}
	}

	/**
	 * Render Lifestyle & Activity Scores
	 */
	renderLifestyle() {
		const current = window.state.currentWeather?.current;
		const daily = window.state.currentWeather?.daily;
		const aqiData = window.state.airQuality;
		const moon = window.astronomy.getMoonPhase(new Date());
		const container = document.getElementById('lifestyleGrid');
		if (!current || !container) return;

		const scores = window.lifestyle.calculateIndices(
			current,
			daily,
			aqiData,
			moon,
		);

		const items = [
			{ title: 'Running & Exercise', ...scores.running },
			{ title: 'Stargazing & Astronomy', ...scores.stargazing },
			{ title: 'BBQ & Outdoor Dining', ...scores.bbq },
			{ title: 'Car Washing', ...scores.carWash },
			{ title: 'Drying Laundry', ...scores.laundry },
			{ title: 'UV Sun Protection', ...scores.uv },
		];

		container.innerHTML = items
			.map(
				(item) => `
      <div class="lifestyle-card">
        <div class="lifestyle-header">
          <div class="lifestyle-icon" style="color: ${item.color}"><i class="fa-solid ${item.icon}"></i></div>
          <div class="lifestyle-score" style="color: ${item.color}">${item.score}${item.score <= 12 && item.title.includes('UV') ? '' : '%'}</div>
        </div>
        <div class="lifestyle-title">${item.title}</div>
        <div class="lifestyle-status" style="background: ${item.color}22; color: ${item.color}">${item.status || item.level}</div>
        <div class="lifestyle-advice">${item.advice}</div>
      </div>
    `,
			)
			.join('');
	}

	/**
	 * Render "This Day Last Year" Historical Comparison
	 */
	renderHistoricalComparison() {
		const hist = window.state.historicalWeather;
		const cur = window.state.currentWeather;
		const container = document.getElementById('historicalComparisonContainer');
		if (!hist || !cur || !container) return;

		const { tempUnit } = window.state.prefs;
		const curMax = cur.daily?.temperature_2m_max[0];
		const histMax = hist.daily?.temperature_2m_max
			? hist.daily.temperature_2m_max[0]
			: null;

		if (histMax === null || histMax === undefined) {
			container.innerHTML =
				'<div class="hist-empty">Historical archive data unavailable for this coordinate.</div>';
			return;
		}

		const deltaC = (curMax - histMax).toFixed(1);
		const deltaSign = deltaC > 0 ? '+' : '';
		const isWarmer = deltaC > 0;

		container.innerHTML = `
      <div class="hist-card">
        <div class="hist-metric">
          <div class="hist-val-box">
            <span class="hist-label">Today</span>
            <span class="hist-temp">${window.weatherAPI.convertTemp(curMax, tempUnit)}°</span>
          </div>
          <div class="hist-vs">VS</div>
          <div class="hist-val-box">
            <span class="hist-label">This Day Last Year</span>
            <span class="hist-temp">${window.weatherAPI.convertTemp(histMax, tempUnit)}°</span>
          </div>
        </div>
        <div class="hist-delta ${isWarmer ? 'warmer' : 'cooler'}">
          <i class="fa-solid fa-${isWarmer ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
          <span>${deltaSign}${deltaC}°C ${isWarmer ? 'warmer' : 'cooler'} than exactly 1 year ago</span>
        </div>
      </div>
    `;
	}

	/**
	 * Render Saved Locations Quick Pills
	 */
	renderSavedLocations() {
		const list = window.state.savedLocations;
		const container = document.getElementById('savedLocationsList');
		if (!container) return;

		container.innerHTML = list
			.map(
				(loc) => `
      <button class="saved-city-pill" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${loc.name}" data-country="${loc.country}" data-code="${loc.country_code}" data-tz="${loc.timezone}">
        <span class="pill-flag">${window.weatherAPI.getCountryFlagEmoji(loc.country_code)}</span>
        <span class="pill-name">${loc.name}</span>
      </button>
    `,
			)
			.join('');

		container.querySelectorAll('.saved-city-pill').forEach((pill) => {
			pill.addEventListener('click', async () => {
				const loc = {
					name: pill.dataset.name,
					country: pill.dataset.country,
					country_code: pill.dataset.code,
					latitude: parseFloat(pill.dataset.lat),
					longitude: parseFloat(pill.dataset.lon),
					timezone: pill.dataset.tz,
				};
				await this.loadLocationWeather(loc);
			});
		});
	}

	updateSaveButtonState(isSaved) {
		const btn = document.getElementById('saveLocationBtn');
		if (btn) {
			if (isSaved) {
				btn.classList.add('saved');
				btn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
			} else {
				btn.classList.remove('saved');
				btn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
			}
		}
	}

	/**
	 * Render Comparison Modal Side-by-Side
	 */
	renderComparisonView() {
		const cityA = window.state.currentLocation;
		const weatherA = window.state.currentWeather;
		const cityB = window.state.comparisonLocation;
		const weatherB = window.state.comparisonWeather;
		const container = document.getElementById('comparisonDisplayArea');
		if (!container) return;

		const { tempUnit, windUnit } = window.state.prefs;

		if (!cityB || !weatherB) {
			container.innerHTML = `
        <div class="compare-placeholder">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>Search and select a 2nd city above to compare weather parameters side-by-side.</p>
        </div>
      `;
			return;
		}

		const tempA = weatherA.current.temperature_2m;
		const tempB = weatherB.current.temperature_2m;
		const diffTemp = (tempB - tempA).toFixed(1);

		container.innerHTML = `
      <div class="comparison-grid">
        <div class="compare-col">
          <div class="compare-city-title">${window.weatherAPI.getCountryFlagEmoji(cityA.country_code)} ${cityA.name}</div>
          <div class="compare-big-temp">${window.weatherAPI.convertTemp(tempA, tempUnit)}°</div>
          <div class="compare-stat"><span>Humidity:</span> <b>${weatherA.current.relative_humidity_2m}%</b></div>
          <div class="compare-stat"><span>Wind:</span> <b>${window.weatherAPI.convertWind(weatherA.current.wind_speed_10m, windUnit)} ${windUnit}</b></div>
          <div class="compare-stat"><span>Pressure:</span> <b>${Math.round(weatherA.current.surface_pressure)} hPa</b></div>
          <div class="compare-stat"><span>UV Index:</span> <b>${weatherA.current.uv_index || 0}</b></div>
        </div>

        <div class="compare-delta-col">
          <div class="compare-delta-tag ${diffTemp >= 0 ? 'warmer' : 'cooler'}">
            ${diffTemp >= 0 ? `+${diffTemp}` : diffTemp}°C Delta
          </div>
        </div>

        <div class="compare-col">
          <div class="compare-city-title">${window.weatherAPI.getCountryFlagEmoji(cityB.country_code)} ${cityB.name}</div>
          <div class="compare-big-temp">${window.weatherAPI.convertTemp(tempB, tempUnit)}°</div>
          <div class="compare-stat"><span>Humidity:</span> <b>${weatherB.current.relative_humidity_2m}%</b></div>
          <div class="compare-stat"><span>Wind:</span> <b>${window.weatherAPI.convertWind(weatherB.current.wind_speed_10m, windUnit)} ${windUnit}</b></div>
          <div class="compare-stat"><span>Pressure:</span> <b>${Math.round(weatherB.current.surface_pressure)} hPa</b></div>
          <div class="compare-stat"><span>UV Index:</span> <b>${weatherB.current.uv_index || 0}</b></div>
        </div>
      </div>
    `;
	}

	/**
	 * Preview Export Share Card inside modal
	 */
	async previewExportCard() {
		const previewContainer = document.getElementById('exportCardPreview');
		if (
			!previewContainer ||
			!window.state.currentLocation ||
			!window.state.currentWeather
		)
			return;

		previewContainer.innerHTML =
			'<div class="card-generating">Rendering 4K Canvas Snapshot...</div>';
		const canvas = await window.cardExporter.generateCard(
			window.state.currentLocation,
			window.state.currentWeather.current,
			window.state.currentWeather.daily,
			window.state.airQuality,
			window.state.prefs.tempUnit,
			window.state.prefs.windUnit,
		);

		previewContainer.innerHTML = '';
		canvas.style.width = '100%';
		canvas.style.height = 'auto';
		canvas.style.borderRadius = '14px';
		previewContainer.appendChild(canvas);
	}

	/**
	 * Update Audio soundscape matching current weather
	 */
	updateAudioState() {
		const isEnabled = window.state.prefs.audioEnabled;
		const btn = document.getElementById('audioToggleBtn');
		if (btn) {
			if (isEnabled) {
				btn.classList.add('playing');
				btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
			} else {
				btn.classList.remove('playing');
				btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
			}
		}

		if (!isEnabled) {
			window.weatherAudio.stopAll();
			return;
		}

		const current = window.state.currentWeather?.current;
		if (current) {
			const isDay = current.is_day === 1 || current.is_day === true;
			const codeInfo = window.weatherAPI.getWeatherCodeInfo(
				current.weather_code,
				isDay,
			);
			window.weatherAudio.playWeatherSound(codeInfo.sound);
		}
	}

	/**
	 * Refresh all unit displays
	 */
	refreshDisplays() {
		this.updateCurrentDisplay();
		this.renderDailyForecast();
		this.renderHourlyCards();
		this.renderHistoricalComparison();
		if (window.state.currentWeather) {
			window.weatherCharts.renderHourlyChart(
				window.state.currentWeather,
				window.state.airQuality,
				window.state.prefs.tempUnit,
				window.state.prefs.windUnit,
			);
		}
	}

	showLoading(show = true) {
		const loader = document.getElementById('globalLoader');
		if (loader) {
			if (show) loader.classList.add('active');
			else loader.classList.remove('active');
		}
	}

	showToast(message, duration = 3000) {
		const toast = document.getElementById('appToast');
		if (toast) {
			toast.textContent = message;
			toast.classList.add('show');
			setTimeout(() => toast.classList.remove('show'), duration);
		}
	}
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
	window.app = new WeatherApp();
});
