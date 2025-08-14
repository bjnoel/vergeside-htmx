import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.6'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  console.log('=== REQUEST RECEIVED ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('=== CORS PREFLIGHT ===')
    return new Response('OK', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    
    console.log('Environment check:', {
      supabaseUrl: !!supabaseUrl,
      resendApiKey: !!resendApiKey
    })

    // Check for admin token in custom header (Auth0 token)
    const adminToken = req.headers.get('x-admin-token')
    console.log('Admin token present:', !!adminToken)
    
    // For now, just use a default admin user
    const user = {
      email: 'admin@vergeside.com.au',
      sub: 'admin-user'
    }
    console.log('Using admin user:', user.email)

    const resend = new Resend(resendApiKey)
    
    // Parse request body
    const { 
      email, 
      includeCurrentWeekData = true,
      isAdminTest = false 
    } = await req.json()
    
    console.log('Request data:', { email, includeCurrentWeekData, isAdminTest })
    
    if (!email) {
      throw new Error('Email address is required')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address format')
    }

    // Get test data (simplified for now)
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - startDate.getDay()) // Start of current week
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    console.log('Sending test email...')

    // Send test email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Vergeside Test <noreply@vergeside.com.au>',
      to: email,
      subject: '[TEST] Vergeside Weekly Pickup Reminder',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <div style="background-color: #f6e05e; color: #744210; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 20px;">
            TEST EMAIL - This is a test of the weekly notification system
          </div>
          <h2>Vergeside Weekly Pickup Reminder</h2>
          <p>Hi there,</p>
          <p>This is a test email sent from the admin interface.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Sent to: ${email}</li>
            <li>Requested by: ${user.email}</li>
            <li>Date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
          <p>Visit <a href="https://www.vergeside.com.au">vergeside.com.au</a> for more information.</p>
        </div>
      `,
      text: `TEST EMAIL\n\nThis is a test email from Vergeside admin.\n\nSent to: ${email}\nRequested by: ${user.email}\nTimestamp: ${new Date().toISOString()}`
    })
    
    if (emailError) {
      console.error('Email send error:', emailError)
      throw new Error(`Failed to send test email: ${emailError.message}`)
    }

    console.log('Email sent successfully:', emailData?.id)

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Test email sent successfully to ${email}`,
        details: {
          recipient: email,
          requestedBy: user.email,
          resendId: emailData?.id,
          dataType: 'test',
          timestamp: new Date().toISOString()
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})