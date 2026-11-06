// Tests with a mocked Foundry. Run: node tests/run.mjs
const hooks = {}; const notes = [];
let renders = 0;
const walls = new Map();
const mk = (id, move, door) => walls.set(id, { id, move, door });
mk("w1",20,0); mk("w2",20,0); mk("d1",20,1); mk("d2",20,2); mk("n1",0,0);
const flags = {};
const scene = {
  id: "s1",
  walls: { has: id => walls.has(id), [Symbol.iterator]: () => walls.values() },
  getFlag: (m,k) => flags[k],
  setFlag: async (m,k,v) => { flags[k] = structuredClone(v); (hooks.updateScene||[]).forEach(f=>f(scene,{flags:{[m]:{[k]:v}}})); },
  updateEmbeddedDocuments: async (t, ups) => ups.forEach(u => walls.get(u._id).move = u.move),
};
globalThis.canvas = { scene };
globalThis.game = { modules: { get: () => null }, user: { isGM: true }, keybindings: { reg: {}, register(m,k,o){ this.reg[k]=o; } } };
globalThis.CONST = { WALL_MOVEMENT_TYPES: { NONE: 0, NORMAL: 20 }, WALL_DOOR_TYPES: { NONE: 0, DOOR: 1, SECRET: 2 } };
globalThis.ui = { notifications: { info: m => notes.push(m), error: m => notes.push("ERR " + m) }, controls: { render(){ renders++; } } };
globalThis.foundry = { utils: { hasProperty: (o,p) => p.split(".").reduce((a,k)=>a && k in a ? a[k] : undefined, o) !== undefined } };
globalThis.Hooks = { on(n,f){ (hooks[n] ??= []).push(f); }, once(n,f){ this.on(n,f); } };
await import("../scripts/main.js");
hooks.init.forEach(f=>f());
const state = () => [...walls.values()].map(w=>`${w.id}:${w.move}`).join(" ");
const tools = () => { const c = { tokens:{tools:{}}, walls:{tools:{}} }; hooks.getSceneControlButtons.forEach(f=>f(c)); return c.tokens.tools; };
const assert = (c, m) => { if (!c) { console.log("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };
const orig = state();
await game.keybindings.reg.toggleWalls.onDown();
await new Promise(r=>setTimeout(r,10));
assert(state()==="w1:0 w2:0 d1:20 d2:20 n1:0", "walls mode: walls off, doors block " + state());
assert(tools().wmtWalls.active && !tools().wmtAll.active, "button state walls");
await tools().wmtWalls.onChange(null, true); // duplicate callback harmless
assert(state()==="w1:0 w2:0 d1:20 d2:20 n1:0", "duplicate onChange is no-op");
await tools().wmtAll.onChange(null, true); // switch walls -> all
assert(state()==="w1:0 w2:0 d1:0 d2:0 n1:0", "switch to all mode " + state());
await tools().wmtWalls.onChange(null, false); // untoggling the other button does nothing
assert(flags.mode==="all", "unrelated untoggle ignored");
await tools().wmtAll.onChange(null, false);
assert(state()===orig, "restore exact originals " + state());
await game.keybindings.reg.toggleAll.onDown(); await new Promise(r=>setTimeout(r,10));
walls.delete("w2"); // wall deleted while off
await game.keybindings.reg.toggleAll.onDown(); await new Promise(r=>setTimeout(r,10));
assert(state()==="w1:20 d1:20 d2:20 n1:0", "deleted wall skipped on restore");
game.user.isGM = false; await tools(); 
assert(Object.keys(tools()).length===0, "players see no buttons");
game.user.isGM = true;
const found = new Set(["x"]);
hooks["dnd5e.determineOccupiedGridSpaceBlocking"].forEach(f=>f({}, {document:{parent:scene}}, {}, found));
assert(found.size===0 === !!flags.mode, "token blocking cleared only while on (mode=" + flags.mode + ")");
await game.keybindings.reg.toggleWalls.onDown(); await new Promise(r=>setTimeout(r,10));
const f2 = new Set(["x"]); hooks["dnd5e.determineOccupiedGridSpaceBlocking"].forEach(f=>f({}, {document:{parent:scene}}, {}, f2));
assert(f2.size===0, "token blocking cleared in walls mode");

// A failed toggle is reported to usedtp Logger.
const errors = []; const opened = [];
game.modules.get = id => id === "usedtp-logger" ? { api: { register: () => ({
  error: (m, e) => errors.push(m), info() {}, warn() {},
  guard: async (l, fn) => fn(),
  openReport: (cat, ctx) => opened.push({ cat, ctx })
}) } } : null;
scene.updateEmbeddedDocuments = async () => { throw new Error("boom"); };
flags.mode = ""; for (const w of walls.values()) w.move = 20;
await game.keybindings.reg.toggleWalls.onDown(); await new Promise(r => setTimeout(r, 10));
assert(errors.includes("toggle"), "toggle failure sent to usedtp Logger");
// Right-click report menu: GM only, two items, opens the logger report with context.
const menus = [];
globalThis.HTMLElement = class { constructor() { this.dataset = {}; } };
foundry.applications = { ux: { ContextMenu: { implementation: class { constructor(root, sel, items) { menus.push({ sel, items }); } } } } };
const root = new HTMLElement();
game.user.isGM = false;
hooks.renderSceneControls.forEach(f => f({}, root));
assert(menus.length === 0, "players get no report menu");
game.user.isGM = true;
hooks.renderSceneControls.forEach(f => f({}, root));
hooks.renderSceneControls.forEach(f => f({}, root));
assert(menus.length === 1, "menu attached once per toolbar");
assert(menus[0].sel.includes("wmtWalls") && menus[0].sel.includes("wmtAll"), "menu on both buttons");
assert(menus[0].items.map(i => i.label).join("|") === "Report error|Report unclear", "labels are Report error and Report unclear");
await menus[0].items[1].onClick();
assert(opened[0]?.cat === "unclear" && opened[0].ctx.scene === "s1" && "mode" in opened[0].ctx && opened[0].ctx.walls >= 1, "unclear report opens with scene context");
await menus[0].items[0].onClick();
assert(opened[1]?.cat === "error", "error report opens");

console.log(process.exitCode ? "FAILED" : "all passed");
