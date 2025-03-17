// API handler for contact form submissions using Supabase
import { supabaseClient } from '../../js/supabase-client.js';

export async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { name, email, subject, message } = req.body;
      
      // Validate input
      if (!name || !email || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: '<div class="alert alert-danger">Please fill in all required fields</div>'
        });
      }
      
      // Use the Supabase client to submit contact form data
      const contactData = {
        name,
        email,
        subject,
        message
      };
      
      const result = await supabaseClient.submitContactForm(contactData);
      
      if (!result) {
        return res.status(500).json({
          success: false,
          message: '<div class="alert alert-danger">Sorry, there was an error submitting your message. Please try again later.</div>'
        });
      }
      
      // Return a successful response
      return res.status(200).json({
        success: true,
        message: '<div class="alert alert-success">Thank you for your message! We\'ll get back to you soon.</div>'
      });
    } catch (error) {
      console.error('Error processing contact form:', error);
      
      return res.status(500).json({
        success: false,
        message: '<div class="alert alert-danger">Sorry, there was an error submitting your message. Please try again later.</div>'
      });
    }
  } else {
    res.status(405).json({ 
      success: false,
      message: '<div class="alert alert-danger">Method not allowed</div>' 
    });
  }
}