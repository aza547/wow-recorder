import { getLocalePhrase } from 'localisation/translations';
import { Phrase, Language } from 'localisation/types';
import { AppState } from 'main/types';
import { Dispatch, SetStateAction, useCallback } from 'react';
import Datepicker, { DateValueType } from 'react-tailwindcss-datepicker';

interface IProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
}

const DateRangePicker = (props: IProps) => {
  const { appState, setAppState } = props;
  const { dateRangeFilter } = appState;

  const format =
    appState.language === Language.KOREAN ? 'YY/MM/DD' : 'DD/MM/YY';

  let i18n = 'en';

  if (appState.language === Language.KOREAN) {
    i18n = 'ko';
  } else if (appState.language === Language.GERMAN) {
    i18n = 'de';
  } else if (appState.language === Language.CHINESE_SIMPLIFIED) {
    i18n = 'zh-CN';
  }

  const configs = {
    shortcuts: {
      today: getLocalePhrase(appState.language, Phrase.Today),
      yesterday: getLocalePhrase(appState.language, Phrase.Yesterday),
      past: (period: number) => {
        if (period === 7)
          return getLocalePhrase(appState.language, Phrase.Last7Days);
        if (period === 30)
          return getLocalePhrase(appState.language, Phrase.Last30Days);
        return `Last ${period} days`; // Don't expect to see this.
      },
      currentMonth: getLocalePhrase(appState.language, Phrase.ThisMonth),
      pastMonth: getLocalePhrase(appState.language, Phrase.LastMonth),
    },
    footer: {
      cancel: getLocalePhrase(appState.language, Phrase.Cancel),
      apply: getLocalePhrase(appState.language, Phrase.Apply),
    },
  };

  const onChange = useCallback(
    (v: DateValueType) => {
      // This looks a bit verbose, but it seems the react library
      // used here will provide the same date object if the range
      // is a single day, as well as setting the time to the current
      // time. So make sure that we have separate date objects, set
      // to midnight and a minute to midnight to cover the full day.
      const drf: DateValueType = {
        startDate: null,
        endDate: null,
      };

      if (v && v.startDate) {
        drf.startDate = new Date(v.startDate);
        drf.startDate.setHours(0, 0, 0, 0);
      }
      if (v && v.endDate) {
        drf.endDate = new Date(v.endDate);
        drf.endDate.setHours(23, 59, 59, 999);
      }

      setAppState((prev) => ({
        ...prev,
        dateRangeFilter: drf,
      }));
    },
    [setAppState],
  );

  return (
    <Datepicker
      key={appState.language}
      value={dateRangeFilter}
      onChange={onChange}
      separator={getLocalePhrase(appState.language, Phrase.DateFilterSeparator)}
      displayFormat={format}
      showShortcuts
      showFooter
      primaryColor="red"
      containerClassName="relative tailwind-datepicker" // See App.css for tailwind overrides. This library doesn't expose much.
      inputClassName="relative transition-all duration-300 h-[38px] pl-4 pr-14 w-full border border-background bg-card text-foreground placeholder:text-foreground rounded-lg text-sm placeholder:text-sm"
      i18n={i18n}
      configs={configs}
    />
  );
};

export default DateRangePicker;
