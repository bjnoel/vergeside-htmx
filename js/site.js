// Main site functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize date range picker
    if (document.getElementById('daterange')) {
        const today = moment();
        const endDate = moment().add(CONFIG.DEFAULT_DATE_RANGE.END_OFFSET, 'days');
        
        $('#daterange').daterangepicker({
            startDate: today,
            endDate: endDate,
            locale: {
                format: 'MMMM D, YYYY'
            },
            ranges: {
                'Next Week': [moment(), moment().add(7, 'days')],
                'Next 2 Weeks': [moment(), moment().add(14, 'days')],
                'Next Month': [moment(), moment().add(1, 'month')],
                'Next 2 Months': [moment(), moment().add(2, 'months')]
            }
        });
        
        // Update map when date range changes
        $('#daterange').on('apply.daterangepicker', function(ev, picker) {
            const startDate = picker.startDate.format(CONFIG.DEFAULT_DATE_FORMAT);
            const endDate = picker.endDate.format(CONFIG.DEFAULT_DATE_FORMAT);
            
            mapController.setDateRange(startDate, endDate);
            
            const councilId = $('#council').val();
            if (councilId === 'all') {
                mapController.loadAreas();
            } else {
                mapController.loadAreas(councilId);
            }
        });
    }
    
    // Handle council selection change
    document.getElementById('council')?.addEventListener('change', function() {
        const councilId = this.value;
        const startDate = $('#daterange').data('daterangepicker').startDate.format(CONFIG.DEFAULT_DATE_FORMAT);
        const endDate = $('#daterange').data('daterangepicker').endDate.format(CONFIG.DEFAULT_DATE_FORMAT);
        
        mapController.setDateRange(startDate, endDate);
        
        if (councilId === 'all') {
            mapController.loadAreas();
        } else {
            mapController.loadAreas(councilId);
        }
    });
    
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