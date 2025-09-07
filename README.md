# Scheduled Insight Reports

A Next.js application that creates recurring ad performance reports from Meta and TikTok platforms with automated scheduling and delivery.

## Features

- **Multi-Platform Support**: Meta (Facebook/Instagram) and TikTok ad data with robust API integration
- **Advanced Scheduling**: Manual to monthly cadences with custom cron expressions
- **Smart Data Handling**: Metric partitioning system prevents zero-result API issues
- **Dynamic Validation**: Real-time configuration validation with level-dimension filtering
- **Multiple Delivery Options**: Email delivery with PDF attachments or secure public links
- **AI-Powered Reporting**: OpenAI-generated summaries with interactive charts
- **Real-time Dashboard**: Live status tracking, run history, and error monitoring
- **Token Security**: JWT-based authentication with configurable expiration
- **Demo Mode**: Accelerated scheduling for testing and development

## Quick Start

1. **Install dependencies and setup database**:
   ```bash
   npm run setup
   ```
   
   This runs the full setup including dependencies, Prisma generation, database setup, and seeding.

2. **Configure environment** (optional for email delivery):
   ```bash
   cp .env
   # Edit .env with your Resend API key
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000`

Note: If port 3000 is in use, Next.js will automatically use the next available port (e.g., 3001, 3002, etc.)

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

### Scheduler
- `POST /api/scheduler` - Configure and start new report
- `GET /api/scheduler/status` - Get scheduler status
- `POST /api/scheduler/run` - Manually trigger report
- `POST /api/scheduler/clear` - Clear scheduler configuration
- `GET /api/scheduler/debug` - Debug scheduler state

### Reports & Data
- `GET /api/reports/[slug]` - Access generated report by slug
- `POST /api/validate` - Validate report configuration
- `GET /api/runs/[id]` - Get report run details
- `POST /api/runs` - List report runs
- `GET /api/configs/[id]` - Get report configuration
- `POST /api/configs` - Manage report configurations
- `POST /api/demo` - Demo mode endpoints

## Configuration Options

### Platforms
- **Meta**: Campaign, adset, ad, or account level reporting with dynamic breakdown filtering
- **TikTok**: Auction advertiser, auction campaign, or auction ad level reporting with level-specific dimensions

### Metrics
Available metrics vary by platform but include spend, impressions, clicks, CTR, conversions, and more.

### Scheduling
- **Manual**: Run only when triggered
- **Hourly**: Every hour
- **12 Hours**: Every 12 hours
- **Daily**: Once per day
- **Weekly**: Once per week
- **Monthly**: Once per month
- **Custom**: Custom cron expressions with validation and preview

### Delivery
- **Link**: Generate public HTML report accessible via URL
- **Email**: Send HTML report via email (requires Resend API key)

## Environment Variables

Configure these in `.env` for email delivery:

```env
# Email delivery (Resend)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=your-verified-sender@example.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/scheduled_reports

# OpenAI for report summaries
OPENAI_API_KEY=your-openai-api-key
```

## Tech Stack

- **Framework**: Next.js 15.5.2 with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL with Prisma ORM
- **Scheduling**: node-cron with cron-parser
- **Charts**: Recharts for interactive visualizations
- **Email**: Resend with React Email templates
- **PDF Generation**: Puppeteer
- **Forms**: React Hook Form + Zod validation
- **AI**: OpenAI for intelligent report summaries
- **Authentication**: JWT tokens with signed URLs
- **Testing**: Jest + Playwright

## Report Features

Generated reports include:
- **AI-generated executive summaries** with key insights
- **Interactive charts** with metric partitioning for reliable data
- **Detailed KPI cards** with performance deltas
- **Professional styling** and responsive design
- **Multiple formats**: HTML reports and PDF attachments
- **Signed URLs** for secure report access
- **Email delivery** with embedded charts and data
- **Live preview** with real-time configuration validation

## API Integration

The application connects to NewForm's ad data API with the following authentication:

- **Base URL**: https://bizdev.newform.ai
- **Token**: NEWFORMCODINGCHALLENGE (included in Authorization header)

Supported endpoints:
- `/sample-data/meta` - Meta platform data
- `/sample-data/tiktok` - TikTok platform data

## Development

To extend the application:

1. **Add new metrics**: Update type definitions in `src/types/index.ts` and metric availability in `src/lib/metric-availability.ts`
2. **Customize reports**: Modify `src/lib/report-generator.ts` and email templates in `src/emails/`
3. **Add platforms**: Extend API integration in `src/lib/api.ts` and partitioned API in `src/lib/partitioned-api.ts`
4. **Modify scheduling**: Update `src/lib/scheduler.ts` and cron utilities in `src/lib/utils/cron-utils.ts`
5. **Database changes**: Update Prisma schema in `prisma/schema.prisma`
6. **Add level-dimension mappings**: Update `src/lib/level-dimension-mapping.ts`

## Production Deployment

For production use:

1. **Configure services**: Set up Resend API key, PostgreSQL database, and OpenAI API key
2. **Database setup**: Run `npm run setup` to initialize Prisma schema and seed data
3. **Security**: Configure JWT token settings and domain whitelisting
4. **Monitoring**: Set up error logging and report run tracking
5. **Performance**: Implement rate limiting and database connection pooling
6. **Scaling**: Consider Redis for caching and job queue for large-scale scheduling

This project was created as a coding challenge demonstration.
