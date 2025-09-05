import { Resend } from 'resend'
import { render } from '@react-email/render'
import ReportDeliveryEmail from '@/emails/report-delivery'
import type { Report } from '@/types/reports'

interface SendEmailOptions {
  to: string
  report: Report
  publicUrl: string
}

export class EmailService {
  private resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async sendReportEmail({ to, report, publicUrl }: SendEmailOptions): Promise<{
    success: boolean
    messageId?: string
    error?: string
  }> {
    try {
      const html = await render(ReportDeliveryEmail({
        reportTitle: report.title,
        reportSummary: report.summary || '',
        kpis: report.kpis,
        reportUrl: publicUrl,
        unsubscribeUrl: `${process.env.NEXTAUTH_URL}/unsubscribe`,
      }))

      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'reports@yourdomain.com',
        to,
        subject: `📊 ${report.title}`,
        html,
      })

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        messageId: data?.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
      }
    }
  }

  async generateEmailHtml(report: Report, publicUrl: string): Promise<string> {
    return render(ReportDeliveryEmail({
      reportTitle: report.title,
      reportSummary: report.summary || '',
      kpis: report.kpis,
      reportUrl: publicUrl,
      unsubscribeUrl: `${process.env.NEXTAUTH_URL}/unsubscribe`,
    }))
  }
}

export const emailService = new EmailService()