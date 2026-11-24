---
name: "KebApps Flat-Smussato 2D"
version: "2.2.0"
description: "A premium, mobile-first design system for global Kebab Intelligence. It features solid geometric forms, buttery warm palettes, and tactile non-elastic interactions."

colors:
  background: "#FFFDF7"      # Warm Cream (Pita bread texture)
  surface: "#FFFFFF"         # Pure White for cards
  primary: "#EA580C"         # Toasted Orange (The Spiedo)
  on-primary: "#FFFFFF"
  text-primary: "#1A1A1A"    # Stark Charcoal
  text-muted: "#71717A"      # Zinc-500
  border: "#E5E5E5"          # Neutral-200
  border-accent: "#FED7AA"   # Orange-200 for subtle focus
  danger: "#DC2626"          # Red-600
  success: "#16A34A"         # Green-600

dark-colors:
  background: "hsl(20, 15%, 10%)"      # Warm Charcoal
  surface: "hsl(20, 12%, 14%)"         # Dark Card Surface
  primary: "#EA580C"                   # Toasted Orange (same brand anchor)
  on-primary: "#FFFFFF"
  text-primary: "hsl(30, 10%, 90%)"    # Light Warm Cream
  text-muted: "hsl(20, 10%, 65%)"      # Muted Zinc
  border: "hsl(20, 10%, 22%)"          # Subtle Dark Border
  border-accent: "hsl(24.6, 95%, 48.2%, 0.3)" # Orange ring/focus
  danger: "hsl(0, 70%, 50%)"
  success: "hsl(140, 50%, 80%)"

typography:
  h1:
    fontFamily: "Quicksand"
    fontSize: "2.25rem"
    fontWeight: "900"
    lineHeight: "1.1"
    letterSpacing: "-0.05em"
  h2:
    fontFamily: "Quicksand"
    fontSize: "1.5rem"
    fontWeight: "900"
    lineHeight: "1.2"
    letterSpacing: "-0.02em"
  body-lg:
    fontFamily: "Quicksand"
    fontSize: "1.125rem"
    fontWeight: "500"
    lineHeight: "1.6"
  body-md:
    fontFamily: "Quicksand"
    fontSize: "1rem"
    fontWeight: "500"
    lineHeight: "1.5"
  label-caps:
    fontFamily: "Quicksand"
    fontSize: "0.75rem"
    fontWeight: "900"
    letterSpacing: "0.1em"
    textTransform: "uppercase"

rounded:
  base: "1rem"       # 16px
  lg: "1.5rem"        # 24px
  xl: "2.5rem"        # 40px (for hero/spotlight containers)
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"

shadows:
  flat: "0 1px 2px rgba(0, 0, 0, 0.04)"
  flat-dark: "0 1px 2px rgba(0, 0, 0, 0.2)"
  dropdown: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
  dropdown-dark: "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.06)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    padding: "1rem 2rem"
    rounded: "{rounded.base}"
    border: "none"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-caps}"
    padding: "1rem 2rem"
    rounded: "{rounded.base}"
    border: "1px solid {colors.border}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "#F9FAFB" # Gray-50
    rounded: "{rounded.base}"
    padding: "0.75rem 1rem"
    border: "2px solid transparent"
---

## Overview

**Flat-Smussato 2D** is the geometric evolution of the KebApps visual identity. Moving away from 3D effects and transparency, this system prioritizes **solid fills, high-contrast borders, and tactile responsiveness**. 

The "Smussato" (rounded) philosophy remains central, reflecting the soft curves of a pita roll, while the "Flat" execution ensures lightning-fast performance and visual clarity on mobile devices. It is designed to feel premium yet rugged—like a perfectly toasted kebab.

## Brand & Style

The design intent is to be **Authoritative yet Playful**. 
- **Solid Shapes:** No rainbow or multi-color gradients. Surfaces use solid fills (warm cream in Light mode, warm charcoal in Dark mode).
- **Tonal Linear Gradients:** Allowed exclusively on progress bars (e.g. `bg-gradient-to-r from-primary/80 to-primary` for XP advancement).
- **Geometric Precision:** All layout elements are strictly aligned to a 4px/8px grid.
- **Mobile-First Navigation:** Interactive areas maintain a touch target of at least 44x44px (`size-11 sm:size-10`). A persistent floating bottom bar with safe-area insets (`env(safe-area-inset-bottom)`) and haptic feedback provides quick access to core features.
- **Viewport Clearance & Legal Footer:** All scrollable page views strictly enforce `pb-28` (112px) to prevent bottom dock clipping. `<AppFooter />` provides immediate access to legal notices with mobile bottom clearance (`pb-24 sm:pb-6`) and is automatically hidden on `/map`, where the map viewport stops cleanly above the dock so attribution remains unobstructed.

## Colors & Themes (Light / Dark Mode)

The palette is anchored by **Toasted Orange** (`#EA580C`), representing the heat of the vertical rotisserie.

### Light Mode ("Flat-Smussato Crema")
- **Background:** Warm cream (`#FFFDF7` / `hsl(32 100% 97%)`) to reduce eye strain and provide a "paper-like" tactile quality.
- **Cards & Surfaces:** Pure white (`#FFFFFF`) with 1px `border-border` (`#E5E5E5`).

### Dark Mode ("Flat-Smussato Notturno")
- **Background:** Warm charcoal (`hsl(20 15% 10%)`).
- **Cards & Surfaces:** Rich dark surface (`hsl(20 12% 14%)`) with subtle borders (`hsl(20 10% 22%)`).

### Badge & Status Tokens
All badges (Rating esperienziali, stato Diario/Wishlist, badge personali) use dual-token styling compliant with WCAG AA (e.g., `bg-amber-500/10 text-amber-800 border-amber-300/80` in Light mode and `dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30` in Dark mode).

## Typography

The font **Quicksand** is mandatory for all contexts. 
- **Headings:** Must be `font-black (900)` with `tight tracking`. This makes labels feel like physical stamps or woodblock prints.
- **Body:** Uses `medium (500)` weight for better legibility on mobile screens against warm backgrounds.
- **Readability:** We maintain a base size of `16px` on mobile, scaling to `18px` on desktop.

## Elevation & Depth

We reject the concept of digital "layers" separated by light and shadow. Instead, we use a **Flat Hierarchy**:
- **Level 0 (Base):** Warm Cream background in Light mode / Warm Charcoal in Dark mode.
- **Level 1 (Content):** Cards with a 1px border.
- **Level 2 (Popups/Modals):** Cards with `shadow-dropdown` (Light) / `shadow-dropdown-dark` (Dark) to provide a subtle functional lift.

## Components

### Buttons & Interactions (The "Flat-Press" Principle)
Interaction is tactile and immediate. 
- **Hover State:** Background colors shift slightly (e.g., Orange-600 to Orange-700). No scaling.
- **Active (Click) State:** The element performs a `translateY(1px)` shift. This mimics the physical "click" of a button without elastic "bouncy" feedback.
- **Icons:** We use `lucide-react` vector outlines exclusively. They should never have shadows or 3D effects.

### Cards & Containers
- Cards use a `1.5rem` radius for a friendly, approachable feel.
- Groups of items use a 1px divider or are contained within individual bordered boxes.

### Forms & Inputs
- Inputs are designed with a Gray-50 background (Dark: `hsl(20 10% 18%)`) and a transparent 2px border.
- **Focus State:** The border changes to `border-orange-500` and the background becomes white / dark card. This provides a clear, high-contrast signal of activity.
- Checkboxes and switches use the `primary` orange when active.

### Map Pins, Markers & Attribution
- Shop markers are represented by solid circular icons or the custom Kebab-Marker (`/icons/kebab-marker.svg` e `/icons/kebab-marker-dark.svg`).
- **Personal Pin States (`DynamicShopPin`):**
  - **Visited (in Diary):** emerald ring (`ring-2 ring-emerald-500 bg-emerald-500/15`) and top pill showing the user's personal score (plus bookmark icon if also in Wishlist).
  - **Wishlist:** amber ring (`ring-2 ring-amber-500 bg-amber-500/15`) and bookmark badge.
  - **Unvisited:** default marker without ring.
- **Google Maps Attribution (`GoogleAttribution`):** Light surfaces render `/images/google_on_white.png` and Dark surfaces render `/images/google_on_dark.png` (official Google logo assets, never recreated in custom text/fonts), paired with Google Places UI Kit's native attribution inside `GooglePlaceDetailsWidget`.

## Do's and Don'ts

### Do
- Use `label-caps` (`font-black uppercase tracking-widest text-xs`) for badges and section tags.
- Use solid 1px borders to separate content.
- Align all interactive elements to at least 44x44px on mobile (`size-11 sm:size-10`).
- Use `flat-press` for all primary actions.
- Use `lucide-react` vector icons exclusively.

### Don't
- Use multi-color or heavy radial gradients (only subtle tonal linear gradients on progress bars are permitted).
- Use raw Unicode emoji in statistical metrics, rating displays, or diary summaries.
- Use small font sizes (below 12px) for critical information.
- Use "Bouncy" or elastic animations (keep it solid and physical).