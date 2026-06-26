# circuit_renderer.py
"""Draws the RC circuit schematic: battery, resistor, capacitor, wires, SPDT switch.
Wire paths are also used by CurrentVisualizer for particle animation."""

import math

import pygame
import pygame.gfxdraw

# Colors
WIRE_WHITE = (200, 200, 210)
BATTERY_RED = (220, 60, 60)
BATTERY_BLACK = (60, 60, 60)
RESISTOR_BROWN = (180, 140, 80)
CAPACITOR_BLUE = (100, 180, 255)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_GREEN = (0, 220, 140)
TRACK_GRAY = (60, 62, 68)      # NEW — inactive terminal color
HANDLE_LIGHT = (180, 185, 195) # NEW — pivot knob highlight
PANEL_DARK = (40, 42, 48)
BG_DARK = (30, 30, 35)


class CircuitRenderer:
    """Draws the RC circuit schematic and provides wire paths for particle animation."""

    # Wire path waypoints — (x, y) coordinates defining the circuit loop
    PATH = [
        # Top wire: battery(+) → resistor → switch_top
        (0, 40),      # 0: battery + terminal
        (40, 40),     # 1: resistor left lead
        # Resistor zigzag (9 segments, drawn by _draw_resistor)
        (160, 40),    # 2: resistor right lead
        (200, 40),    # 3: switch top terminal
        # Right wire: switch → capacitor
        (200, 100),   # 4: switch center terminal (pivot)
        (200, 160),   # 5: switch bottom terminal
        (200, 200),   # 6: capacitor right lead
        # Bottom wire: capacitor → battery(-)
        (160, 200),   # 7: capacitor left lead
        (0, 200),     # 8: battery - terminal
        # Left wire: battery return path
        (0, 160),     # 9
        (0, 80),      # 10
        (0, 40),      # 11: back to start
    ]

    # Switch position in local path coordinates (used by SPDT_Switch)
    SWITCH_CENTER = (200, 125)

    def __init__(self, x, y, width, height):
        self.rect = pygame.Rect(x, y, width, height)
        # Cache transform parameters for external coord conversion
        self.scale_x = (width - 40) / 200.0
        self.scale_y = (height - 40) / 200.0

    def transform_point(self, px, py):
        """Convert path-local coordinates to screen coordinates."""
        return (int(self.rect.x + 20 + px * self.scale_x),
                int(self.rect.y + 20 + py * self.scale_y))

    def get_switch_hitbox(self):
        """Return (cx, cy, radius) for SPDT switch click detection."""
        cx, cy = self.transform_point(*self.SWITCH_CENTER)
        return (cx, cy, 30)

    def draw_schematic(self, surface, font, switch_mode, vc, v0, r_val, c_val):
        """Draw the full circuit schematic."""
        # Background
        pygame.draw.rect(surface, BG_DARK, self.rect)
        pygame.draw.rect(surface, PANEL_DARK, self.rect, 2)

        # Use cached transform
        tx = self.transform_point

        # Draw main wire loop — skip resistor gap (segment 1→2)
        for i in range(len(self.PATH) - 1):
            if i == 1:  # resistor gap — drawn by _draw_resistor
                continue
            p1 = self.PATH[i]
            p2 = self.PATH[i + 1]
            pygame.draw.line(surface, WIRE_WHITE, tx(*p1), tx(*p2), 2)
        # Close the loop
        pygame.draw.line(surface, WIRE_WHITE, tx(*self.PATH[-1]), tx(*self.PATH[0]), 2)

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

        # Resistor (drawn on top of wire path, between points 1 and 2)
        self._draw_resistor(surface, font)

        # ── Capacitor (drawn on top of bottom wire) ──
        cap_left_x, cap_y = self.transform_point(80, 200)
        cap_right_x, _ = self.transform_point(120, 200)
        plate_height = 28  # vertical height of each plate (pixels)

        # Left plate (straight vertical line)
        pygame.draw.line(surface, CAPACITOR_BLUE,
                         (cap_left_x, cap_y - plate_height // 2),
                         (cap_left_x, cap_y + plate_height // 2), 3)

        # Right plate (slightly curved outward — IEC convention)
        # Draw as short line segments forming a shallow arc
        arc_segments = 8
        arc_radius = 30
        for i in range(arc_segments):
            t1 = i / arc_segments
            t2 = (i + 1) / arc_segments
            angle1 = -0.4 + t1 * 0.8
            angle2 = -0.4 + t2 * 0.8
            x1 = cap_right_x + arc_radius * (1 - math.cos(angle1)) * 0.3
            y1 = cap_y - plate_height // 2 + plate_height * t1
            x2 = cap_right_x + arc_radius * (1 - math.cos(angle2)) * 0.3
            y2 = cap_y - plate_height // 2 + plate_height * t2
            pygame.draw.line(surface, CAPACITOR_BLUE, (int(x1), int(y1)), (int(x2), int(y2)), 3)

        # Label
        lbl_c = font.render("C", True, CAPACITOR_BLUE)
        surface.blit(lbl_c, (cap_right_x + 25, cap_y - 10))

        # SPDT switch — now drawn by draw_switch()
        # Component labels
        lbl_v0 = font.render(f"V₀ = {v0:.1f}V", True, TEXT_GRAY)
        surface.blit(lbl_v0, tx(0, 55))

        # Values label
        val_text = f"R={r_val:.0f}Ω  C={c_val*1e6:.0f}µF  τ={(r_val*c_val):.3f}s"
        val_lbl = font.render(val_text, True, TEXT_GRAY)
        surface.blit(val_lbl, (self.rect.x + 10, self.rect.y + self.rect.height - 20))

        # Knife switch (drawn after components so lever is on top)
        self.draw_switch(surface, font, switch_mode)

    def _draw_resistor(self, surface, font):
        """Draw a rectangular-box resistor symbol on the top wire segment."""
        x1, y1 = self.transform_point(40, 40)
        x2, y2 = self.transform_point(160, 40)
        color = RESISTOR_BROWN
        box_height = 28  # vertical height of the resistor box (pixels)

        # Lead wires (straight portions into the box)
        lead_in = 8  # px of straight wire at each end before the box
        lx1 = x1 + lead_in
        lx2 = x2 - lead_in
        pygame.draw.line(surface, color, (x1, y1), (lx1, y1), 2)  # left lead
        pygame.draw.line(surface, color, (lx2, y2), (x2, y2), 2)  # right lead

        # Resistor box (outlined rectangle)
        box_rect = pygame.Rect(lx1, y1 - box_height // 2, lx2 - lx1, box_height)
        pygame.draw.rect(surface, color, box_rect, 3)
        # Fill with a slightly darker shade
        fill_color = (150, 110, 50)
        pygame.draw.rect(surface, fill_color, box_rect.inflate(-2, -2))

        # Junction dots at wire connections
        for pt in [(x1, y1), (x2, y2)]:
            pygame.gfxdraw.filled_circle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)
            pygame.gfxdraw.aacircle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)

        # Label
        lbl_r = font.render("R", True, color)
        surface.blit(lbl_r, self.transform_point(85, 15))

    def draw_switch(self, surface, font, mode):
        """Draw a knife-style SPDT switch on the right side."""
        # Terminal positions in local coords
        top = self.transform_point(200, 100)
        pivot = self.transform_point(200, 125)
        bottom = self.transform_point(200, 150)

        # Determine active terminal
        is_charge = (mode == "CHARGE")
        lever_color = ACCENT_ORANGE if is_charge else ACCENT_GREEN

        # ── Wire connections to terminals ──
        # Top: from top wire (PATH[3]) to top terminal
        pygame.draw.line(surface, WIRE_WHITE, self.transform_point(200, 40), top, 2)
        # Bottom: from bottom terminal down toward capacitor
        pygame.draw.line(surface, WIRE_WHITE, bottom, self.transform_point(200, 175), 2)

        # ── Active path highlight (switch to capacitor) ──
        cap_right = self.transform_point(200, 200)
        glow_color = (*lever_color[:3], 40)  # semi-transparent
        glow_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        # Glow goes from pivot region to capacitor right lead
        if is_charge:
            pygame.draw.line(glow_surf, glow_color, top, cap_right, 4)
        else:
            pygame.draw.line(glow_surf, glow_color, bottom, cap_right, 4)
        surface.blit(glow_surf, (self.rect.x, self.rect.y))

        # ── Terminal contact pads ──
        for pos, is_active in [(top, is_charge), (bottom, not is_charge)]:
            color = lever_color if is_active else TRACK_GRAY
            pygame.gfxdraw.filled_circle(surface, int(pos[0]), int(pos[1]), 4, color)
            pygame.gfxdraw.aacircle(surface, int(pos[0]), int(pos[1]), 4, color)

        # ── Lever (angles right from pivot, not straight to terminal) ──
        lever_length = 30  # pixels from pivot to knob
        if is_charge:
            lever_tip = (pivot[0] + lever_length, pivot[1] - 14)
        else:
            lever_tip = (pivot[0] + lever_length, pivot[1] + 14)
        pygame.draw.line(surface, lever_color, pivot, lever_tip, 4)

        # ── Handle knob at lever tip ──
        pygame.gfxdraw.filled_circle(surface, int(lever_tip[0]), int(lever_tip[1]), 6, lever_color)
        pygame.gfxdraw.aacircle(surface, int(lever_tip[0]), int(lever_tip[1]), 6, lever_color)
        # Inner highlight
        pygame.gfxdraw.filled_circle(surface, int(lever_tip[0]), int(lever_tip[1]), 3, (255, 255, 240))
        pygame.gfxdraw.aacircle(surface, int(lever_tip[0]), int(lever_tip[1]), 3, (255, 255, 240))

        # ── Pivot base ──
        pygame.gfxdraw.filled_circle(surface, int(pivot[0]), int(pivot[1]), 6, PANEL_DARK)
        pygame.gfxdraw.aacircle(surface, int(pivot[0]), int(pivot[1]), 6, PANEL_DARK)
        pygame.gfxdraw.filled_circle(surface, int(pivot[0]), int(pivot[1]), 4, HANDLE_LIGHT)
        pygame.gfxdraw.aacircle(surface, int(pivot[0]), int(pivot[1]), 4, HANDLE_LIGHT)

        # ── Label ──
        label = "CHG" if is_charge else "DCH"
        lbl = font.render(label, True, lever_color)
        surface.blit(lbl, (pivot[0] + 40, pivot[1] - 8))