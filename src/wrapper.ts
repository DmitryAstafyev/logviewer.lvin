import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export interface IFileMapItem {
    b: number[];
    r: number[];
}

export interface IIndexResult {
    size: number;
    map: IFileMapItem[];
}

export interface ILvinOptions {
    chunk_size?: number;
    max_lines?: number;
}

export interface IParameters {
    rowOffset?: number;
    byteOffset?: number;
    srcFile: string;
    destFile?: string;
    injection?: string;
}

export default class Lvin {

    public static path: string = path.join(__dirname, `../bin/lvin${process.platform === 'win32' ? '.exe' : ''}`)
                                     .replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

    private _process: ChildProcess | undefined;

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
            const args: string[] = [];
            Object.keys(options).forEach((key: string) => {
                args.push(...[`--${key}`, (options as any)[key]]);
            });
            if (typeof params.destFile === 'string') {
                // TODO: check size of output. if 0, do not make -a
                args.push('-a');
            }
            args.push(params.srcFile);
            if (typeof params.injection === 'string') {
                args.push(params.injection);
            } else {
                args.push('');
            }
            if (typeof params.destFile === 'string') {
                args.push(params.destFile);
            }
            const started: number = Date.now();
            console.log(`Command "lvin" is started.`);
            // Start process
            this._process = spawn(Lvin.path, args, {
                cwd: path.dirname(params.srcFile),
            });
            this._process.stdout.pipe(process.stdout);
            this._process.once('close', () => {
                const offset = {
                    row: params.rowOffset === undefined ? 0 : params.rowOffset,
                    byte: params.byteOffset === undefined ? 0 : params.byteOffset,
                };
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

}
