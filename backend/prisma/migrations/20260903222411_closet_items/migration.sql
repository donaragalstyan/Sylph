-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE');

-- CreateTable
CREATE TABLE "closet_items" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" TEXT,
    "pattern" TEXT,
    "material" TEXT,
    "season" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "size" TEXT,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "closet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closet_item_images" (
    "id" TEXT NOT NULL,
    "closetItemId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closet_item_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "closet_items_ownerId_idx" ON "closet_items"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "closet_item_images_storageKey_key" ON "closet_item_images"("storageKey");

-- CreateIndex
CREATE INDEX "closet_item_images_closetItemId_idx" ON "closet_item_images"("closetItemId");

-- AddForeignKey
ALTER TABLE "closet_items" ADD CONSTRAINT "closet_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closet_item_images" ADD CONSTRAINT "closet_item_images_closetItemId_fkey" FOREIGN KEY ("closetItemId") REFERENCES "closet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
