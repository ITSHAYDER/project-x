import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const patients = [
  { name: 'Alex', screens: ['today', 'moment', 'map', 'history', 'journal', 'you', 'goals', 'anxiety', 'anxiety/gad7', 'welcome', 'support'] },
  { name: 'Sam', screens: ['today', 'moment', 'map', 'history', 'journal', 'you', 'goals', 'anxiety', 'anxiety/gad7', 'welcome', 'support'] },
  { name: 'Riley', screens: ['today', 'moment', 'map', 'history', 'journal', 'you', 'goals', 'anxiety', 'anxiety/gad7', 'welcome', 'support'] },
  { name: 'Jordan', screens: ['today', 'moment', 'map', 'history', 'journal', 'you', 'goals', 'anxiety', 'anxiety/gad7', 'welcome', 'support'] },
];

async function checkPage(page: Page, path: string, checkAccessibility = true) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBeLessThan(400);
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  if (!checkAccessibility) return;

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  const report = blockers
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(', ')).join('; ')})`)
    .join('\n');
  expect(blockers, `Serious/critical axe violations on ${path}:\n${report}`).toEqual([]);
}

async function enterShowcaseAs(page: Page, name: string) {
  await page.goto('/');
  const destination = name === 'Dr. Lee' ? /\/clinician$/ : /\/patient\/(today|welcome)$/;
  await Promise.all([
    page.waitForURL(destination, { timeout: 180_000 }),
    page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Open' }).click(),
  ]);
}

test('showcase home and guided tour render accessibly', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await checkPage(page, '/');
  await checkPage(page, '/tour');

  expect(consoleErrors, `Showcase console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

for (const patient of patients) {
  test(`${patient.name} can open patient screens without console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await enterShowcaseAs(page, patient.name);

    if (patient.name === 'Jordan') {
      await expect(page).toHaveURL(/\/patient\/welcome$/);
      await checkPage(page, '/patient/welcome');
      await Promise.all([
        page.waitForURL(/\/patient\/today$/, { timeout: 180_000 }),
        page.getByRole('button', { name: 'Start' }).click(),
      ]);
    }

    for (const screen of patient.screens) {
      await checkPage(page, `/patient/${screen}`, patient.name === 'Alex');
    }

    expect(consoleErrors, `${patient.name} console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
}

test('Dr. Lee can open clinician screens without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await enterShowcaseAs(page, 'Dr. Lee');
  await checkPage(page, '/clinician');
  const patientHref = await page.getByRole('link', { name: /Alex/ }).getAttribute('href');
  expect(patientHref).toBeTruthy();

  await checkPage(page, '/clinician/invite');
  for (const tab of ['brief', 'map', 'history', 'journal', 'plan', 'access']) {
    await checkPage(page, `${patientHref}?tab=${tab}`);
  }

  expect(consoleErrors, `Dr. Lee console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
