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

export default class Lvin {

    public static path: string = path.join(__dirname, `../bin/lvin${process.platform === 'win32' ? '.exe' : ''}`)
                                     .replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

    private _process: ChildProcess | undefined;

    public index(srcFile: string, destFile: string, injection: string, options?: ILvinOptions): Promise<IIndexResult> {
        return new Promise((resolve, reject) => {
            // Check existing process
            if (this._process !== undefined) {
                return new Error(`Cannot proceed because previous process wasn't finished yet.`);
            }
            // Check files
            if (!fs.existsSync(srcFile)) {
                return reject(new Error(`Source file "${srcFile}" doesn't exist.`));
            }
            if (options === undefined) {
                options = {};
            }
            const args: string[] = [];
            Object.keys(options).forEach((key: string) => {
                args.push(...[`--${key}`, (options as any)[key]]);
            });
            args.push(srcFile);
            args.push(injection);
            // Start process
            this._process = spawn(Lvin.path, args, {
                cwd: path.dirname(srcFile),
            });
            this._process.stdout.pipe(process.stdout);
            this._process.once('close', () => {
                // Read map
                this._readMeta(srcFile).then((map: IFileMapItem[]) => {
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

    private _readMeta(srcFile: string): Promise<IFileMapItem[]> {
        return new Promise((resolve, reject) => {
            const metaFile: string = path.resolve(path.dirname(srcFile), 'lineMetadata.json');
            if (!fs.existsSync(metaFile)) {
                return reject(new Error(`Cannot find file "${metaFile}" with meta data.`));
            }
            fs.readFile(metaFile, (error: NodeJS.ErrnoException, content: Buffer) => {
                if (error) {
                    return reject(error);
                }
                try {
                    const map: IFileMapItem[] = JSON.parse(content.toString('utf8'));
                    if (!(map instanceof Array)) {
                        return reject(new Error(`Wrong format of meta data. Expected: Array; gotten: ${typeof map}.`));
                    }
                    // Remove meta file
                    fs.unlinkSync(metaFile);
                    // Done
                    resolve(map);
                } catch (e) {
                    return reject(e);
                }
            });
        });
    }

}
