# Fortale UI i18n Coverage Audit

Date: 2026-06-30

## Scope

- Production generation flow and Cloud Functions were not changed.
- UI localization coverage was tightened on the client side.
- No Google Translate API or external translation API was used.

## Changes

- Added `data/uiTranslationSupplements.ts` as a synchronous local supplement dictionary for all supported app languages:
  - `ar`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `nl`, `no`, `pl`, `pt-BR`, `sv`, `th`, `tr`.
- Wired the supplement dictionary into `i18n/uiI18n.tsx` before generated async dictionaries, so critical UI text translates on first render.
- Localized visible and accessibility text in:
  - `views/CommunityView.tsx`
  - `views/ExploreView.tsx`
  - `views/AIChatView.tsx`
  - `views/CourseFlowView.tsx`
  - `components/BottomNav.tsx`
- Added `scripts/i18n/check-ui-i18n.mjs` to scan JSX text and common UI attributes for untranslated raw UI strings.
- Added npm scripts:
  - `npm run i18n:check`
  - `npm run i18n:check:strict`

## Verification

- `npm run i18n:check`
  - Result: `i18n raw UI findings: 0`
- `npm run build`
  - Result: success

## Notes

- Brand names and symbolic UI labels such as `Fortale`, `Google`, `Apple`, `Aa`, and `© Fortale` are intentionally not translated.
- Book titles, user-generated book content, creator names, and externally stored content are not forced through UI translation because they are content, not application chrome.
