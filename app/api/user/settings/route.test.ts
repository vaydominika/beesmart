import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  settingsFind: vi.fn(),
  settingsUpsert: vi.fn(),
  reminderUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  prisma: {
    userSettings: { findUnique: mocks.settingsFind, upsert: mocks.settingsUpsert },
    reminder: { updateMany: mocks.reminderUpdateMany },
  },
}));

import { GET, PATCH } from "./route";

const savedSettings = {
  theme: "dark",
  courseCreationTutorialCompleted: true,
  defaultActiveMinutes: 30,
  defaultBreakMinutes: 10,
  defaultAutoBreak: false,
  reminderNotifications: true,
  classroomNotifications: false,
  profileVisibility: "PUBLIC",
  activitySharing: false,
};

describe("user settings route", () => {
  beforeEach(() => mocks.getCurrentUserId.mockResolvedValue("user-1"));

  it("returns schema-aligned defaults when no settings exist", async () => {
    mocks.settingsFind.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ theme: "bee", defaultActiveMinutes: 45, profileVisibility: "private" });
  });

  it("maps stored enum values into the client contract", async () => {
    mocks.settingsFind.mockResolvedValue(savedSettings);
    expect(await (await GET()).json()).toEqual({ ...savedSettings, profileVisibility: "public" });
  });

  it("updates only supported fields and keeps tutorial completion one-way", async () => {
    mocks.settingsFind.mockResolvedValue({ reminderNotifications: false });
    mocks.settingsUpsert.mockResolvedValue(savedSettings);
    const response = await PATCH(new Request("http://localhost/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({
        theme: "dark",
        courseCreationTutorialCompleted: false,
        defaultActiveMinutes: "30",
        defaultBreakMinutes: "10",
        defaultAutoBreak: 0,
        reminderNotifications: true,
        classroomNotifications: 0,
        profileVisibility: "public",
        activitySharing: 0,
        ignored: "never persisted",
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.reminderUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.settingsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.not.objectContaining({ courseCreationTutorialCompleted: expect.anything(), ignored: expect.anything() }),
      update: expect.objectContaining({ theme: "dark", defaultActiveMinutes: 30, profileVisibility: "PUBLIC" }),
    }));
  });
});
