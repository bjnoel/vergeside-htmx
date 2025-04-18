/**
 * Fix for the Date Range Picker issue (unresponsive date picker)
 * 
 * The issue: The daterangepicker's 'apply.daterangepicker' event wasn't properly
 * triggering map updates after configuration loaded or the user interacted
 * with it multiple times.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Wait for ENV configuration to be loaded
    window.ENV.configLoaded.then(configLoaded => {
        console.log('Config loaded status for date picker init:', configLoaded);
        initializeDateRangePicker();
    });
    
    function initializeDateRangePicker() {
        const daterangePicker = document.getElementById('daterange');
        if (!daterangePicker) {
            console.log('Date range picker element not found');
            return;
        }
        
        console.log('Initializing date range picker');
        
        // Clear any existing event handlers to prevent duplicates
        $(daterangePicker).off('apply.daterangepicker');
        
        // Get configuration values with fallbacks
        const timezone = getConfigValue('TIMEZONE', '+08:00');
        const defaultEndOffset = getConfigValue('DEFAULT_DATE_RANGE', { END_OFFSET: 28 }).END_OFFSET;
        const dateFormat = getConfigValue('DEFAULT_DATE_FORMAT', 'YYYY-MM-DD');
        
        const today = moment().utcOffset(timezone);
        const endDate = moment().utcOffset(timezone).add(defaultEndOffset, 'days');
        
        // Remove any existing daterangepicker instance
        if ($(daterangePicker).data('daterangepicker')) {
            $(daterangePicker).data('daterangepicker').remove();
        }
        
        // Initialize the daterangepicker
        $(daterangePicker).daterangepicker({
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
        
        // Add event handler for date range changes
        $(daterangePicker).on('apply.daterangepicker', function(ev, picker) {
            console.log('Date range changed:', picker.startDate.format(dateFormat), 'to', picker.endDate.format(dateFormat));
            
            const startDate = picker.startDate.format(dateFormat);
            const endDate = picker.endDate.format(dateFormat);
            
            // Direct check and fallback for mapController
            if (typeof mapController === 'undefined' || !mapController) {
                // Global wasn't properly set, try to find it or recreate it
                console.warn('mapController not found, creating a new instance');
                window.mapController = new MapController();
                window.mapController.initMap();
            }
            
            // Set date range on the map controller
            if (window.mapController) {
                console.log('Setting date range on map controller and reloading areas');
                window.mapController.setDateRange(startDate, endDate);
                
                const councilId = document.getElementById('council')?.value;
                if (!councilId || councilId === 'all') {
                    window.mapController.loadAreas();
                } else {
                    window.mapController.loadAreas(councilId);
                }
            } else {
                console.error('Map controller not available for date range update');
            }
        });
        
        // Trigger initial load of the map with the default date range
        if (window.mapController) {
            window.mapController.setDateRange(
                today.format(dateFormat),
                endDate.format(dateFormat)
            );
            window.mapController.loadAreas();
        }
        
        console.log('Date range picker initialization complete');
    }
    
    // Helper function for getting configuration values
    function getConfigValue(key, fallback) {
        if (window.CONFIG && typeof CONFIG[key] !== 'undefined') {
            return CONFIG[key];
        }
        if (window.ENV && typeof ENV[key] !== 'undefined') {
            return ENV[key];
        }
        return fallback;
    }

    // Add logging for debugging events
    document.addEventListener('apply.daterangepicker', function(evt) {
        console.log('Global daterangepicker event detected:', evt);
    });
});