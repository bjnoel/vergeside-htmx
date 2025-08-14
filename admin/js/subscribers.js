// Subscribers management JavaScript
let subscribers = [];
let filteredSubscribers = [];
let currentPage = 1;
let itemsPerPage = 20;
let sortField = 'created_at';
let sortDirection = 'desc';

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!adminAuth.isAdmin()) {
        window.location.href = '/admin';
        return;
    }
    
    // Initialize the page
    initializePage();
});

async function initializePage() {
    try {
        // Set user email in header
        const user = adminAuth.getUser();
        if (user && user.email) {
            document.getElementById('user-email').textContent = user.email;
            // Pre-fill test email modal with admin email
            document.getElementById('test-email-address').value = user.email;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        await refreshSubscribers();
        await loadEmailHistory();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showToast('Error loading page data', 'danger');
    }
}

function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        window.location.href = '/api/auth/logout';
    });
    
    // Search input
    document.getElementById('search-input').addEventListener('input', debounce(filterSubscribers, 300));
    
    // Status filter
    document.getElementById('status-filter').addEventListener('change', filterSubscribers);
    
    // Select all checkbox
    document.getElementById('select-all').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.subscriber-checkbox');
        checkboxes.forEach(cb => cb.checked = this.checked);
        updateBulkActions();
    });
    
    // Add subscriber form
    document.getElementById('add-subscriber-form').addEventListener('submit', handleAddSubscriber);
    
    // Edit subscriber form
    document.getElementById('edit-subscriber-form').addEventListener('submit', handleEditSubscriber);
}

// Load subscribers data
async function refreshSubscribers() {
    try {
        showLoading(true);
        
        const token = adminAuth.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        
        const response = await fetch('/api/admin/email_subscribers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch subscribers');
        }
        
        const data = await response.json();
        subscribers = data.data || [];
        
        // Update statistics
        updateStatistics();
        
        // Apply current filters and display
        filterSubscribers();
        
    } catch (error) {
        console.error('Error loading subscribers:', error);
        showToast('Error loading subscribers: ' + error.message, 'danger');
        
        // Show empty state
        document.getElementById('subscribers-table-body').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="bi bi-exclamation-triangle"></i> Error loading subscribers
                </td>
            </tr>
        `;
    } finally {
        showLoading(false);
    }
}

// Update statistics cards
function updateStatistics() {
    const total = subscribers.length;
    const active = subscribers.filter(s => s.is_active).length;
    const inactive = total - active;
    
    // Calculate recent additions (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = subscribers.filter(s => new Date(s.created_at) >= weekAgo).length;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('active-count').textContent = active;
    document.getElementById('inactive-count').textContent = inactive;
    document.getElementById('recent-count').textContent = recent;
}

// Filter and search subscribers
function filterSubscribers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    filteredSubscribers = subscribers.filter(subscriber => {
        const matchesSearch = !searchTerm || 
            subscriber.name.toLowerCase().includes(searchTerm) ||
            subscriber.email.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || 
            subscriber.is_active.toString() === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    // Sort the filtered results
    sortSubscribers();
    
    // Reset to first page
    currentPage = 1;
    displaySubscribers();
}

// Sort subscribers
function sortSubscribers() {
    filteredSubscribers.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        // Handle null values
        if (aVal === null) aVal = '';
        if (bVal === null) bVal = '';
        
        // Handle dates
        if (sortField.includes('_at')) {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        // Handle strings
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// Sort table by field
function sortTable(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }
    
    filterSubscribers(); // This will trigger sorting and display
}

// Display subscribers in table
function displaySubscribers() {
    const tableBody = document.getElementById('subscribers-table-body');
    
    if (filteredSubscribers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="bi bi-inbox"></i> No subscribers found
                </td>
            </tr>
        `;
        document.getElementById('pagination-container').classList.add('d-none');
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageSubscribers = filteredSubscribers.slice(startIndex, endIndex);
    
    // Generate table rows
    tableBody.innerHTML = pageSubscribers.map(subscriber => {
        const createdDate = new Date(subscriber.created_at).toLocaleDateString();
        const statusBadge = subscriber.is_active 
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>';
        
        return `
            <tr>
                <td>
                    <input type="checkbox" class="form-check-input subscriber-checkbox" 
                           value="${subscriber.id}" onchange="updateBulkActions()">
                </td>
                <td>
                    <strong>${escapeHtml(subscriber.name)}</strong>
                </td>
                <td>
                    <a href="mailto:${escapeHtml(subscriber.email)}">${escapeHtml(subscriber.email)}</a>
                </td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
                <td>
                    <span class="text-muted">Loading...</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editSubscriber('${subscriber.id}')" 
                                title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-${subscriber.is_active ? 'warning' : 'success'}" 
                                onclick="toggleSubscriberStatus('${subscriber.id}')"
                                title="${subscriber.is_active ? 'Deactivate' : 'Activate'}">
                            <i class="bi bi-${subscriber.is_active ? 'x-circle' : 'check-circle'}"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteSubscriber('${subscriber.id}')" 
                                title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Load last email dates (async)
    loadLastEmailDates(pageSubscribers);
    
    // Update pagination
    updatePagination();
    
    // Update bulk actions
    updateBulkActions();
}

// Load last email dates for displayed subscribers
async function loadLastEmailDates(pageSubscribers) {
    try {
        const token = adminAuth.getAccessToken();
        
        for (const subscriber of pageSubscribers) {
            try {
                const response = await fetch(`/api/admin/email_send_log?subscriber_id=eq.${subscriber.id}&order=sent_at.desc&limit=1`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const lastEmail = data.data && data.data[0];
                    
                    // Find the table row and update the last email cell
                    const rows = document.querySelectorAll('#subscribers-table-body tr');
                    const row = Array.from(rows).find(r => {
                        const checkbox = r.querySelector('.subscriber-checkbox');
                        return checkbox && checkbox.value === subscriber.id;
                    });
                    
                    if (row) {
                        const lastEmailCell = row.cells[5]; // Last Email column
                        if (lastEmail) {
                            const date = new Date(lastEmail.sent_at).toLocaleDateString();
                            const statusClass = lastEmail.status === 'sent' ? 'text-success' : 
                                               lastEmail.status === 'failed' ? 'text-danger' : 'text-warning';
                            lastEmailCell.innerHTML = `<span class="${statusClass}">${date}</span>`;
                        } else {
                            lastEmailCell.innerHTML = '<span class="text-muted">Never</span>';
                        }
                    }
                }
            } catch (error) {
                console.error(`Error loading last email for ${subscriber.email}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in loadLastEmailDates:', error);
    }
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    const container = document.getElementById('pagination-container');
    
    if (totalPages <= 1) {
        container.classList.add('d-none');
        return;
    }
    
    container.classList.remove('d-none');
    
    let paginationHtml = '';
    
    // Previous button
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    // Next button
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;
    
    pagination.innerHTML = paginationHtml;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displaySubscribers();
}

// Update bulk actions visibility
function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.subscriber-checkbox:checked');
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');
    
    if (checkboxes.length > 0) {
        selectedCount.textContent = checkboxes.length;
        bulkActions.classList.remove('d-none');
    } else {
        bulkActions.classList.add('d-none');
    }
    
    // Update select all checkbox state
    const allCheckboxes = document.querySelectorAll('.subscriber-checkbox');
    const selectAllCheckbox = document.getElementById('select-all');
    
    if (allCheckboxes.length > 0) {
        selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
        selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
    }
}

// Handle add subscriber form submission
async function handleAddSubscriber(event) {
    event.preventDefault();
    
    const name = document.getElementById('subscriber-name').value.trim();
    const email = document.getElementById('subscriber-email').value.trim();
    const isActive = document.getElementById('subscriber-active').checked;
    
    if (!name || !email) {
        showToast('Name and email are required', 'warning');
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        const response = await fetch('/api/admin/email_subscribers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                is_active: isActive
            })
        });
        
        if (response.ok) {
            showToast('Subscriber added successfully', 'success');
            document.getElementById('add-subscriber-form').reset();
            document.getElementById('subscriber-active').checked = true; // Reset to default
            bootstrap.Modal.getInstance(document.getElementById('addSubscriberModal')).hide();
            await refreshSubscribers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add subscriber');
        }
        
    } catch (error) {
        console.error('Error adding subscriber:', error);
        showToast('Error adding subscriber: ' + error.message, 'danger');
    }
}

// Edit subscriber
function editSubscriber(id) {
    const subscriber = subscribers.find(s => s.id === id);
    if (!subscriber) return;
    
    document.getElementById('edit-subscriber-id').value = subscriber.id;
    document.getElementById('edit-subscriber-name').value = subscriber.name;
    document.getElementById('edit-subscriber-email').value = subscriber.email;
    document.getElementById('edit-subscriber-active').checked = subscriber.is_active;
    
    new bootstrap.Modal(document.getElementById('editSubscriberModal')).show();
}

// Handle edit subscriber form submission
async function handleEditSubscriber(event) {
    event.preventDefault();
    
    const id = document.getElementById('edit-subscriber-id').value;
    const name = document.getElementById('edit-subscriber-name').value.trim();
    const email = document.getElementById('edit-subscriber-email').value.trim();
    const isActive = document.getElementById('edit-subscriber-active').checked;
    
    if (!name || !email) {
        showToast('Name and email are required', 'warning');
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        const response = await fetch(`/api/admin/email_subscribers?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                is_active: isActive
            })
        });
        
        if (response.ok) {
            showToast('Subscriber updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editSubscriberModal')).hide();
            await refreshSubscribers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update subscriber');
        }
        
    } catch (error) {
        console.error('Error updating subscriber:', error);
        showToast('Error updating subscriber: ' + error.message, 'danger');
    }
}

// Toggle subscriber status
async function toggleSubscriberStatus(id) {
    const subscriber = subscribers.find(s => s.id === id);
    if (!subscriber) return;
    
    const newStatus = !subscriber.is_active;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} this subscriber?`)) {
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        const response = await fetch(`/api/admin/email_subscribers?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_active: newStatus
            })
        });
        
        if (response.ok) {
            showToast(`Subscriber ${action}d successfully`, 'success');
            await refreshSubscribers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${action} subscriber`);
        }
        
    } catch (error) {
        console.error(`Error ${action}ing subscriber:`, error);
        showToast(`Error ${action}ing subscriber: ` + error.message, 'danger');
    }
}

// Delete subscriber
async function deleteSubscriber(id) {
    const subscriber = subscribers.find(s => s.id === id);
    if (!subscriber) return;
    
    if (!confirm(`Are you sure you want to delete ${subscriber.name} (${subscriber.email})?`)) {
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        const response = await fetch(`/api/admin/email_subscribers?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            showToast('Subscriber deleted successfully', 'success');
            await refreshSubscribers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete subscriber');
        }
        
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        showToast('Error deleting subscriber: ' + error.message, 'danger');
    }
}

// Bulk activate subscribers
async function bulkActivate() {
    const selectedIds = Array.from(document.querySelectorAll('.subscriber-checkbox:checked')).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to activate ${selectedIds.length} subscriber(s)?`)) {
        return;
    }
    
    await bulkUpdateStatus(selectedIds, true, 'activated');
}

// Bulk deactivate subscribers
async function bulkDeactivate() {
    const selectedIds = Array.from(document.querySelectorAll('.subscriber-checkbox:checked')).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to deactivate ${selectedIds.length} subscriber(s)?`)) {
        return;
    }
    
    await bulkUpdateStatus(selectedIds, false, 'deactivated');
}

// Bulk update status
async function bulkUpdateStatus(ids, status, action) {
    try {
        const token = adminAuth.getAccessToken();
        
        // Update each subscriber individually (Supabase doesn't support bulk updates with IN)
        const promises = ids.map(id => 
            fetch(`/api/admin/email_subscribers?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: status })
            })
        );
        
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.length - successful;
        
        if (successful > 0) {
            showToast(`${successful} subscriber(s) ${action} successfully`, 'success');
        }
        
        if (failed > 0) {
            showToast(`${failed} subscriber(s) failed to be ${action}`, 'warning');
        }
        
        await refreshSubscribers();
        
    } catch (error) {
        console.error(`Error bulk ${action.slice(0, -1)}ing subscribers:`, error);
        showToast(`Error bulk ${action.slice(0, -1)}ing subscribers: ` + error.message, 'danger');
    }
}

// Bulk delete subscribers
async function bulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.subscriber-checkbox:checked')).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to DELETE ${selectedIds.length} subscriber(s)? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        
        // Delete each subscriber individually
        const promises = selectedIds.map(id => 
            fetch(`/api/admin/email_subscribers?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
        );
        
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.length - successful;
        
        if (successful > 0) {
            showToast(`${successful} subscriber(s) deleted successfully`, 'success');
        }
        
        if (failed > 0) {
            showToast(`${failed} subscriber(s) failed to be deleted`, 'warning');
        }
        
        await refreshSubscribers();
        
    } catch (error) {
        console.error('Error bulk deleting subscribers:', error);
        showToast('Error bulk deleting subscribers: ' + error.message, 'danger');
    }
}

// Export subscribers to CSV
function exportSubscribers() {
    if (subscribers.length === 0) {
        showToast('No subscribers to export', 'warning');
        return;
    }
    
    const csvContent = [
        ['Name', 'Email', 'Status', 'Created Date'].join(','),
        ...subscribers.map(s => [
            `"${s.name}"`,
            `"${s.email}"`,
            s.is_active ? 'Active' : 'Inactive',
            new Date(s.created_at).toISOString().split('T')[0]
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vergeside-subscribers-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${subscribers.length} subscribers`, 'success');
}

// Import subscribers from CSV
async function importSubscribers() {
    const fileInput = document.getElementById('csv-file');
    const skipDuplicates = document.getElementById('skip-duplicates').checked;
    
    if (!fileInput.files.length) {
        showToast('Please select a CSV file', 'warning');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) {
                showToast('CSV file appears to be empty or invalid', 'warning');
                return;
            }
            
            // Skip header row
            const dataLines = lines.slice(1);
            const importData = [];
            
            for (let i = 0; i < dataLines.length; i++) {
                const line = dataLines[i].trim();
                if (!line) continue;
                
                // Simple CSV parsing (doesn't handle quotes with commas)
                const parts = line.split(',');
                
                if (parts.length < 2) {
                    showToast(`Invalid format on line ${i + 2}`, 'warning');
                    return;
                }
                
                const name = parts[0].replace(/"/g, '').trim();
                const email = parts[1].replace(/"/g, '').trim();
                const isActive = parts.length > 2 ? 
                    parts[2].replace(/"/g, '').trim().toLowerCase() === 'true' : true;
                
                if (!name || !email) {
                    showToast(`Missing name or email on line ${i + 2}`, 'warning');
                    return;
                }
                
                // Check for duplicates if enabled
                if (skipDuplicates && subscribers.some(s => s.email === email)) {
                    continue;
                }
                
                importData.push({ name, email, is_active: isActive });
            }
            
            if (importData.length === 0) {
                showToast('No new subscribers to import', 'warning');
                return;
            }
            
            // Import the data
            const token = adminAuth.getAccessToken();
            let successful = 0;
            let failed = 0;
            
            for (const subscriber of importData) {
                try {
                    const response = await fetch('/api/admin/email_subscribers', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(subscriber)
                    });
                    
                    if (response.ok) {
                        successful++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    failed++;
                }
            }
            
            bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
            
            if (successful > 0) {
                showToast(`Successfully imported ${successful} subscriber(s)`, 'success');
                await refreshSubscribers();
            }
            
            if (failed > 0) {
                showToast(`Failed to import ${failed} subscriber(s)`, 'warning');
            }
            
        } catch (error) {
            console.error('Error importing subscribers:', error);
            showToast('Error importing subscribers: ' + error.message, 'danger');
        }
    };
    
    reader.readAsText(file);
}

// Test weekly email functionality
async function testWeeklyEmail() {
    const modal = new bootstrap.Modal(document.getElementById('testEmailModal'));
    modal.show();
}

// Send test email
async function sendTestEmail() {
    const email = document.getElementById('test-email-address').value.trim();
    const useCurrentWeek = document.getElementById('use-current-week').checked;
    
    if (!email) {
        showToast('Please enter an email address', 'warning');
        return;
    }
    
    try {
        const token = adminAuth.getAccessToken();
        const supabaseUrl = window.ENV?.SUPABASE_URL || CONFIG?.SUPABASE_URL || 'https://wihegqwakwwvckxrivem.supabase.co';
        const response = await fetch(`${supabaseUrl}/functions/v1/test-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                includeCurrentWeekData: useCurrentWeek,
                isAdminTest: true
            })
        });
        
        console.log('Test email response status:', response.status);
        console.log('Test email response headers:', Object.fromEntries(response.headers.entries()));
        
        // Check if response has content before trying to parse JSON
        const responseText = await response.text();
        console.log('Test email response text:', responseText);
        
        if (!responseText) {
            throw new Error(`Empty response from server (status: ${response.status})`);
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        }
        
        if (response.ok && result.success) {
            showToast(`Test email sent successfully to ${email}`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('testEmailModal')).hide();
        } else {
            throw new Error(result.error || `HTTP ${response.status}: ${responseText.substring(0, 200)}`);
        }
        
    } catch (error) {
        console.error('Error sending test email:', error);
        showToast('Error sending test email: ' + error.message, 'danger');
    }
}

// Load email history
async function loadEmailHistory() {
    try {
        const token = adminAuth.getAccessToken();
        const response = await fetch('/api/admin/email_send_log?order=sent_at.desc&limit=20', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch email history');
        }
        
        const data = await response.json();
        const logs = data.data || [];
        
        const historyContainer = document.getElementById('email-history');
        
        if (logs.length === 0) {
            historyContainer.innerHTML = '<p class="text-muted text-center">No email history found</p>';
            return;
        }
        
        historyContainer.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Subscriber</th>
                            <th>Status</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                            const date = new Date(log.sent_at).toLocaleString();
                            const subscriber = subscribers.find(s => s.id === log.subscriber_id);
                            const subscriberName = subscriber ? `${subscriber.name} (${subscriber.email})` : 'Unknown';
                            const statusClass = log.status === 'sent' ? 'success' : 
                                               log.status === 'failed' ? 'danger' : 'warning';
                            
                            return `
                                <tr>
                                    <td>${date}</td>
                                    <td>${escapeHtml(subscriberName)}</td>
                                    <td><span class="badge bg-${statusClass}">${log.status}</span></td>
                                    <td>${log.error_message ? escapeHtml(log.error_message) : '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading email history:', error);
        document.getElementById('email-history').innerHTML = 
            '<p class="text-danger text-center">Error loading email history</p>';
    }
}

// Utility functions
function showLoading(show) {
    document.getElementById('loading').classList.toggle('d-none', !show);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${escapeHtml(message)}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                    data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: type === 'danger' ? 5000 : 3000
    });
    
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}