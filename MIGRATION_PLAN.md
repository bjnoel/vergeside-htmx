# Vergeside Email Notification System Migration Plan

## Overview
This document outlines the plan to migrate the legacy Vergeside.Emailer (.NET Windows Service) to a modern Supabase-based solution with Edge Functions, scheduled tasks, and an admin UI for subscriber management.

## Current System Analysis

### Legacy System (Vergeside.Emailer)
- **Technology**: .NET Windows Service using MailKit for SMTP
- **Functionality**:
  - Runs continuously, checking every 5 minutes
  - Sends weekly email notifications on Thursdays at 8 AM
  - Fetches upcoming vergeside pickups for the next week
  - Includes area maps as embedded images
  - Tracks email delivery in database
  - Supports both HTML and text email formats

### Data Sources
- `EmailRecipient` table - stores subscriber information
- `EmailRecipientLog` table - tracks sent emails
- `Area` and `Council` tables - pickup location data
- `AreaPickup` table - scheduled pickup dates

## Proposed Architecture

### 1. Database Schema Updates

```sql
-- Subscribers table (replaces EmailRecipient)
CREATE TABLE IF NOT EXISTS email_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email log table (replaces EmailRecipientLog)
CREATE TABLE IF NOT EXISTS email_send_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'pending'
    error_message TEXT,
    email_content JSONB, -- Store the email content for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_email_subscribers_active ON email_subscribers(is_active);
CREATE INDEX idx_email_send_log_subscriber ON email_send_log(subscriber_id);
CREATE INDEX idx_email_send_log_sent_at ON email_send_log(sent_at);
```

### 2. Supabase Edge Functions

#### A. Email Sender Function (`/functions/send-weekly-emails`)
**Purpose**: Core function to send weekly vergeside pickup notifications

**Features**:
- Fetches active subscribers from database
- Queries upcoming pickups for the next week
- Generates HTML and text email content
- Sends emails via Resend/SendGrid API
- Logs delivery status

**Endpoints**:
- `POST /functions/send-weekly-emails` - Trigger weekly email send
- `POST /functions/send-weekly-emails/test` - Test with specific email

#### B. Test Email Function (`/functions/test-email`)
**Purpose**: Allow admins to test email templates with their own address

**Features**:
- Accept email address as parameter
- Generate sample email with current week's data
- Return preview without logging

### 3. Scheduled Tasks (Cron Jobs)

Using Supabase's pg_cron extension:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly email send (Every Thursday at 8 AM UTC)
SELECT cron.schedule(
    'send-weekly-vergeside-emails',
    '0 8 * * 4', -- Cron expression for Thursday 8 AM
    $$
    SELECT net.http_post(
        url := 'https://[PROJECT_REF].supabase.co/functions/v1/send-weekly-emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('scheduled', true)
    );
    $$
);
```

### 4. Admin UI Components

#### A. Subscribers Management Page (`/admin/subscribers.html`)

**Features**:
- List all subscribers with pagination
- Add new subscriber form
- Edit subscriber details
- Activate/deactivate subscribers
- Bulk import/export functionality
- Search and filter options
- Quick test email button in header

**UI Components**:
```html
<!-- Main sections -->
1. Subscriber List Table
   - Email, Name, Status, Created Date, Actions
   - Sort by any column
   - Quick search box

2. Add Subscriber Modal
   - Email input (with validation)
   - Name input
   - Active checkbox

3. Bulk Actions
   - Import CSV
   - Export to CSV
   - Bulk activate/deactivate

4. Email History
   - View send history per subscriber
   - Resend failed emails
```

#### B. Email Testing Interface (`/admin/email-test.html`)

**Features**:
- Test email template with current week's data
- Preview HTML and text versions
- Send test to admin email or custom email address
- Validate email rendering
- Quick test button in subscribers page

**UI Components**:
```html
<!-- Email Test Page -->
1. Test Email Form
   - Email address input (pre-filled with admin email)
   - Include sample data checkbox
   - Send Test button
   
2. Email Preview Section
   - Toggle between HTML/Text view
   - Show actual email content that would be sent
   - Display area maps that would be included

3. Test History
   - Last 10 test emails sent
   - Status (success/failed)
   - Timestamp
```

**Integration in Subscribers Page**:
```html
<!-- Add to subscribers.html -->
<div class="card-header d-flex justify-content-between">
    <h5>Email Subscribers</h5>
    <div>
        <button class="btn btn-info btn-sm" onclick="testWeeklyEmail()">
            <i class="bi bi-envelope"></i> Test Weekly Email
        </button>
        <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addSubscriberModal">
            <i class="bi bi-plus"></i> Add Subscriber
        </button>
    </div>
</div>
```

**Admin Dashboard Menu Item** (`/admin/index.html`):
```html
<!-- Add new card to admin dashboard -->
<div class="col-md-4">
    <div class="card admin-card">
        <div class="card-body text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-envelope-check mb-3 text-secondary" viewBox="0 0 16 16">
                <path d="M2 2a2 2 0 0 0-2 2v8.01A2 2 0 0 0 2 14h5.5a.5.5 0 0 0 0-1H2a1 1 0 0 1-.966-.741l5.64-3.471L8 9.583l7-4.2V8.5a.5.5 0 0 0 1 0V4a2 2 0 0 0-2-2H2Zm3.708 6.208L1 11.105V5.383l4.708 2.825ZM1 4.217V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v.217l-7 4.2-7-4.2Z"/>
                <path d="M16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-1.993-1.679a.5.5 0 0 0-.686.172l-1.17 1.95-.547-.547a.5.5 0 0 0-.708.708l.774.773a.75.75 0 0 0 1.174-.144l1.335-2.226a.5.5 0 0 0-.172-.686Z"/>
            </svg>
            <h4>Email Subscribers</h4>
            <p>Manage email subscribers and test weekly notifications.</p>
            <a href="/admin/subscribers" class="btn btn-secondary">Manage Subscribers</a>
        </div>
    </div>
</div>
```

### 6. Implementation Phases

#### Phase 1: Database Setup (Week 1)
- [ ] Create subscriber tables in Supabase
- [ ] Migrate existing recipient data
- [ ] Set up RLS policies for security
- [ ] Create database functions for common queries

#### Phase 2: Edge Functions Development (Week 2)
- [ ] Implement email sender function
- [ ] Set up email service integration (Resend/SendGrid)
- [ ] Create test email endpoint
- [ ] Add error handling and retry logic

#### Phase 3: Scheduled Tasks (Week 3)
- [ ] Configure pg_cron extension
- [ ] Set up weekly schedule
- [ ] Implement monitoring and alerts
- [ ] Test scheduling reliability

#### Phase 4: Admin UI (Week 4)
- [ ] Build subscribers management page
- [ ] Implement CRUD operations
- [ ] Add email testing interface
- [ ] Create dashboard with statistics

#### Phase 5: Testing & Migration (Week 5)
- [ ] Comprehensive testing with test data
- [ ] Parallel run with legacy system
- [ ] Performance testing
- [ ] Data validation

#### Phase 6: Deployment (Week 6)
- [ ] Deploy to production
- [ ] Monitor initial sends
- [ ] Decommission legacy system
- [ ] Documentation update

## Technical Considerations

### Email Service Provider
**Options**:
1. **Resend** (Recommended)
   - Easy integration with Edge Functions
   - Good deliverability
   - React Email templates support

2. **SendGrid**
   - Mature platform
   - Advanced analytics
   - Higher cost

### Image Handling
- Store area map images in Supabase Storage
- Generate public URLs for email embedding
- Consider lazy loading for better performance

### Error Handling
- Implement retry logic for failed sends
- Queue management for large subscriber lists
- Graceful degradation if services are unavailable

### Security
- Use Supabase Service Role key for cron jobs
- Implement RLS policies on subscriber tables
- Validate email addresses before sending
- Rate limiting on test endpoints

## Testing Strategy

### 1. Unit Tests
- Email content generation
- Data fetching logic
- Subscriber filtering

### 2. Integration Tests
- Edge Function endpoints
- Database operations
- Email service integration

### 3. End-to-End Tests
- Complete email flow
- Scheduled task execution
- Admin UI operations

### 4. Test Commands

```bash
# Test individual email send
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/test-email \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Trigger manual send (admin only)
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/send-weekly-emails \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"manual": true}'
```

### 5. Admin Interface JavaScript Functions

```javascript
// Function to test weekly email from admin interface
async function testWeeklyEmail() {
    const adminEmail = adminAuth.getUser()?.email;
    if (!adminEmail) {
        showToast('Admin email not found', 'danger');
        return;
    }
    
    // Show confirmation dialog
    if (!confirm(`Send test email to ${adminEmail}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/functions/v1/test-email', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminAuth.getAccessToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: adminEmail,
                includeCurrentWeekData: true 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`Test email sent to ${adminEmail}`, 'success');
        } else {
            showToast(`Failed to send test email: ${result.error}`, 'danger');
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        showToast('Error sending test email', 'danger');
    }
}

// Function to send test to custom email
async function sendTestToCustomEmail(email) {
    if (!email || !validateEmail(email)) {
        showToast('Please enter a valid email address', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/functions/v1/test-email', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminAuth.getAccessToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: email,
                includeCurrentWeekData: true,
                isAdminTest: true
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`Test email sent to ${email}`, 'success');
            // Log to test history
            logTestEmail(email, 'success');
        } else {
            showToast(`Failed to send test email: ${result.error}`, 'danger');
            logTestEmail(email, 'failed', result.error);
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        showToast('Error sending test email', 'danger');
        logTestEmail(email, 'failed', error.message);
    }
}
```

## Monitoring & Maintenance

### Metrics to Track
- Email delivery rate
- Bounce rate
- Open rate (if tracking enabled)
- Function execution time
- Error frequency

### Alerting
- Failed cron job execution
- High bounce rate
- Function timeouts
- Database connection issues

### Maintenance Tasks
- Regular subscriber list cleanup
- Email template updates
- Performance optimization
- Security updates

## Rollback Plan

If issues arise:
1. Disable pg_cron schedule
2. Re-enable legacy Windows Service
3. Investigate and fix issues
4. Retry migration with fixes

## Success Criteria

- [ ] All active subscribers receive weekly emails
- [ ] Email delivery rate > 95%
- [ ] Admin can manage subscribers without technical help
- [ ] System operates without manual intervention
- [ ] Cost reduction compared to Windows Service hosting
- [ ] Improved monitoring and observability

## Timeline

**Total Duration**: 6 weeks

- Week 1: Database setup and data migration
- Week 2: Edge Functions development
- Week 3: Scheduled tasks configuration
- Week 4: Admin UI implementation
- Week 5: Testing and validation
- Week 6: Production deployment

## Resources Required

- Supabase Pro plan (for cron jobs)
- Email service account (Resend/SendGrid)
- Development environment access
- Testing email addresses
- Production data backup

## Next Steps

1. Review and approve this plan
2. Set up Supabase project with required extensions
3. Create email service account
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews