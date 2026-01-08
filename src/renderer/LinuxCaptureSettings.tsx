import React, { Dispatch, SetStateAction } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { RecStatus } from 'main/types';
import { Input } from './components/Input/Input';
import Label from './components/Label/Label';
import { Button } from 'renderer/components/Button/Button';
import { setConfigValues } from './useSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import Switch from './components/Switch/Switch';

const ipc = window.electron.ipcRenderer;

interface Props {
  recorderStatus: RecStatus;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

type GsrAudioDevice = { value: string; label: string };

const LinuxCaptureSettings = ({ recorderStatus, config, setConfig }: Props) => {
  const initialRender = React.useRef(true);
  const [audioDevices, setAudioDevices] = React.useState<{
    inputs: GsrAudioDevice[];
    outputs: GsrAudioDevice[];
  }>({ inputs: [], outputs: [] });

  React.useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsFPS: config.obsFPS,
      captureCursor: config.captureCursor,
      linuxGsrBufferSeconds: config.linuxGsrBufferSeconds,
      linuxGsrCodec: config.linuxGsrCodec,
      linuxGsrBitrateKbps: config.linuxGsrBitrateKbps,
      linuxGsrAudioOutput: config.linuxGsrAudioOutput,
      linuxGsrAudioInput: config.linuxGsrAudioInput,
      linuxGsrReplayStorage: config.linuxGsrReplayStorage,
      linuxGsrLeadInSeconds: config.linuxGsrLeadInSeconds,
    });
  }, [
    config.obsFPS,
    config.captureCursor,
    config.linuxGsrBufferSeconds,
    config.linuxGsrCodec,
    config.linuxGsrBitrateKbps,
    config.linuxGsrAudioOutput,
    config.linuxGsrAudioInput,
    config.linuxGsrReplayStorage,
    config.linuxGsrLeadInSeconds,
  ]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await ipc.getLinuxGsrAudioDevices();
        setAudioDevices(res);
      } catch (e) {
        console.warn('[LinuxCaptureSettings] Failed to load audio devices', e);
        setAudioDevices({
          inputs: [
            {
              value: 'default_input',
              label: 'default_input — Default input device',
            },
          ],
          outputs: [
            {
              value: 'default_output',
              label: 'default_output — Default output device',
            },
          ],
        });
      }
    };

    load();
  }, []);

  const setNumber =
    (key: keyof ConfigurationSchema) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      setConfig((prev) => ({
        ...prev,
        [key]: Number.isFinite(value) ? value : 0,
      }));
    };

  const setString = (key: keyof ConfigurationSchema) => (value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const setBool = (key: keyof ConfigurationSchema) => (checked: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: checked }));
  };

  const captureRunning =
    recorderStatus === RecStatus.ReadyToRecord ||
    recorderStatus === RecStatus.Recording ||
    recorderStatus === RecStatus.Overrunning;

  const restartCapture = () =>
    ipc.sendMessage('recorder', ['linuxRestartCapture']);

  const NONE_INPUT_VALUE = '__none__';

  const withCurrentDeviceOption = (
    devices: GsrAudioDevice[],
    currentValue: string,
  ): GsrAudioDevice[] => {
    if (!currentValue) return devices;
    if (devices.some((d) => d.value === currentValue)) return devices;
    return [
      { value: currentValue, label: `${currentValue} — (not available)` },
      ...devices,
    ];
  };

  const outputChoices = withCurrentDeviceOption(
    audioDevices.outputs,
    config.linuxGsrAudioOutput,
  );

  const inputChoices = withCurrentDeviceOption(
    audioDevices.inputs,
    config.linuxGsrAudioInput,
  );

  return (
    <div className="flex flex-col gap-y-4">
      <div className="text-sm text-foreground-lighter">
        Wayland capture uses the system portal. On first start, select the WoW
        window in the share dialog.
        <br />
        The replay buffer is only used to capture pre-roll (combat log events
        can be delayed). Full activities are recorded via a separate “regular
        recording” and are not limited by the buffer length.
      </div>

      <div className="flex flex-row flex-wrap gap-x-8 gap-y-4">
        <div className="flex flex-col w-64">
          <Label htmlFor="linuxGsrBufferSeconds">Replay buffer (seconds)</Label>
          <Input
            id="linuxGsrBufferSeconds"
            type="number"
            min={30}
            max={600}
            value={config.linuxGsrBufferSeconds}
            onChange={setNumber('linuxGsrBufferSeconds')}
          />
        </div>

        <div className="flex flex-col w-64">
          <Label htmlFor="linuxGsrLeadInSeconds">Extra lead-in (seconds)</Label>
          <Input
            id="linuxGsrLeadInSeconds"
            type="number"
            min={0}
            max={30}
            value={config.linuxGsrLeadInSeconds}
            onChange={setNumber('linuxGsrLeadInSeconds')}
          />
        </div>

        <div className="flex flex-col w-64">
          <Label htmlFor="obsFPS">FPS</Label>
          <Input
            id="obsFPS"
            type="number"
            min={15}
            max={240}
            value={config.obsFPS}
            onChange={setNumber('obsFPS')}
          />
        </div>

        <div className="flex flex-col w-64">
          <Label>Codec</Label>
          <Select
            value={config.linuxGsrCodec}
            onValueChange={setString('linuxGsrCodec')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select codec" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h264">h264</SelectItem>
              <SelectItem value="hevc">hevc</SelectItem>
              <SelectItem value="av1">av1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col w-64">
          <Label htmlFor="linuxGsrBitrateKbps">Bitrate (kbps, CBR)</Label>
          <Input
            id="linuxGsrBitrateKbps"
            type="number"
            min={1000}
            max={200000}
            value={config.linuxGsrBitrateKbps}
            onChange={setNumber('linuxGsrBitrateKbps')}
          />
        </div>

        <div className="flex flex-col w-64">
          <Label>Replay storage</Label>
          <Select
            value={config.linuxGsrReplayStorage}
            onValueChange={setString('linuxGsrReplayStorage')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select storage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ram">ram</SelectItem>
              <SelectItem value="disk">disk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col w-[520px]">
          <Label>Output Audio</Label>
          <Select
            value={config.linuxGsrAudioOutput}
            onValueChange={setString('linuxGsrAudioOutput')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select output device" />
            </SelectTrigger>
            <SelectContent>
              {outputChoices.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col w-[520px]">
          <Label>Input Audio</Label>
          <Select
            value={config.linuxGsrAudioInput || NONE_INPUT_VALUE}
            onValueChange={(v) =>
              setString('linuxGsrAudioInput')(v === NONE_INPUT_VALUE ? '' : v)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select input device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_INPUT_VALUE}>None</SelectItem>
              {inputChoices.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col w-64">
          <Label htmlFor="captureCursor">Capture cursor</Label>
          <div className="flex h-10 items-center">
            <Switch
              checked={config.captureCursor}
              name="captureCursor"
              onCheckedChange={setBool('captureCursor')}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-row gap-x-2">
        <Button
          variant="secondary"
          onClick={restartCapture}
          disabled={recorderStatus === RecStatus.Recording}
        >
          Re-select Capture Target
        </Button>
        <div className="flex items-center text-sm text-foreground-lighter">
          Status: {captureRunning ? 'Capturing' : 'Not capturing'}
        </div>
      </div>
    </div>
  );
};

export default LinuxCaptureSettings;
