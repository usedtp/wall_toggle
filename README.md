# Wall Movement Toggle

Foundry VTT module for v14. Requires [usedtp Logger](https://github.com/usedtp/usedtp-logger), which Foundry installs with it. Covers every Scene Level. One click stops walls from blocking token movement on the current scene, for every player. Click again to restore.

- Two modes: walls only (closed doors still block), or walls and doors.
- dnd5e: other creatures' tokens stop blocking movement too, in both modes.
- Sight, light and sound walls are untouched.
- Every wall's original setting is saved and restored exactly.
- GM and Assistant GM only.
- Players get a notice when it changes.

## Use

- **Buttons** (Token and Walls toolbars, lit = active):
  - Walking person: walls don't block, closed doors still do.
  - Open door: walls and closed doors don't block.
  - Click the lit button to restore. Click the other button to switch modes directly.
- **Hotkeys:** set one for each mode in Configure Controls > Wall Movement Toggle.
- **Report a problem:** right-click either button, then Report error or Report unclear. The report includes the mode, scene and wall counts, and shows in usedtp Logger > Open logs.

## Install

In Foundry: Add-on Modules > Install Module > paste the manifest URL:

```
https://github.com/usedtp/wall_toggle/releases/latest/download/module.json
```

## Note

A token moved through a wall gets vision on the other side, so players can see areas behind walls while the toggle is on.

## Errors

If a toggle fails, the error goes to usedtp Logger: Game Settings > usedtp Logger > Open logs, filtered by Wall Movement Toggle.

## Releases

Bump `version` in module.json and add a CHANGELOG entry, then push to main. GitHub Actions runs the tests and publishes the release.

## License

MIT
