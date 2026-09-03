import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/authenticate.js";
import { CLOSET_CATEGORIES, SEASONS } from "./taxonomy.js";
import {
  createClosetItem,
  listClosetItems,
  getClosetItemDetail,
  updateClosetItem,
  deleteClosetItem,
  attachClosetItemImage,
  deleteClosetItemImage,
  TooManyImagesError,
} from "./service.js";
import {
  presignClosetItemImageUpload,
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from "../storage/s3.js";

const tagArray = z.array(z.string().trim().min(1).max(40)).max(20);

const closetItemBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(CLOSET_CATEGORIES),
  subcategory: z.string().trim().min(1).max(80).nullable().optional(),
  colors: tagArray.optional(),
  brand: z.string().trim().min(1).max(80).nullable().optional(),
  pattern: z.string().trim().min(1).max(80).nullable().optional(),
  material: z.string().trim().min(1).max(80).nullable().optional(),
  season: z.array(z.enum(SEASONS)).max(4).optional(),
  styleTags: tagArray.optional(),
  size: z.string().trim().min(1).max(40).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  favorite: z.boolean().optional(),
});

const closetItemUpdateSchema = closetItemBodySchema.partial();

const listQuerySchema = z.object({
  category: z.enum(CLOSET_CATEGORIES).optional(),
  favorite: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  season: z.enum(SEASONS).optional(),
  color: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({ id: z.string().uuid() });
const imageParamSchema = z.object({ id: z.string().uuid(), imageId: z.string().uuid() });

const uploadRequestSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES as [string, ...string[]]),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`),
});

const attachImageSchema = z.object({
  storageKey: z.string().trim().min(1).max(512),
  contentHash: z.string().trim().min(1).max(128).nullable().optional(),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export async function registerClosetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/uploads", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = uploadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const upload = await presignClosetItemImageUpload(
      request.userId!,
      parsed.data.contentType,
      parsed.data.byteSize,
    );
    return reply.send(upload);
  });

  app.post("/v1/closet-items", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = closetItemBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const item = await createClosetItem(request.userId!, parsed.data);
    return reply.code(201).send(item);
  });

  app.get("/v1/closet-items", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const { items, total } = await listClosetItems(request.userId!, parsed.data);
    return reply.send({ items, total, limit: parsed.data.limit, offset: parsed.data.offset });
  });

  app.get("/v1/closet-items/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const item = await getClosetItemDetail(request.userId!, params.data.id);
    if (!item) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.send(item);
  });

  app.patch("/v1/closet-items/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    const body = closetItemUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: "invalid_request",
        issues: [...(params.success ? [] : params.error.issues), ...(body.success ? [] : body.error.issues)],
      });
    }

    const item = await updateClosetItem(request.userId!, params.data.id, body.data);
    if (!item) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.send(item);
  });

  app.delete("/v1/closet-items/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const deleted = await deleteClosetItem(request.userId!, params.data.id);
    if (!deleted) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.code(204).send();
  });

  app.post(
    "/v1/closet-items/:id/images",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      const body = attachImageSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({
          error: "invalid_request",
          issues: [
            ...(params.success ? [] : params.error.issues),
            ...(body.success ? [] : body.error.issues),
          ],
        });
      }

      try {
        const image = await attachClosetItemImage(request.userId!, params.data.id, body.data);
        if (!image) {
          return reply.code(404).send({ error: "not_found" });
        }
        return reply.code(201).send(image);
      } catch (err) {
        if (err instanceof TooManyImagesError) {
          return reply.code(422).send({ error: "too_many_images", message: err.message });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/v1/closet-items/:id/images/:imageId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = imageParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const deleted = await deleteClosetItemImage(
        request.userId!,
        params.data.id,
        params.data.imageId,
      );
      if (!deleted) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.code(204).send();
    },
  );
}
