import { z } from 'zod'

export const ReportRunStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
])

export const KPISchema = z.object({
  metric: z.string(),
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
  deltaPercent: z.number(),
  trend: z.enum(['up', 'down', 'stable']),
})

export const ReportRunSchema = z.object({
  id: z.string(),
  configId: z.string(),
  status: ReportRunStatusSchema,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  retryCount: z.number().default(0),
  lastErrorCode: z.string().optional(),
  lastErrorSnippet: z.string().optional(),
  rawPayload: z.any().optional(),
})

export const ReportSchema = z.object({
  id: z.string(),
  runId: z.string(),
  configId: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  kpis: z.array(KPISchema),
  rawData: z.any(),
  emailHtml: z.string().optional(),
  deliveryMethod: z.enum(['link', 'email']),
  deliveryTarget: z.string().optional(),
  isPublic: z.boolean().default(true),
  createdAt: z.date(),
})

export const CreateReportSchema = ReportSchema.omit({
  id: true,
  createdAt: true,
})

export type ReportRunStatus = z.infer<typeof ReportRunStatusSchema>
export type KPI = z.infer<typeof KPISchema>
export type ReportRun = z.infer<typeof ReportRunSchema>
export type Report = z.infer<typeof ReportSchema>
export type CreateReport = z.infer<typeof CreateReportSchema>