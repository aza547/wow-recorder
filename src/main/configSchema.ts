export type ConfigurationSchema = {
    storagePath: string,
    bufferStoragePath?: string,
    retailLogPath?: string,
    classicLogPath?: string,
    maxStorage: number,
    monitorIndex: number,
    selectedCategory: number,
    audioInputDevice?: string,
    audioOutputDevice?: string,
    minEncounterDuration: number,
    startUp?: boolean,
    startMinimized: boolean,
    obsBaseResolution: string,
    obsOutputResolution: string,
    obsFPS: number,
    recordRetail: boolean,
    recordClassic: boolean,
    recordRaids: boolean,
    recordDungeons: boolean,
    recordTwoVTwo: boolean,
    recordThreeVThree: boolean,
    recordSkirmish: boolean,
    recordSoloShuffle: boolean,
    recordBattlegrounds: boolean,
};

export type ConfigurationSchemaKey = keyof ConfigurationSchema;

/**
 * Config schema.
 */
export const configSchema = {
    storagePath: {
        description: 'Location to store the recordings.',
        type: 'string',
        default: '',
    },
    bufferStoragePath: {
        description: 'Location to store temporary recordings. If left unset this will default to a temporary folder inside the Storage Path.',
        type: 'string',
        default: '',
    },
    retailLogPath: {
        description: 'Location of the World of Warcraft logs folder for your retail installation, e.g. "D:\\World of Warcraft\\_retail_\\Logs".',
        type: 'string',
        default: '',
    },
    classicLogPath: {
        description: 'Location of the World of Warcraft logs folder for your classic installation, e.g. "D:\\World of Warcraft\\_classic_\\Logs".',
        type: 'string',
        default: '',
    },
    maxStorage: {
        description: 'Maximum allowed storage that the application will consume for video files. Set to 0 to signify unlimited.',
        type: 'integer',
        default: 0,
        minimum: 0,
    },
    monitorIndex: {
        description: 'The monitor to record.',
        type: 'integer',
        default: 1,
        minimum: 1,
        maximum: 4,
    },
    selectedCategory: {
        description: 'Last selected video category in the UI',
        type: 'integer',
        default: 1,
    },
    audioInputDevice: {
        description: 'Audio input device to be included in the recording.',
        type: 'string',
        default: 'all',
    },
    audioOutputDevice: {
        description: 'Audio output device to be included in the recording.',
        type: 'string',
        default: 'all',
    },
    minEncounterDuration: {
        description: 'Minimum raid boss encounter duration, encounters shorter than this will not be recorded. This setting is aimed at avoiding saving boss resets.',
        type: 'integer',
        default: 15,
        maximum: 10000,
    },
    startUp: {
        description: 'Automatically start the application when Windows starts.',
        type: 'boolean',
        default: false,
    },
    startMinimized: {
        description: "Open to the Windows system tray.",
        type: 'boolean',
        default: false,
    },
    obsBaseResolution: {
        description: 'Base resolution for recording. Typically the same as the monitor you are recording.',
        type: 'string',
        default: '1920x1080',
    },
    obsOutputResolution: {
        description: 'Resolution of videos as saved on disk. Smaller resolution gives smaller video size, but can look grainy/pixelated.',
        type: 'string',
        default: '1920x1080',
    },
    obsFPS: {
        description: 'The number of frames per second to record the video at. Lower FPS gives smaller video size, but also more choppy playback.',
        type: 'integer',
        default: 60,
        minimum: 15,
        maximum: 60,
    },
    recordRetail: {
        description: 'Whether the application should record retail',
        type: 'boolean',
        default: true,
    },
    recordClassic: {
        description: 'Whether the application should record classic',
        type: 'boolean',
        default: true,
    },
    recordRaids: {
        description: 'Whether the application should record raids',
        type: 'boolean',
        default: true,
    },
    recordDungeons: {
        description: 'Whether the application should record Mythic+',
        type: 'boolean',
        default: true,
    },
    recordTwoVTwo: {
        description: 'Whether the application should record 2v2',
        type: 'boolean',
        default: true,
    },
    recordThreeVThree: {
        description: 'Whether the application should record 3v3',
        type: 'boolean',
        default: true,
    },
    recordSkirmish: {
        description: 'Whether the application should record skirmishes',
        type: 'boolean',
        default: true,
    },
    recordSoloShuffle: {
        description: 'Whether the application should record solo shuffle',
        type: 'boolean',
        default: true,
    },
    recordBattlegrounds: {
        description: 'Whether the application should record battlegrounds',
        type: 'boolean',
        default: true,
    },
};