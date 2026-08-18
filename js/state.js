/**
 * State Management for Weather Web Application
 */
class AppState {
	constructor() {
		this.STORAGE_KEY_PREFS = 'weather_app_prefs_v1';
		this.STORAGE_KEY_SAVED = 'weather_app_saved_locations_v1';
		this.STORAGE_KEY_LAST_LOC = 'weather_app_last_loc_v1';

		this.defaultPrefs = {
			tempUnit: 'c', // 'c' | 'f'
			windUnit: 'kmh', // 'kmh' | 'mph' | 'knots' | 'ms'
			precipUnit: 'mm', // 'mm' | 'inch'
			pressureUnit: 'hPa', // 'hPa' | 'inHg'
			audioEnabled: false,
			audioVolume: 0.35,
			canvasEffects: true,
			timeFormat: '24h', // '12h' | '24h'
		};

		this.prefs = this.loadPreferences();
		this.savedLocations = this.loadSavedLocations();
		this.currentLocation = null;
		this.currentWeather = null;
		this.airQuality = null;
		this.historicalWeather = null;
		this.comparisonLocation = null;
		this.comparisonWeather = null;

		// Time Scrubber state
		this.scrubberActive = false;
		this.scrubberHourIndex = 0; // 0 to 47

		// Listeners for state change events
		this.listeners = new Map();
	}

	loadPreferences() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY_PREFS);
			return stored
				? { ...this.defaultPrefs, ...JSON.parse(stored) }
				: { ...this.defaultPrefs };
		} catch (e) {
			console.warn('Failed to load preferences from localStorage:', e);
			return { ...this.defaultPrefs };
		}
	}

	savePreferences() {
		try {
			localStorage.setItem(this.STORAGE_KEY_PREFS, JSON.stringify(this.prefs));
			this.emit('prefsChanged', this.prefs);
		} catch (e) {
			console.warn('Failed to save preferences:', e);
		}
	}

	setPref(key, value) {
		this.prefs[key] = value;
		this.savePreferences();
	}

	loadSavedLocations() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY_SAVED);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load saved locations:', e);
		}
		// Default initial starter favorites
		return [
			{
				name: 'Tokyo',
				country: 'Japan',
				country_code: 'JP',
				latitude: 35.6895,
				longitude: 139.6917,
				timezone: 'Asia/Tokyo',
			},
			{
				name: 'New York',
				admin1: 'New York',
				country: 'United States',
				country_code: 'US',
				latitude: 40.7128,
				longitude: -74.006,
				timezone: 'America/New_York',
			},
			{
				name: 'London',
				country: 'United Kingdom',
				country_code: 'GB',
				latitude: 51.5074,
				longitude: -0.1278,
				timezone: 'Europe/London',
			},
			{
				name: 'Cape Town',
				country: 'South Africa',
				country_code: 'ZA',
				latitude: -33.9249,
				longitude: 18.4241,
				timezone: 'Africa/Johannesburg',
			},
			{
				name: 'Paris',
				country: 'France',
				country_code: 'FR',
				latitude: 48.8566,
				longitude: 2.3522,
				timezone: 'Europe/Paris',
			},
		];
	}

	saveSavedLocations() {
		try {
			localStorage.setItem(
				this.STORAGE_KEY_SAVED,
				JSON.stringify(this.savedLocations),
			);
			this.emit('savedLocationsChanged', this.savedLocations);
		} catch (e) {
			console.warn('Failed to save locations:', e);
		}
	}

	isLocationSaved(lat, lon) {
		return this.savedLocations.some(
			(loc) =>
				Math.abs(loc.latitude - lat) < 0.01 &&
				Math.abs(loc.longitude - lon) < 0.01,
		);
	}

	toggleSaveLocation(location) {
		const existsIndex = this.savedLocations.findIndex(
			(loc) =>
				Math.abs(loc.latitude - location.latitude) < 0.01 &&
				Math.abs(loc.longitude - location.longitude) < 0.01,
		);

		if (existsIndex >= 0) {
			this.savedLocations.splice(existsIndex, 1);
		} else {
			this.savedLocations.unshift({
				name: location.name,
				admin1: location.admin1 || '',
				country: location.country || '',
				country_code: location.country_code || '',
				latitude: location.latitude,
				longitude: location.longitude,
				timezone: location.timezone || 'auto',
			});
			// Cap at 15 saved cities
			if (this.savedLocations.length > 15) {
				this.savedLocations.pop();
			}
		}
		this.saveSavedLocations();
		return this.isLocationSaved(location.latitude, location.longitude);
	}

	saveLastLocation(location) {
		try {
			localStorage.setItem(this.STORAGE_KEY_LAST_LOC, JSON.stringify(location));
		} catch (e) {
			console.warn('Failed to save last location:', e);
		}
	}

	getLastLocation() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY_LAST_LOC);
			return stored ? JSON.parse(stored) : null;
		} catch (e) {
			return null;
		}
	}

	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	emit(event, data) {
		if (this.listeners.has(event)) {
			this.listeners.get(event).forEach((cb) => {
				try {
					cb(data);
				} catch (err) {
					console.error(`Error in event listener for ${event}:`, err);
				}
			});
		}
	}
}

// Global state instance
window.state = new AppState();
