import { log } from "./diag.mjs";

const MODULE = "wall-movement-toggle";
let busy = false;

/** Current mode of a scene: "walls" (doors still block), "all" (nothing blocks), or null (normal). */
function getMode(scene = canvas?.scene) {
  return scene?.getFlag(MODULE, "mode") || null;
}

/**
 * Put the current scene into the target mode. Idempotent: calling it with the
 * mode the scene is already in does nothing, so repeated callbacks are harmless.
 * @param {"walls"|"all"|null} target
 */
async function setMode(target) {
  const scene = canvas?.scene;
  if (!scene || !game.user.isGM || busy) return;
  const current = getMode(scene);
  if (current === target) return;
  busy = true;
  const NONE = CONST.WALL_MOVEMENT_TYPES.NONE;
  const NO_DOOR = CONST.WALL_DOOR_TYPES.NONE;
  try {
    // 1. Restore originals if anything is currently switched off.
    if (current) {
      const saved = scene.getFlag(MODULE, "saved") ?? [];
      const updates = saved
        .filter(([id]) => scene.walls.has(id))
        .map(([id, move]) => ({ _id: id, move }));
      if (updates.length) await scene.updateEmbeddedDocuments("Wall", updates);
      await scene.setFlag(MODULE, "saved", []);
    }

    // 2. Apply the new mode. scene.walls covers every Scene Level.
    if (target) {
      const saved = [];
      for (const w of scene.walls) {
        if (w.move === NONE) continue;
        if (target === "walls" && w.door !== NO_DOOR) continue;
        saved.push([w.id, w.move]);
      }
      // Save originals before changing anything so nothing is lost on failure.
      await scene.setFlag(MODULE, "saved", saved);
      if (saved.length) {
        await scene.updateEmbeddedDocuments("Wall", saved.map(([id]) => ({ _id: id, move: NONE })));
      }
    }

    await scene.setFlag(MODULE, "mode", target ?? "");
  } catch (err) {
    log().error("toggle", err, { target, scene: scene.id });
    ui.notifications.error("Wall Movement Toggle failed. The error is in usedtp Logger.");
  } finally {
    busy = false;
    refreshControls();
  }
}

/** Keybinding behaviour: press once to enter the mode, press again to restore. */
function pressMode(target) {
  setMode(getMode() === target ? null : target);
}

/** Rebuild the toolbar so button states match the scene. */
function refreshControls() {
  ui.controls?.render({ reset: true });
}

/** What the GM sees when reporting: mode, scene and wall counts. */
function reportContext() {
  const scene = canvas?.scene;
  const walls = scene ? [...scene.walls] : [];
  return {
    mode: getMode(scene),
    scene: scene?.id,
    sceneName: scene?.name,
    walls: walls.length,
    blocking: walls.filter(w => w.move !== CONST.WALL_MOVEMENT_TYPES.NONE).length,
    saved: (scene?.getFlag(MODULE, "saved") ?? []).length,
    busy
  };
}

/** Right-click either toolbar button: Report error or Report unclear. Attached once per toolbar element. */
function attachReportMenu(root) {
  if (!(root instanceof HTMLElement) || root.dataset.wmtReportMenu) return;
  root.dataset.wmtReportMenu = "1";
  const report = category => log().guard("report menu", () => log().openReport(category, reportContext()));
  new foundry.applications.ux.ContextMenu.implementation(root, '[data-tool="wmtWalls"], [data-tool="wmtAll"]', [
    { label: "Report error", icon: '<i class="fa-solid fa-triangle-exclamation"></i>', onClick: () => report("error") },
    { label: "Report unclear", icon: '<i class="fa-solid fa-circle-question"></i>', onClick: () => report("unclear") }
  ], { jQuery: false, fixed: true });
}

Hooks.once("ready", () => log().info("ready"));

Hooks.on("renderSceneControls", (app, html) => {
  if (!game.user.isGM) return;
  try { attachReportMenu(html instanceof HTMLElement ? html : html?.[0]); } catch (err) { log().error("report menu attach", err); }
});

Hooks.once("init", () => {
  game.keybindings.register(MODULE, "toggleWalls", {
    name: "Toggle walls (doors still block)",
    hint: "Walls stop blocking movement on the current scene. Closed doors still block. Press again to restore.",
    editable: [],
    restricted: true, // GM and Assistant GM only
    onDown: () => { pressMode("walls"); return true; }
  });
  game.keybindings.register(MODULE, "toggleAll", {
    name: "Toggle walls and doors",
    hint: "Walls and closed doors stop blocking movement on the current scene. Press again to restore.",
    editable: [],
    restricted: true,
    onDown: () => { pressMode("all"); return true; }
  });
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const mode = getMode();
  for (const layer of ["tokens", "walls"]) {
    const group = controls[layer];
    if (!group?.tools) continue;
    const base = Object.keys(group.tools).length;
    group.tools.wmtWalls = {
      name: "wmtWalls",
      title: "Walls Don't Block (doors still block). Right-click to report.",
      icon: "fa-solid fa-person-walking",
      order: base,
      toggle: true,
      active: mode === "walls",
      visible: true,
      onChange: (event, active) => setMode(active ? "walls" : (getMode() === "walls" ? null : getMode()))
    };
    group.tools.wmtAll = {
      name: "wmtAll",
      title: "Walls and Doors Don't Block. Right-click to report.",
      icon: "fa-solid fa-door-open",
      order: base + 1,
      toggle: true,
      active: mode === "all",
      visible: true,
      onChange: (event, active) => setMode(active ? "all" : (getMode() === "all" ? null : getMode()))
    };
  }
});

// Tell everyone on the scene when the state changes, and keep the buttons in sync.
Hooks.on("updateScene", (scene, changes) => {
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE}.mode`)) return;
  if (scene.id !== canvas?.scene?.id) return;
  const mode = getMode(scene);
  const msg = mode === "all" ? "Walls, doors and tokens no longer block movement."
    : mode === "walls" ? "Walls and tokens no longer block movement. Doors still do."
    : "Walls, doors and tokens block movement again.";
  ui.notifications.info(msg);
  if (game.user.isGM) refreshControls();
});

Hooks.on("canvasReady", () => { if (game.user.isGM) refreshControls(); });

// dnd5e: while either mode is on, other creatures' tokens don't block movement either.
// Runs on the client of whoever drags, so it applies to players too. No effect on other systems.
Hooks.on("dnd5e.determineOccupiedGridSpaceBlocking", (gridSpace, token, options, found) => {
  const scene = token?.document?.parent ?? canvas?.scene;
  if (getMode(scene) && typeof found?.clear === "function") found.clear();
});
