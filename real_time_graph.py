# real_time_graph.py
"""Real-time stacked graph for Vc (top) and I (bottom)
using bounded deques for memory-safe rolling history.
"""

from collections import deque
import pygame

BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
GRID_GRAY = (55, 58, 62)
GRAPH_BG = (22, 24, 28)


class RealTimeGraph:
    """Stacked graph with Vc on top, I on bottom, shared X-axis."""

    def __init__(self, x, y, width, height_top, height_bottom, font, v0=12.0):
        self.x = x
        self.y = y
        self.width = width
        self.height_top = height_top
        self.height_bottom = height_bottom
        self.font = font
        self.v0 = v0

        # Data storage — rolling 300 points
        self.vc_data = deque(maxlen=300)
        self.i_data = deque(maxlen=300)

        # Margins for labels
        self.y_label_margin = 25  # left margin for Y-axis labels
        self.x_label_margin = 20  # bottom margin for X-axis label

    def push(self, vc, current):
        """Append a data point (called each frame while unpaused)."""
        self.vc_data.append(vc)
        self.i_data.append(current)

    def reset(self):
        """Clear all graph data."""
        self.vc_data.clear()
        self.i_data.clear()

    def draw(self, surface):
        """Draw both stacked graphs."""
        plot_top_x = self.x + self.y_label_margin
        plot_top_y = self.y
        plot_width = self.width - self.y_label_margin - 5

        # Draw Vc graph
        self._draw_graph(surface, self.vc_data,
                         plot_top_x, plot_top_y, plot_width, self.height_top,
                         self.v0, "Vc (V)", ACCENT_CYAN)

        # Draw I graph (below Vc graph)
        i_y = self.y + self.height_top + 4
        # Auto-range I: find max absolute current from data
        i_max = 0.001
        for val in self.i_data:
            i_max = max(i_max, abs(val))
        i_range = max(i_max * 1.2, 0.001)

        self._draw_graph(surface, self.i_data,
                         plot_top_x, i_y, plot_width, self.height_bottom,
                         i_range, "I (mA)", ACCENT_GREEN,
                         center_zero=True)

    def _draw_graph(self, surface, data, gx, gy, gw, gh, y_range, label, color,
                    center_zero=False):
        """Draw a single graph with background, grid, axis labels, and trace."""
        # Background
        bg_rect = pygame.Rect(gx, gy, gw, gh)
        pygame.draw.rect(surface, GRAPH_BG, bg_rect)
        pygame.draw.rect(surface, PANEL_DARK, bg_rect, 1)

        # Grid lines (5 horizontal lines)
        for i in range(5):
            y_pos = gy + int(gh * i / 4)
            pygame.draw.line(surface, GRID_GRAY, (gx, y_pos), (gx + gw, y_pos), 1)

        # Y-axis label
        lbl = self.font.render(label, True, color)
        surface.blit(lbl, (gx - self.y_label_margin + 2, gy + 2))

        # Y-axis tick labels
        if center_zero:
            mid = gy + gh // 2
            self._draw_tick_label(surface, f"{y_range*1000:.1f}", gx - 2, gy)
            self._draw_tick_label(surface, "0", gx - 2, mid)
            self._draw_tick_label(surface, f"{-y_range*1000:.1f}", gx - 2, gy + gh - 5)
        else:
            self._draw_tick_label(surface, f"{y_range:.1f}", gx - 2, gy)
            mid = gy + gh // 2
            self._draw_tick_label(surface, f"{y_range/2:.1f}", gx - 2, mid)
            self._draw_tick_label(surface, "0", gx - 2, gy + gh - 5)

        # X-axis label (time)
        xlbl = self.font.render("time (s)", True, TEXT_GRAY)
        surface.blit(xlbl, (gx + gw - xlbl.get_width() - 4, gy + gh + 2))

        # Trace
        if len(data) < 2:
            return

        points = []
        for i, val in enumerate(data):
            px = gx + int((i / (len(data) - 1)) * gw)
            if center_zero:
                half = gh / 2
                norm = val / y_range if y_range != 0 else 0
                norm = max(-1, min(1, norm))
                py = gy + int(half - norm * (half - 4))
            else:
                norm = val / y_range if y_range != 0 else 0
                norm = max(0, min(1, norm))
                py = gy + gh - 4 - int(norm * (gh - 8))
            points.append((px, py))

        if len(points) >= 2:
            pygame.draw.lines(surface, color, False, points, 2)

    def _draw_tick_label(self, surface, text, x, y):
        """Draw a small Y-axis tick label right-aligned to x."""
        lbl = self.font.render(text, True, TEXT_GRAY)
        lbl_rect = lbl.get_rect(right=x, centery=y)
        surface.blit(lbl, lbl_rect)