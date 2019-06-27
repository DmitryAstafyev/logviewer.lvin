import * as fs from 'fs';
import * as path from 'path';
import { getAsset } from './downloader';
import { unpack, chmod } from './unpacker';

const Settings: {
    bin: string,
    user: string,
    repo: string,
    version: string,
} = {
    bin: path.join(__dirname, '../bin'),
    user: 'marcmo',
    repo: 'logviewer_indexer',
    version: '0.20.0',
};

const OriginalFileName: {
    darwin: string,
    win32: string,
    linux: string,
} = {
    darwin: 'logviewer_parser',
    win32: 'logviewer_parser.exe',
    linux: 'logviewer_parser',
};

const TargetFileName: {
    darwin: string,
    win32: string,
    linux: string,
} = {
    darwin: 'lvin',
    win32: 'lvin.exe',
    linux: 'lvin',
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
    return `indexing@${version}-${process.platform}.tgz`;
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

function success() {
    console.log(`Sources successfuly downloaded and unpacked.`);
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
    getAsset({
        token: (process.env as any).GITHUB_TOKEN,
        user: Settings.user,
        repo: Settings.repo,
    }, {
        name: getAssetName(Settings.version),
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
                return fail(`Expecting file "${expected}", but file isn't found`);
            }
            const cropped: string = path.resolve(Settings.bin, getExpectedTarFileName());
            // Rename
            fs.renameSync(expected, cropped);
            // Correct params
            chmod(cropped);
            // Done
            success();
        }).catch((unpackError: Error) => {
            fail(`Fail to unpack binary source due error: ${unpackError.message}`);
        });
    }).catch((downloadError: Error) => {
        fail(`Fail to download binary source due error: ${downloadError.message}`);
    });
}

postInstall();
