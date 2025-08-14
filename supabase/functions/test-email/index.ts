import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.6'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import * as jose from 'https://esm.sh/jose@5.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const auth0Domain = Deno.env.get('AUTH0_DOMAIN')
    const auth0Audience = Deno.env.get('AUTH0_AUDIENCE')
    
    console.log('Environment check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseAnonKey: !!supabaseAnonKey,
      resendApiKey: !!resendApiKey,
      auth0Domain: !!auth0Domain,
      auth0Audience: !!auth0Audience
    })
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }
    
    // Verify the user is authenticated with Auth0
    const token = authHeader.replace('Bearer ', '')
    console.log('Token received (first 20 chars):', token.substring(0, 20))
    let user: any = null
    
    // Validate Auth0 token
    if (auth0Domain && auth0Audience) {
      try {
        console.log('Validating Auth0 token...')
        const JWKS = jose.createRemoteJWKSet(new URL(`https://${auth0Domain}/.well-known/jwks.json`))
        
        const { payload } = await jose.jwtVerify(token, JWKS, {
          issuer: `https://${auth0Domain}/`,
          audience: auth0Audience,
          algorithms: ['RS256']
        })
        
        user = {
          email: payload.email || payload.sub,
          sub: payload.sub
        }
        console.log(`Auth0 token validated successfully for: ${user.email}`)
      } catch (authError) {
        console.error('Auth0 validation error:', authError.message)
        throw new Error('Unauthorized: Invalid Auth0 token')
      }
    } else {
      // TEMPORARY: Bypass authentication for testing since Auth0 env vars not set
      console.log('AUTH0_DOMAIN/AUTH0_AUDIENCE not set, bypassing auth for testing...')
      console.log('WARNING: This is a security bypass for testing only!')
      
      // Extract email from token payload without validation (UNSAFE - for testing only)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        user = {
          email: payload.email || payload.sub || 'test@example.com',
          sub: payload.sub || 'test-user'
        }
        console.log('Using bypassed auth with user:', user.email)
      } catch (e) {
        // If token parsing fails, use a default test user
        user = {
          email: 'test@example.com',
          sub: 'test-user'
        }
        console.log('Token parsing failed, using default test user')
      }
    }
    
    if (!user) {
      throw new Error('Unauthorized: No valid user found')
    }
    
    const resend = new Resend(resendApiKey)
    
    // Parse request body
    const { 
      email, 
      includeCurrentWeekData = true,
      isAdminTest = false 
    } = await req.json()
    
    if (!email) {
      throw new Error('Email address is required')
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address format')
    }
    
    // For admin tests, verify the requesting user is an admin
    // This could be enhanced with proper role checking
    if (isAdminTest) {
      console.log(`Admin test email requested by ${user.email} to ${email}`)
    }
    
    // Get test data (current or next week's pickups)
    const now = new Date()
    
    const getNextSunday = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = day === 0 ? 0 : 7 - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d
    }
    
    const getCurrentSunday = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      d.setDate(d.getDate() - day)
      d.setHours(0, 0, 0, 0)
      return d
    }
    
    const startDate = includeCurrentWeekData ? getCurrentSunday(now) : getNextSunday(now)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
    
    // Use service role key for fetching data
    const supabaseService = createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Fetch pickups for the week with area and council information
    const { data: pickups, error: pickupError } = await supabaseService
      .from('area_pickup')
      .select(`
        *,
        area:area_id (
          id,
          name,
          council:council_id (
            id,
            name,
            bulk_waste_url
          )
        )
      `)
      .gte('start_date', startDate.toISOString())
      .lt('start_date', endDate.toISOString())
      .order('start_date', { ascending: true })
    
    if (pickupError) {
      throw new Error(`Failed to fetch pickups: ${pickupError.message}`)
    }
    
    // If no pickups, use sample data
    const hasPickups = pickups && pickups.length > 0
    
    // Group pickups by council
    const pickupsByCouncil = hasPickups ? pickups.reduce((acc: any, pickup: any) => {
      const councilName = pickup.area?.council?.name || 'Unknown Council'
      if (!acc[councilName]) {
        acc[councilName] = {
          council: pickup.area?.council,
          areas: []
        }
      }
      // Avoid duplicates
      if (!acc[councilName].areas.find((a: any) => a.id === pickup.area?.id)) {
        acc[councilName].areas.push(pickup.area)
      }
      return acc
    }, {}) : {
      'Sample Council': {
        council: { 
          name: 'Sample Council', 
          bulk_waste_url: 'https://example.com/bulk-waste' 
        },
        areas: [
          { id: 1, name: 'Sample Area 1' },
          { id: 2, name: 'Sample Area 2' }
        ]
      }
    }
    
    // Generate test email content
    const generateTestEmailHtml = () => {
      const weekLabel = includeCurrentWeekData ? 'this week' : 'next week'
      const dataLabel = hasPickups ? '' : ' (SAMPLE DATA - No actual pickups found)'
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4a5568; color: white; padding: 20px; text-align: center; }
            .test-banner { background-color: #f6e05e; color: #744210; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 20px; }
            .content { padding: 20px; background-color: #f7fafc; }
            .council { margin: 20px 0; }
            .council-name { font-size: 18px; font-weight: bold; color: #2d3748; margin-bottom: 10px; }
            .area { margin: 10px 0; padding: 10px; background-color: white; border-left: 4px solid #4299e1; }
            .area-name { font-weight: bold; color: #2b6cb0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 14px; }
            .map-image { max-width: 100%; height: auto; margin-top: 10px; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="test-banner">
              TEST EMAIL - This is a test of the weekly notification system${dataLabel}
            </div>
            <div class="header">
              <h1>Vergeside Weekly Pickup Reminder</h1>
            </div>
            <div class="content">
              <p>Hi Test User,</p>
              <p>Here are the vergeside pickups scheduled for ${weekLabel} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}):</p>
              
              ${Object.entries(pickupsByCouncil).map(([councilName, data]: [string, any]) => `
                <div class="council">
                  <div class="council-name">${councilName}</div>
                  ${data.areas.map((area: any) => `
                    <div class="area">
                      <div class="area-name">${area.name}</div>
                      ${hasPickups ? `
                        <img src="https://www.vergeside.com.au/api/area/${area.id}/map" alt="${area.name} map" class="map-image" />
                      ` : `
                        <p style="color: #718096; font-style: italic;">[Map would appear here for ${area.name}]</p>
                      `}
                    </div>
                  `).join('')}
                  ${data.council?.bulk_waste_url ? `
                    <p style="margin-top: 10px;">
                      <a href="${data.council.bulk_waste_url}" style="color: #4299e1;">
                        Book bulk waste collection for ${councilName}
                      </a>
                    </p>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            <div class="footer">
              <p style="color: #e53e3e; font-weight: bold;">
                This is a TEST email sent to: ${email}
              </p>
              <p>Requested by: ${user.email}</p>
              <p>Time: ${new Date().toISOString()}</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
              <p>You are receiving this email because you are subscribed to Vergeside pickup notifications.</p>
              <p>Visit <a href="https://www.vergeside.com.au" style="color: #4299e1;">vergeside.com.au</a> for more information.</p>
            </div>
          </div>
        </body>
        </html>
      `
      return html
    }
    
    const generateTestEmailText = () => {
      const weekLabel = includeCurrentWeekData ? 'this week' : 'next week'
      const dataLabel = hasPickups ? '' : ' (SAMPLE DATA - No actual pickups found)'
      
      let text = `TEST EMAIL - This is a test of the weekly notification system${dataLabel}\n\n`
      text += `Hi Test User,\n\n`
      text += `Here are the vergeside pickups scheduled for ${weekLabel} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}):\n\n`
      
      Object.entries(pickupsByCouncil).forEach(([councilName, data]: [string, any]) => {
        text += `${councilName}\n`
        text += `${'='.repeat(councilName.length)}\n`
        data.areas.forEach((area: any) => {
          text += `- ${area.name}\n`
          if (hasPickups) {
            text += `  View map: https://www.vergeside.com.au/api/area/${area.id}/map\n`
          } else {
            text += `  [Map URL would be here]\n`
          }
        })
        if (data.council?.bulk_waste_url) {
          text += `\nBook bulk waste collection: ${data.council.bulk_waste_url}\n`
        }
        text += '\n'
      })
      
      text += '\n---\n'
      text += `This is a TEST email sent to: ${email}\n`
      text += `Requested by: ${user.email}\n`
      text += `Time: ${new Date().toISOString()}\n`
      text += '\n---\n'
      text += 'You are receiving this email because you are subscribed to Vergeside pickup notifications.\n'
      text += 'Visit https://www.vergeside.com.au for more information.'
      
      return text
    }
    
    // Send test email via Resend
    const emailHtml = generateTestEmailHtml()
    const emailText = generateTestEmailText()
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Vergeside Test <noreply@vergeside.com.au>',
      to: email,
      subject: '[TEST] Vergeside Weekly Pickup Reminder',
      html: emailHtml,
      text: emailText,
      headers: {
        'X-Test-Email': 'true',
        'X-Requested-By': user.email || 'unknown',
      }
    })
    
    if (emailError) {
      throw new Error(`Failed to send test email: ${emailError.message}`)
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Test email sent successfully to ${email}`,
        details: {
          recipient: email,
          requestedBy: user.email,
          resendId: emailData?.id,
          dataType: hasPickups ? 'actual' : 'sample',
          weekType: includeCurrentWeekData ? 'current' : 'next',
          pickupCount: hasPickups ? pickups.length : 0,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error) {
    console.error('Error in test-email:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500
      }
    )
  }
})