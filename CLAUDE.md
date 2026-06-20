# Infinite Timeline — Minimal Version

## Purpose
A free, zero-login, client-side web app for entering dated events and viewing a zoomable, 
visual timeline. All data lives in browser memory for the session only.

## Core Features (Implement ALL)
- Manual event entry (date + description)
- Import events from CSV/JSON flat files
- Visual timeline rendering (horizontal axis)
- Zoom in/out functionality (scroll + buttons)
- Density handling: collapse/cluster overlapping events at low zoom, expand at high zoom
- Export event list as CSV
- Export timeline as PNG image

## EXCLUDED (DO NOT IMPLEMENT)
- No AI/LLM integration (no Mistral API)
- No persistence (no localStorage, cookies, database, or server)
- No user accounts/auth
- No filtering, tagging, or collections

## Stack
- Vanilla HTML, CSS, JavaScript (no frameworks/bundlers)
- Canvas or SVG for rendering
