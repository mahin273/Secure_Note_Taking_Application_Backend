import { z } from 'zod';
import { Types } from 'mongoose';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const cursorPaginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'limit must be an integer between 1 and 100',
    }),
  after: objectIdSchema.optional(),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export function paginateCursorResults<T extends { _id: Types.ObjectId }>(
  items: T[],
  limit: number
): { data: T[]; nextCursor: string | null } {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;
  return { data, nextCursor };
}
