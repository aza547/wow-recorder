import { VideoCategory } from '../types/VideoCategory';
import { Language, LocalizationDataType, Phrase } from './types';
import EnglishTranslations from './english';
import KoreanTranslations from './korean';
import GermanTranslations from './german';
import ChineseSimplifiedTranslations from './chineseSimplified';

const data: LocalizationDataType = {
  [Language.ENGLISH]: EnglishTranslations,
  [Language.KOREAN]: KoreanTranslations,
  [Language.GERMAN]: GermanTranslations,
  [Language.CHINESE_SIMPLIFIED]: ChineseSimplifiedTranslations,
};

const getLocalePhrase = (lang: Language, phrase: Phrase) => data[lang][phrase];

const getLocaleCategoryLabel = (
  lang: Language,
  videoCategory: VideoCategory,
) => {
  switch (videoCategory) {
    case VideoCategory.TwoVTwo:
      return getLocalePhrase(lang, Phrase.VideoCategoryTwoVTwoLabel);
    case VideoCategory.ThreeVThree:
      return getLocalePhrase(lang, Phrase.VideoCategoryThreeVThreeLabel);
    case VideoCategory.FiveVFive:
      return getLocalePhrase(lang, Phrase.VideoCategoryFiveVFiveLabel);
    case VideoCategory.Skirmish:
      return getLocalePhrase(lang, Phrase.VideoCategorySkirmishLabel);
    case VideoCategory.SoloShuffle:
      return getLocalePhrase(lang, Phrase.VideoCategorySoloShuffleLabel);
    case VideoCategory.Raids:
      return getLocalePhrase(lang, Phrase.VideoCategoryRaidsLabel);
    case VideoCategory.MythicPlus:
      return getLocalePhrase(lang, Phrase.VideoCategoryMythicPlusLabel);
    case VideoCategory.Battlegrounds:
      return getLocalePhrase(lang, Phrase.VideoCategoryBattlegroundsLabel);
    case VideoCategory.Manual:
      return getLocalePhrase(lang, Phrase.VideoCategoryManualLabel);
    case VideoCategory.Clips:
      return getLocalePhrase(lang, Phrase.VideoCategoryClipsLabel);
    default:
      throw new Error('Unrecognized category');
  }
};

export { getLocalePhrase, getLocaleCategoryLabel, Language, Phrase };
