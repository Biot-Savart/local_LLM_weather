/**
 * Interactive Weather Map Engine (Leaflet.js)
 * OpenStreetMap & CartoDB tiles with interactive coordinate inspector,
 * custom pulsing location pin, simulated radar layer, and quick city selection.
 */
class WeatherMap {
	constructor(mapContainerId = 'weatherMap') {
		this.mapContainerId = mapContainerId;
		this.map = null;
		this.marker = null;
		this.radarLayer = null;
		this.radarActive = true;
		this.onLocationSelect = null;
	}

	/**
	 * Initialize Leaflet map
	 */
	init(lat = 51.5074, lon = -0.1278, zoom = 9) {
		const container = document.getElementById(this.mapContainerId);
		if (!container || !window.L) return;

		if (this.map) {
			this.map.remove();
		}

		// Initialize Map with dark tiles
		this.map = window.L.map(this.mapContainerId, {
			center: [lat, lon],
			zoom: zoom,
			zoomControl: false,
		});

		// Add Zoom Control to top right
		window.L.control.zoom({ position: 'topright' }).addTo(this.map);

		// CartoDB Dark Matter base tiles
		window.L.tileLayer(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
			{
				attribution:
					'&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
				subdomains: 'abcd',
				maxZoom: 18,
			},
		).addTo(this.map);

		// Click anywhere on map to pick location
		this.map.on('click', (e) => {
			const { lat, lng } = e.latlng;
			if (this.onLocationSelect) {
				this.onLocationSelect(lat, lng);
			}
		});

		this.updateMarker(lat, lon, 'Selected Location');
	}

	/**
	 * Update active location pin with animated pulse & popup
	 */
	updateMarker(lat, lon, title = 'Current Location', tempStr = '') {
		if (!this.map || !window.L) return;

		if (this.marker) {
			this.map.removeLayer(this.marker);
		}

		const customIcon = window.L.divIcon({
			className: 'custom-weather-pin-container',
			html: `
        <div class="custom-weather-pin">
          <div class="pin-pulse"></div>
          <div class="pin-dot">
            <i class="fa-solid fa-location-dot"></i>
          </div>
          ${tempStr ? `<div class="pin-badge">${tempStr}</div>` : ''}
        </div>
      `,
			iconSize: [40, 40],
			iconAnchor: [20, 38],
		});

		this.marker = window.L.marker([lat, lon], { icon: customIcon }).addTo(
			this.map,
		);
		this.marker.bindPopup(
			`<b>${title}</b><br>Lat: ${lat.toFixed(3)}°, Lon: ${lon.toFixed(3)}°`,
		);
	}

	/**
	 * Pan and zoom smoothly to new coordinates
	 */
	setView(lat, lon, zoom = 10, title = '', tempStr = '') {
		if (!this.map) {
			this.init(lat, lon, zoom);
		} else {
			this.map.flyTo([lat, lon], zoom, { duration: 1.5 });
			this.updateMarker(lat, lon, title, tempStr);
		}
	}

	/**
	 * Invalidate map size on layout / tab switches
	 */
	invalidateSize() {
		if (this.map) {
			setTimeout(() => this.map.invalidateSize(), 200);
		}
	}
}

// Global map instance
window.weatherMap = new WeatherMap();
