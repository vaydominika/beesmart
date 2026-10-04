import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const [source, hungarian] = process.argv.slice(2);
if (!source || !hungarian) {
  console.error('Usage: node scripts/add-translation.mjs "English interface text" "Hungarian translation"');
  process.exit(1);
}
const key = 'm' + createHash('sha1').update(source).digest('hex').slice(0, 12);
const catalogs = await Promise.all(['en', 'hu'].map(async (locale) => {
  const path = new URL(`../messages/${locale}.json`, import.meta.url);
  return {locale, path, messages: JSON.parse(await readFile(path, 'utf8'))};
}));
const existing = catalogs[0].messages.UI[key];
if (existing && existing !== source) throw new Error(`Translation key collision: ${key}`);
for (const {locale, path, messages} of catalogs) {
  messages.UI[key] = locale === 'en' ? source : hungarian;
  messages.UI = Object.fromEntries(Object.entries(messages.UI).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path, JSON.stringify(messages, null, 2) + '\n');
}
console.log(`Saved ${key} in both catalogs.`);
