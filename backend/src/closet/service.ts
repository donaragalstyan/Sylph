import { prisma } from "../db.js";
import { presignClosetItemImageDownload, deleteStorageObject } from "../storage/s3.js";
import type { ClosetItem, ClosetItemImage } from "@prisma/client";

export const MAX_IMAGES_PER_ITEM = 10;

export interface ClosetItemInput {
  name: string;
  category: string;
  subcategory?: string | null;
  colors?: string[];
  brand?: string | null;
  pattern?: string | null;
  material?: string | null;
  season?: string[];
  styleTags?: string[];
  size?: string | null;
  notes?: string | null;
  favorite?: boolean;
}

export interface ClosetItemFilters {
  category?: string;
  favorite?: boolean;
  season?: string;
  color?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface ClosetItemImageView {
  id: string;
  url: string;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface ClosetItemView extends Omit<ClosetItem, "ownerId" | "deletedAt"> {
  primaryImageUrl: string | null;
}

export interface ClosetItemDetailView extends Omit<ClosetItem, "ownerId" | "deletedAt"> {
  images: ClosetItemImageView[];
}

async function toClosetItemView(
  item: ClosetItem & { images: ClosetItemImage[] },
): Promise<ClosetItemView> {
  const primary = item.images.find((img) => img.isPrimary) ?? item.images[0] ?? null;
  // `images` is deliberately excluded from `rest` — the raw rows (including storageKey) must
  // never reach a response directly; only presignClosetItemImageDownload output does.
  const { ownerId: _ownerId, deletedAt: _deletedAt, images: _images, ...rest } = item;
  return {
    ...rest,
    primaryImageUrl: primary ? await presignClosetItemImageDownload(primary.storageKey) : null,
  };
}

export async function createClosetItem(
  ownerId: string,
  input: ClosetItemInput,
): Promise<ClosetItemView> {
  const item = await prisma.closetItem.create({
    data: { ownerId, ...input },
    include: { images: true },
  });
  return toClosetItemView(item);
}

export async function listClosetItems(
  ownerId: string,
  filters: ClosetItemFilters,
): Promise<{ items: ClosetItemView[]; total: number }> {
  const where = {
    ownerId,
    deletedAt: null,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.favorite !== undefined ? { favorite: filters.favorite } : {}),
    ...(filters.season ? { season: { has: filters.season } } : {}),
    ...(filters.color ? { colors: { has: filters.color } } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { brand: { contains: filters.q, mode: "insensitive" as const } },
            { notes: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.closetItem.findMany({
      where,
      include: { images: true },
      orderBy: { createdAt: "desc" },
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.closetItem.count({ where }),
  ]);

  const items = await Promise.all(rows.map(toClosetItemView));
  return { items, total };
}

async function findOwnedItem(ownerId: string, itemId: string) {
  const item = await prisma.closetItem.findFirst({
    where: { id: itemId, ownerId, deletedAt: null },
    include: { images: true },
  });
  return item;
}

export async function getClosetItemDetail(
  ownerId: string,
  itemId: string,
): Promise<ClosetItemDetailView | null> {
  const item = await findOwnedItem(ownerId, itemId);
  if (!item) return null;

  const { ownerId: _ownerId, deletedAt: _deletedAt, images, ...rest } = item;
  const imageViews = await Promise.all(
    images
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map(
        async (img): Promise<ClosetItemImageView> => ({
          id: img.id,
          url: await presignClosetItemImageDownload(img.storageKey),
          isPrimary: img.isPrimary,
          width: img.width,
          height: img.height,
          createdAt: img.createdAt,
        }),
      ),
  );

  return { ...rest, images: imageViews };
}

export async function updateClosetItem(
  ownerId: string,
  itemId: string,
  patch: Partial<ClosetItemInput>,
): Promise<ClosetItemView | null> {
  const existing = await findOwnedItem(ownerId, itemId);
  if (!existing) return null;

  const item = await prisma.closetItem.update({
    where: { id: itemId },
    data: patch,
    include: { images: true },
  });
  return toClosetItemView(item);
}

export async function deleteClosetItem(ownerId: string, itemId: string): Promise<boolean> {
  const existing = await findOwnedItem(ownerId, itemId);
  if (!existing) return false;

  await prisma.closetItem.delete({ where: { id: itemId } });
  await Promise.all(existing.images.map((img) => deleteStorageObject(img.storageKey)));
  return true;
}

export interface AttachImageInput {
  storageKey: string;
  contentHash?: string | null;
  width?: number | null;
  height?: number | null;
  isPrimary?: boolean;
}

export class TooManyImagesError extends Error {}

export async function attachClosetItemImage(
  ownerId: string,
  itemId: string,
  input: AttachImageInput,
): Promise<ClosetItemImageView | null> {
  const item = await findOwnedItem(ownerId, itemId);
  if (!item) return null;

  if (item.images.length >= MAX_IMAGES_PER_ITEM) {
    throw new TooManyImagesError(`A closet item may have at most ${MAX_IMAGES_PER_ITEM} images`);
  }

  const makePrimary = input.isPrimary ?? item.images.length === 0;

  const image = await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.closetItemImage.updateMany({
        where: { closetItemId: itemId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.closetItemImage.create({
      data: {
        closetItemId: itemId,
        storageKey: input.storageKey,
        contentHash: input.contentHash,
        width: input.width,
        height: input.height,
        isPrimary: makePrimary,
      },
    });
  });

  return {
    id: image.id,
    url: await presignClosetItemImageDownload(image.storageKey),
    isPrimary: image.isPrimary,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt,
  };
}

export async function deleteClosetItemImage(
  ownerId: string,
  itemId: string,
  imageId: string,
): Promise<boolean> {
  const item = await findOwnedItem(ownerId, itemId);
  if (!item) return false;

  const image = item.images.find((img) => img.id === imageId);
  if (!image) return false;

  await prisma.closetItemImage.delete({ where: { id: imageId } });
  await deleteStorageObject(image.storageKey);

  if (image.isPrimary) {
    const nextPrimary = await prisma.closetItemImage.findFirst({
      where: { closetItemId: itemId },
      orderBy: { createdAt: "asc" },
    });
    if (nextPrimary) {
      await prisma.closetItemImage.update({
        where: { id: nextPrimary.id },
        data: { isPrimary: true },
      });
    }
  }

  return true;
}
