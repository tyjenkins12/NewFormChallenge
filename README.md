# Scheduled Insight Reports

A Next.js application that creates recurring ad performance reports from Meta and TikTok platforms with automated scheduling and delivery.

## Features

- **Platform Support**: Meta (Facebook/Instagram) and TikTok ad data
- **Flexible Scheduling**: Manual, hourly, 12-hour, or daily report generation
- **Multiple Delivery Options**: Email delivery or public link access
- **Rich Reporting**: LLM-generated summaries with interactive charts
- **Real-time Dashboard**: Track report status, schedules, and history

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (optional for email delivery):
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your SMTP settings
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000`

## Usage

### 1. Configure Report
- Select platform (Meta or TikTok)
- Choose metrics to track
- Set reporting level and date range
- Configure schedule cadence
- Choose delivery method (email or public link)

### 2. Monitor Dashboard
- View scheduler status and next run time
- Manually trigger report generation
- Access generated reports
- Review run history and errors

## API Endpoints

The application includes the following API routes:

- `POST /api/scheduler` - Configure new report
- `GET /api/scheduler/status` - Get current status
- `POST /api/scheduler/run` - Manually trigger report

## Configuration Options

### Platforms
- **Meta**: Account, campaign, adset, or ad level reporting
- **TikTok**: Advertiser, campaign, or ad level reporting

### Metrics
Available metrics vary by platform but include spend, impressions, clicks, CTR, conversions, and more.

### Scheduling
- Manual: Run only when triggered
- Hourly: Every hour
- 12 Hours: Twice daily
- Daily: Once per day at 9 AM

### Delivery
- **Link**: Generate public HTML report accessible via URL
- **Email**: Send HTML report via email (requires SMTP configuration)

## Environment Variables

Configure these in `.env.local` for email delivery:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@example.com
```

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Scheduling**: node-cron
- **Charts**: Chart.js
- **Email**: Nodemailer
- **Forms**: React Hook Form + Zod validation

## Report Features

Generated reports include:
- Executive summary with key metrics
- Interactive charts showing performance data
- Detailed data tables
- Professional styling and responsive design
- Exportable HTML format

## API Integration

The application connects to NewForm's ad data API with the following authentication:

- **Base URL**: https://bizdev.newform.ai
- **Token**: NEWFORMCODINGCHALLENGE (included in Authorization header)

Supported endpoints:
- `/sample-data/meta` - Meta platform data
- `/sample-data/tiktok` - TikTok platform data

## Development

To extend the application:

1. **Add new metrics**: Update type definitions in `src/types/index.ts`
2. **Customize reports**: Modify `src/lib/report-generator.ts`
3. **Add platforms**: Extend API integration in `src/lib/api.ts`
4. **Modify scheduling**: Update `src/lib/scheduler.ts`

## Production Deployment

For production use:

1. Configure SMTP settings for email delivery
2. Set up proper error logging and monitoring
3. Consider using a database for persistence
4. Implement user authentication if needed
5. Add rate limiting for API endpoints

This project was created as a coding challenge demonstration.
