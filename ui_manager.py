# ui_manager.py
"""Custom native Pygame UI widgets — Slider, Button, SPDT_Switch.
No external GUI frameworks; all rendered via pygame.draw primitives.
"""

import pygame


# ── Color Palette (Dark Mode) ──────────────────────────────────────
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_RED = (220, 60, 60)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
TRACK_GRAY = (60, 62, 68)
HANDLE_LIGHT = (180, 185, 195)
WIRE_WHITE = (200, 200, 210)
YELLOW_GLOW = (255, 220, 80)


class Slider:
    """Draggable horizontal slider for R or C values.
    Updates value on release; shows tooltip during drag.
    """

    def __init__(self, x, y, width, label, min_val, max_val, initial, fmt=".0f", unit=""):
        self.rect = pygame.Rect(x, y, width, 30)
        self.label = label
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial
        self.fmt = fmt
        self.unit = unit
        self.dragging = False
        # Handle position (circular)
        self.handle_radius = 8
        self.handle_y = y + 15

    @property
    def handle_x(self):
        """Map current value to pixel position."""
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return self.rect.x + int(ratio * self.rect.width)

    def _value_from_x(self, x):
        """Map pixel position to value (clamped)."""
        ratio = max(0, min(1, (x - self.rect.x) / self.rect.width))
        return self.min_val + ratio * (self.max_val - self.min_val)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = event.pos
            # Check if click is on handle
            dx = mx - self.handle_x
            dy = my - self.handle_y
            if dx * dx + dy * dy <= (self.handle_radius + 5) ** 2:
                self.dragging = True
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            if self.dragging:
                self.dragging = False
                self.value = max(self.min_val, min(self.max_val, self.value))
                return True  # value committed
        elif event.type == pygame.MOUSEMOTION:
            if self.dragging:
                self.value = self._value_from_x(event.pos[0])
                self.value = max(self.min_val, min(self.max_val, self.value))
                return True
        return False

    def draw(self, surface, font):
        # Track line
        track_y = self.rect.y + 13
        pygame.draw.line(surface, TRACK_GRAY,
                         (self.rect.x, track_y),
                         (self.rect.x + self.rect.width, track_y), 3)
        # Filled portion (active)
        filled_end = self.handle_x
        if filled_end > self.rect.x:
            pygame.draw.line(surface, ACCENT_CYAN,
                             (self.rect.x, track_y),
                             (filled_end, track_y), 3)
        # Handle
        pygame.draw.circle(surface, HANDLE_LIGHT, (self.handle_x, self.handle_y), self.handle_radius)
        pygame.draw.circle(surface, ACCENT_CYAN, (self.handle_x, self.handle_y), self.handle_radius, 2)
        # Label
        label_surf = font.render(f"{self.label}:", True, TEXT_WHITE)
        surface.blit(label_surf, (self.rect.x, self.rect.y - 18))
        # Value display (right-aligned)
        val_str = f"{self.value:{self.fmt}}{self.unit}"
        val_surf = font.render(val_str, True, ACCENT_CYAN)
        surface.blit(val_surf, (self.rect.x + self.rect.width - val_surf.get_width(), self.rect.y - 18))
        # Tooltip during drag
        if self.dragging:
            tip = font.render(val_str, True, TEXT_WHITE)
            tip_rect = tip.get_rect(midbottom=(self.handle_x, self.handle_y - self.handle_radius - 4))
            pygame.draw.rect(surface, PANEL_DARK, tip_rect.inflate(8, 4), border_radius=3)
            surface.blit(tip, tip_rect)


class Button:
    """Clickable button with label and optional icon."""

    def __init__(self, x, y, width, height, label, color=ACCENT_CYAN, toggle=False):
        self.rect = pygame.Rect(x, y, width, height)
        self.label = label
        self.color = color
        self.toggle = toggle
        self.active = False if toggle else True
        self.pressed = False

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.pressed = True
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            if self.pressed and self.rect.collidepoint(event.pos):
                self.pressed = False
                if self.toggle:
                    self.active = not self.active
                return True  # button was clicked
            self.pressed = False
        return False

    def draw(self, surface, font):
        color = self.color if self.active else TRACK_GRAY
        if self.pressed:
            color = tuple(max(0, c - 40) for c in color)
        pygame.draw.rect(surface, color, self.rect, border_radius=5)
        if not self.active:
            pygame.draw.rect(surface, TEXT_GRAY, self.rect, 2, border_radius=5)
        text = font.render(self.label, True, TEXT_WHITE)
        text_rect = text.get_rect(center=self.rect.center)
        surface.blit(text, text_rect)


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