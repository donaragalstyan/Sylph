/**
 * The Phase 1 category list from docs/PRODUCT_AND_COMPLIANCE.md. Deliberately an application-
 * level constant, not a Postgres enum (see prisma/schema.prisma) — adding a category later is a
 * one-line change here, not a migration.
 */
export const CLOSET_CATEGORIES = [
  "TOPS",
  "BOTTOMS",
  "DRESSES",
  "OUTERWEAR",
  "SHOES",
  "BAGS",
  "ACCESSORIES",
  "JEWELRY",
  "OTHER",
] as const;

export type ClosetCategory = (typeof CLOSET_CATEGORIES)[number];

export const SEASONS = ["SPRING", "SUMMER", "FALL", "WINTER"] as const;

export type Season = (typeof SEASONS)[number];
