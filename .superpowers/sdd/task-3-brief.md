### Task 3: Redraw Resistor with Proportional Zigzag

**Files:**
- Modify: `circuit_renderer.py:146-158` (`_draw_resistor` method)

**Interfaces:**
- Consumes: Resistor end positions from PATH[1] and PATH[2], `RESISTOR_BROWN` color
- Produces: 9-segment zigzag centered on the top wire between x=40 and x=160

- [ ] **Step 1: Replace `_draw_resistor` with 9-segment proportional zigzag**

The resistor sits on the top wire between `PATH[1]` (40,40) and `PATH[2]` (160,40). The lead wires extend to the wire loop joints. The zigzag amplitude scales with the panel transform.

```python
def _draw_resistor(self, surface, font):
    """Draw ANSI zigzag resistor on the top wire segment."""
    x1, y1 = self.transform_point(40, 40)
    x2, y2 = self.transform_point(160, 40)
    color = RESISTOR_BROWN
    segments = 9
    amplitude = 14  # pixels in screen space

    # Lead wires (straight portions)
    lead_in = 10  # px of straight wire at each end
    lx1 = x1 + lead_in
    lx2 = x2 - lead_in
    pygame.draw.line(surface, color, (x1, y1), (lx1, y1), 2)  # left lead
    pygame.draw.line(surface, color, (lx2, y2), (x2, y2), 2)  # right lead

    # Zigzag body
    dx = (lx2 - lx1) / segments
    points = [(lx1, y1)]
    for i in range(1, segments):
        px = lx1 + i * dx
        py = y1 + (amplitude if i % 2 == 1 else -amplitude)
        points.append((int(px), int(py)))
    points.append((lx2, y2))
    pygame.draw.lines(surface, color, False, points, 3)

    # Junction dots at wire connections
    for pt in [(x1, y1), (x2, y2)]:
        pygame.gfxdraw.filled_circle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)
        pygame.gfxdraw.aacircle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)

    # Label
    lbl_r = font.render("R", True, color)
    surface.blit(lbl_r, self.transform_point(85, 15))
```

- [ ] **Step 2: Update the `draw_schematic` method call**

Replace the old resistor call:

```python
# Old:
r_start = tx(40, 30)
r_end = tx(90, 30)
self._draw_resistor(surface, r_start, r_end, RESISTOR_BROWN, 5)

# New:
self._draw_resistor(surface, font)
```

Remove the old `lbl_r` line since it's now inside `_draw_resistor`.

- [ ] **Step 3: Run and verify**

```bash
source .venv/bin/activate && python main.py
```

**Verify:** Resistor on the top wire shows a clean 9-segment zigzag in brown. Lead wires connect into the circuit with small white junction dots. Label "R" appears above the zigzag.

- [ ] **Step 4: Commit**

```bash
git add circuit_renderer.py
git commit -m "feat(circuit): redraw resistor with 9-segment proportional zigzag

Replace fixed-amplitude 5-segment zigzag with 9-segment version
scaled to the full top-wire span. Added lead wires, junction dots,
and inline label."
```

---

