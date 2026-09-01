import { z } from 'zod';

const timestamp = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.length === 0) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.parse(value);
}, z.number().finite().catch(0));

const finiteNumber = z.coerce.number().finite();
const nonNegativeNumber = finiteNumber.min(0);
const optionalNullableNumber = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  finiteNumber.nullable(),
);

const boundedInteger = (fallback: number, minimum: number, maximum: number) =>
  z.coerce
    .number()
    .int()
    .catch(fallback)
    .transform((value) => Math.max(minimum, Math.min(maximum, value)));

const boundedNumber = (fallback: number, minimum: number, maximum: number) =>
  z.coerce
    .number()
    .finite()
    .catch(fallback)
    .transform((value) => Math.max(minimum, Math.min(maximum, value)));

export const AccentColorSchema = z.enum([
  'kiwi',
  'orange',
  'blue',
  'green',
  'purple',
  'red',
  'pink',
  'teal',
  'indigo',
  'cyan',
  'lime',
  'amber',
]);

export const KiwiConfigSchema = z.looseObject({
  libraryPath: z.string().default(''),
  browseRoots: z.array(z.string()).default([]),
  requestPageSize: z.coerce.number().int().min(10).max(500).default(50),
  defaultTheme: z.enum(['light', 'dark']).default('dark'),
  defaultAccentColor: AccentColorSchema.default('kiwi'),
  enableCache: z.boolean().default(true),
  cacheValidityHours: z.coerce.number().min(1).max(8_760).default(24),
  enablePodcastMode: z.boolean().default(false),
  enableColorIntegration: z.boolean().default(true),
  useFolderThumbnails: z.boolean().default(true),
  autoplayGifsInGrid: z.boolean().default(false),
  hideControlsWithInfoBox: z.boolean().default(false),
  infoBoxSize: z.coerce.number().int().min(50).max(150).default(100),
  sidebarWidth: z.coerce.number().int().min(200).max(600).default(256),
  defaultSidebarOpen: z.boolean().default(false),
});

export const KiwiConfigUpdateSchema = z
  .looseObject({
    libraryPath: z.string(),
    browseRoots: z.array(z.string()),
    requestPageSize: z.coerce.number().int().min(10).max(500),
    defaultTheme: z.enum(['light', 'dark']),
    defaultAccentColor: AccentColorSchema,
    enableCache: z.boolean(),
    cacheValidityHours: z.coerce.number().min(1).max(8_760),
    enablePodcastMode: z.boolean(),
    enableColorIntegration: z.boolean(),
    useFolderThumbnails: z.boolean(),
    autoplayGifsInGrid: z.boolean(),
    hideControlsWithInfoBox: z.boolean(),
    infoBoxSize: z.coerce.number().int().min(50).max(150),
    sidebarWidth: z.coerce.number().int().min(200).max(600),
    defaultSidebarOpen: z.boolean(),
  })
  .partial();

export const ConfigResponseSchema = KiwiConfigSchema.extend({
  _configured: z.boolean(),
  _validation: z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
    hint: z.string().optional(),
  }),
});

export const ConfigValidationSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  hint: z.string().optional(),
});

export const ConfigUpdateResponseSchema = z.object({
  success: z.literal(true),
  config: KiwiConfigSchema,
});

export const BrowseEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isLibrary: z.boolean(),
  libraryValid: z.boolean(),
});

export const BrowseResponseSchema = z.object({
  path: z.string().nullable(),
  parent: z.string().nullable(),
  entries: z.array(BrowseEntrySchema),
});

export const PhotoSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  size: nonNegativeNumber.catch(0),
  btime: timestamp,
  mtime: timestamp,
  ext: z.string(),
  type: z.enum(['image', 'video', 'audio', 'document', 'unknown']).catch('unknown'),
  tags: z.array(z.string()).default([]),
  folders: z.array(z.string()).default([]),
  isDeleted: z.boolean().default(false),
  url: z.string().default(''),
  thumbnailUrl: z.string().optional(),
  annotation: z.string().default(''),
  modificationTime: timestamp.optional(),
  width: nonNegativeNumber.catch(0),
  height: nonNegativeNumber.catch(0),
  lastModified: timestamp.optional(),
  palettes: z.array(z.object({ color: z.array(z.number()), ratio: z.number() })).optional(),
  duration: optionalNullableNumber.optional(),
  fps: optionalNullableNumber.optional(),
  bitrate: optionalNullableNumber.optional(),
  codec: z.string().nullable().optional(),
  audioCodec: z.string().nullable().optional(),
  sampleRate: optionalNullableNumber.optional(),
  channels: optionalNullableNumber.optional(),
  camera: z.string().nullable().optional(),
  dateTime: z.string().nullable().optional(),
  gps_latitude: optionalNullableNumber.optional(),
  gps_longitude: optionalNullableNumber.optional(),
  gps_altitude: optionalNullableNumber.optional(),
  exif_data: z.string().nullable().optional(),
});

export const PhotosPageSchema = z.object({
  photos: z.array(PhotoSchema),
  total: z.coerce.number().int().min(0),
  totalSize: nonNegativeNumber.default(0),
  hasMore: z.boolean().default(false),
});

export const FolderMetadataSchema: z.ZodType<FolderMetadata> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(''),
    children: z.array(FolderMetadataSchema).default([]),
    modificationTime: timestamp,
    tags: z.array(z.string()).default([]),
    extendTags: z.array(z.string()).default([]),
    pinyin: z.string().default(''),
    password: z.string().default(''),
    passwordTips: z.string().default(''),
    icon: z.string().optional(),
  }),
);

export interface FolderMetadata {
  id: string;
  name: string;
  description: string;
  children: FolderMetadata[];
  modificationTime: number;
  tags: string[];
  extendTags: string[];
  pinyin: string;
  password: string;
  passwordTips: string;
  icon?: string | undefined;
}

export const LibraryMetadataSchema = z.looseObject({
  folders: z.array(FolderMetadataSchema).default([]),
  smartFolders: z.array(z.unknown()).default([]),
  quickAccess: z.array(z.unknown()).default([]),
  tagsGroups: z.array(z.unknown()).default([]),
  modificationTime: timestamp,
  applicationVersion: z.string().default(''),
});

export const SortFieldSchema = z.enum([
  'name',
  'date',
  'date_created',
  'date_updated',
  'size',
  'type',
  'dimensions',
  'tags',
  'random',
  'mtime',
]);

export const SortDirectionSchema = z.preprocess(
  (value) => String(value ?? 'DESC').toUpperCase(),
  z.enum(['ASC', 'DESC']),
);

export const PaginationQuerySchema = z.object({
  limit: boundedInteger(50, 1, 500).default(50),
  offset: boundedInteger(0, 0, Number.MAX_SAFE_INTEGER).default(0),
  orderBy: SortFieldSchema.default('mtime'),
  orderDirection: SortDirectionSchema.default('DESC'),
  randomSeed: z.coerce.number().int().safe().optional(),
});

export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().max(500).default(''),
  type: z.enum(['image', 'video', 'audio', 'document', 'unknown']).nullable().optional(),
  folderId: z.string().max(255).nullable().optional(),
  tag: z.string().max(500).nullable().optional(),
});

export const TagNetworkQuerySchema = z.object({
  minTagCount: boundedInteger(10, 0, 1_000_000).default(10),
  minWeight: boundedInteger(2, 1, 1_000_000).default(2),
  maxNodes: boundedInteger(100, 2, 800).default(100),
  megaTagPct: boundedNumber(0.35, 0, 1).default(0.35),
  pmiThreshold: boundedNumber(0.5, -50, 50).default(0.5),
  minScore: boundedNumber(0.12, 0, 1).default(0.12),
  maxDegree: boundedInteger(6, 1, 50).default(6),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  message: z.string().optional(),
  requestId: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  setup: z.boolean().optional(),
});

export const WatcherActivitySchema = z.looseObject({
  id: z.coerce.number().int().min(0),
  type: z.string(),
  photoId: z.string().optional(),
  photoName: z.string().optional(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
});

export const SyncStatusSchema = z.looseObject({
  running: z.boolean().default(false),
  libraryPath: z.string().nullable().default(null),
  lastEvent: z.string().nullable().default(null),
  lastEventTime: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
  pendingCount: z.coerce.number().int().min(0).default(0),
  processedCount: z.coerce.number().int().min(0).default(0),
  lastReconcileTime: z.string().nullable().default(null),
  activityLog: z.array(WatcherActivitySchema).default([]),
});

export const DashboardAnalyticsSchema = z.object({
  timelineByMonth: z.array(z.object({ month: z.string(), count: nonNegativeNumber })),
  storageByGroup: z.array(
    z.object({ group: z.string(), totalSize: nonNegativeNumber, count: nonNegativeNumber }),
  ),
  topTags: z.array(z.object({ tag: z.string(), count: nonNegativeNumber })),
  topFolders: z.array(z.object({ folderId: z.string(), name: z.string(), count: nonNegativeNumber })),
  resolutionBuckets: z.array(z.object({ bucket: z.string(), count: nonNegativeNumber })),
  orientationStats: z.object({
    landscape: nonNegativeNumber,
    portrait: nonNegativeNumber,
    square: nonNegativeNumber,
  }),
  summary: z.object({
    avgFileSize: nonNegativeNumber,
    taggedPhotos: nonNegativeNumber,
    untaggedPhotos: nonNegativeNumber,
    imageCount: nonNegativeNumber,
  }),
});

export const DashboardStatsSchema = z.looseObject({
  totalPhotos: nonNegativeNumber,
  totalFolders: nonNegativeNumber,
  totalTags: nonNegativeNumber,
  totalSize: nonNegativeNumber,
  dbSize: nonNegativeNumber,
  lastRefresh: z.string().nullable(),
  fileTypes: z.record(z.string(), nonNegativeNumber),
  typeStats: z.array(z.object({ type: z.string(), count: nonNegativeNumber })).optional(),
  extensionStats: z
    .array(
      z.object({
        ext: z.string(),
        count: nonNegativeNumber,
        avgSize: nonNegativeNumber,
        totalSize: nonNegativeNumber,
      }),
    )
    .optional(),
  analytics: DashboardAnalyticsSchema.optional(),
});

export const FolderThumbnailSchema = z.object({ id: z.string(), name: z.string(), ext: z.string() });
export const CountMapSchema = z.record(z.string(), z.coerce.number().int().min(0));
export const CountResponseSchema = z.object({ count: z.coerce.number().int().min(0) });
export const TagsSchema = z.array(z.string());
export const SuccessResponseSchema = z.looseObject({
  success: z.literal(true),
  message: z.string().optional(),
});
export const DatabaseStatusSchema = z.looseObject({
  exists: z.boolean(),
  totalPhotos: z.coerce.number().int().min(0),
  dbSize: nonNegativeNumber,
  lastRefresh: z.string().nullable(),
  source: z.string(),
  message: z.string(),
});

export const TagNetworkNodeSchema = z.object({
  id: z.string(),
  count: z.number(),
  community: z.number(),
  color: z.string(),
  val: z.number(),
  x: z.number(),
  y: z.number(),
  fx: z.number(),
  fy: z.number(),
  degree: z.number().int().min(0).optional(),
  strength: z.number().min(0).optional(),
  rank: z.number().int().min(1).optional(),
});
export const TagNetworkLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number(),
  pmi: z.number().optional(),
  npmi: z.number().min(-1).max(1).optional(),
  overlap: z.number().min(0).max(1).optional(),
  score: z.number().min(0).max(1).optional(),
});
export const TagClusterSchema = z.object({
  id: z.number(),
  color: z.string(),
  hull: z.array(z.object({ x: z.number(), y: z.number() })),
  nodeCount: z.number(),
  label: z.string(),
  labelCount: z.number(),
  totalItems: z.number().min(0).optional(),
  radius: z.number().min(0).optional(),
  cx: z.number(),
  cy: z.number(),
});
export const TagNetworkGraphSchema = z.object({
  version: z.number().int().min(1).optional(),
  generatedAt: z.string().optional(),
  nodes: z.array(TagNetworkNodeSchema),
  links: z.array(TagNetworkLinkSchema),
  interLinks: z.array(TagNetworkLinkSchema),
  clusters: z.array(TagClusterSchema),
  stats: z.object({
    tags: z.number(),
    links: z.number(),
    interLinks: z.number(),
    communities: z.number(),
    prunedMegaTags: z.number(),
    candidateLinks: z.number().int().min(0).optional(),
    buildMs: z.number().min(0).optional(),
  }),
});

export type KiwiConfig = z.infer<typeof KiwiConfigSchema>;
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>;
export type ConfigValidation = z.infer<typeof ConfigValidationSchema>;
export type ConfigUpdateResponse = z.infer<typeof ConfigUpdateResponseSchema>;
export type BrowseResponse = z.infer<typeof BrowseResponseSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type PhotosPage = z.infer<typeof PhotosPageSchema>;
export type LibraryMetadata = z.infer<typeof LibraryMetadataSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
export type WatcherActivity = z.infer<typeof WatcherActivitySchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardAnalytics = z.infer<typeof DashboardAnalyticsSchema>;
export type TagNetworkGraph = z.infer<typeof TagNetworkGraphSchema>;
export type TagNetworkNode = z.infer<typeof TagNetworkNodeSchema>;
export type TagNetworkLink = z.infer<typeof TagNetworkLinkSchema>;
export type TagCluster = z.infer<typeof TagClusterSchema>;

export function toValidationIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}
