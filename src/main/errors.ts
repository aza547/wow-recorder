export class FfmpegError extends Error {
    error: any;

    constructor(message: string, error: any) {
        super(message);

        this.error = error;
    }
}

export class FfmpegProbeError extends Error {
    format: any;

    constructor(message: string, format: any) {
        super(message);

        this.format = format;
    }
}
