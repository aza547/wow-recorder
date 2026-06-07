import { getLocalePhrase } from 'localisation/translations';
import { Phrase, Language } from 'localisation/phrases';
import { AppState } from 'main/types';
import {
  Dispatch,
  MouseEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import Datepicker, { DateValueType } from 'react-tailwindcss-datepicker';

interface IProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
}

const DateRangePicker = (props: IProps) => {
  const { appState, setAppState } = props;
  const { dateRangeFilter } = appState;
  const containerRef = useRef<HTMLDivElement>(null);
  const closeAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  const clearCloseAnimationTimeout = useCallback(() => {
    if (closeAnimationTimeout.current) {
      clearTimeout(closeAnimationTimeout.current);
      closeAnimationTimeout.current = null;
    }
  }, []);

  const getDatepickerElements = useCallback(() => {
    const datepicker = containerRef.current?.querySelector<HTMLElement>(
      '.tailwind-datepicker',
    );
    const input = datepicker?.querySelector<HTMLInputElement>(':scope > input');
    const toggle =
      datepicker?.querySelector<HTMLButtonElement>(':scope > button');
    const popup = datepicker?.querySelector<HTMLElement>(
      ':scope > div:last-child',
    );
    const arrow =
      popup?.firstElementChild instanceof HTMLElement
        ? popup.firstElementChild
        : null;

    return {
      input,
      toggle,
      popup,
      arrow,
    };
  }, []);

  const closeDatepicker = useCallback(() => {
    const { popup, arrow } = getDatepickerElements();

    if (!popup?.classList.contains('block') || !arrow) {
      return false;
    }

    clearCloseAnimationTimeout();

    // The bundled datepicker does not expose its close handler, so mirror the
    // library's class-based hide animation until the upstream fix is released.
    popup.classList.remove('block', 'translate-y-0', 'opacity-1');
    popup.classList.add('translate-y-4', 'opacity-0');

    closeAnimationTimeout.current = setTimeout(() => {
      popup.classList.remove('bottom-full');
      popup.classList.add('hidden', 'mb-2.5', 'mt-2.5');
      arrow.classList.remove('-bottom-2', 'border-r', 'border-b');
      arrow.classList.add('border-l', 'border-t');
      closeAnimationTimeout.current = null;
    }, 300);

    return true;
  }, [clearCloseAnimationTimeout, getDatepickerElements]);

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const { input, toggle } = getDatepickerElements();
      const isInput = target === input;
      const isToggle = Boolean(toggle?.contains(target));

      if ((isInput || isToggle) && closeDatepicker()) {
        event.preventDefault();
        event.stopPropagation();
        input?.blur();
      }
    },
    [closeDatepicker, getDatepickerElements],
  );

  useEffect(() => {
    const handleEscapeKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !closeDatepicker()) {
        return;
      }

      event.preventDefault();
      getDatepickerElements().input?.blur();
    };

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [closeDatepicker, getDatepickerElements]);

  useEffect(() => clearCloseAnimationTimeout, [clearCloseAnimationTimeout]);

  return (
    <div ref={containerRef} onMouseDownCapture={handleMouseDown}>
      <Datepicker
        key={appState.language}
        value={dateRangeFilter}
        onChange={onChange}
        separator={getLocalePhrase(
          appState.language,
          Phrase.DateFilterSeparator,
        )}
        displayFormat={format}
        showShortcuts
        showFooter
        primaryColor="red"
        containerClassName="relative tailwind-datepicker" // See App.css for tailwind overrides. This library doesn't expose much.
        inputClassName="relative transition-all duration-300 h-[38px] pl-4 pr-14 w-full border border-background bg-card text-foreground placeholder:text-foreground rounded-lg text-sm placeholder:text-sm"
        i18n={i18n}
        configs={configs}
      />
    </div>
  );
};

export default DateRangePicker;
