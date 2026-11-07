import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFixtureServer } from './server.mjs';
import { dialogFixture } from './desktop-dialog-fixtures.mjs';

// Production renderer, isolated read-only native fixtures. Never authenticate to
// a server, save a connection, approve a request, or start an update here.
const output = path.resolve(import.meta.dirname, '../../artifacts/desktop-fork-workflows');
fs.mkdirSync(output, { recursive: true });
const report = { fixture: true, nativeBackend: false, checks: [], screenshots: [], errors: [], failures: [] };
const fixture = await startFixtureServer();
let browser;
let current = 'setup';
const check = (condition, message) => {
  assert(condition, `${current}: ${message}`);
  report.checks.push(`${current}: ${message}`);
};

async function capture(page, surface, locale) {
  for (const [width, height] of [[1440, 960], [780, 580], [390, 780]]) {
    await page.setViewportSize({ width, height });
    for (const mode of ['light', 'dark']) {
      current = `${surface}-${locale}-${width}-${mode}`;
      await page.evaluate(value => {
        localStorage.setItem('webcodex.desktop.appearance.v1', value);
        window.dispatchEvent(new CustomEvent('webcodex:appearance-change', { detail: value }));
      }, mode);
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
      const metrics = await page.evaluate(() => {
        const element = document.querySelector('[role="dialog"]') || document.querySelector('[data-webcodex-page="settings"]');
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: element.clientWidth, scroll: element.scrollWidth, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
      });
      check(metrics.left >= -1 && metrics.right <= width + 1, 'content remains within the viewport');
      check(metrics.scroll <= metrics.width + 1 && metrics.documentWidth <= width + 1, 'no horizontal overflow');
      const name = `${current}.png`;
      await page.screenshot({ path: path.join(output, name), animations: 'disabled', caret: 'hide' });
      report.screenshots.push(name);
    }
  }
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.WEBCODEX_SMOKE_BROWSER ? { executablePath: process.env.WEBCODEX_SMOKE_BROWSER } : {}) });
  for (const locale of ['en-US', 'zh-CN']) {
    current = `open-${locale}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    // Fix Date only; ordinary timer scheduling and UI interactions still run.
    // A screenshot matrix must not cross the fixture's displayed minute boundary.
    const fixtureNow = Date.now();
    await page.clock.setFixedTime(new Date(fixtureNow));
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => report.errors.push({ surface: current, message: error.message }));
    await page.route('**/desktop-shim.js', async route => {
      const response = await route.fetch();
      let body = dialogFixture(await response.text(), locale);
      const marker = "if(cmd==='ssh_resource_list')return {runner:'fixture-runner',available:true,";
      assert.equal(body.split(marker).length, 2);
      body = body.replace(marker, marker + 'setup_supported:true,');
      body = body.replace('window.__fixtureCalls=[];', "authorized=true;update.release_repository='9holy/webcodex';window.__fixtureCalls=[];");
      const ended = fixtureNow - 13_731_000;
      const observedWindow = {
        client_window_key: 'fixture-window', source: 'chatgpt', last_project: 'agent:fixture-runner:alpha',
        last_seen_at_ms: ended, last_meaningful_activity_at_ms: ended,
        active_count: 0, linked_session_count: 0, linked_sessions: [], active_requests: [],
        activity: [{ meaningful: true, tool_name: 'finish_coding_task', status: 'failed',
          project: 'agent:fixture-runner:alpha', request_observed_at_ms: ended, started_at_ms: ended, ended_at_ms: ended,
          response_handed_at_ms: ended, service_ms: 0, server_trace_id: 'fixture-finish-call',
          failure: { outcome: 'call_failed', reason: 'session_mismatch', error_kind: 'session_project_mismatch' } }],
        sessions_truncated: false, activity_truncated: true,
      };
      const queryMarker = "if(request.kind==='runner_details')return";
      assert.equal(body.split(queryMarker).length, 2);
      body = body.replace(queryMarker, `if(request.kind==='windows')return {windows:[${JSON.stringify(observedWindow)}]};if(request.kind==='window')return ${JSON.stringify(observedWindow)};` + queryMarker);
      await route.fulfill({ response, body });
    });
    try {
      await page.goto(fixture.url + '/desktop/');
      await page.locator('[data-webcodex-page="home"]').waitFor();
      await page.locator('[data-webcodex-action="navigate-extensions"]').click();
      await page.locator('#extension-tab-sshResources').click();
      await page.getByRole('button', { name: 'Add SSH Resource', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      current = `ssh-${locale}`;
      const host = dialog.getByLabel('Host or IP Address', { exact: true });
      await host.fill('192.0.2.25');
      await dialog.getByLabel('SSH Username', { exact: true }).fill('operator');
      check(await dialog.getByLabel('Resource Name', { exact: true }).inputValue() === 'ssh-192-0-2-25', 'name is suggested without an extra setup step');
      check(!await dialog.getByLabel('Default Working Directory', { exact: true }).isVisible(), 'optional settings begin collapsed');
      check(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), 'saving still requires fingerprint confirmation and a successful probe');
      await capture(page, 'ssh', locale);
      await page.setViewportSize({ width: 1440, height: 960 });
      const advanced = dialog.locator('.ssh-advanced-options > summary');
      await advanced.click();
      const directory = dialog.getByLabel('Default Working Directory', { exact: true });
      await directory.fill('/srv/project');
      await advanced.click();
      await advanced.click();
      check(await directory.inputValue() === '/srv/project', 'advanced drafts survive collapse and reopen');
      await dialog.getByRole('combobox', { name: 'Connection Type', exact: true }).click();
      await page.getByRole('option', { name: locale === 'zh-CN' ? '已有 OpenSSH 别名' : 'OpenSSH alias', exact: true }).click();
      await dialog.getByLabel('Target', { exact: true }).fill('fixture-alias');
      check(await dialog.getByLabel('Resource Name', { exact: true }).inputValue() === 'ssh-fixture-alias', 'advanced alias setup keeps automatic naming');
      await dialog.getByLabel('Resource Name', { exact: true }).fill('my-server');
      await dialog.getByLabel('Target', { exact: true }).fill('another-fixture-alias');
      check(await dialog.getByLabel('Resource Name', { exact: true }).inputValue() === 'my-server', 'edited names are never replaced');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });

      await page.locator('[data-webcodex-action="navigate-settings"]').click();
      await page.locator('#settings-tab-about').click();
      current = `about-${locale}`;
      await page.getByText('9holy/webcodex', { exact: true }).waitFor();
      check(await page.getByRole('button', { name: locale === 'zh-CN' ? '上游项目' : 'Upstream project', exact: true }).isVisible(), 'upstream acknowledgement is available separately');
      check(await page.getByRole('button', { name: locale === 'zh-CN' ? '发布与下载' : 'Releases', exact: true }).isVisible(), 'release downloads have a direct entry');
      check(await page.getByRole('button', { name: locale === 'zh-CN' ? '更新日志' : 'Release notes', exact: true }).isVisible(), 'release notes have a direct entry');
      await capture(page, 'about', locale);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.locator('[data-webcodex-action="navigate-activity"]').click();
      await page.locator('.activity-work-row').first().click();
      const callDialog = page.getByRole('dialog');
      const facts = callDialog.locator('.continuation-facts');
      current = `activity-${locale}`;
      await facts.locator('.call-failure-notice').waitFor();
      check(await facts.locator('.call-result-label').innerText() === (locale === 'zh-CN' ? '调用失败' : 'Call failed'), 'a failed closeout call is not mislabeled as failed command execution');
      check(await facts.locator('.call-failure-notice').getAttribute('data-call-outcome') === 'call_failed', 'uncertain execution remains explicit');
      const technical = facts.locator('.call-technical-details');
      check(await technical.getAttribute('open') === null, 'technical details begin collapsed');
      check(!await facts.getByText('session_project_mismatch', { exact: true }).isVisible(), 'raw diagnostic codes do not clutter the first view');
      const elapsed = await facts.locator('.runtime-facts').first().innerText();
      check(elapsed.includes('3') && elapsed.includes('48') && !elapsed.includes('13731'), 'elapsed time uses readable hours and minutes');
      check(elapsed.includes(locale === 'zh-CN' ? '距此次返回' : 'Time since response'), 'elapsed time is identified as time since response');
      await capture(page, 'activity', locale);
      await technical.locator('summary').click();
      check(await facts.getByText('session_project_mismatch', { exact: true }).isVisible(), 'diagnostic codes remain available on demand');
      await page.keyboard.press('Escape');
      await callDialog.waitFor({ state: 'hidden' });
      const effects = await page.evaluate(() => window.__fixtureForbiddenCalls || []);
      check(effects.length === 0, 'browsing and editing drafts cause no native mutations');
    } catch (error) {
      const name = `failure-${current}.png`;
      await page.screenshot({ path: path.join(output, name), animations: 'disabled', caret: 'hide' })
        .then(() => report.screenshots.push(name)).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  assert.equal(report.errors.length, 0, 'renderer errors');
} catch (error) {
  report.failures.push({ surface: current, message: error.message });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => fixture.server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ fixture: true, nativeBackend: false, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, failures: report.failures, report: path.join(output, 'report.json') }, null, 2));
