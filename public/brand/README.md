# Zeno Brand Assets

## Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Electric Blue** | `#0055FF` | Primary brand, marketing, buttons |
| **Dark** | `#0D1327` | Text, dark backgrounds |
| **White** | `#FFFFFF` | Light backgrounds, inverted text |
| **Product Blue** | `#2563EB` | Dashboard UI (calmer for daily use) |

---

## Full Logo (`zeno.`)

| File | Description | Use Case |
|------|-------------|----------|
| `logo-primary.svg` | Dark text, blue dot | Light backgrounds (default) |
| `logo-inverted.svg` | White text, blue dot | Dark backgrounds |
| `logo-branded.svg` | Blue bg, all white | Social headers, presentations |
| `logo-mono-dark.svg` | All dark | Single-color print on light |
| `logo-mono-light.svg` | All white | Single-color print on dark |

---

## Z Mark (Icon)

| File | Description | Use Case |
|------|-------------|----------|
| `mark-primary.svg` | Dark Z on transparent | Light backgrounds |
| `mark-inverted.svg` | White Z on transparent | Dark backgrounds |
| `mark-branded.svg` | Blue bg, white Z | LinkedIn, social media, app icon |
| `mark-branded-alt.svg` | Dark bg, white Z | Alternative social option |

---

## Favicon & Social

| File | Size | Use Case |
|------|------|----------|
| `../favicon.svg` | 32x32 | Browser favicon |
| `../social/linkedin-square.svg` | 400x400 | LinkedIn profile picture |
| `../social/og-image.svg` | 1200x630 | Link preview (Open Graph) |

---

## Converting to PNG

To convert SVGs to PNG for platforms that don't support SVG:

### Using Inkscape (CLI)
```bash
inkscape -w 512 -h 512 mark-branded.svg -o mark-branded-512.png
```

### Using ImageMagick
```bash
convert -background none -resize 512x512 mark-branded.svg mark-branded-512.png
```

### Using online tools
- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [SVG to PNG](https://svgtopng.com/)

---

## Recommended Export Sizes

| Platform | Size | Asset |
|----------|------|-------|
| Favicon | 32x32, 16x16 | `favicon.svg` |
| Apple Touch Icon | 180x180 | `mark-branded.svg` |
| Android Chrome | 192x192, 512x512 | `mark-branded.svg` |
| LinkedIn Profile | 400x400 | `linkedin-square.svg` |
| Twitter Profile | 400x400 | `linkedin-square.svg` |
| OG Image | 1200x630 | `og-image.svg` |
