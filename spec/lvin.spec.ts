// tslint:disable

/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

//./node_modules/.bin/jasmine-ts src/something.spec.ts
import * as path from 'path';
import { Lvin, IIndexResult } from '../src/index';
console.log(process.cwd());
describe('Lvin tests', () => {
/*
    it('Read and index file', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });
        inst.index({ 
            srcFile: path.resolve(process.cwd(), './spec/logs/small.log'),
            destFile: path.resolve(process.cwd(), './spec/logs/small.log.indexed'),
            injection: 'PLUGIN_ID',
        }).then((results: IIndexResult) => {
            // Done
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });
*/
    it('Merge', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });
        inst.merge(
            [
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/timestamp_a-s.log', sourceId: '1' },
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/tm_b-s.log', sourceId: '2' },
            ],
            { 
                destFile: path.resolve(process.cwd(), './spec/logs/small.log.indexed'),
            }
        ).then(() => {
            // Done
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });

});
