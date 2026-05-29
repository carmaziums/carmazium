# State: Carmazium Mobile App

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-30 — Milestone v1.0 Mobile App started

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** A verified, premium car marketplace where buying and selling is transparent, fast, and cinematic — whether on web or mobile.
**Current focus:** Milestone v1.0 — Mobile App

## Accumulated Context

### What's Built (Scaffold — 2026-05-30)

**Infrastructure (complete):**
- Expo 52 + Expo Router 4 + NativeWind + TanStack Query + Zustand + Socket.IO + Supabase auth
- Design tokens (CZM object), API client layer (8 services), Socket.IO client (3 namespaces)
- Zustand stores: auth.store.ts, auction.store.ts

**UI Atoms (complete):**
- CzButton (5 variants: primary/outline/glass/dark/ghost)
- CzBadge (live/featured/premium/standard/verified/dark, animated pulse on live)
- CzChip, CzPrice (mono font, £ formatted), CzEyebrow, CzScreen, CzTabBar

**Screens (complete):**
- Auth: Onboarding (3-slide gradient), Login (Supabase + Google OAuth), Signup
- Tabs: Home (featured listings + live auctions + body-type browse), Search (filters + sort + results list), Live (auctions with countdown timer, anti-snipe indicator), Saved (watchlist grid), Profile (role-aware links + sign out)
- Detail: Vehicle Detail (image gallery, specs, watchlist, offer/message CTA), Live Auction Room (WebSocket bids, countdown, anti-snipe, bid input), Messages Inbox, Conversation (real-time Socket.IO chat)

### Architecture Decisions Locked

- Auth: Supabase Bearer token → backend SessionAuthGuard (already dual-mode, no changes needed)
- API base: https://carmazium-hjoh9w.fly.dev
- Fonts: @expo-google-fonts/poppins + montserrat + jetbrains-mono
- Real-time: socket.io-client connecting to /auctions, /chat, /notifications namespaces
- State: Zustand for auth + auction live state; TanStack Query for server cache

### Known TODOs / Next Up

- All dashboard screens (buyer, seller, dealer, dealer analytics, dealer leads)
- Sell My Car wizard
- Remaining feature screens (KYC, AI search, Map, Compare, Offers, Purchase)
- Push notifications + preferences
- App store prep (EAS Build)
