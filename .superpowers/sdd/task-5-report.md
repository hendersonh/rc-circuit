## Task 5 Report: Knife Switch Integration

### Files changed

**`circuit_renderer.py`:**
- Added `TRACK_GRAY` and `HANDLE_LIGHT` color constants (lines 20-21)
- Replaced `switch_screen_pos` property with `get_switch_hitbox()` method (lines 64-67) -- returns `(cx, cy, 30)` from `SWITCH_CENTER`
- Removed old terminal dot drawing (3 circles at switch_top, switch_pivot, switch_bot) from `draw_schematic` (line 151 is now a comment)
- Added `draw_switch(surface, font, mode)` method (lines ~197-255) -- draws knife-style toggle with pivot base, lever, handle knob, contact pads, active-path glow, and CHG/DCH label
- Added `self.draw_switch(surface, font, switch_mode)` call at end of `draw_schematic` (line 162)

**`ui_manager.py`:**
- Replaced entire `SPDT_Switch` class (lines 141-162) -- now accepts `get_hitbox` callable instead of hardcoded x/y, keeps only `mode` state + `handle_event`, no more `draw()` method or terminal position properties

**`main.py`:**
- Changed SPDT construction from `SPDT_Switch(x, y)` to `SPDT_Switch(self.circuit.get_switch_hitbox)` (lines 72-73)
- Removed explicit `self.spdt.draw(self.screen, self.big_font)` call (was lines 148-149, now gone)

### App runs: YES

`python main.py` launches cleanly with no exceptions or errors. pygame initializes, the window opens, and the main loop runs.

### Concerns: None

All wiring is consistent: `SPDT_Switch` delegates hit-testing to `CircuitRenderer.get_switch_hitbox()`, and all drawing is handled inside `CircuitRenderer.draw_switch()` which is called from `draw_schematic()`.
