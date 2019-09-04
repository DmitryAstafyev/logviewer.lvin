import * as fs from 'fs';
import * as path from 'path';
import { getAsset } from './downloader';
import { unpack, chmod } from './unpacker';
import { getEnvVar } from 'logviewer.shell.env';

const Settings: {
    bin: string,
    user: string,
    repo: string,
    version: string,
    vars: string[],
} = {
    bin: path.join(__dirname, '../bin'),
    user: 'marcmo',
    repo: 'chipmunk.indexer',
    version: '0.33.0',
    vars: ['GITHUB_TOKEN', 'CUSTOM_REPO_TOKEN'],
};

const OriginalFileName: {
    darwin: string,
    win32: string,
    win64: string,
    linux: string,
} = {
    darwin: 'logviewer_parser',
    win32: 'logviewer_parser.exe',
    win64: 'logviewer_parser.exe',
    linux: 'logviewer_parser',
};

const TargetFileName: {
    darwin: string,
    win32: string,
    win64: string,
    linux: string,
} = {
    darwin: 'lvin',
    win32: 'lvin.exe',
    win64: 'lvin.exe',
    linux: 'lvin',
};

const CPlatforms = {
    aix: 'aix',
    darwin: 'darwin',
    freebsd: 'freebsd',
    linux: 'linux',
    openbsd: 'openbsd',
    sunos: 'sunos',
    win32: 'win32',
};

const CArch = {
    arm: 'arm',
    arm64: 'arm64',
    ia32: 'ia32',
    ppc: 'ppc',
    ppc64: 'ppc64',
    s390: 's390',
    s390x: 's390x',
    x32: 'x32',
    x64: 'x64',
};

function isNodeModulesExist(): boolean {
    const pathA: string = path.resolve(__dirname, 'node_modules');
    const pathB: string = path.resolve(__dirname, '../node_modules');
    const pathC: string = path.resolve(__dirname, '../../node_modules');
    const pathD: string = path.resolve(__dirname, '../../../node_modules');
    if (!fs.existsSync(pathA) && !fs.existsSync(pathB) && !fs.existsSync(pathC) && !fs.existsSync(pathD)) {
        console.log(`node_modules paths:\n\t- ${pathA}\n\t- ${pathB}\n\t- ${pathC}\n\t- ${pathD}`);
        return false;
    }
    return true;
}

function getAssetName(version: string): string {
    // indexing@0.2.1-darwin.tgz
    let platform: string = process.platform;
    if (platform === CPlatforms.win32) {
        if ([CArch.x64, CArch.ppc64].indexOf(process.arch) !== -1) {
            platform = 'win64';
        }
    }
    return `indexing@${version}-${platform}.tgz`;
}

function getExpectedOriFileName(): string {
    return (OriginalFileName as any)[process.platform] as string;
}

function getExpectedTarFileName(): string {
    return (TargetFileName as any)[process.platform] as string;
}

function fail(message: string, code: number = 1) {
    console.log(message);
    fs.unlink(Settings.bin, (error: NodeJS.ErrnoException | null) => {
        process.exit(code);
    });
}

function success(file: string) {
    console.log(`Sources successfuly downloaded and unpacked: ${file}.`);
}

function download(src: string, token: string) {
    return new Promise((resolve, reject) => {
        getAsset({
            token: token,
            user: Settings.user,
            repo: Settings.repo,
        }, {
            name: src,
            version: Settings.version,
            dest: Settings.bin,
        }).then((tgzfile: string) => {
            // Unpack sources
            unpack(tgzfile).then((dest: string) => {
                // Remove packet
                fs.unlinkSync(tgzfile);
                // Confirm file
                const expected: string = path.resolve(Settings.bin, getExpectedOriFileName());
                if (!fs.existsSync(expected)) {
                    return reject(new Error(`Expecting file "${expected}", but file isn't found`));
                }
                const cropped: string = path.resolve(Settings.bin, getExpectedTarFileName());
                // Rename
                fs.renameSync(expected, cropped);
                // Correct params
                chmod(cropped);
                // Done
                resolve(src);
            }).catch((unpackError: Error) => {
                reject(new Error(`Fail to unpack binary source due error: ${unpackError.message}`));
            });
        }).catch((downloadError: Error) => {
            reject(new Error(`Fail to download binary source due error: ${downloadError.message}`));
        });
    });
}

function getToken(): Promise<string> {
    return new Promise((resolve) => {
        let token: string | undefined;
        Settings.vars.forEach((name: string) => {
            if (typeof (process.env as any)[name] !== 'string') {
                return;
            }
            if ((process.env as any)[name].trim() === '') {
                return;
            }
            token = (process.env as any)[name];
            console.log(`Env variable "${name}" has string value.`);
        });
        if (typeof token === 'string' && token.trim() !== '') {
            return resolve(token);
        }
        Promise.all(Settings.vars.map((name: string) => {
            return new Promise((resolveName) => {
                getEnvVar(name).then((extracted: string) => {
                    if (extracted.trim() !== '') {
                        token = extracted;
                        console.log(`Env variable "${name}" has string value.`);
                    }
                    resolveName();
                }).catch((error: Error) => {
                    console.warn(`Fail to get ${name} due error: ${error.message}`);
                    resolveName();
                });
            });
        })).then(() => {
            resolve(typeof token !== 'string' ? '' : token);
        }).catch((error: Error) => {
            console.warn(`Error while getting vars: ${error.message}`);
            resolve('');
        });
    });
}
export function postInstall() {
    // Check platform
    if ((OriginalFileName as any)[process.platform] === undefined) {
        return fail(`Platform "${process.platform}" isn't supported.`);
    }
    // Check: is node_modules installed at all
    if (!isNodeModulesExist()) {
        return fail(`Fail to find folder "node_modules". Cannot proceed postinstall`);
    }
    // Check: does we already have binary
    if (fs.existsSync(Settings.bin)) {
        return console.log(`Folder "${Settings.bin}" is already exist. No need to proceed postinstall`);
    }
    // Create bin folder
    fs.mkdirSync(Settings.bin);
    // Downloading binary
    const sourceFile: string = getAssetName(Settings.version);

    // Try to get token
    getToken().then((extracted: string) => {
        if (extracted !== '') {
            console.log(`Found github token, it will be used to access to github API`);
        } else {
            console.log(`Cannot find github token, will procced without it`);
        }
        download(sourceFile, extracted).then(() => {
            success(sourceFile);
        }).catch((error: Error) => {
            fail(error.message);
        });
    });
}

postInstall();
