/**
 * Main Application Orchestrator & UI Controller
 */
class WeatherApp {
	constructor() {
		this.atmosphere = null;
		this.searchDebounceTimer = null;
		this.init();
	}

	/**
	 * Safe DOM Element Selector Helper
	 * Resolves by ID or CSS selector without throwing errors
	 */
	getElement(selectorOrId) {
		if (!selectorOrId) return null;
		if (typeof selectorOrId !== 'string') return selectorOrId;
		if (
			selectorOrId.startsWith('#') ||
			selectorOrId.startsWith('.') ||
			selectorOrId.includes(' ') ||
			selectorOrId.includes('[')
		) {
			return document.querySelector(selectorOrId);
		}
		return (
			document.getElementById(selectorOrId) ||
			document.querySelector(selectorOrId)
		);
	}

	/**
	 * Null-safe textContent setter
	 */
	setText(selectorOrId, text) {
		const el = this.getElement(selectorOrId);
		if (el) {
			el.textContent = text ?? '';
		}
		return el;
	}

	/**
	 * Null-safe innerHTML setter
	 */
	setHtml(selectorOrId, html) {
		const el = this.getElement(selectorOrId);
		if (el) {
			el.innerHTML = html ?? '';
		}
		return el;
	}

	/**
	 * Null-safe value setter
	 */
	setValue(selectorOrId, value) {
		const el = this.getElement(selectorOrId);
		if (el) {
			el.value = value ?? '';
		}
		return el;
	}

	/**
	 * Null-safe class toggler
	 */
	toggleClass(selectorOrId, className, force) {
		const el = this.getElement(selectorOrId);
		if (el) {
			if (typeof force === 'boolean') {
				el.classList.toggle(className, force);
			} else {
				el.classList.toggle(className);
			}
		}
		return el;
	}

	async init() {
		// 1. Initialize Canvas Background Atmosphere
		this.atmosphere = new window.CanvasAtmosphere('weatherCanvas');

		// 2. Initialize Leaflet Map
		if (window.weatherMap) {
			window.weatherMap.onLocationSelect = async (lat, lon) => {
				this.showLoading(true);
				const loc = await window.weatherAPI.reverseGeocode(lat, lon);
				await this.loadLocationWeather(loc);
			};
		}

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
		const searchInput = this.getElement('citySearchInput');
		const searchResults = this.getElement('searchResultsDropdown');

		if (searchInput) {
			searchInput.addEventListener('input', (e) => {
				const q = e.target.value;
				clearTimeout(this.searchDebounceTimer);
				if (q.trim().length < 2) {
					if (searchResults) {
						searchResults.classList.remove('active');
						searchResults.style.display = 'none';
						searchResults.innerHTML = '';
					}
					return;
				}
				this.searchDebounceTimer = setTimeout(async () => {
					const results = await window.weatherAPI.searchLocations(q);
					if (searchResults) {
						this.renderSearchResults(results, searchResults);
					}
				}, 200);
			});

			searchInput.addEventListener('focus', () => {
				if (
					searchInput.value.trim().length >= 2 &&
					searchResults &&
					searchResults.innerHTML.trim() !== ''
				) {
					searchResults.classList.add('active');
					searchResults.style.display = 'block';
				}
			});

			searchInput.addEventListener('keydown', async (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					const q = searchInput.value.trim();
					if (q.length >= 2) {
						clearTimeout(this.searchDebounceTimer);
						const results = await window.weatherAPI.searchLocations(q);
						if (results && results.length > 0) {
							const first = results[0];
							if (searchResults) {
								searchResults.classList.remove('active');
								searchResults.style.display = 'none';
							}
							searchInput.value = '';
							await this.loadLocationWeather(first);
						}
					}
				} else if (e.key === 'Escape') {
					if (searchResults) {
						searchResults.classList.remove('active');
						searchResults.style.display = 'none';
					}
				}
			});

			// Close dropdown when clicked outside
			document.addEventListener('click', (e) => {
				if (
					searchResults &&
					!searchInput.contains(e.target) &&
					!searchResults.contains(e.target)
				) {
					searchResults.classList.remove('active');
					searchResults.style.display = 'none';
				}
			});
		}

		// Geolocation button
		const geoBtn = this.getElement('currentLocationBtn');
		if (geoBtn) {
			geoBtn.addEventListener('click', () => this.autoDetectLocation(true));
		}

		// Save/Favorite button
		const saveLocBtn = this.getElement('saveLocationBtn');
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
		const scrubber = this.getElement('timeScrubber');
		const resetScrubberBtn = this.getElement('resetScrubberBtn');

		if (scrubber) {
			scrubber.addEventListener('input', (e) => {
				const hourIdx = parseInt(e.target.value, 10);
				this.handleTimeScrubber(hourIdx);
			});
		}

		if (resetScrubberBtn) {
			resetScrubberBtn.addEventListener('click', () => {
				window.state.scrubberActive = false;
				if (scrubber) scrubber.value = 0;
				this.setText('scrubberTimeDisplay', 'Live (Now)');
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
				if (window.state.currentWeather && window.weatherCharts) {
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
		const audioToggle = this.getElement('audioToggleBtn');
		const audioVolSlider = this.getElement('audioVolumeSlider');

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
				if (window.weatherAudio) {
					window.weatherAudio.setVolume(vol);
				}
			});
		}

		// Export / Share Card Modal
		const exportBtn = this.getElement('exportCardBtn');
		const exportModal = this.getElement('exportModal');
		const closeExportModal = this.getElement('closeExportModal');
		const downloadCardBtn = this.getElement('downloadCardBtn');

		if (exportBtn && exportModal) {
			exportBtn.addEventListener('click', async () => {
				exportModal.classList.add('active');
				await this.previewExportCard();
			});
		}

		if (closeExportModal && exportModal) {
			closeExportModal.addEventListener('click', () => {
				exportModal.classList.remove('active');
			});
		}

		if (downloadCardBtn) {
			downloadCardBtn.addEventListener('click', async () => {
				if (
					window.state.currentLocation &&
					window.state.currentWeather &&
					window.cardExporter
				) {
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
		const compareBtn = this.getElement('compareCitiesBtn');
		const compareModal = this.getElement('compareModal');
		const closeCompareModal = this.getElement('closeCompareModal');
		const compareSearchInput = this.getElement('compareCitySearch');
		const compareSearchResults = this.getElement('compareSearchResults');

		if (compareBtn && compareModal) {
			compareBtn.addEventListener('click', () => {
				compareModal.classList.add('active');
				this.renderComparisonView();
			});
		}

		if (closeCompareModal && compareModal) {
			closeCompareModal.addEventListener('click', () => {
				compareModal.classList.remove('active');
			});
		}

		if (compareSearchInput && compareSearchResults) {
			compareSearchInput.addEventListener('input', (e) => {
				const q = e.target.value;
				if (q.trim().length < 2) {
					compareSearchResults.innerHTML = '';
					compareSearchResults.classList.remove('active');
					return;
				}
				setTimeout(async () => {
					const results = await window.weatherAPI.searchLocations(q);
					if (results && results.length > 0) {
						compareSearchResults.innerHTML = results
							.map(
								(loc) => `
		           <div class="search-result-item" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${loc.name}" data-country="${loc.country}">
		             <span>${window.weatherAPI.getCountryFlagEmoji(loc.country_code)} <b>${loc.name}</b>, ${loc.country}</span>
		           </div>
		         `,
							)
							.join('');
						compareSearchResults.classList.add('active');
					} else {
						compareSearchResults.innerHTML =
							'<div class="search-empty">No matching cities found</div>';
						compareSearchResults.classList.add('active');
					}

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
								compareSearchResults.classList.remove('active');
								compareSearchInput.value = '';
								this.renderComparisonView();
							});
						});
				}, 250);
			});
		}

		// Settings & Unit Switches
		const settingsBtn = this.getElement('settingsBtn');
		const settingsModal = this.getElement('settingsModal');
		const closeSettingsModal = this.getElement('closeSettingsModal');

		if (settingsBtn && settingsModal) {
			settingsBtn.addEventListener('click', () =>
				settingsModal.classList.add('active'),
			);
		}
		if (closeSettingsModal && settingsModal) {
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
			if (window.weatherMap && forecastData?.current) {
				const tempStr = `${window.weatherAPI.convertTemp(forecastData.current.temperature_2m, window.state.prefs.tempUnit)}°`;
				window.weatherMap.setView(
					lat,
					lon,
					9,
					`${location.name}, ${location.country}`,
					tempStr,
				);
			}

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
			if (window.weatherCharts) {
				window.weatherCharts.renderHourlyChart(
					forecastData,
					airData,
					window.state.prefs.tempUnit,
					window.state.prefs.windUnit,
				);
			}

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
		if (!container) return;

		if (!results || results.length === 0) {
			container.innerHTML =
				'<div class="search-empty">No matching cities found</div>';
			container.classList.add('active');
			container.style.display = 'block';
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
		container.style.display = 'block';

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
				container.style.display = 'none';
				this.setValue('citySearchInput', '');
				await this.loadLocationWeather(location);
			});
		});
	}

	/**
	 * Get thematic accent color for a weather code
	 */
	getWeatherCodeColor(code, isDay = 1) {
		const c = Number(code);
		if (c === 0 || c === 1) return isDay ? '#f59e0b' : '#38bdf8';
		if (c === 2) return isDay ? '#fbbf24' : '#818cf8';
		if (c === 3) return '#94a3b8';
		if (c === 45 || c === 48) return '#cbd5e1';
		if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return '#38bdf8';
		if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '#a5f3fc';
		if (c >= 95) return '#f59e0b';
		return '#38bdf8';
	}

	/**
	 * Generate Dynamic Multi-Layered Animated Weather SVG Art
	 */
	renderHeroWeatherArt(
		code,
		isDay = true,
		cloudCover = 20,
		windSpeed = 10,
		temp = 20,
	) {
		const c = Number(code);
		const isD = Boolean(isDay);

		// 1. Clear Day (Code 0, 1 & isDay)
		if ((c === 0 || c === 1) && isD) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<radialGradient id="sunCoreGrad" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stop-color="#fffbeb" />
							<stop offset="40%" stop-color="#fde047" />
							<stop offset="100%" stop-color="#f59e0b" />
						</radialGradient>
						<radialGradient id="sunCoronaGrad" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stop-color="rgba(253, 224, 71, 0.45)" />
							<stop offset="60%" stop-color="rgba(245, 158, 11, 0.15)" />
							<stop offset="100%" stop-color="rgba(245, 158, 11, 0)" />
						</radialGradient>
						<filter id="sunGlow" x="-30%" y="-30%" width="160%" height="160%">
							<feGaussianBlur stdDeviation="4" result="blur" />
							<feComposite in="SourceGraphic" in2="blur" operator="over" />
						</filter>
					</defs>
					<!-- Corona Aura -->
					<circle cx="70" cy="60" r="42" fill="url(#sunCoronaGrad)" style="animation: sunPulseCore 3s ease-in-out infinite;" />
					<!-- Rotating Sun Rays -->
					<g style="transform-origin: 70px 60px; animation: sunSpinSlow 28s linear infinite;">
						<line x1="70" y1="20" x2="70" y2="28" stroke="#fde047" stroke-width="3" stroke-linecap="round" opacity="0.9" />
						<line x1="70" y1="92" x2="70" y2="100" stroke="#fde047" stroke-width="3" stroke-linecap="round" opacity="0.9" />
						<line x1="30" y1="60" x2="38" y2="60" stroke="#fde047" stroke-width="3" stroke-linecap="round" opacity="0.9" />
						<line x1="102" y1="60" x2="110" y2="60" stroke="#fde047" stroke-width="3" stroke-linecap="round" opacity="0.9" />
						<line x1="42" y1="32" x2="48" y2="38" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.8" />
						<line x1="92" y1="82" x2="98" y2="88" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.8" />
						<line x1="42" y1="88" x2="48" y2="82" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.8" />
						<line x1="92" y1="38" x2="98" y2="32" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.8" />
					</g>
					<!-- Glowing Sun Core -->
					<circle cx="70" cy="60" r="23" fill="url(#sunCoreGrad)" filter="url(#sunGlow)" />
					<!-- Lens Flare Sparkles -->
					<polygon points="106,30 108,34 112,36 108,38 106,42 104,38 100,36 104,34" fill="#ffffff" opacity="0.85" style="animation: starGlimmer 2.5s ease-in-out infinite;" />
					<polygon points="34,80 35,83 38,84 35,85 34,88 33,85 30,84 33,83" fill="#fde047" opacity="0.75" style="animation: starGlimmer 3s ease-in-out infinite; animation-delay: 1.2s;" />
				</svg>
			`;
		}

		// 2. Clear Night (Code 0, 1 & !isDay)
		if ((c === 0 || c === 1) && !isD) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="moonBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#f8fafc" />
							<stop offset="50%" stop-color="#bae6fd" />
							<stop offset="100%" stop-color="#38bdf8" />
						</linearGradient>
						<radialGradient id="moonAuraGrad" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stop-color="rgba(56, 189, 248, 0.35)" />
							<stop offset="70%" stop-color="rgba(56, 189, 248, 0.05)" />
							<stop offset="100%" stop-color="transparent" />
						</radialGradient>
					</defs>
					<!-- Celestial Ambient Halo -->
					<circle cx="70" cy="60" r="44" fill="url(#moonAuraGrad)" style="animation: sunPulseCore 4s ease-in-out infinite;" />
					<!-- Luminous Crescent Moon -->
					<path d="M78,32 C60,32 46,45 46,62 C46,79 60,92 78,92 C68,85 62,74 62,62 C62,50 68,39 78,32 Z" 
						fill="url(#moonBodyGrad)" 
						filter="drop-shadow(0 0 10px rgba(56, 189, 248, 0.5))" />
					<!-- Subtle Moon Craters -->
					<circle cx="56" cy="58" r="3" fill="rgba(14, 165, 233, 0.25)" />
					<circle cx="58" cy="72" r="2.2" fill="rgba(14, 165, 233, 0.2)" />
					<circle cx="64" cy="48" r="1.8" fill="rgba(14, 165, 233, 0.2)" />
					<!-- Twinkling Starlight -->
					<polygon points="98,28 100,32 104,34 100,36 98,40 96,36 92,34 96,32" fill="#ffffff" style="animation: starGlimmer 2s ease-in-out infinite;" />
					<polygon points="32,38 33,40 36,41 33,42 32,45 31,42 28,41 31,40" fill="#bae6fd" style="animation: starGlimmer 2.6s ease-in-out infinite; animation-delay: 0.8s;" />
					<polygon points="102,78 103,80 106,81 103,82 102,85 101,82 98,81 101,80" fill="#ffffff" style="animation: starGlimmer 3.2s ease-in-out infinite; animation-delay: 1.4s;" />
					<circle cx="40" cy="82" r="1.5" fill="#f8fafc" style="animation: starGlimmer 2.2s ease-in-out infinite; animation-delay: 0.5s;" />
				</svg>
			`;
		}

		// 3. Partly Cloudy Day (Code 2 & isDay)
		if (c === 2 && isD) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<radialGradient id="partlySunGrad" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stop-color="#fef08a" />
							<stop offset="100%" stop-color="#f59e0b" />
						</radialGradient>
						<linearGradient id="frontCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="rgba(255, 255, 255, 0.95)" />
							<stop offset="100%" stop-color="rgba(203, 213, 225, 0.8)" />
						</linearGradient>
					</defs>
					<!-- Peeking Sun -->
					<g style="transform-origin: 88px 46px; animation: sunSpinSlow 30s linear infinite;">
						<line x1="88" y1="18" x2="88" y2="24" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
						<line x1="112" y1="46" x2="118" y2="46" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
						<line x1="106" y1="28" x2="110" y2="24" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
						<line x1="106" y1="64" x2="110" y2="68" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
					</g>
					<circle cx="88" cy="46" r="18" fill="url(#partlySunGrad)" filter="drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))" />
					<!-- Floating Glassmorphic Front Cloud -->
					<path d="M42,86 C32,86 24,78 24,68 C24,59 30,52 39,50 C42,39 52,32 64,32 C78,32 89,42 91,55 C98,56 104,62 104,70 C104,79 96,86 86,86 Z" 
						fill="url(#frontCloudGrad)" 
						stroke="rgba(255,255,255,0.6)" 
						stroke-width="1.5"
						filter="drop-shadow(0 6px 16px rgba(0, 0, 0, 0.2))" 
						style="animation: cloudDriftLayer1 6s ease-in-out infinite;" />
				</svg>
			`;
		}

		// 4. Partly Cloudy Night (Code 2 & !isDay)
		if (c === 2 && !isD) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="nightCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="rgba(148, 163, 184, 0.85)" />
							<stop offset="100%" stop-color="rgba(71, 85, 105, 0.7)" />
						</linearGradient>
					</defs>
					<!-- Peeking Crescent Moon -->
					<path d="M96,28 C84,28 74,37 74,49 C74,61 84,70 96,70 C89,65 85,57 85,49 C85,41 89,33 96,28 Z" 
						fill="#38bdf8" 
						filter="drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))" />
					<!-- Twinkling Star -->
					<polygon points="112,24 113,26 115,27 113,28 112,30 111,28 109,27 111,26" fill="#ffffff" style="animation: starGlimmer 2.5s ease-in-out infinite;" />
					<!-- Floating Night Cloud -->
					<path d="M42,86 C32,86 24,78 24,68 C24,59 30,52 39,50 C42,39 52,32 64,32 C78,32 89,42 91,55 C98,56 104,62 104,70 C104,79 96,86 86,86 Z" 
						fill="url(#nightCloudGrad)" 
						stroke="rgba(255,255,255,0.3)" 
						stroke-width="1.5"
						filter="drop-shadow(0 6px 16px rgba(0, 0, 0, 0.3))" 
						style="animation: cloudDriftLayer1 6s ease-in-out infinite;" />
				</svg>
			`;
		}

		// 5. Overcast / Heavy Clouds (Code 3)
		if (c === 3) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="backCloudOvercast" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="rgba(100, 116, 139, 0.75)" />
							<stop offset="100%" stop-color="rgba(51, 65, 85, 0.8)" />
						</linearGradient>
						<linearGradient id="frontCloudOvercast" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="rgba(203, 213, 225, 0.9)" />
							<stop offset="100%" stop-color="rgba(148, 163, 184, 0.85)" />
						</linearGradient>
					</defs>
					<!-- Back Cloud -->
					<path d="M60,72 C52,72 46,66 46,58 C46,51 51,45 58,43 C60,35 68,30 78,30 C89,30 98,38 100,48 C105,49 110,54 110,60 C110,67 104,72 96,72 Z" 
						fill="url(#backCloudOvercast)" 
						style="animation: cloudDriftLayer2 8s ease-in-out infinite;" />
					<!-- Front Cloud -->
					<path d="M40,90 C29,90 20,81 20,70 C20,60 27,52 37,50 C40,38 51,30 64,30 C79,30 91,41 93,55 C101,56 107,63 107,72 C107,82 99,90 88,90 Z" 
						fill="url(#frontCloudOvercast)" 
						stroke="rgba(255,255,255,0.4)" 
						stroke-width="1.5"
						filter="drop-shadow(0 8px 18px rgba(0, 0, 0, 0.3))" 
						style="animation: cloudDriftLayer1 6s ease-in-out infinite;" />
				</svg>
			`;
		}

		// 6. Fog / Mist (Code 45, 48)
		if (c === 45 || c === 48) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="mistGrad" x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset="0%" stop-color="rgba(148, 163, 184, 0.2)" />
							<stop offset="50%" stop-color="rgba(226, 232, 240, 0.8)" />
							<stop offset="100%" stop-color="rgba(148, 163, 184, 0.2)" />
						</linearGradient>
					</defs>
					<!-- Obscured Core -->
					<circle cx="70" cy="50" r="22" fill="${isD ? '#fde047' : '#93c5fd'}" opacity="0.35" filter="blur(6px)" />
					<!-- Floating Mist Waves -->
					<rect x="24" y="44" width="92" height="7" rx="3.5" fill="url(#mistGrad)" style="animation: mistWave 3.5s ease-in-out infinite alternate;" />
					<rect x="18" y="58" width="104" height="8" rx="4" fill="url(#mistGrad)" style="animation: mistWave 4.2s ease-in-out infinite alternate; animation-delay: 0.6s;" />
					<rect x="28" y="74" width="84" height="7" rx="3.5" fill="url(#mistGrad)" style="animation: mistWave 3.8s ease-in-out infinite alternate; animation-delay: 1.2s;" />
					<rect x="36" y="88" width="68" height="6" rx="3" fill="url(#mistGrad)" style="animation: mistWave 3s ease-in-out infinite alternate; animation-delay: 0.3s;" />
				</svg>
			`;
		}

		// 7. Thunderstorm (Code 95, 96, 99)
		if (c >= 95) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="stormCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#475569" />
							<stop offset="100%" stop-color="#1e293b" />
						</linearGradient>
					</defs>
					<!-- Dark Storm Cloud -->
					<path d="M38,72 C28,72 20,64 20,54 C20,45 26,38 35,36 C38,26 48,20 60,20 C74,20 85,29 88,41 C95,42 101,48 101,56 C101,65 93,72 84,72 Z" 
						fill="url(#stormCloudGrad)" 
						stroke="rgba(255,255,255,0.2)" 
						stroke-width="1.5"
						filter="drop-shadow(0 8px 20px rgba(0, 0, 0, 0.4))" 
						style="animation: cloudDriftLayer1 5s ease-in-out infinite;" />
					<!-- Jagged Electric Lightning Bolt -->
					<polygon points="68,50 56,72 66,72 58,98 80,68 70,68 78,50" 
						fill="#fde047" 
						stroke="#f59e0b" 
						stroke-width="1"
						filter="drop-shadow(0 0 8px #fbbf24)" 
						style="animation: lightningBoltFlash 2.8s ease-in-out infinite;" />
					<!-- Rain Streaks -->
					<line x1="38" y1="78" x2="32" y2="94" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.8" style="animation: rainStreakDrop 1s linear infinite;" />
					<line x1="88" y1="78" x2="82" y2="94" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.8" style="animation: rainStreakDrop 1s linear infinite; animation-delay: 0.5s;" />
				</svg>
			`;
		}

		// 8. Snow / Sleet (Code 71..77, 85..86)
		if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
			return `
				<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="snowCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#f8fafc" />
							<stop offset="100%" stop-color="#cbd5e1" />
						</linearGradient>
					</defs>
					<!-- Frosty Cloud -->
					<path d="M38,68 C28,68 20,60 20,50 C20,41 26,34 35,32 C38,22 48,16 60,16 C74,16 85,25 88,37 C95,38 101,44 101,52 C101,61 93,68 84,68 Z" 
						fill="url(#snowCloudGrad)" 
						stroke="rgba(255,255,255,0.7)" 
						stroke-width="1.5"
						filter="drop-shadow(0 8px 18px rgba(165, 243, 252, 0.2))" 
						style="animation: cloudDriftLayer1 6s ease-in-out infinite;" />
					<!-- Fluttering Snowflakes -->
					<g style="animation: snowflakeDrift 2.8s linear infinite;">
						<text x="36" y="86" font-size="14" fill="#a5f3fc" text-anchor="middle">❄</text>
					</g>
					<g style="animation: snowflakeDrift 2.4s linear infinite; animation-delay: 0.9s;">
						<text x="62" y="90" font-size="12" fill="#e0f2fe" text-anchor="middle">❄</text>
					</g>
					<g style="animation: snowflakeDrift 3s linear infinite; animation-delay: 1.6s;">
						<text x="84" y="86" font-size="14" fill="#a5f3fc" text-anchor="middle">❄</text>
					</g>
				</svg>
			`;
		}

		// 9. Rain / Drizzle / Showers (Code 51..67, 80..82)
		return `
			<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<linearGradient id="rainCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stop-color="rgba(226, 232, 240, 0.95)" />
						<stop offset="100%" stop-color="rgba(100, 116, 139, 0.85)" />
					</linearGradient>
				</defs>
				<!-- Rain Cloud -->
				<path d="M38,68 C28,68 20,60 20,50 C20,41 26,34 35,32 C38,22 48,16 60,16 C74,16 85,25 88,37 C95,38 101,44 101,52 C101,61 93,68 84,68 Z" 
					fill="url(#rainCloudGrad)" 
					stroke="rgba(255,255,255,0.5)" 
					stroke-width="1.5"
					filter="drop-shadow(0 8px 18px rgba(0, 0, 0, 0.25))" 
					style="animation: cloudDriftLayer1 6s ease-in-out infinite;" />
				<!-- Animated Rain Drops / Streaks -->
				<line x1="36" y1="76" x2="30" y2="94" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" style="animation: rainStreakDrop 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite;" />
				<line x1="52" y1="78" x2="46" y2="98" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" style="animation: rainStreakDrop 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite; animation-delay: 0.35s;" />
				<line x1="68" y1="76" x2="62" y2="94" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" style="animation: rainStreakDrop 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite; animation-delay: 0.7s;" />
				<line x1="84" y1="78" x2="78" y2="96" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" style="animation: rainStreakDrop 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite; animation-delay: 0.2s;" />
			</svg>
		`;
	}

	/**
	 * Render Next 6-Hour Micro-Forecast Quick-Glance Ribbon
	 */
	renderHeroMicroForecast(
		forecast,
		startHourIdx = 0,
		tempUnit = 'c',
		precipUnit = 'mm',
	) {
		const container = this.getElement('heroMicroForecastRibbon');
		if (!container || !forecast?.hourly?.time) return;

		const h = forecast.hourly;
		const totalHours = h.time.length;
		const count = 6;
		let html = '';

		for (let i = 0; i < count; i++) {
			const idx = (startHourIdx + i) % totalHours;
			const timeISO = h.time[idx];
			const d = new Date(timeISO);
			const isCurrentHour = i === 0;

			let timeLabel = 'Now';
			if (!isCurrentHour || window.state.scrubberActive) {
				timeLabel = d.toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
				});
			}

			const isDayHour = h.is_day
				? h.is_day[idx] === 1 || h.is_day[idx] === true
				: true;
			const code = h.weather_code?.[idx] ?? 0;
			const codeInfo = window.weatherAPI.getWeatherCodeInfo(code, isDayHour);
			const iconColor = this.getWeatherCodeColor(code, isDayHour);
			const tempVal = window.weatherAPI.convertTemp(
				h.temperature_2m?.[idx] ?? 0,
				tempUnit,
			);
			const pop = h.precipitation_probability
				? (h.precipitation_probability[idx] ?? 0)
				: 0;
			const precipVal = h.precipitation ? (h.precipitation[idx] ?? 0) : 0;

			const hasPrecip = pop > 0 || precipVal > 0;
			const precipBadge = hasPrecip
				? `<span class="micro-precip"><i class="fa-solid fa-droplet"></i> ${pop}%</span>`
				: `<span class="micro-precip zero">0%</span>`;

			html += `
				<div class="micro-forecast-card ${isCurrentHour ? 'active-hour' : ''}" title="${timeLabel}: ${codeInfo.label}, ${tempVal}°${tempUnit.toUpperCase()}">
					<div class="micro-time">${timeLabel}</div>
					<div class="micro-icon" style="color: ${iconColor};">
						<i class="fa-solid fa-${codeInfo.icon}"></i>
					</div>
					<div class="micro-temp">${tempVal}°</div>
					${precipBadge}
				</div>
			`;
		}

		container.innerHTML = html;

		// Update range subtitle
		const startD = new Date(h.time[startHourIdx % totalHours]);
		const endD = new Date(h.time[(startHourIdx + count - 1) % totalHours]);
		const startStr = startD.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		const endStr = endD.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		this.setText('microForecastRange', `${startStr} – ${endStr}`);
	}

	/**
	 * Generate Smart Weather Insight & Condition Briefing
	 */
	generateSmartWeatherInsight(current, forecast, isDay, tempUnit, codeInfo) {
		const temp = current.temperature_2m;
		const code = Number(current.weather_code);
		const uv = current.uv_index || 0;
		const gusts = current.wind_gusts_10m || current.wind_speed_10m || 0;
		const windUnit = window.state.prefs.windUnit;
		const precipUnit = window.state.prefs.precipUnit;

		let maxT = '--';
		let minT = '--';
		let sunsetTime = '';
		let sunriseTime = '';

		if (forecast?.daily?.temperature_2m_max?.[0] != null) {
			maxT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_max[0],
				tempUnit,
			);
			minT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_min[0],
				tempUnit,
			);
		}
		if (forecast?.daily?.sunset?.[0]) {
			const s = new Date(forecast.daily.sunset[0]);
			sunsetTime = s.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}
		if (forecast?.daily?.sunrise?.[0]) {
			const s = new Date(forecast.daily.sunrise[0]);
			sunriseTime = s.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}

		// 1. Severe / Thunderstorm alert
		if (code >= 95) {
			return `⚠️ Thunderstorm activity in effect. Expect sudden gusts up to ${window.weatherAPI.convertWind(gusts, windUnit)} ${windUnit} and heavy downpours — stay sheltered indoors.`;
		}

		// 2. Active Rain / Snow
		if (
			current.precipitation > 0 ||
			(code >= 51 && code <= 67) ||
			(code >= 80 && code <= 82)
		) {
			const precipVal = window.weatherAPI.convertPrecip(
				current.precipitation || 0.5,
				precipUnit,
			);
			return `🌧️ Active precipitation detected (${precipVal} ${precipUnit}). Roads may be slick — carry an umbrella and drive with caution.`;
		}
		if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
			return `❄️ Wintry precipitation in the area. Expect chilly temperatures around ${window.weatherAPI.convertTemp(temp, tempUnit)}° and reduced road traction.`;
		}

		// 3. Extreme UV Index
		if (uv >= 7) {
			return `☀️ Very High UV Index (${uv}). Peak solar intensity — seek shade and apply SPF 30+ sunscreen if outdoors.`;
		}

		// 4. High Wind Warning
		if (gusts >= 40) {
			return `💨 High wind advisory: Gusts reaching ${window.weatherAPI.convertWind(gusts, windUnit)} ${windUnit}. Secure loose outdoor items.`;
		}

		// 5. Extreme Hot or Cold
		if (temp >= 33) {
			return `🔥 Heat advisory: High of ${maxT}°${tempUnit.toUpperCase()}. Stay well-hydrated and limit direct sun exposure during peak afternoon hours.`;
		}
		if (temp <= 1) {
			return `❄️ Near or sub-freezing conditions (Low of ${minT}°). Dress in warm thermal layers and watch for frost on outdoor surfaces.`;
		}

		// 6. Ideal / Standard Pleasant Day or Night briefing
		if (isDay) {
			const sunText = sunsetTime ? ` • Sunset at ${sunsetTime}` : '';
			return `☀️ High of ${maxT}° and low of ${minT}°${sunText}. ${codeInfo.label} skies with pleasant outdoor conditions.`;
		} else {
			const sunText = sunriseTime ? ` • Dawn at ${sunriseTime}` : '';
			return `🌙 Clear night atmosphere with an overnight low of ${minT}°${sunText}. Calm conditions ideal for stargazing.`;
		}
	}

	/**
	 * Update Main Hero Display
	 */
	updateCurrentDisplay() {
		const loc = window.state.currentLocation;
		const forecast = window.state.currentWeather;
		if (!loc || !forecast || !forecast.current) return;

		let current = forecast.current;
		let isLive = true;
		let activeHourIndex = 0;

		// If scrubber active, pick selected hour from hourly
		if (window.state.scrubberActive && forecast.hourly) {
			const idx = window.state.scrubberHourIndex;
			activeHourIndex = idx;
			const h = forecast.hourly;
			isLive = false;
			current = {
				temperature_2m: h.temperature_2m?.[idx] ?? current.temperature_2m,
				apparent_temperature:
					h.apparent_temperature?.[idx] ?? current.apparent_temperature,
				relative_humidity_2m:
					h.relative_humidity_2m?.[idx] ?? current.relative_humidity_2m,
				weather_code: h.weather_code?.[idx] ?? current.weather_code,
				wind_speed_10m: h.wind_speed_10m?.[idx] ?? current.wind_speed_10m,
				wind_direction_10m:
					h.wind_direction_10m?.[idx] ?? current.wind_direction_10m,
				wind_gusts_10m: h.wind_gusts_10m
					? h.wind_gusts_10m[idx]
					: (h.wind_speed_10m?.[idx] ?? current.wind_speed_10m),
				surface_pressure: h.surface_pressure?.[idx] ?? current.surface_pressure,
				uv_index: h.uv_index ? (h.uv_index[idx] ?? 0) : 0,
				cloud_cover: h.cloud_cover?.[idx] ?? current.cloud_cover,
				precipitation: h.precipitation?.[idx] ?? current.precipitation,
				is_day: h.is_day ? (h.is_day[idx] ?? 1) : 1,
			};
		}

		const { tempUnit, windUnit, precipUnit, pressureUnit } = window.state.prefs;
		const isDay = current.is_day === 1 || current.is_day === true;
		const codeInfo = window.weatherAPI.getWeatherCodeInfo(
			current.weather_code,
			isDay,
		);

		// Update Atmosphere Dynamic Canvas
		if (this.atmosphere?.setAtmosphere) {
			this.atmosphere.setAtmosphere(
				codeInfo.atmosphere,
				isDay,
				current.cloud_cover || 20,
				current.wind_speed_10m || 10,
				current.wind_direction_10m || 90,
			);
		}

		// Update Hero elements
		const flag = window.weatherAPI.getCountryFlagEmoji(loc.country_code);
		this.setHtml('cityName', `${flag} ${loc.name}`);
		this.setText(
			'cityCountry',
			[loc.admin1, loc.country].filter(Boolean).join(', ') || 'Global Location',
		);

		// Local Time Display
		if (forecast.hourly?.time && forecast.hourly.time[activeHourIndex]) {
			const d = new Date(forecast.hourly.time[activeHourIndex]);
			this.setText(
				'heroLocalTimeDisplay',
				d.toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
				}),
			);
		} else {
			this.setText(
				'heroLocalTimeDisplay',
				new Date().toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
				}),
			);
		}

		this.setText(
			'currentTemp',
			`${window.weatherAPI.convertTemp(current.temperature_2m, tempUnit)}°`,
		);
		this.setText('currentConditionLabel', codeInfo.label);
		this.setText('currentConditionDesc', codeInfo.description);
		this.setText(
			'feelsLikeTemp',
			`Feels like ${window.weatherAPI.convertTemp(current.apparent_temperature, tempUnit)}°${tempUnit.toUpperCase()}`,
		);

		// Daylight Status Chip
		let sunsetTimeStr = '';
		let sunriseTimeStr = '';
		if (forecast.daily?.sunset?.[0]) {
			const s = new Date(forecast.daily.sunset[0]);
			sunsetTimeStr = s.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}
		if (forecast.daily?.sunrise?.[0]) {
			const s = new Date(forecast.daily.sunrise[0]);
			sunriseTimeStr = s.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}

		if (isDay) {
			this.setText(
				'heroDaylightStatus',
				sunsetTimeStr ? `Daylight • Sunset ${sunsetTimeStr}` : 'Daylight',
			);
			const badgeEl = this.getElement('heroDaylightBadge');
			if (badgeEl) {
				badgeEl.innerHTML = `<i class="fa-solid fa-sun"></i> <span>Daylight${sunsetTimeStr ? ` • Sunset ${sunsetTimeStr}` : ''}</span>`;
				badgeEl.style.background = 'rgba(245, 158, 11, 0.12)';
				badgeEl.style.color = 'var(--accent-amber)';
				badgeEl.style.borderColor = 'rgba(245, 158, 11, 0.25)';
			}
		} else {
			const badgeEl = this.getElement('heroDaylightBadge');
			if (badgeEl) {
				badgeEl.innerHTML = `<i class="fa-solid fa-moon"></i> <span>Night${sunriseTimeStr ? ` • Dawn ${sunriseTimeStr}` : ''}</span>`;
				badgeEl.style.background = 'rgba(56, 189, 248, 0.12)';
				badgeEl.style.color = 'var(--accent-blue)';
				badgeEl.style.borderColor = 'rgba(56, 189, 248, 0.25)';
			}
		}

		// 1. Dynamic Animated Weather Visual Showcase Art
		const artContainer = this.getElement('heroWeatherArt');
		if (artContainer) {
			artContainer.innerHTML = this.renderHeroWeatherArt(
				current.weather_code,
				isDay,
				current.cloud_cover,
				current.wind_speed_10m,
				current.temperature_2m,
			);
		}

		// 2. Next 6-Hour Micro-Forecast Ribbon
		this.renderHeroMicroForecast(
			forecast,
			activeHourIndex,
			tempUnit,
			precipUnit,
		);

		// 3. Smart Weather Insight & Condition Briefing Banner
		const insightText = this.generateSmartWeatherInsight(
			current,
			forecast,
			isDay,
			tempUnit,
			codeInfo,
		);
		this.setText('heroInsightText', insightText);

		// Daily High / Low
		if (
			forecast.daily &&
			Array.isArray(forecast.daily.temperature_2m_max) &&
			forecast.daily.temperature_2m_max.length > 0
		) {
			const maxT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_max[0],
				tempUnit,
			);
			const minT = window.weatherAPI.convertTemp(
				forecast.daily.temperature_2m_min[0],
				tempUnit,
			);
			this.setText('heroHighLow', `H: ${maxT}°  •  L: ${minT}°`);
		}

		// Hero Metric Badges (Primary 6)
		this.setText(
			'windMetric',
			`${window.weatherAPI.convertWind(current.wind_speed_10m, windUnit)} ${windUnit}`,
		);
		this.setText(
			'windDirMetric',
			`${window.weatherAPI.getWindDirectionCompass(current.wind_direction_10m)} (${Math.round(current.wind_direction_10m || 0)}°)`,
		);
		this.setText('humidityMetric', `${current.relative_humidity_2m || 0}%`);
		this.setText(
			'uvMetric',
			`${current.uv_index || 0} (${window.lifestyle?.calcUVIndex ? window.lifestyle.calcUVIndex(current.uv_index).level : 'Low'})`,
		);
		this.setText(
			'pressureMetric',
			`${window.weatherAPI.convertPressure(current.surface_pressure, pressureUnit)} ${pressureUnit}`,
		);
		this.setText('cloudMetric', `${current.cloud_cover || 0}%`);
		this.setText(
			'precipMetric',
			`${window.weatherAPI.convertPrecip(current.precipitation || 0, precipUnit)} ${precipUnit}`,
		);

		// Hero Secondary Badges
		const visMeters = forecast.hourly?.visibility?.[activeHourIndex] ?? 10000;
		const visKm = (visMeters / 1000).toFixed(1);
		this.setText('visibilityMetric', `${visKm} km`);
		this.setText('cloudCoverMetric', `${current.cloud_cover || 0}%`);

		const dewPointVal = forecast.hourly?.dew_point_2m?.[activeHourIndex];
		if (dewPointVal != null) {
			this.setText(
				'dewPointMetric',
				`${window.weatherAPI.convertTemp(dewPointVal, tempUnit)}°${tempUnit.toUpperCase()}`,
			);
		} else {
			this.setText('dewPointMetric', '--');
		}

		const gustVal =
			current.wind_gusts_10m ??
			forecast.hourly?.wind_gusts_10m?.[activeHourIndex] ??
			current.wind_speed_10m;
		this.setText(
			'windGustMetric',
			`${window.weatherAPI.convertWind(gustVal, windUnit)} ${windUnit}`,
		);

		if (isDay && sunsetTimeStr) {
			this.setText('daylightProgressMetric', `Until ${sunsetTimeStr}`);
		} else if (!isDay && sunriseTimeStr) {
			this.setText('daylightProgressMetric', `Dawn at ${sunriseTimeStr}`);
		} else {
			this.setText('daylightProgressMetric', isDay ? 'Daytime' : 'Night');
		}
	}

	/**
	 * Handle Time Scrubber slider input
	 */
	handleTimeScrubber(hourIdx) {
		const forecast = window.state.currentWeather;
		if (
			!forecast ||
			!forecast.hourly ||
			!forecast.hourly.time ||
			!forecast.hourly.time[hourIdx]
		)
			return;

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

		this.setText(
			'scrubberTimeDisplay',
			hourIdx === 0 ? 'Live (Now)' : `Simulation: ${timeStr}`,
		);
		const resetBtn = this.getElement('resetScrubberBtn');
		if (resetBtn) resetBtn.classList.add('active');

		this.updateCurrentDisplay();
	}

	/**
	 * Render 7-Day Forecast Grid Cards
	 */
	renderDailyForecast() {
		const daily = window.state.currentWeather?.daily;
		const container = this.getElement('dailyForecastContainer');
		if (!daily || !daily.time || !container) return;

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
		const container = this.getElement('hourlyCardsContainer');
		if (!hourly || !hourly.time || !container) return;

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
			const code = hourly.weather_code ? hourly.weather_code[i] : 0;
			const isDay = hourly.is_day ? hourly.is_day[i] : 1;
			const info = window.weatherAPI.getWeatherCodeInfo(code, isDay);
			const temp = window.weatherAPI.convertTemp(
				hourly.temperature_2m ? hourly.temperature_2m[i] : 0,
				tempUnit,
			);
			const rainProb = hourly.precipitation_probability
				? hourly.precipitation_probability[i] || 0
				: 0;

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
		const containerArc = this.getElement('solarArcWrapper');
		const containerMoon = this.getElement('moonPhaseWrapper');
		if (!daily || !containerArc || !containerMoon || !window.astronomy) return;

		const sunrise = daily.sunrise ? daily.sunrise[0] : null;
		const sunset = daily.sunset ? daily.sunset[0] : null;

		const solarMetrics = window.astronomy.calculateSolarMetrics(
			sunrise,
			sunset,
		);
		containerArc.innerHTML = window.astronomy.renderSolarArcSVG(solarMetrics);

		this.setText('dayDuration', solarMetrics.dayDuration);
		this.setText(
			'goldenHour',
			`${solarMetrics.goldenHourMorning} / ${solarMetrics.goldenHourEvening}`,
		);

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
		const container = this.getElement('aqiGaugeContainer');
		const breakdownContainer = this.getElement('aqiBreakdownContainer');
		if (!aqiData || !container || !window.airQuality) return;

		const usAqi = aqiData.current?.us_aqi || 35;
		const status = window.airQuality.getAQIStatus(usAqi);

		container.innerHTML = window.airQuality.renderRadialGaugeSVG(usAqi, 170);
		this.setText('aqiStatement', status.statement);
		this.setText('aqiRecommendation', status.recommendation);

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
		const moon = window.astronomy
			? window.astronomy.getMoonPhase(new Date())
			: null;
		const container = this.getElement('lifestyleGrid');
		if (!current || !container || !window.lifestyle) return;

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
		const container = this.getElement('historicalComparisonContainer');
		if (!hist || !cur || !container) return;

		const { tempUnit } = window.state.prefs;
		const curMax = cur.daily?.temperature_2m_max?.[0];
		const histMax = hist.daily?.temperature_2m_max
			? hist.daily.temperature_2m_max[0]
			: null;

		if (
			curMax === undefined ||
			curMax === null ||
			histMax === null ||
			histMax === undefined
		) {
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
		const list = window.state.savedLocations || [];
		const container = this.getElement('savedLocationsList');
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
		const btn = this.getElement('saveLocationBtn');
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
		const container = this.getElement('comparisonDisplayArea');
		if (!container) return;

		const { tempUnit, windUnit } = window.state.prefs;

		if (
			!cityB ||
			!weatherB ||
			!weatherB.current ||
			!weatherA ||
			!weatherA.current
		) {
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
		const previewContainer = this.getElement('exportCardPreview');
		if (
			!previewContainer ||
			!window.state.currentLocation ||
			!window.state.currentWeather ||
			!window.cardExporter
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
		const btn = this.getElement('audioToggleBtn');
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
			if (window.weatherAudio?.stopAll) {
				window.weatherAudio.stopAll();
			}
			return;
		}

		const current = window.state.currentWeather?.current;
		if (current && window.weatherAudio?.playWeatherSound) {
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
		if (window.state.currentWeather && window.weatherCharts) {
			window.weatherCharts.renderHourlyChart(
				window.state.currentWeather,
				window.state.airQuality,
				window.state.prefs.tempUnit,
				window.state.prefs.windUnit,
			);
		}
	}

	showLoading(show = true) {
		const loader = this.getElement('globalLoader');
		if (loader) {
			if (show) loader.classList.add('active');
			else loader.classList.remove('active');
		}
	}

	showToast(message, duration = 3000) {
		const toast = this.getElement('appToast');
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
