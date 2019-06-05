import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

export interface IFileMapItem {
    b: number[];
    r: number[];
}

export interface IIndexResult {
    size: number;
    map: IFileMapItem[];
}

export interface IDatetimeFormatTest {
    file: string;
    format: string;
    rowsToBeRead: number;
}

export interface IDatetimeFormatTestResult {
    readBytes: number;
    readRows: number;
    regExpStr: string;
    matches: number;
}

export interface IFileToBeMerged {
    file: string;
    sourceId: string;
    offset?: number;
    year?: number;
    format: string;
}

export interface IMergeResult {
    size: number;
    file: string;
    map: IFileMapItem[];
    files: IFileToBeMerged[];
}

export interface ILvinOptions {
    chunk_size?: number;
    max_lines?: number;
    cwd?: string;
}

export interface IParametersMerging {
    destFile?: string;
    rowOffset?: number;
    byteOffset?: number;
}

export interface IParameters {
    rowOffset?: number;
    byteOffset?: number;
    srcFile: string;
    destFile?: string;
    injection?: string;
}

const CSettings = {
    datetimeTestRowsToBeRead: 1000,
};

export default class Lvin extends EventEmitter {

    public static Events = {
        progress: 'progress',
        map: 'map',
    };

    public static path: string = path.join(__dirname, `../bin/lvin${process.platform === 'win32' ? '.exe' : ''}`)
                                     .replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

    private _process: ChildProcess | undefined;
    private _stdoutRest: string = '';

    public datetimeFormatTest(file: IDatetimeFormatTest, options?: ILvinOptions): Promise<IDatetimeFormatTestResult> {
        return new Promise((resolve, reject) => {
            if (options === undefined) {
                options = {};
            }
            (options as any).cwd = typeof (options as any).cwd !== 'string' ? path.dirname(file.file) : (options as any).cwd;
            const configFile: string = path.resolve((options.cwd !== undefined ? options.cwd : process.cwd()), `${(Date.now())}.json`);
            let output: string = '';
            this._createFormatConfigFile(file, configFile).then(() => {
                const args: string[] = [
                    'format',
                    '-c',
                    configFile,
                ];
                const started: number = Date.now();
                console.log(`Command "lvin" is started (datetime testing):\n\tcommand: ${Lvin.path} ${args.join(' ')}`);
                // Start process
                this._process = spawn(Lvin.path, args, {
                    cwd: (options as any).cwd !== undefined ? (options as any).cwd : process.cwd(),
                });
                this._process.stdout.on('data', (chunk: Buffer | string) => {
                    if (chunk instanceof Buffer) {
                        chunk = chunk.toString('utf8');
                    }
                    if (typeof chunk !== 'string') {
                        return;
                    }
                    output += chunk;
                });
                this._process.once('close', (chunk: Buffer | string, out: any, arg: any) => {
                    // Remove config file
                    fs.unlinkSync(configFile);
                    console.log(`Command "lvin" (datetime testing) is finished in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
                    try {
                        const result: any = JSON.parse(output);
                        resolve({
                            matches: result.matching_lines,
                            readRows: result.matching_lines + result.nonmatching_lines,
                            readBytes: result.processed_bytes,
                            regExpStr: this._convertRegExpStrToES2018(result.regex),
                        });
                    } catch (e) {
                        return reject(`Fail to get results of test due error: ${e.message}. Input: "${output}"`);
                    }
                });
                this._process.once('error', (error: Error) => {
                    this._process = undefined;
                    reject(error);
                });
            }).catch((error: Error) => {
                reject(new Error(`[test format] Fail to generate configuration due error: ${error.message}`));
            });
        });
    }

    public merge(files: IFileToBeMerged[], params: IParametersMerging, options?: ILvinOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (options === undefined) {
                options = {};
            }
            if (typeof params.destFile === 'string') {
                (options as any).cwd = typeof (options as any).cwd !== 'string' ? path.dirname(params.destFile) : (options as any).cwd;
            }
            const configFile: string = path.resolve((options.cwd !== undefined ? options.cwd : process.cwd()), `${(Date.now())}.json`);
            this._createMergeConfigFile(files, configFile).then(() => {
                const args: string[] = [
                    'merge',
                    configFile,
                    '-s', // to post map into stdout
                ];
                if (typeof params.destFile === 'string') {
                    (options as any).cwd = typeof (options as any).cwd !== 'string' ? path.dirname(params.destFile) : (options as any).cwd;
                    args.push(...['-a', '-o', params.destFile]);
                }
                const started: number = Date.now();
                console.log(`Command "lvin" is started (merging).`);
                // Start process
                this._process = spawn(Lvin.path, args, {
                    cwd: (options as any).cwd !== undefined ? (options as any).cwd : process.cwd(),
                });
                this._process.stdout.on('data', (chunk: Buffer | string) => {
                    if (chunk instanceof Buffer) {
                        chunk = chunk.toString('utf8');
                    }
                    if (typeof chunk !== 'string') {
                        return;
                    }
                    chunk = `${this._stdoutRest}${chunk}`;
                    const rest = this._getRest(chunk);
                    this._stdoutRest = rest.rest;
                    chunk = rest.cleared;
                    const mapItems: IFileMapItem[] | undefined = this._getMapSegments(rest.cleared);
                    if (mapItems !== undefined) {
                        this.emit(Lvin.Events.map, mapItems);
                    } else {
                        process.stdout.write(chunk);
                    }
                });
                this._process.once('close', () => {
                    // Check rest part in stdout
                    if (this._stdoutRest.trim() !== '') {
                        const mapItems: IFileMapItem[] | undefined = this._getMapSegments(this._stdoutRest);
                        if (mapItems !== undefined) {
                            this.emit(Lvin.Events.map, mapItems);
                        }
                    }
                    this._stdoutRest = '';
                    // Remove config file
                    fs.unlinkSync(configFile);
                    console.log(`Command "lvin" (merging) is finished in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
                    resolve();
                });
                this._process.once('error', (error: Error) => {
                    this._process = undefined;
                    reject(error);
                });
            }).catch((error: Error) => {
                reject(new Error(`[merging] Fail to generate configuration due error: ${error.message}`));
            });
        });
    }

    public index(params: IParameters, options?: ILvinOptions): Promise<IIndexResult> {
        return new Promise((resolve, reject) => {
            // Check existing process
            if (this._process !== undefined) {
                return new Error(`Cannot proceed because previous process wasn't finished yet.`);
            }
            // Check files
            if (!fs.existsSync(params.srcFile)) {
                return reject(new Error(`Source file "${params.srcFile}" doesn't exist.`));
            }
            if (options === undefined) {
                options = {};
            }
            const args: string[] = [
                'index',
                params.srcFile,
                '-s', // to post map into stdout
            ];
            Object.keys(options).forEach((key: string) => {
                args.push(...[`--${key}`, (options as any)[key]]);
            });
            if (typeof params.destFile === 'string') {
                args.push(...['-a', '-o', params.destFile]);
            }
            if (typeof params.injection === 'string') {
                args.push(...['-t', params.injection]);
            }
            const started: number = Date.now();
            console.log(`Command "lvin" is started.`);
            // Start process
            this._process = spawn(Lvin.path, args, {
                cwd: path.dirname(params.srcFile),
            });
            this._process.stdout.on('data', (chunk: Buffer | string) => {
                if (chunk instanceof Buffer) {
                    chunk = chunk.toString('utf8');
                }
                if (typeof chunk !== 'string') {
                    return;
                }
                chunk = `${this._stdoutRest}${chunk}`;
                const rest = this._getRest(chunk);
                this._stdoutRest = rest.rest;
                chunk = rest.cleared;
                const mapItems: IFileMapItem[] | undefined = this._getMapSegments(rest.cleared);
                if (mapItems !== undefined) {
                    this.emit(Lvin.Events.map, mapItems);
                } else {
                    process.stdout.write(chunk);
                }
            });
            this._process.once('close', () => {
                const offset = {
                    row: params.rowOffset === undefined ? 0 : params.rowOffset,
                    byte: params.byteOffset === undefined ? 0 : params.byteOffset,
                };
                // Check rest part in stdout
                if (this._stdoutRest.trim() !== '') {
                    const mapItems: IFileMapItem[] | undefined = this._getMapSegments(this._stdoutRest);
                    if (mapItems !== undefined) {
                        this.emit(Lvin.Events.map, mapItems);
                    }
                }
                this._stdoutRest = '';
                console.log(`Command "lvin" is finished in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
                // Read map
                this._readMeta(params.srcFile, offset).then((map: IFileMapItem[]) => {
                    resolve({
                        size: 0,
                        map: map,
                    });
                }).catch((metaError: Error) => {
                    this._process = undefined;
                    reject(metaError);
                });
            });
            this._process.once('error', (error: Error) => {
                this._process = undefined;
                reject(error);
            });
        });
    }

    private _readMeta(srcFile: string, offset: { row: number, byte: number }): Promise<IFileMapItem[]> {
        return new Promise((resolve, reject) => {
            const metaFile: string = path.resolve(`${srcFile}.map.json`);
            if (!fs.existsSync(metaFile)) {
                return reject(new Error(`Cannot find file "${metaFile}" with meta data.`));
            }
            if (offset === undefined) {
                offset = { row: 0, byte: 0 };
            }
            if (typeof offset.row !== 'number' || typeof offset.byte !== 'number') {
                return reject(new Error(`Offset should be defined as { row: number, byte: number } object`));
            }
            if (isNaN(offset.row) || isNaN(offset.byte) || !isFinite(offset.byte) || !isFinite(offset.row)) {
                return reject(new Error(`Offset should be defined as { row: number, byte: number } object. And row and byte shound finite and not NaN.`));
            }
            fs.readFile(metaFile, (error: NodeJS.ErrnoException, content: Buffer) => {
                if (error) {
                    return reject(error);
                }
                try {
                    let map: IFileMapItem[] = JSON.parse(content.toString('utf8'));
                    if (!(map instanceof Array)) {
                        return reject(new Error(`Wrong format of meta data. Expected: Array; gotten: ${typeof map}.`));
                    }
                    // Remove meta file
                    fs.unlinkSync(metaFile);
                    // Apply offset if needed
                    if (offset.row > 0 || offset.byte > 0) {
                        map = map.map((item: IFileMapItem) => {
                            return {
                                r: [item.r[0] + offset.row, item.r[1] + offset.row],
                                b: [item.b[0] + offset.byte, item.b[1] + offset.byte],
                            };
                        });
                    }
                    // Done
                    resolve(map);
                } catch (e) {
                    return reject(e);
                }
            });
        });
    }

    private _getRest(str: string): { rest: string, cleared: string } {
        const last = str.length - 1;
        for (let i = last; i >= 0; i -= 1) {
            if (str[i] === '\n' && i > 0) {
                return {
                    rest: str.substr(i + 1, last),
                    cleared: str.substr(0, i + 1),
                };
            }
        }
        return { rest: '', cleared: str };
    }

    private _getMapSegments(str: string): IFileMapItem[] | undefined {
        const items: IFileMapItem[] = [];
        str.split(/[\n\r]/gi).forEach((row: string) => {
            try {
                const obj: IFileMapItem = JSON.parse(row);
                if (typeof obj !== 'object' || obj === null) {
                    return;
                }
                if (!(obj.b instanceof Array) || obj.b.length !== 2) {
                    return;
                }
                if (!(obj.r instanceof Array) || obj.r.length !== 2) {
                    return;
                }
                items.push(obj);
            } catch (e) {
                return;
            }
        });
        return items.length > 0 ? items : undefined;
    }

    private _createMergeConfigFile(files: IFileToBeMerged[], destFileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check files
            const missed: string[] = [];
            files.forEach((file: IFileToBeMerged) => {
                if (!fs.existsSync(file.file)) {
                    missed.push(file.file);
                }
            });
            if (missed.length !== 0) {
                return reject(new Error(`Cannot file next file(s): ${missed.join('; ')}`));
            }
            const errors: string[] = [];
            // Prepare config file
            const content: string = `[${files.map((file: IFileToBeMerged, index: number) => {
                if (typeof file.file !== 'string' || file.file.trim() === '') {
                    errors.push(`Record #${index}: file (filename) is missed`);
                    return undefined;
                }
                if (typeof file.format !== 'string' || file.format.trim() === '') {
                    errors.push(`${file.file}: format is missed`);
                    return undefined;
                }
                if (typeof file.sourceId !== 'string' || file.sourceId.trim() === '') {
                    errors.push(`${file.file}: sourceId is missed`);
                    return undefined;
                }
                const record: any = { name: file.file, tag: file.sourceId, format: file.format };
                if (typeof file.offset === 'number') {
                    record.offset = file.offset;
                } else {
                    record.offset = 0;
                }
                if (typeof file.year === 'number') {
                    record.year = file.year;
                }
                return JSON.stringify(record);
            }).join(',')}]`;
            if (errors.length !== 0) {
                return reject(new Error(errors.join('\n')));
            }
            // Write config file
            fs.writeFile(destFileName, content, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    private _createFormatConfigFile(file: IDatetimeFormatTest, destFileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check file
            if (!fs.existsSync(file.file)) {
                return reject(new Error(`Cannot file next file(s): ${file.file}`));
            }
            const errors: string[] = [];
            if (typeof file.file !== 'string' || file.file.trim() === '') {
                errors.push(`File (filename) is missed`);
            }
            if (typeof file.format !== 'string' || file.format.trim() === '') {
                errors.push(`Format is missed`);
            }
            if (errors.length !== 0) {
                return reject(new Error(errors.join('\n')));
            }
            // Prepare config file
            const record: any = {
                file: file.file,
                format: file.format,
                lines_to_test: file.rowsToBeRead === undefined ? CSettings.datetimeTestRowsToBeRead : file.rowsToBeRead,
            };
            // Write config file
            fs.writeFile(destFileName, JSON.stringify(record), (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    private _convertRegExpStrToES2018(str: string): string {
        const renaming: Array<{ find: string, replace: string }> = [
            { find: '<m>', replace: '<MM>' },
            { find: '<d>', replace: '<DD>' },
            { find: '<y>', replace: '<YYYY>' },
            { find: '<H>', replace: '<hh>' },
            { find: '<M>', replace: '<mm>' },
            { find: '<S>', replace: '<ss>' },
            { find: '<millis>', replace: '<s>' },
            { find: '<timezone>', replace: '<TMZ>' },
        ];
        str = str.replace(/\?P\</gi, '?<');
        renaming.forEach((rename) => {
            str = str.replace(rename.find, rename.replace);
        });
        return str;
    }

}
