# Zeno Design System

> A unified design language for Zeno's marketing website and product interface.

## Design Principles

### 1. Clarity Over Cleverness
Every element serves a purpose. We favor straightforward communication over decorative complexity.

### 2. Trust Through Restraint
A clean, uncluttered interface signals professionalism. White space is a feature, not empty space.

### 3. Warmth Without Whimsy
Approachable and human, but never unprofessional. We're a tool people rely on for work.

### 4. Consistent, Not Uniform
Marketing can be more expressive; product stays utilitarian. Both share the same DNA.

---

## Color System

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#2563EB` | Primary actions, links, key UI elements |
| `--color-primary-hover` | `#1D4ED8` | Primary hover states |
| `--color-primary-light` | `#DBEAFE` | Primary backgrounds, highlights |
| `--color-accent` | `#0D9488` | Secondary actions, success states, data viz |
| `--color-accent-hover` | `#0F766E` | Accent hover states |
| `--color-accent-light` | `#CCFBF1` | Accent backgrounds |

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-white` | `#FFFFFF` | Page backgrounds, cards |
| `--color-gray-50` | `#F9FAFB` | Subtle backgrounds, alternating rows |
| `--color-gray-100` | `#F3F4F6` | Borders, dividers, input backgrounds |
| `--color-gray-200` | `#E5E7EB` | Stronger borders |
| `--color-gray-300` | `#D1D5DB` | Disabled states |
| `--color-gray-400` | `#9CA3AF` | Placeholder text |
| `--color-gray-500` | `#6B7280` | Secondary text |
| `--color-gray-600` | `#4B5563` | Body text |
| `--color-gray-700` | `#374151` | Strong body text |
| `--color-gray-800` | `#1F2937` | Headings |
| `--color-gray-900` | `#111827` | Primary headings, high emphasis |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#059669` | Success messages, positive states |
| `--color-success-light` | `#D1FAE5` | Success backgrounds |
| `--color-warning` | `#D97706` | Warnings, attention needed |
| `--color-warning-light` | `#FEF3C7` | Warning backgrounds |
| `--color-error` | `#DC2626` | Errors, destructive actions |
| `--color-error-light` | `#FEE2E2` | Error backgrounds |

### Background Strategy

**No dark backgrounds.** All surfaces use light values:
- Primary surfaces: `#FFFFFF`
- Secondary surfaces: `#F9FAFB`
- Tertiary/cards on gray: `#FFFFFF` with subtle shadow

---

## Typography

### Font Stack

```css
--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', 'Consolas', monospace;
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display` | 56px / 3.5rem | 700 | 1.1 | Hero headlines (marketing) |
| `h1` | 40px / 2.5rem | 700 | 1.2 | Page titles |
| `h2` | 32px / 2rem | 600 | 1.25 | Section headers |
| `h3` | 24px / 1.5rem | 600 | 1.3 | Subsection headers |
| `h4` | 20px / 1.25rem | 600 | 1.4 | Card titles |
| `body-lg` | 18px / 1.125rem | 400 | 1.6 | Lead paragraphs |
| `body` | 16px / 1rem | 400 | 1.6 | Default body text |
| `body-sm` | 14px / 0.875rem | 400 | 1.5 | Secondary text, captions |
| `caption` | 12px / 0.75rem | 500 | 1.4 | Labels, metadata |

### Type Usage Guidelines

- **Headings**: Gray-900 for primary, Gray-700 for secondary
- **Body**: Gray-600 for standard, Gray-500 for secondary
- **Links**: Primary blue, underline on hover
- **Letter spacing**: -0.02em for display/h1, normal elsewhere

---

## Spacing System

Based on 4px grid with an 8px base unit.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, icon padding |
| `--space-2` | 8px | Compact elements |
| `--space-3` | 12px | Default element spacing |
| `--space-4` | 16px | Standard gap |
| `--space-5` | 20px | Comfortable spacing |
| `--space-6` | 24px | Section padding (small) |
| `--space-8` | 32px | Section gaps |
| `--space-10` | 40px | Large section padding |
| `--space-12` | 48px | Section padding |
| `--space-16` | 64px | Marketing section gaps |
| `--space-20` | 80px | Large marketing sections |
| `--space-24` | 96px | Hero sections |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small elements, tags |
| `--radius-md` | 8px | Buttons, inputs, small cards |
| `--radius-lg` | 12px | Cards, modals |
| `--radius-xl` | 16px | Large cards, marketing elements |
| `--radius-2xl` | 24px | Hero elements, feature cards |
| `--radius-full` | 9999px | Pills, avatars |

---

## Shadows

Light, subtle shadows that don't compete with content:

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Cards, buttons |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)` | Elevated cards |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)` | Dropdowns, modals |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)` | Marketing highlights |

---

## Layout

### Container Widths

| Token | Value | Usage |
|-------|-------|-------|
| `--container-sm` | 640px | Narrow content, auth pages |
| `--container-md` | 768px | Blog posts, focused content |
| `--container-lg` | 1024px | Standard content |
| `--container-xl` | 1280px | Wide content, dashboards |
| `--container-2xl` | 1440px | Marketing sections |

### Grid

- 12-column grid for marketing
- Flexible grid for product
- 24px gutter on mobile, 32px on desktop

---

## Components

### Buttons

**Primary Button**
- Background: `--color-primary`
- Text: White
- Padding: 12px 24px
- Border radius: `--radius-md`
- Font weight: 500
- Hover: `--color-primary-hover`
- Shadow: `--shadow-sm` on hover

**Secondary Button**
- Background: White
- Border: 1px solid `--color-gray-200`
- Text: `--color-gray-700`
- Hover: Background `--color-gray-50`

**Ghost Button**
- Background: Transparent
- Text: `--color-gray-600`
- Hover: Background `--color-gray-100`

**Sizes**
| Size | Padding | Font Size |
|------|---------|-----------|
| sm | 8px 16px | 14px |
| md | 12px 24px | 16px |
| lg | 16px 32px | 18px |

### Cards

**Standard Card**
- Background: White
- Border: 1px solid `--color-gray-100`
- Border radius: `--radius-lg`
- Padding: 24px
- Hover (interactive): `--shadow-md`

**Feature Card (Marketing)**
- Background: White
- Border radius: `--radius-xl`
- Padding: 32px
- Shadow: `--shadow-sm`
- Hover: `--shadow-lg`, subtle y-translate

### Inputs

- Background: White
- Border: 1px solid `--color-gray-200`
- Border radius: `--radius-md`
- Padding: 12px 16px
- Focus: Border `--color-primary`, ring `--color-primary-light`

### Navigation

**Marketing Nav**
- Background: White with subtle backdrop blur
- Height: 64px
- Logo left, links center, CTA right
- Sticky on scroll

**Product Nav**
- Background: White
- Height: 56px
- Simpler, more utilitarian

---

## Marketing Design System

### Hero Section
- Large display text (56px)
- Centered layout
- Primary CTA + Secondary CTA
- Subtle gradient or illustration background (light tones only)
- Generous padding: 96px+ vertical

### Feature Sections
- Alternating layout (image left/right)
- 3-column grid for feature cards
- Icons in primary or accent color
- Light gray background alternating with white

### Social Proof
- Logo bar (grayscale, 50% opacity, full on hover)
- Testimonial cards with avatar, quote, attribution
- Metrics with large numbers

### Footer
- Multi-column layout
- Light gray background (`--color-gray-50`)
- Organized link groups

---

## Product Design System

### Philosophy
The product interface should feel like a professional tool:
- Minimal chrome, maximum canvas
- Data and content take priority
- Neutral colors for UI, color reserved for data

### Dashboard Layout
- Collapsible sidebar (240px expanded)
- Top bar with breadcrumbs and actions
- Main content area with card-based widgets

### Data Visualization
Primary palette for charts:
```
#2563EB (Primary Blue)
#0D9488 (Teal)
#8B5CF6 (Purple)
#F59E0B (Amber)
#EF4444 (Red)
#10B981 (Green)
```

### Empty States
- Centered content
- Subtle illustration or icon
- Clear action button

### Loading States
- Skeleton screens over spinners
- Subtle pulse animation

---

## Animation

### Timing
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 100ms | Micro-interactions |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-slow` | 300ms | Page transitions, modals |

### Easing
```css
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Principles
- Subtle over dramatic
- Purpose-driven (guide attention, confirm actions)
- No animation for animation's sake

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Focus states visible and consistent
- Touch targets minimum 44x44px
- Reduced motion support via `prefers-reduced-motion`

---

## File Organization

```
src/
├── styles/
│   └── design-tokens.css    # CSS custom properties
├── components/
│   ├── ui/                  # Shared UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── marketing/           # Marketing-specific components
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── FeatureCard.tsx
│   │   └── Footer.tsx
│   └── product/             # Product-specific components
│       └── ...
```

---

## Quick Reference

### Do
- Use white and light grays for backgrounds
- Keep interactions subtle and purposeful
- Maintain generous whitespace
- Use color intentionally (primary for actions, semantic for states)

### Don't
- Use dark backgrounds
- Overuse shadows or gradients
- Add decorative elements without purpose
- Use more than 2-3 colors in a single view
