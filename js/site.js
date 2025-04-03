// Main site functionality

// Ensure we have configuration values
function getConfigValue(key, fallback) {
    if (window.CONFIG && typeof CONFIG[key] !== 'undefined') {
        return CONFIG[key];
    }
    if (window.ENV && typeof ENV[key] !== 'undefined') {
        return ENV[key];
    }
    return fallback;
}

// Default configuration values if CONFIG is not defined
const DEFAULT_CONFIG = {
    TIMEZONE: '+08:00',
    DEFAULT_DATE_FORMAT: 'YYYY-MM-DD',
    DEFAULT_DATE_RANGE: {
        START_OFFSET: 0,
        END_OFFSET: 28
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize date range picker
    if (document.getElementById('daterange')) {
        const timezone = getConfigValue('TIMEZONE', DEFAULT_CONFIG.TIMEZONE);
        const defaultEndOffset = getConfigValue('DEFAULT_DATE_RANGE', DEFAULT_CONFIG.DEFAULT_DATE_RANGE).END_OFFSET;
        
        const today = moment().utcOffset(timezone);
        const endDate = moment().utcOffset(timezone).add(defaultEndOffset, 'days');
        
        $('#daterange').daterangepicker({
            startDate: today,
            endDate: endDate,
            timeZone: 'Australia/Perth',
            locale: {
                format: 'MMMM D, YYYY'
            },
            ranges: {
                'Next Week': [moment().utcOffset(timezone), moment().utcOffset(timezone).add(7, 'days')],
                'Next 2 Weeks': [moment().utcOffset(timezone), moment().utcOffset(timezone).add(14, 'days')],
                'Next Month': [moment().utcOffset(timezone), moment().utcOffset(timezone).add(1, 'month')],
                'Next 2 Months': [moment().utcOffset(timezone), moment().utcOffset(timezone).add(2, 'months')]
            }
        });
        
        // Update map when date range changes
        $('#daterange').on('apply.daterangepicker', function(ev, picker) {
            const dateFormat = getConfigValue('DEFAULT_DATE_FORMAT', DEFAULT_CONFIG.DEFAULT_DATE_FORMAT);
            const startDate = picker.startDate.format(dateFormat);
            const endDate = picker.endDate.format(dateFormat);
            
            // Ensure mapController is available (should be defined in mapbox-controller.js)
            if (window.mapController) {
                mapController.setDateRange(startDate, endDate);
                
                const councilId = $('#council').val();
                if (!councilId || councilId === 'all') {
                    mapController.loadAreas();
                } else {
                    mapController.loadAreas(councilId);
                }
            }
        });
    }
    
    // Handle council selection change
    const councilDropdown = document.getElementById('council');
    if (councilDropdown) {
        councilDropdown.addEventListener('change', function() {
            const councilId = this.value;
            const dateFormat = getConfigValue('DEFAULT_DATE_FORMAT', DEFAULT_CONFIG.DEFAULT_DATE_FORMAT);
            
            // Get date range from picker if available
            let startDate, endDate;
            if ($('#daterange').data('daterangepicker')) {
                startDate = $('#daterange').data('daterangepicker').startDate.format(dateFormat);
                endDate = $('#daterange').data('daterangepicker').endDate.format(dateFormat);
            } else {
                // Default date range if picker not initialized
                const timezone = getConfigValue('TIMEZONE', DEFAULT_CONFIG.TIMEZONE);
                const defaultEndOffset = getConfigValue('DEFAULT_DATE_RANGE', DEFAULT_CONFIG.DEFAULT_DATE_RANGE).END_OFFSET;
                
                startDate = moment().utcOffset(timezone).format(dateFormat);
                endDate = moment().utcOffset(timezone).add(defaultEndOffset, 'days').format(dateFormat);
            }
            
            // Update map with selected council
            if (window.mapController) {
                mapController.setDateRange(startDate, endDate);
                
                if (councilId === 'all') {
                    mapController.loadAreas();
                } else {
                    mapController.loadAreas(councilId);
                }
            }
        });
    }
    
    // Populate council dropdown
    populateCouncilDropdown();
    
    // Contact form submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('htmx:beforeRequest', function(e) {
            // Disable submit button during request
            const submitButton = contactForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
        });
        
        contactForm.addEventListener('htmx:afterRequest', function(e) {
            // Re-enable submit button after request
            const submitButton = contactForm.querySelector('button[type="submit"]');
            submitButton.disabled = false;
            
            if (e.detail.successful) {
                // Clear form on success
                contactForm.reset();
            }
        });
    }
});

// Populate council dropdown
async function populateCouncilDropdown() {
    const councilSelect = document.getElementById('council');
    if (!councilSelect) return;
    
    try {
        const councils = await supabaseClient.getCouncils();
        
        councils.forEach(council => {
            const option = document.createElement('option');
            option.value = parseInt(council.id); // Ensure numeric id
            option.textContent = council.name;
            councilSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading councils:', error);
    }
}

// Generate council cards for About page
async function renderCouncilList() {
    const councilListElement = document.getElementById('council-list');
    if (!councilListElement) return;
    
    try {
        const councils = await supabaseClient.getCouncils();
        
        let councilHtml = '';
        councils.forEach(council => {
            councilHtml += `
                <div class="col">
                    <div class="card council-card">
                        <div class="card-header">${council.name}</div>
                        <div class="card-body">
                            <p>${council.description || 'Information about vergeside pickups for this council.'}</p>
                            ${council.website ? `<a href="${council.website}" target="_blank" class="btn btn-sm btn-outline-primary">Visit Website</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        councilListElement.innerHTML = councilHtml;
    } catch (error) {
        console.error('Error rendering council list:', error);
        councilListElement.innerHTML = '<div class="col-12"><div class="alert alert-danger">Failed to load council information.</div></div>';
    }
}

// Helper function for geocoding with Mapbox
async function geocodeAddress(address) {
    const mapboxToken = getConfigValue('MAPBOX_TOKEN', '');
    if (!mapboxToken) {
        console.error('Mapbox token is missing for geocoding');
        return null;
    }
    
    try {
        const query = encodeURIComponent(address);
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}`);
        const data = await response.json();
        
        if (data && data.features && data.features.length > 0) {
            const feature = data.features[0];
            return {
                lat: feature.center[1],
                lng: feature.center[0],
                location: feature.place_name,
                details: feature
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    
    return null;
}

// HTMX handlers for API responses
document.addEventListener('htmx:configRequest', function(evt) {
    // Add headers for API calls
    evt.detail.headers['Content-Type'] = 'application/json';
});

// HTMX after-settle event for council list
document.body.addEventListener('htmx:afterSettle', function(evt) {
    if (evt.target.id === 'council-list') {
        renderCouncilList();
    }
});