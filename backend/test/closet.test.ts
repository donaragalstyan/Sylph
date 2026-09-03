import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { signInTestUser } from "./helpers/auth.js";

// Identity verification itself is covered in auth.apple.test.ts — these tests only need a
// working sign-in to get an authenticated caller, same rationale as auth.flow.test.ts.
vi.mock("../src/auth/apple.js", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/apple.js")>(
    "../src/auth/apple.js",
  );
  return {
    ...actual,
    verifyAppleIdentityToken: vi.fn(async (token: string) => JSON.parse(token)),
  };
});

const { buildApp } = await import("../src/app.js");

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp();
});

function authed(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function createItem(app: FastifyInstance, accessToken: string, overrides: object = {}) {
  return app.inject({
    method: "POST",
    url: "/v1/closet-items",
    headers: authed(accessToken),
    payload: { name: "Black pleated mini skirt", category: "BOTTOMS", ...overrides },
  });
}

describe("closet item CRUD", () => {
  it("creates an item and returns it with no images yet", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-1");
    const res = await createItem(app, accessToken, { colors: ["black"], favorite: true });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe("Black pleated mini skirt");
    expect(body.category).toBe("BOTTOMS");
    expect(body.favorite).toBe(true);
    expect(body.primaryImageUrl).toBeNull();
    expect(body.ownerId).toBeUndefined();
    // the raw images/storageKey rows must never leak through the list/create projection —
    // only a presigned primaryImageUrl does (see toClosetItemView in src/closet/service.ts)
    expect(body.images).toBeUndefined();
  });

  it("rejects an unknown category", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-2");
    const res = await createItem(app, accessToken, { category: "SPACESUITS" });
    expect(res.statusCode).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/closet-items",
      payload: { name: "x", category: "TOPS" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists only the caller's items and supports filters", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-3");
    await createItem(app, accessToken, { name: "Denim skirt", category: "BOTTOMS", favorite: true });
    await createItem(app, accessToken, { name: "White tee", category: "TOPS", favorite: false });

    const all = await app.inject({
      method: "GET",
      url: "/v1/closet-items",
      headers: authed(accessToken),
    });
    expect(all.json().total).toBe(2);

    const favoritesOnly = await app.inject({
      method: "GET",
      url: "/v1/closet-items?favorite=true",
      headers: authed(accessToken),
    });
    expect(favoritesOnly.json().total).toBe(1);
    expect(favoritesOnly.json().items[0].name).toBe("Denim skirt");

    const search = await app.inject({
      method: "GET",
      url: "/v1/closet-items?q=tee",
      headers: authed(accessToken),
    });
    expect(search.json().total).toBe(1);
    expect(search.json().items[0].name).toBe("White tee");
  });

  it("updates an item", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-4");
    const created = (await createItem(app, accessToken)).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/closet-items/${created.id}`,
      headers: authed(accessToken),
      payload: { favorite: true, notes: "wear with boots" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().favorite).toBe(true);
    expect(res.json().notes).toBe("wear with boots");
  });

  it("deletes an item", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-5");
    const created = (await createItem(app, accessToken)).json();

    const del = await app.inject({
      method: "DELETE",
      url: `/v1/closet-items/${created.id}`,
      headers: authed(accessToken),
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/v1/closet-items/${created.id}`,
      headers: authed(accessToken),
    });
    expect(get.statusCode).toBe(404);
  });

  it("404s for a well-formed but nonexistent item id", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-6");
    const res = await app.inject({
      method: "GET",
      url: "/v1/closet-items/00000000-0000-0000-0000-000000000000",
      headers: authed(accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it("400s for a malformed item id", async () => {
    const { accessToken } = await signInTestUser(app, "closet-user-7");
    const res = await app.inject({
      method: "GET",
      url: "/v1/closet-items/not-a-uuid",
      headers: authed(accessToken),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("closet item authorization boundary", () => {
  it("a second user cannot read, update, delete, or tag another user's item", async () => {
    const owner = await signInTestUser(app, "closet-owner");
    const intruder = await signInTestUser(app, "closet-intruder");
    const item = (await createItem(app, owner.accessToken)).json();

    const get = await app.inject({
      method: "GET",
      url: `/v1/closet-items/${item.id}`,
      headers: authed(intruder.accessToken),
    });
    expect(get.statusCode).toBe(404);

    const patch = await app.inject({
      method: "PATCH",
      url: `/v1/closet-items/${item.id}`,
      headers: authed(intruder.accessToken),
      payload: { favorite: true },
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: "DELETE",
      url: `/v1/closet-items/${item.id}`,
      headers: authed(intruder.accessToken),
    });
    expect(del.statusCode).toBe(404);

    const image = await app.inject({
      method: "POST",
      url: `/v1/closet-items/${item.id}/images`,
      headers: authed(intruder.accessToken),
      payload: { storageKey: `closet-items/${owner.userId}/fake.jpg` },
    });
    expect(image.statusCode).toBe(404);

    // and the owner's item is untouched
    const ownerGet = await app.inject({
      method: "GET",
      url: `/v1/closet-items/${item.id}`,
      headers: authed(owner.accessToken),
    });
    expect(ownerGet.statusCode).toBe(200);
  });

  it("lists are scoped per-user even with identical item names", async () => {
    const userA = await signInTestUser(app, "list-user-a");
    const userB = await signInTestUser(app, "list-user-b");
    await createItem(app, userA.accessToken, { name: "Shared name" });
    await createItem(app, userB.accessToken, { name: "Shared name" });

    const listA = await app.inject({
      method: "GET",
      url: "/v1/closet-items",
      headers: authed(userA.accessToken),
    });
    expect(listA.json().total).toBe(1);
  });
});

describe("closet item images — real signed upload/download against local storage", () => {
  it("uploads a real object, attaches it, and serves it only via a signed URL", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-1");
    const item = (await createItem(app, accessToken)).json();

    const bytes = Buffer.from("fake-jpeg-bytes-for-testing");
    const presign = await app.inject({
      method: "POST",
      url: "/v1/uploads",
      headers: authed(accessToken),
      payload: { contentType: "image/jpeg", byteSize: bytes.byteLength },
    });
    expect(presign.statusCode).toBe(200);
    const { uploadUrl, storageKey } = presign.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: bytes,
    });
    expect(putRes.status).toBe(200);

    const attach = await app.inject({
      method: "POST",
      url: `/v1/closet-items/${item.id}/images`,
      headers: authed(accessToken),
      payload: { storageKey, contentHash: "abc123", width: 800, height: 1000 },
    });
    expect(attach.statusCode).toBe(201);
    expect(attach.json().isPrimary).toBe(true);

    const detail = await app.inject({
      method: "GET",
      url: `/v1/closet-items/${item.id}`,
      headers: authed(accessToken),
    });
    const detailBody = detail.json();
    expect(detailBody.images).toHaveLength(1);

    const signedGet = await fetch(detailBody.images[0].url);
    expect(signedGet.status).toBe(200);
    expect(await signedGet.text()).toBe(bytes.toString());

    // the same object, requested without any signature, must be denied — the bucket is
    // private by default (docs/PRODUCT_AND_COMPLIANCE.md §3)
    const unsignedUrl = new URL(detailBody.images[0].url);
    unsignedUrl.search = "";
    const unsignedGet = await fetch(unsignedUrl);
    expect(unsignedGet.status).not.toBe(200);
  });

  it("rejects an unsupported content type at the presign step", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-2");
    const res = await app.inject({
      method: "POST",
      url: "/v1/uploads",
      headers: authed(accessToken),
      payload: { contentType: "application/pdf", byteSize: 1000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an upload over the size cap", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-3");
    const res = await app.inject({
      method: "POST",
      url: "/v1/uploads",
      headers: authed(accessToken),
      payload: { contentType: "image/png", byteSize: 999_999_999 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("makes the first attached image primary automatically, and swaps primary on request", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-4");
    const item = (await createItem(app, accessToken)).json();

    const first = await app.inject({
      method: "POST",
      url: `/v1/closet-items/${item.id}/images`,
      headers: authed(accessToken),
      payload: { storageKey: "closet-items/x/one.jpg" },
    });
    expect(first.json().isPrimary).toBe(true);

    const second = await app.inject({
      method: "POST",
      url: `/v1/closet-items/${item.id}/images`,
      headers: authed(accessToken),
      payload: { storageKey: "closet-items/x/two.jpg", isPrimary: true },
    });
    expect(second.json().isPrimary).toBe(true);

    const detail = (
      await app.inject({
        method: "GET",
        url: `/v1/closet-items/${item.id}`,
        headers: authed(accessToken),
      })
    ).json();
    const primaries = detail.images.filter((img: { isPrimary: boolean }) => img.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(second.json().id);
  });

  it("promotes another image to primary after the primary is deleted", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-5");
    const item = (await createItem(app, accessToken)).json();

    const first = (
      await app.inject({
        method: "POST",
        url: `/v1/closet-items/${item.id}/images`,
        headers: authed(accessToken),
        payload: { storageKey: "closet-items/x/a.jpg" },
      })
    ).json();
    const second = (
      await app.inject({
        method: "POST",
        url: `/v1/closet-items/${item.id}/images`,
        headers: authed(accessToken),
        payload: { storageKey: "closet-items/x/b.jpg" },
      })
    ).json();

    const del = await app.inject({
      method: "DELETE",
      url: `/v1/closet-items/${item.id}/images/${first.id}`,
      headers: authed(accessToken),
    });
    expect(del.statusCode).toBe(204);

    const detail = (
      await app.inject({
        method: "GET",
        url: `/v1/closet-items/${item.id}`,
        headers: authed(accessToken),
      })
    ).json();
    expect(detail.images).toHaveLength(1);
    expect(detail.images[0].id).toBe(second.id);
    expect(detail.images[0].isPrimary).toBe(true);
  });

  it("enforces the per-item image cap", async () => {
    const { accessToken } = await signInTestUser(app, "image-user-6");
    const item = (await createItem(app, accessToken)).json();

    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/v1/closet-items/${item.id}/images`,
        headers: authed(accessToken),
        payload: { storageKey: `closet-items/x/${i}.jpg` },
      });
      expect(res.statusCode).toBe(201);
    }

    const eleventh = await app.inject({
      method: "POST",
      url: `/v1/closet-items/${item.id}/images`,
      headers: authed(accessToken),
      payload: { storageKey: "closet-items/x/overflow.jpg" },
    });
    expect(eleventh.statusCode).toBe(422);
  });
});
