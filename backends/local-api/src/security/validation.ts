import { z } from 'zod';

export const schemas = {
  createApp: z.object({
    name: z.string().min(1).max(100),
    package_name: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
    fcm_project_id: z.string().optional(),
  }),
  
  createCampaign: z.object({
    app_id: z.string().uuid(),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(300),
    image_url: z.string().url().optional(),
    click_url: z.string().optional(),
    target_type: z.enum(['all', 'active', 'country', 'device_list']),
    country_codes: z.array(z.string().length(2)).optional(),
    device_ids: z.array(z.string()).max(10000).optional(),
    scheduled_at: z.string().datetime().optional(),
  }),
  
  createApiKey: z.object({
    app_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).min(1),
    rate_limit_rpm: z.number().int().min(60).max(60000),
  }),
};

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
