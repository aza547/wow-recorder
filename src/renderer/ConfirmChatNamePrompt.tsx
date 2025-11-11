import { ConfigurationSchema } from 'config/configSchema';
import { Dispatch, SetStateAction } from 'react';
import { setConfigValue } from './useSettings';
import { Button } from './components/Button/Button';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

interface IProps {
  cloudAccountName: string;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  language: Language;
}

/**
 * This component prompts the user to accept the chat name they are logged in
 * as before sending any messages that might self-dox them.
 */
const ConfirmChatNamePrompt = (props: IProps) => {
  const { cloudAccountName, setConfig, language } = props;

  const onConfirmName = () => {
    setConfigValue('chatUserNameAgreed', cloudAccountName);
    setConfig((prev) => ({
      ...prev,
      chatUserNameAgreed: props.cloudAccountName,
    }));
  };

  return (
    <div className="flex h-full m-2 flex-col items-center justify-center text-sm text-foreground gap-y-2 border border-background-dark-gradient-to rounded-sm bg-background-dark-gradient-to">
      <div className="flex flex-col gap-y-2 px-4">
        <p>{getLocalePhrase(language, Phrase.ChatUserText1)}</p>
        {cloudAccountName.includes('@') && (
          <p>
            {getLocalePhrase(language, Phrase.ChatUserText2)}
            <a
              href="https://warcraftrecorder.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-lighter hover:text-[#bb4420]"
            >
              warcraftrecorder.com
            </a>
            {getLocalePhrase(language, Phrase.ChatUserText3)}
          </p>
        )}
      </div>
      <Button
        className="text-xs mt-2"
        onClick={onConfirmName}
        variant="destructive"
      >
        {getLocalePhrase(language, Phrase.ChatUserText4)} {cloudAccountName}!
      </Button>
    </div>
  );
};

export default ConfirmChatNamePrompt;
