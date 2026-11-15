# Design system — extracted from the 3 reference photos

The reference is an **i-CORE admin console** (light theme, dark navy sidebar, red accent).
The new app must reproduce that shell 1:1 and adapt the workspace to a textile CAD tool.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F6F6F4` | app background (warm light grey) |
| `--surface` | `#FFFFFF` | cards, panels |
| `--surface-muted` | `#FAFAF8` | table headers, inert zones |
| `--border` | `#E4E4E1` | 1px hairlines everywhere |
| `--text` | `#14181F` | headings / body |
| `--text-muted` | `#6B7280` | subtitles, meta |
| `--sidebar` | `#16202D` | navigation rail |
| `--sidebar-hover` | `#1E2C3D` | nav hover |
| `--sidebar-active` | `#23364C` | nav active fill |
| `--accent` | `#D92D20` | primary actions, active marker, brand underline |
| `--accent-hover` | `#B42318` | |
| `--success` | `#12B76A` | positive deltas, online |
| `--warning` | `#F79009` | attention |
| `--danger` | `#D92D20` | destructive |
| `--info` | `#2E90FA` | links / info |

Radii: cards `10px`, buttons `8px`, pills `999px`.
Shadow: only `0 1px 2px rgba(16,24,40,.04)` — borders do the separation.
Sidebar width `260px`, collapsed `72px`; topbar height `56px`.
Type: `Inter` (EN) / `Cairo` (AR); base `14px`; KPI number `30px/600`; page title `18px/600`; card title `15px/600`; meta `12px`.

## Shell anatomy (must match the photos)

1. **Sidebar** — dark navy, full height. Brand wordmark top-left in white bold with a short red underline. Nav items: 15px, icon 18px, 10px gap, 40px height, rounded 8px. Active item = lighter navy fill + 3px red bar on the inline-start edge. Section groups separated by generous space; bottom group (Settings/Reports/Help) pushed down. Language selector pinned above the user chip.
2. **Topbar** — white, 1px bottom border, sidebar collapse icon, thin separator, page icon + page title. Right: search, notifications, avatar.
3. **Content** — 24px padding, 16px gap grid, max-width none. Page header row optional.
4. **KPI cards** — white, 1px border, 12px padding; label row (12px muted + small icon) and a pill delta at the far end; big number; two lines of muted micro-stats.
5. **Section cards** — title 15px + muted subtitle 12px; segmented control (Last 30 days / 7 / 3 / 24h / Custom) on the right; body with empty-state centered text; footer action `View All ↗` as an outlined button.
6. **Footer** — small muted center text `Textile CAD Studio`, version on the far end, brand mark on the near end.

## Adaptation to the textile app

- Nav: Overview → Dashboard; Workspace → Studio, Designs; Engineering → Calculations, Yarn Library; bottom → Settings, Help.
- Studio keeps the shell: a left tool rail (icons only, 48px), the canvas card in the centre, and a right inspector card (tabs: Grid / Weave / Color / Repeat). All three are white cards with hairline borders on the warm background.
- The weave canvas uses a white cell base, warp colours, weft colours, and a light grey guide grid; selection/paint states use the red accent at 12% opacity.
- Red is used sparingly: primary buttons, active nav marker, destructive actions, brand underline. Everything else is neutral.
- RTL: the whole shell mirrors (sidebar on the right, red bar on the right edge, chevrons flipped). Use CSS logical properties only.

## Non-negotiables

- No gradients on chrome, no glassmorphism, no huge rounded corners, no emoji as UI icons.
- No mixed Arabic/English on one screen. Every string comes from `i18n`.
- Focus ring: 2px `--accent` at 40% + 2px offset.
- Contrast ≥ WCAG AA.
