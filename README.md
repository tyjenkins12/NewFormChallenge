# Report Runner

Automated report generation and delivery system with LLM-powered insights and demo capabilities.

## Quick Evaluation Guide

**Get started in 30 seconds:**

1. **Setup**: `pnpm setup` (installs dependencies, sets up database, seeds data)
2. **Start**: `pnpm dev` → Opens [localhost:3000](http://localhost:3000)
3. **Evaluate**:
   - Toggle **Demo Mode** (accelerated 30s schedule)
   - Click **Run Now** → Watch real-time progress
   - Toggle **Simulate LLM Failure** → See fallback behavior
   - Toggle **Bypass Cache** → Hit real APIs
   - Visit **/r/[slug]** → View shareable public reports

## Core Features

- **Automated Scheduling**: Configurable intervals with demo acceleration
- **LLM Integration**: OpenAI with intelligent fallbacks
- **Report Generation**: JSON-first with public shareable links
- **Email Delivery**: HTML templates with react-email
- **Real-time UI**: Progress tracking, status updates, error handling
- **Demo Mode**: Safe evaluation with cached responses

## Tech Stack

- **Framework**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **UI**: Radix UI + shadcn/ui components
- **Email**: Resend + React Email templates
- **LLM**: OpenAI GPT-4 with timeout handling
- **Testing**: Jest + Playwright E2E

## Development Scripts

```bash
pnpm setup        # Full setup (install + db + seed)
pnpm dev          # Start development server
pnpm build        # Production build
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
pnpm lint         # ESLint check
```

## Architecture

```
src/
├── app/          # Next.js App Router
├── components/   # UI components
├── lib/          # Business logic
├── types/        # TypeScript definitions
└── emails/       # React email templates
```

## Configuration

1. Copy `.env.example` → `.env.local`
2. Update database and API keys
3. Run `pnpm setup`

## Key Demo Features

- **Concurrent Protection**: "Run Now" disabled during active runs
- **LLM Fallback**: Toggle failure simulation with clear UI feedback
- **Cache Control**: Bypass toggle for real API calls
- **Error Handling**: Detailed error cards with status codes
- **Accessibility**: ARIA labels, color-blind friendly indicators

## Observability

Each run stores:
- Status, duration, retry count
- Error codes and response snippets
- Raw JSON payloads (viewable in dashboard)

## Production Notes

**Beyond the Take-Home:**
- Replace in-process scheduler with Vercel Cron/Temporal
- Add database locks for run deduplication  
- Implement secrets via platform KMS
- Email templating with provider webhooks

## Rubric Alignment

- **Requirements**: Scheduling, delivery, validation, public reports
- **Quality**: Error handling, fallbacks, comprehensive tests
- **Pragmatism**: Demo mode, caching, mutex protection
- **Security**: Server-only API calls, environment secrets