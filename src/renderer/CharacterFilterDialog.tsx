import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Dispatch, ReactNode, SetStateAction, useState } from 'react';
import {
  AppState,
  Character,
  CharacterFilter,
  RendererVideo,
} from 'main/types';
import Separator from './components/Separator/Separator';
import { Box } from '@mui/material';
import {
  formatRealmNameForDisplay,
  getSpecClass,
  getWoWClassColor,
} from './rendererutils';
import { specImages } from './images';
import { Input } from './components/Input/Input';
import { Button } from './components/Button/Button';
import { Info, Plus } from 'lucide-react';
import { Tooltip } from './components/Tooltip/Tooltip';
import { ConfigurationSchema } from 'config/configSchema';
import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';

type IProps = {
  children: ReactNode;
  appState: AppState;
  videoState: RendererVideo[];
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
};

const CharacterFilterDialog = (props: IProps) => {
  const { children, appState, videoState, config, setConfig } = props;
  const { language } = appState;

  const [open, setOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualRealm, setManualRealm] = useState('');

  const set = new Set(
    config.characterUploadFilters.map((f) => `${f.name}-${f.realm}`),
  );

  const suggestions = videoState
    .filter((rv) => !rv.cloud)
    .map((rv) => rv.player)
    .filter((rc) => rc !== undefined)
    .filter((rc) => rc._name && rc._realm && rc._specID)
    .filter((rc) => rc._name != 'WCR Multipov Name')
    .filter((rc) => !set.has(`${rc._name}-${rc._realm}`))
    .map((rc) => ({
      name: rc._name,
      realm: rc._realm,
      specID: rc._specID,
    })) as Character[];

  const unique = Array.from(
    new Map(suggestions.map((s) => [`${s.name}-${s.realm}`, s])).values(),
  ).slice(0, 12); // Limit to 12 suggestions;

  const renderRaidFrame = (character: Character) => {
    if (!character.name || !character.realm || !character.specID) {
      // We already filtered for this so just keep typescript right.
      return <></>;
    }

    const playerClass = getSpecClass(character.specID);
    const classColor = getWoWClassColor(playerClass);
    const specIcon = specImages[character.specID as keyof typeof specImages];

    return (
      <div
        className={`h-[50px] cursor-pointer`}
        key={character.name + character.realm}
        onClick={() => applyAutoFilter(character)}
      >
        <Box
          sx={{
            display: 'flex',
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: classColor,
            border: '1px solid black',
            boxSizing: 'border-box',
            borderRadius: '2px',
            height: '100%',
            width: '100%',
          }}
        >
          <Box
            key={character.name + character.realm}
            component="img"
            src={specIcon}
            sx={{
              display: 'flex',
              position: 'absolute',
              height: '15px',
              width: '15px',
              top: '2px',
              left: '2px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          />
          <div className="grid justify-items-center font-sans text-black font-bold leading-snug">
            <p className="text-[10px] truncate">{character.name}</p>
            <p className="text-[8px] truncate">
              {formatRealmNameForDisplay(character.realm)}
            </p>
          </div>
        </Box>
      </div>
    );
  };

  const fieldsValid = manualName.length > 0 && manualRealm.length > 0;

  const applyAutoFilter = (character: Character) => {
    const filter: CharacterFilter = {
      name: character.name,
      realm: character.realm,
    };

    setConfig((prevState) => ({
      ...prevState,
      characterUploadFilters: [...prevState.characterUploadFilters, filter],
    }));

    setOpen(false);
  };

  const applyManualFilter = () => {
    const filter: CharacterFilter = {
      name: manualName,
      realm: manualRealm,
    };

    setConfig((prevState) => ({
      ...prevState,
      characterUploadFilters: [...prevState.characterUploadFilters, filter],
    }));

    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        setManualName('');
        setManualRealm('');
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.CharacterFilterAdd)}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          {getLocalePhrase(language, Phrase.CharacterFilterSelectFromRecent)}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {unique.map(renderRaidFrame)}
        </div>
        <Separator />
        <div className="flex">
          <p className="text-sm text-foreground">
            {getLocalePhrase(language, Phrase.CharacterFilterAddManual)}
          </p>
          <Tooltip
            content={
              "Realm name must match combat log format, e.g. 'TwistingNether' not 'Twisting Nether'."
            }
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fieldsValid) applyManualFilter();
          }}
          className="grid grid-cols-[1fr_1fr_auto] gap-2"
        >
          <Input
            placeholder="Character Name"
            value={manualName}
            onChange={(e) => {
              const value = e.target.value.replace(/[\s\d]/g, ''); // No numbers or spaces.
              const formatted =
                value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); // First character capital, rest lowercase.
              setManualName(formatted);
            }}
          />
          <Input
            placeholder="Realm Name"
            value={manualRealm}
            onChange={(e) => {
              const value = e.target.value.replace(/[\s]/g, ''); // No spaces.
              const formatted = value.charAt(0).toUpperCase() + value.slice(1); // First character capital.
              setManualRealm(formatted);
            }}
          />
          <Button size="icon" disabled={!fieldsValid} type="submit">
            <Plus />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CharacterFilterDialog;
