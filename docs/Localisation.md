# How to Add A Language
1. Copy the file `src/localisation/english.ts` to another language e.g. `src/localisation/klingon.ts`.
2. Replace all the strings with the appropriate translation.
3. Add an entry in the `Languages` enum in `src/localisation/types.ts`. For example:

```
enum Language {
  ENGLISH = 'English',
  KOREAN = 'Korean',
  ...
  KLINGON = 'Klingon',
}
```
4. Add an entry to the data variable in `src/localisation/translations.ts` to point to the new translations. For example:

```
import KlingonTranslations from './Klingon';
...

const data: LocalizationDataType = {
  [Language.ENGLISH]: EnglishTranslations,
  [Language.KOREAN]: KoreanTranslations,
  ...
  [Language.KLINGON]: KlingonTranslations,
};
```

5. That's it. You should now be able to select the new language in the settings page.