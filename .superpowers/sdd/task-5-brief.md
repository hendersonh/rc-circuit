### Task 5: Integrate Knife Switch into CircuitRenderer

**Files:**
- Modify: `circuit_renderer.py` (add switch drawing methods)
- Modify: `ui_manager.py` (refactor `SPDT_Switch` — remove drawing, remove hardcoded coords)
- Modify: `main.py` (update wiring)

**Interfaces:**
- `CircuitRenderer.get_switch_hitbox()` → `(cx, cy, radius)` — center and click radius in screen coords
- `CircuitRenderer.draw_switch(surface, font, mode)` — draws the knife switch
- `SPDT_Switch.__init__(get_hitbox)` — accepts a callable returning `(cx, cy, radius)`
- `SPDT_Switch.handle_event(event)` — uses `self.get_hitbox()` instead of stored x,y
- `SPDT_Switch.draw()` — removed
- `SimulationApp.handle_events()` — uses `self.circuit.get_switch_hitbox()` indirectly
- `SimulationApp.draw()` — removes `self.spdt.draw()` call

- [ ] **Step 1: Add `get_switch_hitbox` method to CircuitRenderer**

The switch pivot is at `SWITCH_CENTER` in local coords. The click radius is 30px in screen space.

```python
def get_switch_hitbox(self):
    """Return (cx, cy, radius) for SPDT switch click detection."""
    cx, cy = self.transform_point(*self.SWITCH_CENTER)
    return (cx, cy, 30)
```

- [ ] **Step 2: Add `draw_switch` method to CircuitRenderer**

Three terminals: top (200,100), center/pivot (200,125), bottom (200,150). The active path depends on the switch mode.

```python
def draw_switch(self, surface, font, mode):
    """Draw a knife-style SPDT switch on the right side."""
    # Terminal positions in local coords
    top = self.transform_point(200, 100)
    pivot = self.transform_point(200, 125)
    bottom = self.transform_point(200, 150)

    # Determine active terminal
    is_charge = (mode == "CHARGE")
    active_terminal = top if is_charge else bottom
    lever_color = ACCENT_ORANGE if is_charge else ACCENT_GREEN

    # ── Wire connections to terminals ──
    # Top: from top wire (PATH[3])
    pygame.draw.line(surface, WIRE_WHITE, self.transform_point(200, 40), top, 2)
    # Center: from inside switch to...
    # (no wire to center — it's the pivot; lever connects to active)

    # ── Active path highlight (switch to capacitor) ──
    cap_right = self.transform_point(200, 200)
    glow_color = (*lever_color[:3], 40)  # semi-transparent
    glow_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
    if is_charge:
        # Top terminal → capacitor right
        pygame.draw.line(glow_surf, glow_color, top, cap_right, 4)
    else:
        # Bottom terminal → capacitor right (direct)
        pygame.draw.line(glow_surf, glow_color, bottom, cap_right, 4)
    surface.blit(glow_surf, (self.rect.x, self.rect.y))

    # ── Terminal contact pads ──
    for pos, is_active in [(top, is_charge), (pivot, False), (bottom, not is_charge)]:
        if is_active:
            color = lever_color
        else:
            color = TRACK_GRAY
        # Junction dot
        pygame.gfxdraw.filled_circle(surface, int(pos[0]), int(pos[1]), 4, color)
        pygame.gfxdraw.aacircle(surface, int(pos[0]), int(pos[1]), 4, color)

    # ── Lever ──
    pygame.draw.aaline(surface, lever_color, pivot, active_terminal, 4)

    # ── Handle knob at lever tip ──
    knob_pos = active_terminal
    pygame.gfxdraw.filled_circle(surface, int(knob_pos[0]), int(knob_pos[1]), 6, lever_color)
    pygame.gfxdraw.aacircle(surface, int(knob_pos[0]), int(knob_pos[1]), 6, lever_color)
    # Inner highlight
    pygame.gfxdraw.filled_circle(surface, int(knob_pos[0]), int(knob_pos[1]), 3, (255, 255, 240))
    pygame.gfxdraw.aacircle(surface, int(knob_pos[0]), int(knob_pos[1]), 3, (255, 255, 240))

    # ── Pivot base ──
    pygame.gfxdraw.filled_circle(surface, int(pivot[0]), int(pivot[1]), 6, PANEL_DARK)
    pygame.gfxdraw.aacircle(surface, int(pivot[0]), int(pivot[1]), 6, PANEL_DARK)
    pygame.gfxdraw.filled_circle(surface, int(pivot[0]), int(pivot[1]), 4, HANDLE_LIGHT)
    pygame.gfxdraw.aacircle(surface, int(pivot[0]), int(pivot[1]), 4, HANDLE_LIGHT)

    # ── Label ──
    label = "CHG" if is_charge else "DCH"
    lbl = font.render(label, True, lever_color)
    lbl_x = pivot[0] + 15
    lbl_y = pivot[1] - 8
    surface.blit(lbl, (lbl_x, lbl_y))
```

Add the new color constants alongside the existing ones in `circuit_renderer.py`:

```python
TRACK_GRAY = (60, 62, 68)      # NEW — inactive terminal color
HANDLE_LIGHT = (180, 185, 195) # NEW — pivot knob highlight
```

- [ ] **Step 3: Update `draw_schematic` to call `draw_switch`**

At the end of `draw_schematic`, after drawing components:

```python
# Knife switch (drawn after components so lever is on top)
self.draw_switch(surface, font, switch_mode)
```

Pass `switch_mode` as a parameter — it's already passed to `draw_schematic` as the `switch_mode` arg (line 78 signature: `def draw_schematic(self, surface, font, switch_mode, vc, v0, r_val, c_val)`).

- [ ] **Step 4: Remove old switch drawing from `draw_schematic`**

Remove lines 125-135 (old switch terminal dots and right wire to capacitor) since they're now part of `draw_switch`.

- [ ] **Step 5: Refactor `SPDT_Switch` in `ui_manager.py`**

Remove hardcoded x, y and terminal positions. Accept hitbox callable:

```python
class SPDT_Switch:
    """Three-terminal toggle switch state. Drawing is handled by CircuitRenderer."""

    MODE_CHARGE = "CHARGE"
    MODE_DISCHARGE = "DISCHARGE"

    def __init__(self, get_hitbox):
        self.mode = self.MODE_CHARGE
        self.get_hitbox = get_hitbox

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            cx, cy, radius = self.get_hitbox()
            mx, my = event.pos
            dx = mx - cx
            dy = my - cy
            if dx * dx + dy * dy <= radius * radius:
                self.mode = self.MODE_DISCHARGE if self.mode == self.MODE_CHARGE else self.MODE_CHARGE
                return True
        return False

    # draw() method removed — circuit renderer handles it
```

- [ ] **Step 6: Update `SimulationApp` in `main.py`**

Change the SPDT construction (line 74):

```python
# Before:
self.spdt = SPDT_Switch(switch_pos[0], switch_pos[1])

# After:
self.spdt = SPDT_Switch(self.circuit.get_switch_hitbox)
```

Remove the `switch_pos` line since it's no longer needed by SPDT constructor:

```python
# Remove these lines (72-74):
# ── SPDT Switch (aligned to circuit schematic) ──
# switch_pos = self.circuit.switch_screen_pos
# self.spdt = SPDT_Switch(switch_pos[0], switch_pos[1])
```

Replace with just:

```python
# ── SPDT Switch (state only, drawing handled by CircuitRenderer) ──
self.spdt = SPDT_Switch(self.circuit.get_switch_hitbox)
```

Remove the `self.spdt.draw()` call from the `draw` method (line 149):

Old:
```python
# Draw SPDT switch on top
self.spdt.draw(self.screen, self.big_font)
```

Remove those two lines.

- [ ] **Step 7: Remove the unused `switch_screen_pos` property from CircuitRenderer**

Lines 73-76 — remove or comment:

```python
# Removed: @property switch_screen_pos — no longer used (switch uses get_switch_hitbox)
```

- [ ] **Step 8: Run and verify**

```bash
source .venv/bin/activate && python main.py
```

**Verify:**
- Knife switch appears on the right side of the circuit
- Orange lever points to top terminal when in CHARGE mode
- Green lever points to bottom terminal in DISCHARGE mode
- Clicking the switch area toggles modes
- Active path has a subtle colored glow from switch to capacitor
- Lever has a handle knob at the tip
- Pivot block is visible at center terminal

- [ ] **Step 9: Commit**

```bash
git add circuit_renderer.py ui_manager.py main.py
git commit -m "feat(switch): integrate knife switch into CircuitRenderer

Rewrite SPDT as knife-style toggle with pivot, lever, handle knob,
contact pads, and active path glow. Refactor SPDT_Switch in ui_manager
to pure state container — accepts get_hitbox callable, no drawing,
no hardcoded coords. Update SimulationApp wiring."
```

---

