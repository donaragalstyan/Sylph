import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./client";

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

export interface ClosetItemSummary {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  colors: string[];
  brand: string | null;
  favorite: boolean;
  primaryImageUrl: string | null;
  createdAt: string;
}

export interface ClosetItemImage {
  id: string;
  url: string;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ClosetItemDetail extends Omit<ClosetItemSummary, "primaryImageUrl"> {
  pattern: string | null;
  material: string | null;
  season: string[];
  styleTags: string[];
  size: string | null;
  notes: string | null;
  images: ClosetItemImage[];
}

export interface ClosetListFilters {
  category?: ClosetCategory;
  favorite?: boolean;
  q?: string;
}

interface ClosetListResponse {
  items: ClosetItemSummary[];
  total: number;
}

const closetKeys = {
  list: (filters: ClosetListFilters) => ["closet-items", filters] as const,
  detail: (id: string) => ["closet-items", id] as const,
};

export function useClosetItems(filters: ClosetListFilters) {
  return useQuery({
    queryKey: closetKeys.list(filters),
    queryFn: () =>
      apiRequest<ClosetListResponse>("/v1/closet-items", {
        query: {
          category: filters.category,
          favorite: filters.favorite,
          q: filters.q || undefined,
        },
      }),
  });
}

export function useClosetItem(id: string) {
  return useQuery({
    queryKey: closetKeys.detail(id),
    queryFn: () => apiRequest<ClosetItemDetail>(`/v1/closet-items/${id}`),
    enabled: !!id,
  });
}

export interface CreateClosetItemInput {
  name: string;
  category: ClosetCategory;
}

export function useCreateClosetItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClosetItemInput) =>
      apiRequest<ClosetItemDetail>("/v1/closet-items", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    },
  });
}

export function useSetClosetItemFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      apiRequest<ClosetItemDetail>(`/v1/closet-items/${id}`, { method: "PATCH", body: { favorite } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    },
  });
}

export function useDeleteClosetItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/v1/closet-items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    },
  });
}
