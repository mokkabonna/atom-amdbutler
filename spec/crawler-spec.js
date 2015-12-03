var crawler = require('../lib/crawler');
var path = require('path');
var os = require('os');


describe('crawler tests', function () {
    var folder = path.join(__dirname, 'data', 'crawlTest');
    describe('getBaseFolderPath', function () {
        it('gets folder from path', function () {
            var path;
            var expected;
            if (os.platform() === 'win32') {
                path = 'C:\\Users\\stdavis\\Documents\\Projects\\wri-web\\src\\app\\Test.js';
                expected = 'C:\\Users\\stdavis\\Documents\\Projects\\wri-web\\src';
            } else {
                path = '/Users/stdavis/Documents/Projects/wri-web/src/app/Test.js';
                expected = '/Users/stdavis/Documents/Projects/wri-web/src';
            }

            var folderNames = ['src'];

            expect(crawler.getBaseFolderPath(path, folderNames)).toBe(expected);
        });
        it('throws error if no match is found', function () {
            expect(function () {
                crawler.getBaseFolderPath('/blah/blah', ['hello']);
            }).toThrow();
        });
    });
    describe('crawl', function () {
        it('gets module list', function () {
            crawler.crawl(folder, 'test');

            expect(crawler.modules.length).toBe(7);
        });
        it('gets param name', function () {
            expect(crawler.getParamName('test/dom-style')).toEqual('domStyle');
            expect(crawler.getParamName('test/window')).toEqual('testWindow');
        });
        it('gets preferred argument', function () {
            expect(crawler.getParamName('esri/basemaps')).toEqual('esriBasemaps');
            expect(crawler.getParamName('esri/styles/choropleth')).toEqual('esriStylesChoropleth');
        });
        it('handles js keywords', function () {
            expect(crawler.getParamName('test/sub/string')).toEqual('testString');
        });
    });
    describe('getModuleFromPath', function () {
        it('returns a module object from a path', function () {
            expect(crawler.getModuleFromPath('app/sub/Hello.js')).toEqual({
                path: 'app/sub/Hello',
                rawPath: 'app/sub/Hello',
                name: 'Hello'
            });
            expect(crawler.getModuleFromPath('/Users/stdavis/Documents/Projects/wri-web/src/app/project/test4.js',
                '/Users/stdavis/Documents/Projects/wri-web/src')).toEqual({
                path: 'app/project/test4',
                rawPath: 'app/project/test4',
                name: 'test4'
            });
        });
        it('rewrites if passed a matching map', function() {
            expect(crawler.getModuleFromPath(
                '/Users/stdavis/Documents/Projects/wri-web/src/app/bower_components/lodash/modern/array/flatten.js',
                '/Users/stdavis/Documents/Projects/wri-web/src',
                {'app/bower_components/lodash/modern' : 'lodash'})).toEqual({
                path: 'lodash/array/flatten',
                rawPath: 'app/bower_components/lodash/modern/array/flatten',
                name: 'flatten'
            });
        });
        it('rewrites if passed a matching map, and uses correct package name', function() {
            expect(crawler.getModuleFromPath(
                '/Users/stdavis/Documents/Projects/wri-web/src/app/bower_components/lodash/modern/foo/string.js',
                '/Users/stdavis/Documents/Projects/wri-web/src',
                {'app/bower_components/lodash/modern' : 'lodash'})).toEqual({
                path: 'lodash/foo/string',
                rawPath: 'app/bower_components/lodash/modern/foo/string',
                name: 'lodashString'
            });
        });
    });
    describe('removeModule', function () {
        it('removes a module from the list', function () {
            crawler.crawl(folder, 'test');

            crawler.removeModule('test2/dom-style.js');

            expect(crawler.modules.length).toBe(6);
        });
    });
});
