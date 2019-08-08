// tslint:disable

/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

//./node_modules/.bin/jasmine-ts src/something.spec.ts
import * as path from 'path';
import { Lvin, IIndexResult, IDLTStatsResults } from '../src/index';
console.log(process.cwd());
jasmine.DEFAULT_TIMEOUT_INTERVAL = 6000*1000;
describe('Lvin tests', () => {
    /*
    it('Getting stats of DLT file', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });
        inst.dltStat({ 
            srcFile: path.resolve(process.cwd(), './spec/logs/DTC_SP21.dlt')
        }).then((results: IDLTStatsResults) => {
            console.log(results);
            // Done
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });
    

    it('Read and index DLT file', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });
        inst.dlt({ 
            srcFile: path.resolve(process.cwd(), './spec/logs/DTC_SP21.dlt'),
            destFile: path.resolve(process.cwd(), './spec/logs/dlt.output'),
            injection: 'PLUGIN_ID',
        },
        {
            logLevel:6,
            //APID: ['Vin', 'VSom']
        }).then((results: IIndexResult) => {
            console.log(results);
            // Done
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });


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
    /*
    it('Discover', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });//05-02-2019 12:38:36.506
        inst.datetimeDiscover(
            [
                '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/timestamp_a.log',
                '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/tm_b.log',
            ]
        ).then((res) => {
            // Done
            console.log(res);
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });
    */
    /*
   it('Concat', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });//05-02-2019 12:38:36.506
        inst.concat(
            [
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/timestamp_a.log', sourceId: 'timestamp_a.log'},
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/tm_b.log', sourceId: 'tm_b.log' },
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
*/
    it('Merge', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.on(Lvin.Events.map, (map) => {
            console.log(`Map is gotten:`, map);
        });//05-02-2019 12:38:36.506
        inst.merge(
            [
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/timestamp_a.log', sourceId: 'timestamp_a.log', format: 'MM-DD-YYYY hh:mm:ss.s' },
                { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/tm_b.log', sourceId: 'tm_b.log', format: 'MM-DD-YYYY hh:mm:ss.s' },
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
    
   /*
   it('Test datetime', (done: Function)=>{
        const inst: Lvin = new Lvin();
        inst.datetimeFormatTest(
            { file: '/Users/dmitry.astafyev/WebstormProjects/logviewer/npm.indexer/spec/logs/timestamp_a.log', rowsToBeRead: 1000, format: 'MM-DD-YYYY hh:mm:ss.s' }
        ).then((result) => {
            console.log(result);
            // Done
            done();
        }).catch((error: Error) => {
            console.log(error);
            expect(true).toBe(false);
            done();
        });
    });
    */
});
