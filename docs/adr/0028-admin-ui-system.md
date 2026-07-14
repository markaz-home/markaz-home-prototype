# ADR-0028 — Admin UI system (Week 6)

## Status

Accepted (Week 6).

## Context

The portal needs a consistent, accessible, bilingual operations UI without redesigning the
customer experience or scattering one-off styles.

## Decision

A small shared kit (`apps/admin/src/components/admin/`): responsive data-table (semantic
desktop table → mobile record cards; no bulk actions/checkboxes), status badges (text +
icon, never colour-only), an action-dialog shell + reason selector (no hidden default),
notes panel, document panel, global-search combobox, filter tabs + pagination with URL
state, and public/private data sections. Copy is 446 nested `admin.*` i18n keys with exact
EN/AR parity (Arabic draft/unreviewed). a11y: skip link, `aria-current`, semantic tables +
captions, LTR-safe references/amounts, RTL logical properties. Raw enums never render as
text — the client maps them to i18n keys + a semantic tone, with an unknown-value fallback
so a new server enum cannot crash a page.

## Consequences

Pages are thin compositions over the kit; new areas reuse the same primitives. The
enum→tone/key indirection decouples UI from DB enums. Uses the approved dark-blue admin
sidebar from the design foundation.
