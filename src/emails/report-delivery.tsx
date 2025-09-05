import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { KPI } from '@/types/reports'

interface ReportDeliveryEmailProps {
  reportTitle: string
  reportSummary: string
  kpis: KPI[]
  reportUrl: string
  unsubscribeUrl: string
}

export default function ReportDeliveryEmail({
  reportTitle,
  reportSummary,
  kpis,
  reportUrl,
  unsubscribeUrl,
}: ReportDeliveryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your {reportTitle} is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Text style={paragraph}>
              Your automated report has been generated and is ready for review.
            </Text>
            
            <Text style={heading}>{reportTitle}</Text>
            
            {reportSummary && (
              <Section>
                <Text style={subheading}>Executive Summary</Text>
                <Text style={paragraph}>{reportSummary}</Text>
              </Section>
            )}

            <Section>
              <Text style={subheading}>Key Metrics</Text>
              {kpis.slice(0, 3).map((kpi) => (
                <div key={kpi.metric} style={kpiRow}>
                  <Text style={kpiLabel}>{kpi.metric}</Text>
                  <Text style={kpiValue}>
                    {kpi.current.toLocaleString()}
                    <span style={getTrendStyle(kpi.trend)}>
                      {kpi.trend === 'up' ? ' ↗' : kpi.trend === 'down' ? ' ↘' : ' →'}
                      {kpi.deltaPercent > 0 ? '+' : ''}{kpi.deltaPercent}%
                    </span>
                  </Text>
                </div>
              ))}
            </Section>

            <Section style={buttonSection}>
              <Button style={button} href={reportUrl}>
                View Complete Report
              </Button>
            </Section>

            <Hr style={hr} />
            
            <Text style={footer}>
              This report was generated automatically. 
              <br />
              <a href={unsubscribeUrl} style={link}>Unsubscribe</a> from future reports.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function getTrendStyle(trend: 'up' | 'down' | 'stable') {
  const base = { fontWeight: 'bold', marginLeft: '8px' }
  switch (trend) {
    case 'up':
      return { ...base, color: '#22c55e' }
    case 'down':
      return { ...base, color: '#ef4444' }
    default:
      return { ...base, color: '#6b7280' }
  }
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const box = {
  padding: '0 48px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
}

const subheading = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 12px 0',
}

const kpiRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #e6ebf1',
}

const kpiLabel = {
  color: '#525f7f',
  fontSize: '14px',
  margin: '0',
}

const kpiValue = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  width: '200px',
  padding: '14px 7px',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
}

const link = {
  color: '#3b82f6',
  textDecoration: 'underline',
}