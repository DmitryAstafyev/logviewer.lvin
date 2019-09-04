import * as fs from 'fs';
import * as path from 'path';
// tslint:disable-next-line:no-var-requires
const GitHub: any = require('github-releases');

export interface IGitHubOptions {
    user: string;
    repo: string;
    token: string;
}

export interface IAssetOptions {
    version: string;
    name: string;
    dest: string;
}

export function getAsset(git: IGitHubOptions, asset: IAssetOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        // Create transport
        let github: any;
        try {
            github = new GitHub({
                user: git.user,
                repo: git.repo,
                token: git.token === '' ? null : git.token,
            });
        } catch (e) {
            return reject(e);
        }
        const output = path.join(asset.dest, asset.name);
        // Check: does already exist
        if (fs.existsSync(output)) {
            return resolve(output);
        }
        // Downloading
        github.getReleases({ tag_name: asset.version }, (getReleaseError: Error | null | undefined, releases: any[]) => {
            if (getReleaseError) {
                return reject(getReleaseError);
            }
            // Find neccessary asset
            const last = releases[0];
            const target = last.assets.find((_: any) => _.name === asset.name);
            if (!target) {
                return reject(new Error(`No asset named ${asset.name} found`));
            }
            // Download asset
            github.downloadAsset(target, (downloadAssetError: Error | null | undefined, reader: fs.ReadStream) => {
                if (downloadAssetError) {
                    return reject(downloadAssetError);
                }
                // Create writer stream
                const writer: fs.WriteStream = fs.createWriteStream(output);
                // Attach listeners
                reader.on('error', reject);
                writer.on('error', reject);
                writer.on('close', () => {
                    resolve(output);
                });
                // Pipe
                reader.pipe(writer);
            });

        });
    });
}
