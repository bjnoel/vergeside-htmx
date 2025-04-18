/**
 * Loads HTML includes like a shared navbar or footer
 * Usage: <div data-include="/includes/navbar.html"></div>
 */
document.addEventListener('DOMContentLoaded', function() {
    // Find all elements with data-include attribute
    const includes = document.querySelectorAll('[data-include]');
    
    // For each include element
    includes.forEach(function(element) {
        const file = element.getAttribute('data-include');
        
        // Fetch the include file
        fetch(file)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${file}: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                // Insert the HTML content
                element.innerHTML = html;
                
                // Execute any scripts within the included HTML
                const scripts = element.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    
                    // Copy attributes
                    Array.from(script.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    
                    // Copy content
                    newScript.textContent = script.textContent;
                    
                    // Replace old script with new one to execute it
                    script.parentNode.replaceChild(newScript, script);
                });
            })
            .catch(error => {
                console.error('Error loading include:', error);
                element.innerHTML = `<div class="alert alert-danger">Failed to load ${file}</div>`;
            });
    });
});