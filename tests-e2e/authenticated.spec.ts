import { expect, test } from "@playwright/test";
import { E2E_IDS } from "@/scripts/seed-test-data";
import { authStatePath } from "./auth-state";

test.describe("teacher journeys", () => {
  test.use({ storageState: authStatePath("teacher") });

  test("opens the classroom and course-building areas", async ({ page }) => {
    await page.goto("/classroom");
    await expect(page.getByRole("heading", { name: "Classrooms" })).toBeVisible();
    await expect(page.getByText("BeeSmart Testing Lab")).toBeVisible();

    await page.goto(`/courses/${E2E_IDS.course}/builder`);
    await expect(page).toHaveURL(new RegExp(`/courses/${E2E_IDS.course}/builder$`));
    await expect(page.getByText("Reliable Learning Systems").first()).toBeVisible();
  });
});

test.describe("student journeys", () => {
  test.use({ storageState: authStatePath("student") });

  test("opens joined learning, schedule, assignment, and test areas", async ({ page }) => {
    await page.goto("/classroom");
    await expect(page.getByText("BeeSmart Testing Lab")).toBeVisible();

    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    await expect(page.getByText("Reliable Learning Systems")).toBeVisible();

    await page.goto("/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    await page.goto(`/classroom/${E2E_IDS.classroom}/assignments/${E2E_IDS.assignment}`);
    await expect(page.getByText("Testing reflection").first()).toBeVisible();

    await page.goto(`/classroom/${E2E_IDS.classroom}/tests/${E2E_IDS.test}`);
    await expect(page.getByText("Testing fundamentals").first()).toBeVisible();
  });
});

test.describe("admin journey", () => {
  test.use({ storageState: authStatePath("admin") });

  test("allows the configured admin into the ticket console", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText(/ticket|feedback/i).first()).toBeVisible();
  });
});
