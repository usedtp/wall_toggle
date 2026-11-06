/*
 * Diagnostics go through the shared usedtp Logger module. If it is missing, entries go to the console only,
 * so the module still runs. Every file imports from here; nothing else talks to the logger.
 */
const MODULE_ID = "wall-movement-toggle";
const TITLE = "Wall Movement Toggle";

const fallback = {
  debug: (m, d) => console.debug(`${MODULE_ID} | ${m}`, d ?? ""),
  info: (m, d) => console.log(`${MODULE_ID} | ${m}`, d ?? ""),
  warn: (m, d) => console.warn(`${MODULE_ID} | ${m}`, d ?? ""),
  error: (m, e, d) => console.error(`${MODULE_ID} | ${m}`, e, d ?? ""),
  unclear: (k, m, d) => console.warn(`${MODULE_ID} | unclear: ${m}`, d ?? ""),
  report: () => { ui.notifications?.warn("Install usedtp Logger to send reports."); return Promise.resolve("queued"); },
  async guard(label, fn) {
    try { return await fn(); } catch (err) { console.error(`${MODULE_ID} | ${label} failed`, err); return undefined; }
  },
  openReport: () => ui.notifications?.warn("Install usedtp Logger to send reports.")
};

let logger = null;

/** The module's logger. Call it at use time (log().warn(...)), never store the result at import time. */
export function log() {
  if (logger) return logger;
  const api = game.modules?.get("usedtp-logger")?.api ?? globalThis.UsedtpLogger;
  if (api?.register) logger = api.register(MODULE_ID, { title: TITLE });
  return logger ?? fallback;
}
