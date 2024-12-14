enum Language {
  ENGLISH = 'English',
  KOREAN = 'Korean',
}

enum Phrase {
  NoVideosSaved,
  FirstTimeHere,
  SetupInstructions,
  ClipsDisplayedHere,
  NoClipsSaved,
}

type Translations = {
  [key in Phrase]: string;
};

type LocalizationData = {
  [key in Language]: Translations;
};

const english: Translations = {
  /* eslint-disable prettier/prettier */
  [Phrase.NoVideosSaved]: 'You have no videos saved for this category',
  [Phrase.FirstTimeHere]: 'If it is your first time here, setup instructions can be found at the link below. If you have problems, please use the Discord #help channel to get support.',
  [Phrase.SetupInstructions]: 'Setup Instructions',
  [Phrase.ClipsDisplayedHere]: 'Videos you clip will be displayed here.',
  [Phrase.NoClipsSaved]: 'You have no clips saved',
  /* eslint-enable prettier/prettier */
};

const data: LocalizationData = {
  [Language.ENGLISH]: english,
  [Language.KOREAN]: english,
};

const getLocalePhrase = (lang: Language, phrase: Phrase) => data[lang][phrase];

export { getLocalePhrase, Language, Phrase };
