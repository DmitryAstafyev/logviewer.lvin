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

export interface IFileToBeMerged {
    file: string;
    offset?: number;
    year?: number;
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

export default class Lvin extends EventEmitter {

    public static Events = {
        progress: 'progress',
        map: 'map',
    };

    public static path: string = path.join(__dirname, `../bin/lvin${process.platform === 'win32' ? '.exe' : ''}`)
                                     .replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

    private _process: ChildProcess | undefined;
    private _stdoutRest: string = '';

    public merge(files: IFileToBeMerged[], params: IParametersMerging, options?: ILvinOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (options === undefined) {
                options = {};
            }
            if (typeof params.destFile === 'string') {
                (options as any).cwd = typeof (options as any).cwd !== 'string' ? path.dirname(params.destFile) : (options as any).cwd;
            }
            const configFile: string = path.resolve((options.cwd !== undefined ? options.cwd : process.cwd()), `${(Date.now())}.json`);
            this._createConfigFile(files, configFile).then(() => {
                const args: string[] = [
                    '-s', // to post map into stdout
                ];
                // Provide config file path
                args.push(...['-m', configFile]);
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
                reject(error);
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
                '-s', // to post map into stdout
            ];
            Object.keys(options).forEach((key: string) => {
                args.push(...[`--${key}`, (options as any)[key]]);
            });
            args.push(...['-i', params.srcFile]);
            if (typeof params.injection === 'string') {
                args.push(...['-t', params.injection]);
            }
            if (typeof params.destFile === 'string') {
                args.push(...['-a', '-o', params.destFile]);
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

    private _createConfigFile(files: IFileToBeMerged[], destFileName: string): Promise<void> {
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
            // Prepare config file
            const content: string = `[${files.map((file: IFileToBeMerged) => {
                const record: any = { name: file.file, tag: path.basename(file.file) };
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
            // Write config file
            fs.writeFile(destFileName, content, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

}
