export async function sendEmail(to: string, htmlContent: string, subject: string, attachment?: { filename: string; content: Buffer }): Promise<void> {
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.log('📧 Email delivery skipped - RESEND_API_KEY not configured');
    console.log(`📤 Would send email to: ${to}`);
    console.log(`📋 Subject: ${subject}`);
    return;
  }

  try {
    const emailPayload: any = {
      from: 'onboarding@resend.dev', // Using verified Resend domain
      to: [to],
      subject: subject,
      html: htmlContent
    };

    // Add attachment if provided
    if (attachment) {
      // Validate attachment buffer before encoding
      const bufferSize = attachment.content.length;
      console.log(`📎 PDF attachment buffer size: ${(bufferSize / 1024).toFixed(2)}KB`);
      
      if (bufferSize < 1000) {
        console.error('⚠️ PDF attachment buffer seems too small:', bufferSize);
        throw new Error(`PDF attachment buffer too small: ${bufferSize} bytes`);
      }
      
      // Check PDF header before encoding
      const header = attachment.content.toString('ascii', 0, 8);
      if (!header.startsWith('%PDF-')) {
        console.error('⚠️ PDF attachment missing valid PDF header:', header);
        throw new Error('Invalid PDF attachment - missing PDF header');
      }
      
      const base64Content = attachment.content.toString('base64');
      console.log(`📎 PDF attachment base64 length: ${base64Content.length}`);
      
      emailPayload.attachments = [{
        filename: attachment.filename,
        content: base64Content,
        contentType: 'application/pdf'
      }];
      console.log(`📎 Adding PDF attachment: ${attachment.filename}`);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
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