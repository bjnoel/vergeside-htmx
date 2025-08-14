import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.6'
import { Resend } from 'https://esm.sh/resend@2.0.0'

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    
    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)
    
    // Parse request body
    const { manual = false, scheduled = false } = await req.json().catch(() => ({}))
    
    // Check if this is a scheduled run (Thursday 8 AM check)
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const hour = now.getUTCHours()
    
    // Only proceed if it's Thursday 8 AM UTC, or if manually triggered
    if (!manual && scheduled && (dayOfWeek !== 4 || hour !== 8)) {
      return new Response(
        JSON.stringify({ 
          message: 'Not scheduled time for weekly emails',
          currentTime: now.toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Get active subscribers
    const { data: subscribers, error: subscriberError } = await supabase
      .from('email_subscribers')
      .select('*')
      .eq('is_active', true)
    
    if (subscriberError) {
      throw new Error(`Failed to fetch subscribers: ${subscriberError.message}`)
    }
    
    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active subscribers found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Get next week's pickups (Sunday to Sunday)
    const getNextSunday = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = day === 0 ? 0 : 7 - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d
    }
    
    const startDate = getNextSunday(now)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
    
    // Fetch pickups for the next week with area and council information
    const { data: pickups, error: pickupError } = await supabase
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
    
    if (!pickups || pickups.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No pickups scheduled for next week',
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Group pickups by council
    const pickupsByCouncil = pickups.reduce((acc: any, pickup: any) => {
      const councilName = pickup.area?.council?.name || 'Unknown Council'
      if (!acc[councilName]) {
        acc[councilName] = {
          council: pickup.area?.council,
          areas: []
        }
      }
      acc[councilName].areas.push(pickup.area)
      return acc
    }, {})
    
    // Generate email content
    const generateEmailHtml = (recipientName: string) => {
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4a5568; color: white; padding: 20px; text-align: center; }
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
            <div class="header">
              <h1>Vergeside Weekly Pickup Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p>Here are the vergeside pickups scheduled for next week (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}):</p>
              
              ${Object.entries(pickupsByCouncil).map(([councilName, data]: [string, any]) => `
                <div class="council">
                  <div class="council-name">${councilName}</div>
                  ${data.areas.map((area: any) => `
                    <div class="area">
                      <div class="area-name">${area.name}</div>
                      <img src="https://www.vergeside.com.au/api/area/${area.id}/map" alt="${area.name} map" class="map-image" />
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
              <p>You are receiving this email because you are subscribed to Vergeside pickup notifications.</p>
              <p>Visit <a href="https://www.vergeside.com.au" style="color: #4299e1;">vergeside.com.au</a> for more information.</p>
            </div>
          </div>
        </body>
        </html>
      `
      return html
    }
    
    const generateEmailText = (recipientName: string) => {
      let text = `Hi ${recipientName},\n\n`
      text += `Here are the vergeside pickups scheduled for next week (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}):\n\n`
      
      Object.entries(pickupsByCouncil).forEach(([councilName, data]: [string, any]) => {
        text += `${councilName}\n`
        text += `${'='.repeat(councilName.length)}\n`
        data.areas.forEach((area: any) => {
          text += `- ${area.name}\n`
          text += `  View map: https://www.vergeside.com.au/api/area/${area.id}/map\n`
        })
        if (data.council?.bulk_waste_url) {
          text += `\nBook bulk waste collection: ${data.council.bulk_waste_url}\n`
        }
        text += '\n'
      })
      
      text += '\n---\n'
      text += 'You are receiving this email because you are subscribed to Vergeside pickup notifications.\n'
      text += 'Visit https://www.vergeside.com.au for more information.'
      
      return text
    }
    
    // Send emails to all subscribers
    const results = []
    for (const subscriber of subscribers) {
      try {
        const emailHtml = generateEmailHtml(subscriber.name)
        const emailText = generateEmailText(subscriber.name)
        
        // Send email via Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Vergeside Pickups <noreply@vergeside.com.au>',
          to: subscriber.email,
          subject: 'Vergeside Weekly Pickup Reminder',
          html: emailHtml,
          text: emailText,
        })
        
        if (emailError) {
          // Log failed attempt
          await supabase
            .from('email_send_log')
            .insert({
              subscriber_id: subscriber.id,
              status: 'failed',
              error_message: emailError.message || 'Unknown error',
              email_content: { 
                subject: 'Vergeside Weekly Pickup Reminder',
                areas: Object.keys(pickupsByCouncil)
              }
            })
          
          results.push({
            email: subscriber.email,
            status: 'failed',
            error: emailError.message
          })
        } else {
          // Log successful send
          await supabase
            .from('email_send_log')
            .insert({
              subscriber_id: subscriber.id,
              status: 'sent',
              email_content: { 
                subject: 'Vergeside Weekly Pickup Reminder',
                areas: Object.keys(pickupsByCouncil),
                resend_id: emailData?.id
              }
            })
          
          results.push({
            email: subscriber.email,
            status: 'sent',
            id: emailData?.id
          })
        }
      } catch (error) {
        // Log error
        await supabase
          .from('email_send_log')
          .insert({
            subscriber_id: subscriber.id,
            status: 'failed',
            error_message: error.message || 'Unknown error',
            email_content: { 
              subject: 'Vergeside Weekly Pickup Reminder',
              areas: Object.keys(pickupsByCouncil)
            }
          })
        
        results.push({
          email: subscriber.email,
          status: 'failed',
          error: error.message
        })
      }
    }
    
    // Return summary
    const successCount = results.filter(r => r.status === 'sent').length
    const failedCount = results.filter(r => r.status === 'failed').length
    
    return new Response(
      JSON.stringify({ 
        message: `Weekly emails processed`,
        summary: {
          total: subscribers.length,
          sent: successCount,
          failed: failedCount
        },
        results,
        pickupCount: pickups.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error) {
    console.error('Error in send-weekly-emails:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})