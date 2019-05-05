import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';

export function unpack(tgzfile: string, dest?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const cwd: string = typeof dest === 'string' ? dest : path.dirname(tgzfile);
        tar.x({
            file: tgzfile,
            cwd: cwd,
        }).then(() => {
            resolve(cwd);
        }).catch(reject);
    });
}

export function chmod(file: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            return resolve();
        }
        fs.chmod(file, '755', (error: NodeJS.ErrnoException | null) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}
