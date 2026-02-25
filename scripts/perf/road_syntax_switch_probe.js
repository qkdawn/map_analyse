#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const HISTORY_ID = Number(process.env.HISTORY_ID || 0);
const TARGET_P95_MS = Number(process.env.TARGET_P95_MS || 120);
const SWITCH_TIMES = Number(process.env.SWITCH_TIMES || 30);
const DEBUG_TRACE = String(process.env.DEBUG_TRACE || '') === '1';

async function resolveHistoryId() {
  if (Number.isFinite(HISTORY_ID) && HISTORY_ID > 0) return HISTORY_ID;
  const res = await fetch(`${BASE_URL}/api/v1/analysis/history`);
  if (!res.ok) {
    throw new Error(`读取历史列表失败: ${res.status}`);
  }
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('历史列表为空，无法执行探针');
  }
  const picked = Number(list[0] && list[0].id);
  if (!Number.isFinite(picked) || picked <= 0) {
    throw new Error('历史列表返回的首条记录缺少有效 id');
  }
  return picked;
}

async function waitForVm(page, timeoutMs = 60000) {
  const startedAt = Date.now();
  let lastLogAt = 0;
  let lastState = null;
  while ((Date.now() - startedAt) < timeoutMs) {
    const state = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy) || null;
      return {
        hasRoot: !!root,
        hasVueGlobal: !!window.Vue,
        hasVueAppOnRoot: !!app,
        hasVm: !!vm,
        hasAMap: !!window.AMap,
        hasMap: !!(vm && vm.mapCore && vm.mapCore.map),
      };
    }).catch(() => ({
      hasRoot: false,
      hasVueGlobal: false,
      hasVueAppOnRoot: false,
      hasVm: false,
      hasAMap: false,
      hasMap: false,
      evalFailed: true,
    }));
    lastState = state;
    if (DEBUG_TRACE && (Date.now() - lastLogAt) >= 5000) {
      lastLogAt = Date.now();
      console.log(`[road-syntax-probe] vm-state: ${JSON.stringify(state)}`);
    }
    if (state && state.hasVm && state.hasMap) return true;
    await page.waitForTimeout(500);
  }
  throw new Error(`等待 Vue VM 超时（>${timeoutMs}ms）, lastState=${JSON.stringify(lastState)}`);
}

async function waitForHistoryReady(page, timeoutMs = 180000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const state = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy) || null;
      if (!vm) return { vm: false, ready: false, error: '' };
      return {
        vm: true,
        ready: !!(vm.lastIsochroneGeoJSON && vm.step === 3),
        error: String(vm.errorMessage || ''),
        poiStatus: String(vm.poiStatus || ''),
      };
    }).catch(() => ({ vm: false, ready: false, error: 'eval-failed' }));
    if (state.ready) return true;
    await page.waitForTimeout(500);
  }
  throw new Error(`历史回放超时（>${timeoutMs}ms）`);
}

async function waitForRoadSyntaxReady(page, timeoutMs = 300000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const state = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy) || null;
      if (!vm) return { vm: false, done: false, failed: false, status: '' };
      const status = String(vm.roadSyntaxStatus || '');
      return {
        vm: true,
        done: !vm.isComputingRoadSyntax && !!(vm.roadSyntaxPoolReady || vm.roadSyntaxPoolDegraded),
        failed: status.startsWith('失败:'),
        status,
      };
    }).catch(() => ({ vm: false, done: false, failed: false, status: '' }));
    if (state.failed) {
      throw new Error(`路网计算失败: ${state.status}`);
    }
    if (state.done) return true;
    await page.waitForTimeout(500);
  }
  throw new Error(`路网计算等待超时（>${timeoutMs}ms）`);
}

async function main() {
  const historyId = await resolveHistoryId();
  console.log(`[road-syntax-probe] using history id=${historyId}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__probeVm = null;
    window.__probeVueWrapped = false;
    const wrapVueObject = (vue) => {
      if (!vue || typeof vue.createApp !== 'function') return vue;
      if (vue.__probeCreateAppWrapped) return vue;
      const originalCreateApp = vue.createApp.bind(vue);
      vue.createApp = (...args) => {
        const app = originalCreateApp(...args);
        const originalMount = app.mount.bind(app);
        app.mount = (...mountArgs) => {
          const vm = originalMount(...mountArgs);
          window.__probeVm = vm || null;
          return vm;
        };
        return app;
      };
      vue.__probeCreateAppWrapped = true;
      window.__probeVueWrapped = true;
      return vue;
    };
    let vueValue = null;
    try {
      vueValue = wrapVueObject(window.Vue || null);
      Object.defineProperty(window, 'Vue', {
        configurable: true,
        enumerable: true,
        get() { return vueValue; },
        set(v) { vueValue = wrapVueObject(v); },
      });
    } catch (_) { }
    if (!window.__probeVueWrapped) {
      const timer = window.setInterval(() => {
        if (window.Vue) {
          wrapVueObject(window.Vue);
        }
        if (window.__probeVueWrapped) {
          window.clearInterval(timer);
        }
      }, 10);
      window.setTimeout(() => window.clearInterval(timer), 60000);
    }
  });
  page.setDefaultTimeout(300000);
  page.setDefaultNavigationTimeout(120000);
  page.on('dialog', async (dialog) => {
    console.warn(`[road-syntax-probe] dismiss dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => {});
  });

  try {
    console.log('[road-syntax-probe] opening analysis page');
    await page.goto(`${BASE_URL}/analysis`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);

    console.log('[road-syntax-probe] waiting vue app');
    await waitForVm(page, 60000);

    console.log('[road-syntax-probe] restoring history detail');
    await page.evaluate((id) => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) throw new Error('vm unavailable in restore-history');
      vm.errorMessage = '';
      vm.loadHistoryDetail(id);
    }, historyId);

    await waitForHistoryReady(page, 180000);

    console.log('[road-syntax-probe] trigger road-syntax compute');
    await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) throw new Error('vm unavailable in compute-road-syntax');
      vm.step = 3;
      vm.selectStep3Panel('syntax');
      vm.computeRoadSyntax();
    });

    console.log('[road-syntax-probe] waiting road-syntax ready/degraded');
    await waitForRoadSyntaxReady(page, 300000);

    const failureStatus = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) return '失败: vm unavailable after road-syntax wait';
      return String(vm.roadSyntaxStatus || '');
    });
    if (failureStatus.startsWith('失败:')) {
      throw new Error(`路网计算失败: ${failureStatus}`);
    }

    console.log('[road-syntax-probe] collecting ready metrics');
    const readyMetrics = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) return [];
      const all = ['accessibility', 'connectivity', 'choice', 'integration', 'intelligibility'];
      return all.filter((metric) => vm.isRoadSyntaxMetricReady(metric));
    });

    if (!Array.isArray(readyMetrics) || readyMetrics.length === 0) {
      throw new Error('无可切换的已就绪路网指标层');
    }
    console.log(`[road-syntax-probe] ready metrics: ${readyMetrics.join(',')}`);

    await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) return;
      vm.roadSyntaxSwitchSamples = [];
      vm.roadSyntaxSwitchLastMs = 0;
      vm.roadSyntaxSwitchP50Ms = 0;
      vm.roadSyntaxSwitchP95Ms = 0;
    });

    console.log(`[road-syntax-probe] switching ${SWITCH_TIMES} times`);
    const switchTrace = DEBUG_TRACE ? [] : null;
    for (let i = 0; i < SWITCH_TIMES; i += 1) {
      const metric = readyMetrics[i % readyMetrics.length];
      await page.evaluate((m) => {
        const root = document.querySelector('#app');
        const app = root && root.__vue_app__;
        const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
        if (!vm) return;
        vm.setRoadSyntaxMainTab(m);
      }, metric);
      await page.waitForTimeout(120);
      if (DEBUG_TRACE) {
        const sample = await page.evaluate((target) => {
          const root = document.querySelector('#app');
          const app = root && root.__vue_app__;
          const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
          if (!vm) return null;
          return {
            target,
            activeTab: String(vm.roadSyntaxMainTab || ''),
            lastMs: Number(vm.roadSyntaxSwitchLastMs || 0),
            path: String(vm.roadSyntaxSwitchPath || ''),
            status: String(vm.roadSyntaxStatus || ''),
          };
        }, metric);
        if (sample && switchTrace) switchTrace.push(sample);
      }
    }

    const stats = await page.evaluate(() => {
      const root = document.querySelector('#app');
      const app = root && root.__vue_app__;
      const vm = window.__probeVm || (app && app._instance && app._instance.proxy);
      if (!vm) {
        return {
          historyId: 0,
          p95: 0,
          p50: 0,
          last: 0,
          path: '',
          status: 'vm unavailable when collecting stats',
          readyDone: 0,
          readyTotal: 0,
          ready: false,
          degraded: false,
        };
      }
      return {
        historyId: Number(vm && vm.currentHistoryId ? vm.currentHistoryId : 0),
        p95: Number(vm.roadSyntaxSwitchP95Ms || 0),
        p50: Number(vm.roadSyntaxSwitchP50Ms || 0),
        last: Number(vm.roadSyntaxSwitchLastMs || 0),
        path: String(vm.roadSyntaxSwitchPath || ''),
        status: String(vm.roadSyntaxStatus || ''),
        readyDone: Number(vm.roadSyntaxPoolInitDone || 0),
        readyTotal: Number(vm.roadSyntaxPoolInitTotal || 0),
        ready: !!vm.roadSyntaxPoolReady,
        degraded: !!vm.roadSyntaxPoolDegraded,
        topSlowMs: (Array.isArray(vm.roadSyntaxSwitchSamples) ? vm.roadSyntaxSwitchSamples : [])
          .map((item) => Number(item))
          .filter((v) => Number.isFinite(v) && v > 0)
          .sort((a, b) => b - a)
          .slice(0, 6),
      };
    });
    if (DEBUG_TRACE && Array.isArray(switchTrace)) {
      stats.switchTrace = switchTrace;
    }

    console.log('[road-syntax-probe] stats:', JSON.stringify(stats, null, 2));

    if (!Number.isFinite(stats.p95) || stats.p95 <= 0) {
      throw new Error(`无效的切换性能统计 p95=${stats.p95}`);
    }
    if (stats.p95 > TARGET_P95_MS) {
      throw new Error(`切换性能不达标: p95=${stats.p95}ms > target=${TARGET_P95_MS}ms`);
    }
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[road-syntax-probe] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
