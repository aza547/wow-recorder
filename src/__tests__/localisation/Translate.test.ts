import { Flavour, Metadata } from '../../main/types';
import { convertKoreanVideoCategory } from '../../main/util';
import { VideoCategory } from '../../types/VideoCategory';
import KOREAN from '../../localisation/korean';
import ENGLISH from '../../localisation/english';
import {
  getLocaleCategoryLabel,
  getLocalePhrase,
} from '../../localisation/translations';
import { Language, Phrase } from '../../localisation/phrases';

test('English Phrase', () => {
  const phrase = getLocalePhrase(Language.ENGLISH, Phrase.NoVideosSaved);
  expect(phrase).toBe(ENGLISH[Phrase.NoVideosSaved]);
});

test('Korean Phrase', () => {
  const phrase = getLocalePhrase(Language.KOREAN, Phrase.NoVideosSaved);
  expect(phrase).toBe(KOREAN[Phrase.NoVideosSaved]);
});

test('English Category', () => {
  const phrase = getLocaleCategoryLabel(Language.ENGLISH, VideoCategory.Raids);
  expect(phrase).toBe(ENGLISH[Phrase.VideoCategoryRaidsLabel]);
});

test('Korean Category', () => {
  const phrase = getLocaleCategoryLabel(Language.KOREAN, VideoCategory.Raids);
  expect(phrase).toBe(KOREAN[Phrase.VideoCategoryRaidsLabel]);
});

test('Convert Korean Category', () => {
  const metadata: Metadata = {
    category: '레이드' as VideoCategory,
    zoneID: 0,
    zoneName: 'Unknown Raid',
    flavour: Flavour.Retail,
    encounterID: 2922,
    encounterName: 'Queen Ansurek',
    difficultyID: 16,
    difficulty: 'M',
    duration: 307,
    result: false,
    player: {
      _GUID: 'Player-3674-0ACE9152',
      _teamID: 0,
      _specID: 264,
      _name: 'Alextides',
      _realm: 'TwistingNether',
    },
    deaths: [],
    overrun: 0,
    combatants: [],
    start: 1734031729000,
    uniqueHash: 'f0f733f2b4b26d074f0682125f7826f0',
  };

  convertKoreanVideoCategory(metadata);
  expect(metadata.category).toBe(VideoCategory.Raids);
});
