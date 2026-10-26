---
name: GhostQ
description: An AI ghostwriter that knows your next crowd, with a receipt on every line.
colors:
  graphite: "oklch(0.2 0.012 250)"
  paper: "oklch(0.96 0.003 250)"
  card-white: "#ffffff"
  signal-lime: "oklch(0.9 0.19 115)"
  signal-ink: "oklch(0.26 0.06 115)"
  muted-mist: "oklch(0.92 0.004 250)"
  muted-ink: "oklch(0.45 0.012 250)"
  hairline: "oklch(0.86 0.006 250)"
  destructive: "oklch(0.55 0.19 25)"
  destructive-soft: "oklch(0.94 0.03 25)"
  warning: "oklch(0.93 0.09 90)"
  night: "oklch(0.15 0.01 250)"
  night-card: "oklch(0.2 0.01 250)"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(32px, 5vw, 56px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(26px, 4vw, 36px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  lyric:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "Red Hat Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.06em"
  readout:
    fontFamily: "Geist Pixel, Red Hat Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
rounded:
  chip: "999px"
  md: "10px"
  card: "12px"
spacing:
  page-x-phone: "16px"
  page-x-tablet: "32px"
  page-x-desktop: "48px"
  card-pad: "18px"
components:
  button-primary:
    backgroundColor: "{colors.signal-lime}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.chip}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.chip}"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.card}"
    padding: "18px"
  receipt-chip-qloo:
    backgroundColor: "{colors.signal-lime}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.chip}"
    height: "24px"
  receipt-chip-derived:
    backgroundColor: "{colors.muted-mist}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
    height: "24px"
  qplayer-bar:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    height: "48px"
---

# Design System: GhostQ

## Overview

**Creative North Star: "The Crowd Receipt"**

GhostQ looks like a working tool for songwriters that prints its evidence. A cool graphite-on-paper surface carries everything; one electric lime is reserved for the taste signal Qloo reads from a crowd, so wherever lime appears, data is speaking. Song sheets read like annotated chord charts, each line tagged with small receipt chips that open the signal behind it.

The system is calm and dense rather than decorative: pill-shaped controls, white cards on a pale cool-grey page, hairline borders, no shadows at rest. Character comes from three type voices with fixed jobs: Hanken Grotesk for reading, Red Hat Mono for chords and data, and Geist Pixel for standalone readouts (times, counts, section names). The 3×3 crowd-grid mark (eight dots, a lit centre, a lit tail that makes the Q) is the brand's signature and the Ghost agent's face.

The source of truth is the Claude Design project "GhostQ Design System" (direction 1b, graphite and lime); the app ports it 1:1. Dark mode follows the system and inverts surfaces while lime stays constant.

**Key Characteristics:**
- Graphite and paper neutrals; lime only for Qloo's signal and the primary play/sing action.
- Pills for every control and chip; 12 px cards; hairline borders; flat surfaces.
- Three type voices with strict jobs; pixel type never sets lyrics or body copy.
- Receipts everywhere: every line, brief and step cites its source.

## Colors

A cool, nearly achromatic graphite-and-paper palette with a single saturated lime signal.

### Primary
- **Signal Lime** (oklch(0.9 0.19 115)): Qloo's taste signal (receipt chips from Qloo, crowd bars, FROM QLOO tags) and the primary action (Sing it, play). Text on it is Signal Ink.

### Neutral
- **Graphite** (oklch(0.2 0.012 250)): text, the secondary button, the QPlayer bar, active (pinned) chips.
- **Paper** (oklch(0.96 0.003 250)): the page.
- **Card White** (#ffffff): cards, popovers, inputs.
- **Muted Mist** (oklch(0.92 0.004 250)) and **Muted Ink** (oklch(0.45 0.012 250)): derived (non-Qloo) chips, tracks, secondary text.
- **Hairline** (oklch(0.86 0.006 250)): borders and dividers.
- **Night / Night Card** (oklch(0.15 0.01 250) / oklch(0.2 0.01 250)): the dark theme's page and cards.

### Named Rules
**The Lime Means Qloo Rule.** Lime marks Qloo's data (and the one primary action). Data from GhostQ, MusicBrainz, Wikipedia or Spotify is never lime; it sits on Muted Mist or in graphite outline.

**The Readable Lime Rule.** Lime text only on graphite or dark ink; lime chips carry Signal Ink text. Never lime on paper or light foreground.

## Typography

**Display Font:** Hanken Grotesk (with system-ui)
**Body Font:** Hanken Grotesk
**Label/Mono Font:** Red Hat Mono; readouts in Geist Pixel (Circle, Square, Grid cuts via the ELSH axis)

**Character:** A plain, slightly tight grotesk for reading, a technical mono for chords and labels, and a pixel face that makes data feel like a readout.

### Hierarchy
- **Display** (600, clamp(32px, 5vw, 56px), 1, −0.045em): page heroes.
- **Headline** (600, clamp(26px, 4vw, 36px), 1.05, −0.035em): song titles.
- **Title** (600, 15px): card and section titles.
- **Body** (400, 15px, 1.5): descriptions; secondary copy 12–13px in Muted Ink.
- **Lyric** (500, 17px, 1.35): sung lines, with chords above in Red Hat Mono 13px semibold.
- **Label** (Red Hat Mono 10–11px, uppercase, 0.06em): tags like WATERMARKED · LYRIA, SUNG, MELODY.

### Named Rules
**The Pixel Job Rule.** Geist Pixel is for standalone readouts only, 13px and up (Grid 20px and up): Circle = Qloo data, Square = agent work and counts, Grid = song structure. Never lyrics or body text.

## Layout

Centered pages up to 1200px with a gutter of 16px (phone), 32px (from 640px) and 48px (from 1100px). The song page is a sheet plus a 380px rail from 1100px; below that the rail stacks. Cards pad 18px; stacks use 12–20px gaps. Mobile is a first-class target (390px), as are 768px and 1440px.

## Elevation & Depth

Flat. Depth comes from tonal layering (paper page, white cards, hairline borders), not shadows. The only shadows are on floating layers (popovers, the side sheet).

**The Flat Card Rule.** Cards never cast shadows at rest; separation is a 1px hairline on a tonal step.

## Shapes

Everything interactive is a pill (999px): buttons, chips, toggles, inputs, badges. Cards and panels are 12px; inner boxes 10px. The crowd-grid mark is circles on a 3×3 grid with one rotated rounded tail.

## Components

### Buttons
- **Shape:** pill (999px).
- **Primary:** Signal Lime with Signal Ink text, 44px for Sing it and play.
- **Secondary:** Graphite with white text; **Outline:** white with hairline border; **Ghost:** text only.
- **Focus:** a 2px outline in the text colour, offset 2px, on every control.

### Chips (receipts)
- **Qloo:** Signal Lime with Signal Ink, glyph + mono id (T5, C1); **derived:** Muted Mist.
- **Active (hovered/pinned):** Signal Ink background with lime text (Qloo) or graphite with paper text.

### Cards / Containers
- **Corner Style:** 12px; **Background:** Card White (Night Card in dark); **Border:** hairline; **Padding:** 18px.

### Inputs / Fields
- **Style:** white pill, hairline stroke, 44–52px tall; artist fields show the Spotify pick inside the pill.

### Navigation
- **Header:** the lockup left, Write · Library · How it works as pills right (active on Muted Mist); a sheet menu on phones.
- **QPlayer:** a 48px graphite bar under the header with the lime play button.

### The Ghost (signature)
The agent's face is the crowd-grid mark: at rest (lime centre and tail), working (dots light in turn, no tail), or muted (empty grid). It tags the agent's notes, steps and suggestions.

## Do's and Don'ts

### Do:
- **Do** cite a source for every data point on screen (receipt chip, source tag, step).
- **Do** keep the draft label ("GhostQ draft for <artist>, AI-generated, not affiliated with <artist>") on every song surface.
- **Do** use pills for every control and the 2px foreground focus outline.

### Don't:
- **Don't** use lime for non-Qloo data or as decoration.
- **Don't** set lyrics or body copy in Geist Pixel.
- **Don't** use text glyphs (▸ → ✓) as icons; use the brand glyphs or Lucide.
- **Don't** add shadows to cards at rest.
