import { z } from 'zod'

export const ReportConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  schedule: z.string().min(1), // cron expression
  enabled: z.boolean().default(true),
  allowedSites: z.array(z.string().url()),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const CreateReportConfigSchema = ReportConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const UpdateReportConfigSchema = CreateReportConfigSchema.partial()

export type ReportConfig = z.infer<typeof ReportConfigSchema>
export type CreateReportConfig = z.infer<typeof CreateReportConfigSchema>
export type UpdateReportConfig = z.infer<typeof UpdateReportConfigSchema>