### Task 2: Redraw Battery with Multi-Cell Symbol

**Files:**
- Modify: `circuit_renderer.py:88-99` (battery drawing)

**Interfaces:**
- Consumes: `CircuitRenderer.transform_point()`, `WIRE_WHITE`, `BATTERY_RED`, `BATTERY_BLACK` colors
- Produces: Battery drawn on the left side of the circuit between `PATH[8]` and `PATH[0]`

- [ ] **Step 1: Replace battery drawing code**

Replace lines 87-99 with a proper multi-cell battery symbol. The battery sits on the left side between y=40 and y=200 (local coords). Draw 3 cell pairs stacked vertically with lead wires above/below:

```python
# ── Battery (left side) ──
batt_top = tx(0, 40)
batt_bot = tx(0, 200)
batt_center_x = batt_top[0]

# Lead wires: connect battery terminals into the circuit loop
pygame.draw.line(surface, WIRE_WHITE, batt_top, tx(0, 30), 2)    # top lead
pygame.draw.line(surface, WIRE_WHITE, batt_bot, tx(0, 210), 2)   # bottom lead

# Three battery cells: long/short line pairs
cells = 3
cell_height_px = (batt_bot[1] - batt_top[1]) / cells
for i in range(cells):
    cell_top_y = batt_top[1] + i * cell_height_px + cell_height_px * 0.15
    cell_bot_y = batt_top[1] + (i + 1) * cell_height_px - cell_height_px * 0.15
    cell_mid_y = (cell_top_y + cell_bot_y) / 2
    # Long line (positive plate — red)
    pygame.draw.line(surface, BATTERY_RED,
                     (batt_center_x - 10, cell_mid_y - 4),
                     (batt_center_x + 10, cell_mid_y - 4), 3)
    # Short line (negative plate — black)
    pygame.draw.line(surface, BATTERY_BLACK,
                     (batt_center_x - 6, cell_mid_y + 4),
                     (batt_center_x + 6, cell_mid_y + 4), 2)

# + and − labels
lbl_plus = font.render("+", True, BATTERY_RED)
surface.blit(lbl_plus, tx(-20, 28))
lbl_minus = font.render("−", True, BATTERY_BLACK)
surface.blit(lbl_minus, tx(-20, 195))
```

- [ ] **Step 2: Run and verify**

```bash
source .venv/bin/activate && python main.py
```

**Verify:** Battery on the left shows 3 cell pairs (alternating thick/thin horizontal lines). Red positive plate on top of each pair, black negative below. `+` label near top of battery, `−` label near bottom. Lead wires connect top and bottom into the circuit loop.

- [ ] **Step 3: Commit**

```bash
git add circuit_renderer.py
git commit -m "feat(circuit): draw battery as multi-cell symbol

Replace 4 arbitrary lines with proper 3-cell battery:
alternating long (red, +) and short (black, −) plates,
lead wires into the circuit loop, +/− labels."
```

---

