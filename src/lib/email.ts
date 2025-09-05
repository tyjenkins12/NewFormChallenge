import nodemailer from 'nodemailer';

export async function sendEmail(to: string, htmlContent: string, subject: string): Promise<void> {
  // Configure with environment variables for security
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Only send email if SMTP is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email delivery skipped - SMTP not configured');
    console.log(`Would send email to: ${to}`);
    console.log(`Subject: ${subject}`);
    return;
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: htmlContent,
  });

  console.log('Email sent:', info.messageId);
}

export const emailService = {
  sendEmail
};