# Translations

English is the source language. Lingui 6 uses the complete English message as its ID, including named placeholders and ICU plurals. Editable catalogs live in `src/locales/{en,es,de}/messages.po`; compiled `messages.ts` files are generated. Edit PO files, never compiled catalogs.

## Choosing a translation strategy

This project uses the runtime APIs from `@lingui/react`, with explicit English IDs (not the macro APIs).

### `Trans`: rendered JSX text

Use `Trans` for visible text, especially sentences containing links, emphasis, or other React elements:

```tsx
import { Trans } from '@lingui/react'

export function Greeting({ name }: { name: string }) {
  return (
    <p>
      <Trans id="Hello, {name}!" values={{ name }} />
    </p>
  )
}
```

For rich text, use numbered tags in the ID and supply the corresponding elements through `components`, for example `<Trans id="Read <0>the terms</0>." components={{ 0: <a href="/terms" /> }} />`. Keep whole sentences together so translators can reorder words and markup. Use ICU plurals for counts, for example `<Trans id="{count, plural, one {# item} other {# items}}" values={{ count }} />`.

`Trans` subscribes to Lingui context itself. A component that only renders `Trans` does **not** need an additional `useLingui()` call.

### `useLingui`: translated strings and reactive reads

Use `useLingui()` when the component needs strings for attributes, props, option labels, validation, or other JavaScript expressions:

```tsx
import { Trans, useLingui } from '@lingui/react'

export function Retry() {
  const { i18n } = useLingui()
  return (
    <button title={i18n._('Try again')}>
      <Trans id="Try again" />
    </button>
  )
}
```

The hook subscribes the component to locale/catalog changes. Importing the shared `i18n` singleton alone does not establish that subscription. This also explains bare `useLingui()` calls whose return value appears unused: they make components re-render when reading lazy translated content from `src/i18n/content.ts` or shared translation helpers. Keep those calls when the component reads translated values during render; a short comment such as `// Subscribe to locale changes for lazy content labels.` makes their purpose clear. The hook is not required in every component or merely because a descendant uses translations.

Recompute translated strings during render instead of capturing them at module scope or only in a state initializer. A re-render does not refresh strings already stored in state, including existing validation errors or toast messages. Language changes should update labels without remounting forms and losing input.

For memoized translations, use the hook's changing `_` function as a dependency; `i18n` itself has a stable reference:

```tsx
const { _ } = useLingui()
const label = useMemo(() => _('Try again'), [_])
```

Outside React, utilities can import `i18n` from `src/i18n/index.ts` and translate when called. The caller must arrange reactivity if their result is displayed. `translate()` in `src/i18n/translate.ts` localizes known server error strings at the display boundary and leaves unknown messages unchanged; preserve original errors for API logic.

See Lingui's [React API and memoization guidance](https://lingui.dev/ref/react) and [lazy translations guide](https://lingui.dev/guides/lazy-translations).

### JSON content, legal text, and stable values

Editable English JSON remains in `content/` and `src/components/@shared/PolicyEditor/editor.json`. Extraction generates lazy bindings in `content.ts` and descriptors in `contentMessages.ts`. Their proxies translate configured display fields when read; consumers still need a locale subscription as described above. Change the original JSON rather than generated bindings.

Legal extraction reads `content/pages/privacy/*/en.md`: title/description front matter, paragraph blocks, and policy names become English IDs in `legalMessages.ts`. Source scanning also generates `sourceMessages.ts` for selected form labels, constants, and internal errors. Do not edit these generated files by hand. If a new kind of display field is missed, update the relevant generator in `scripts/i18n/` and extract again.

Keep field names, API values, routes, asset states, and option values stable; translate their displayed labels. Duration presets and compute wizard step names also serve as internal identifiers. Do not translate user-provided asset content as if it were interface copy.

## Changing the default language

Current locale selection in `Provider.tsx` is: saved `market-locale` cookie, otherwise the browser language's primary subtag, otherwise English. An unsupported saved value falls back to English rather than retrying the browser language. `setLocale()` activates the catalog, updates the document's `lang`, and saves the essential preference cookie for one year, independently of analytics consent. Children render after client locale initialization.

To change the initial/fallback UI language to an already supported locale, update:

1. `i18n.activate('en')` in `src/i18n/index.ts`.
2. The context default, `useState<Locale>('en')`, and unsupported-language fallback in `src/i18n/Provider.tsx`.

For example, replace those locale defaults with `es`. Existing cookies and supported browser preferences still take precedence. To make Spanish the default for all new visitors regardless of browser language, also change the `preferred` selection to use the saved cookie or `es`, instead of `navigator.language`. Clear the `market-locale` cookie when testing a new default.

The UI default and `sourceLocale` are separate concepts. Keep `sourceLocale: 'en'` in `lingui.config.ts` while authoring messages in English; changing the default UI language does not require rewriting message IDs or English legal sources.

## Adding a language

For example, to add French:

1. Add `fr` to `locales` in `lingui.config.ts`.
2. Run `npm run lingui:extract` to create `src/locales/fr/messages.po`, and fill every translation in its `msgstr` fields.
3. Run `npm run lingui:compile` to generate `src/locales/fr/messages.ts`.
4. In `src/i18n/index.ts`, import the French `messages`, add `fr` to the exported `locales` tuple, and include it in `i18n.load({ en, es, de, fr })`. The `Locale` type and `isLocale()` derive from that tuple.
5. Add `<option value="fr" lang="fr">Français</option>` in `LanguageSwitcher.tsx`.
6. Run `npm run lingui:check` and verify switching to French, reloading with its saved cookie, and using a French browser preference. Check long labels, interpolation, plurals, rich text, and retained form input.

All catalogs are imported eagerly. Adding a locale requires both extraction configuration and runtime registration; changing only one does not enable the language throughout the app.

## Fixing or updating translations

```sh
npm run lingui:extract
# Edit src/locales/es/messages.po, src/locales/de/messages.po,
# and any other configured target catalogs.
npm run lingui:compile
npm run lingui:check
```

Find the entry by its English `msgid` and source-reference comments. For a wrong Spanish/German translation, correct that locale's `msgstr` while keeping `msgid` intact. For wrong English copy, edit the original TSX/TS, JSON, or English Markdown source, then extract again. Because English text is the ID, changing it creates a new message: translate the new entry in every target catalog and review the old one for removal.

Preserve placeholder names, rich-text tag numbers, and ICU syntax; translate the words around them. Supply the plural categories required by the target language. Resolve fuzzy entries after reviewing them, including removing the `fuzzy` flag once approved. Strict compilation catches missing translations and invalid messages; it does not assess translation quality. Development (`npm start`) and production builds compile catalogs automatically, but do not run extraction automatically. Restart/recompile after editing PO files, then verify the affected screen in each language.

Review and commit the source changes, generated descriptors/bindings, PO catalogs, and compiled TypeScript catalogs together.

## Detecting and removing unused translations

First extract without cleaning:

```sh
npm run lingui:extract
rg -n '^#~' src/locales --glob '*.po'
```

Lingui marks messages no longer found by extraction as obsolete (`#~`). Review those entries and their original call sites before removing them. Then remove obsolete entries and regenerate compiled catalogs:

```sh
npm run lingui:extract -- --clean
npm run lingui:compile
```

Use the npm wrapper so JSON, legal, and source descriptors are regenerated before Lingui decides which messages are obsolete. Deleting a PO entry while leaving its source or generated descriptor will cause extraction to restore it.

Extraction detects source references, not whether a screen is reachable or a message is ever displayed. The broad source scanner can retain descriptors for constants/errors that are not visible, and dynamic lookups may be missed unless covered by descriptors. Investigate retained entries in the original source and generators; remove obsolete source references rather than editing generated descriptor files. Keep explicit IDs/descriptors for genuinely needed dynamic messages.

`npm run lingui:check` runs the JSX text audit, extraction **with `--clean`**, and strict compilation. It modifies catalogs/generated files; review its diff. The audit detects certain untranslated JSX text, expressions, and display attributes; it is not an unused-message detector or a complete check of runtime-generated text. See the [Lingui CLI reference](https://lingui.dev/ref/cli) for extraction and cleanup options.
