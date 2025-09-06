export async function sendEmail(to: string, htmlContent: string, subject: string): Promise<void> {
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.log('📧 Email delivery skipped - RESEND_API_KEY not configured');
    console.log(`📤 Would send email to: ${to}`);
    console.log(`📋 Subject: ${subject}`);
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // Using verified Resend domain
        to: [to],
        subject: subject,
        html: htmlContent
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Resend API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('📧 Email sent successfully via Resend API:', result.id);
    
  } catch (error) {
    console.error('❌ Failed to send email via Resend API:', error);
    throw error;
  }
}

export const emailService = {
  sendEmail
};