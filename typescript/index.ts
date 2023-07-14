import path from 'path';
import fs from 'fs';
import { saveBuffer, useEffect, useMode, stage } from 'imagerot';
import cliProgress from 'cli-progress';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';
import { v4 as uuidv4 } from 'uuid';

const UUID = uuidv4();

ffmpeg.setFfprobePath(ffprobe.path);

type TOnFrame = (params: {
    current: number;
    total: number;
    fileName: string;
    framePath: string;
}) => Promise<void>;

interface IRenderParams {
    videoPath: string;
    videoOut?: string;
    verbose?: boolean;
    action: (params: {
        staged: any;
        useMode: any;
        useEffect: any;
        current: number;
        total: number;
    }) => Promise<any>;
};

interface CreateVideoParams {
    frameRate: number;
    framesDir: string;
    audioPath: string | null;
    videoOut: string;
    width: number;
    height: number;
    bitRate: number;
};

type TRender = (params: IRenderParams) => Promise<void>;

const getTimestamp = (): string => new Date().toLocaleTimeString();

const log = (condition: boolean, message: string): void =>
{
    if(condition) {
        console.log(`[${getTimestamp()}] ${message}`);
    }
};

const createVideo = ({ frameRate, framesDir, audioPath, videoOut, width, height, bitRate }: CreateVideoParams): Promise<void> => {
    return new Promise((resolve, reject) => {
        const command = ffmpeg()
            .input(path.join(framesDir, '%06d.jpg'))
            .inputFPS(frameRate)
            .size(`${width}x${height}`)
        
        let videoCodec: string;

        switch(path.extname(videoOut)) {
            case '.mp4':
                videoCodec = 'libx264';
                break;
            case '.mkv':
                videoCodec = 'libvpx';
                break;
            case '.avi':
                videoCodec = 'mpeg4';
                break;
            default:
                videoCodec = 'libx264';
        }

        command.outputOptions(`-c:v ${videoCodec}`);

        if(audioPath !== null) {
            command.input(audioPath).outputOptions('-c:a aac');
        } else {
            command.outputOptions('-an');
        }

        command.output(videoOut)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
};

const processFrames = async (framesDir: string, onFrame: TOnFrame): Promise<{ outPath: string; }> => {
    const files = await fs.promises.readdir(framesDir);
    
    files.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        return numA - numB;
    });

    let index = 1;
    
    for(const file of files) {
        if(path.extname(file) === '.jpg') {
            await onFrame({
                current: index,
                total: files.length,
                fileName: file,
                framePath: path.join(framesDir, file)
            });

            index++;
        }
    }

    return { outPath: framesDir };
};

const extractAudio = (videoPath: string): Promise<{ audioPath: string | null; }> => {
    return new Promise(async (resolve) => {
        const outPath = path.join(`./cache`, `$${UUID}/audio`);
        const outFile = path.join(outPath, 'audio.aac');

        await fs.promises.mkdir(outPath, { recursive: true });

        ffmpeg(videoPath)
            .noVideo()
            .audioCodec('aac')
            .output(outFile)
            .on('end', () => resolve({ audioPath: outFile }))
            .on('error', () => resolve({ audioPath: null }))
            .run();
    });
};


const extractFrames = (videoFilePath: string): Promise<{ path: string; }> => {
    return new Promise(async (resolve, reject) => {
        const outPath = path.join(`./cache`, `$${UUID}/frames`);
        await fs.promises.mkdir(outPath, { recursive: true });

        ffmpeg(videoFilePath)
            .on('end', () => resolve({ path: outPath }))
            .on('error', reject)
            .output(path.join(outPath, '%06d.jpg'))
            .run();
    });
};

const getVideoDetails = (filePath: string): Promise<{ width: number; height: number; frameRate: number; bitRate: number; }> => {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath).ffprobe((err, data) => {
            if(err) {
                reject(err);
            } else {
                const videoStream = data.streams.find(stream => stream.codec_type === 'video');

                if (!videoStream) {
                    reject(new Error('No video stream found'));
                    return;
                }

                const { width, height, r_frame_rate, bit_rate } = videoStream as {
                    width: number;
                    height: number;
                    r_frame_rate: string;
                    bit_rate: string | undefined;
                };

                const [numerator, denominator] = r_frame_rate.split('/');
                const frameRate = parseInt(numerator) / parseInt(denominator);

                const bitRate: number = bit_rate ? parseInt(bit_rate) || 75E3 : 75E3;

                resolve({ width, height, frameRate, bitRate });
            }
        });
    });
};

const render: TRender = async (params) =>
{
    const {
        verbose = true,
        action = null,
        videoPath,
        videoOut = './result.mp4'
    } = params;

    const probed = await getVideoDetails(videoPath);

    log(verbose, `Video details: ${JSON.stringify(probed)}`);
    log(verbose, `Extracting frames and audio ...`);

    const extracted = await extractFrames(videoPath);

    let audioPath = null;

    try {
        [audioPath] = Object.values(await extractAudio(videoPath));
    } catch(e) {
        log(verbose, `Failed to extract audio stream`);
    }

    log(verbose, ` :: ${extracted.path}/*`);
    log(verbose, ` :: ${audioPath || 'No audio stream found'}`);

    const pFrames = path.join(extracted.path, '../processed');
    await fs.promises.mkdir(pFrames, { recursive: true });

    const progress = new cliProgress.SingleBar({
        format: '[' + getTimestamp() + '] {bar} {percentage}% | ETA: {eta}s | {value} of {total} frames',
        barCompleteChar: '=',
        barIncompleteChar: ' ',
        hideCursor: true
    });

    const onFrame: TOnFrame = async ({ current, total, fileName, framePath }) => {
        if(current === 1) {
            progress.start(total, total);
        }

        let staged = await stage({ file: framePath });

        if(action) {
            staged = await action({ staged, current, total, useEffect, useMode });
        }

        await saveBuffer(staged, path.join(pFrames, fileName), {
            mime: 'image/jpeg',
        });

        progress.update(current);

        if(current === total) {
            progress.stop();
        }
    };

    log(verbose, `Processing frames (imageRot) ...`);
    const { outPath } = await processFrames(extracted.path, onFrame);
    log(verbose, `OK: ${outPath}`);

    const creationParams = {
        frameRate: probed.frameRate,
        framesDir: pFrames,
        audioPath, videoOut,
        height: probed.height,
        width: probed.width,
        bitRate: probed.bitRate
    };

    log(verbose, `Creating video (${JSON.stringify(creationParams)} ...`);
    await createVideo(creationParams);
    log(verbose, `Done!`);
};

export { render };
