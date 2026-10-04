# English and Hungarian interface

BeeSmart uses next-intl with `en` and `hu` catalogs. URLs stay the same in both languages. A language selector is available on authentication pages and in Settings → Appearance.

The `beesmart-locale` cookie controls server rendering and lasts one year. English is the default. Authenticated settings load the saved account language; changing it updates both the cookie and `User.locale`. The root HTML language and locale-aware dates follow the selected language. Course content, classroom names, and other user-authored text keep their original language.

## Database deployment

Apply the included `20261003160000_add_user_locale` migration before running the updated app:

```sh
npm run db:migrate:deploy
```

Existing accounts receive English as their default. Generating the Prisma client does not apply this migration.

## Adding interface text

Client components use `useText` from `@/i18n/use-text`. Async server components use `await getText()` from `@/i18n/server`.

```tsx
const t = useText();
return <button>{t("Save changes")}</button>;
```

The adapter maps English source copy to stable hash keys in `messages/en.json` and `messages/hu.json`. Register new copy in both catalogs:

```sh
node scripts/add-translation.mjs "Save changes" "Módosítások mentése"
```

Pass dynamic values separately using ICU placeholders, for example `t("Hello, {name}", {name})`. Keep placeholders identical in both translations; next-intl also supports ICU plural messages. Unknown source text falls back to English. Changing English source copy requires registering the new source in both catalogs.

Translate only interface text. Do not pass user-authored content to `t`. `WorkspaceSelect` preserves option labels by default; enable `translateLabels` only for predefined interface options.

Run the catalog and language-switch checks with:

```sh
npm run test:unit -- i18n/text.test.ts components/i18n/LanguageProvider.test.tsx
```

## Dependency compatibility

`@swc/core` is pinned through an npm override to 1.15.21. Newer 1.16 native carriers rejected the Windows cache permissions on the development machine while loading the next-intl plugin. Recheck the build on Windows before removing this override.
