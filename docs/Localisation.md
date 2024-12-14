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

# How To Add User-Facing Strings 
I've just added localisation support to the client. All users facing text in the application should now be populated via the localisation infrastructure. 

That means no hard coded english user facing strings, unless there is good reason for it. To add a new localised phrase through the you must:
1. Add it to the `Phrase` enum in `src/localisation/types.ts`. For example:
```
enum Phrase {
  ...
  SettingsDisabledText
}
```
2. Add a translation to each language the client supports (see `src/localisation/english.ts` for example). This is well typed, so you should see warnings if you miss this. For example:
```
  ...
  [Phrase.SettingsDisabledText]: 'Invalid retail log path.',
```

3. In the appropriate component where you want to display the phrase, render it using the `getLocalPhrase(language, phrase)` function. For example:
```
<TextBanner>
  {getLocalePhrase(appState.language, Phrase.SettingsDisabledText)}
</TextBanner>
```
Obviously this doesn't apply to anything internal. That should all remain in english.