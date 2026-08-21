import { createRequire } from 'node:module';
import { Router } from 'express';
import { z } from 'zod';
import { PaginationQuerySchema, TagNetworkQuerySchema } from '@kiwi/contracts';
import type { LibraryContextManager } from '../library-context.mjs';
import type { LegacyDatabase } from '../legacy-types.mjs';
import { parseInput } from '../validation.mjs';
import { AppError } from '../errors.mjs';

const require = createRequire(import.meta.url);
const tagNetwork = require('../../tagNetwork.cjs') as {
  getTagNetworkGraph(database: LegacyDatabase, options: Record<string, number>): Promise<unknown>;
};

const tagSchema = z.string().min(1).max(500);

export function createTagRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    const rows = await context.requireCurrent().database.getAllTags();
    response.json(rows.map((row) => row.tag).sort((left, right) => left.localeCompare(right)));
  });

  router.get('/counts', async (_request, response) => {
    response.json(await context.requireCurrent().database.getTagCounts());
  });

  router.get('/network', async (request, response) => {
    const query = parseInput(TagNetworkQuerySchema, request.query);
    response.json(await tagNetwork.getTagNetworkGraph(context.requireCurrent().database, query));
  });

  router.get('/co-occurrences', async (request, response) => {
    const query = parseInput(
      z.object({
        minWeight: z.coerce.number().int().min(1).max(1_000_000).default(2),
        minTagCount: z.coerce.number().int().min(0).max(1_000_000).default(10),
        limit: z.coerce.number().int().min(1).max(20_000).default(5_000),
      }),
      request.query,
    );
    response.json(await context.requireCurrent().database.getTagCoOccurrences(query));
  });

  router.get('/photos', async (request, response) => {
    const query = parseInput(
      PaginationQuerySchema.extend({ tags: z.string().min(1).max(5_000) }),
      request.query,
    );
    const tags = [
      ...new Set(
        query.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    if (tags.length < 2 || tags.length > 20)
      throw new AppError('Between 2 and 20 tags are required', 400, 'VALIDATION_ERROR');
    tags.forEach((tag) => parseInput(tagSchema, tag));
    const result = await context.requireCurrent().database.getPhotosByTagsPaginated({
      tags,
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
      randomSeed: query.randomSeed,
    });
    response.json({
      ...result,
      totalSize: result.totalSize ?? 0,
      hasMore: result.hasMore ?? query.offset + result.photos.length < result.total,
    });
  });

  router.get('/:tag/photos', async (request, response) => {
    const tag = parseInput(tagSchema, request.params.tag);
    const query = parseInput(PaginationQuerySchema, request.query);
    const result = await context.requireCurrent().database.getPhotosByTagPaginated({
      tag,
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
      randomSeed: query.randomSeed,
    });
    response.json({
      ...result,
      totalSize: result.totalSize ?? 0,
      hasMore: result.hasMore ?? query.offset + result.photos.length < result.total,
    });
  });

  return router;
}
