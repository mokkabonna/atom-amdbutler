var CompositeDisposable = require('atom').CompositeDisposable;
var crawler = require('./crawler');
var ModsView = require('./mods-view');
var bufferParser = require('./buffer-parser');
var zipper = require('./zipper');
var fs = require('fs');

module.exports =  {
    // settings
    config: {
        baseFolders: {
            type: 'array',
            'default': ['src'],
            items: {
                type: 'string'
            }
        },
        requirejsConfigFile:{
            type: 'string',
            'default': 'config.json'
        },
        excludePaths:{
            type: 'array',
            'default': [],
            description: 'List of ',
            items: {
                type: 'string'
            }
        }
    },

    subscriptions: null,

    modsView: null,

    activate: function () {
        console.log('amd-butler:activate');

        this.modsView = new ModsView();

        this.subscriptions = new CompositeDisposable();

        return this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'amdbutler:add': this.add.bind(this),
                'amdbutler:sort': this.sort.bind(this),
                'amdbutler:remove': this.remove.bind(this)
            }),
            this.modsView.onAddItemSelected(this.onAddModSelected.bind(this)),
            this.modsView.onRemoveItemSelected(this.onRemoveModSelected.bind(this))
        );
    },
    deactivate: function () {
        console.log('amdbutler:deactivate');

        this.subscriptions.dispose();
    },
    getSortedPairs: function (buffer) {
        var importsRange = bufferParser.getImportsRange(buffer);
        var paramsRange = bufferParser.getParamsRange(buffer);
        return zipper.zip(buffer.getTextInRange(importsRange), buffer.getTextInRange(paramsRange));
    },
    onAddModSelected: function (item) {
        var buffer = atom.workspace.getActivePaneItem().buffer;

        // create a checkpoint to allow for a single undo for this entire operation
        var checkPoint = buffer.createCheckpoint();

        // add pair
        var paramsPoint = bufferParser.getParamsRange(buffer).start;
        buffer.insert(paramsPoint, item.name + ',');
        var importsPoint = bufferParser.getImportsRange(buffer).start;
        buffer.insert(importsPoint, '\'' + item.path + '\',');

        this._sort(buffer, checkPoint);
    },
    onRemoveModSelected: function (item) {
        console.log('onRemoveModSelected');
        // TODO: refactor shared code with onAddModSelected
        var buffer = atom.workspace.getActivePaneItem().buffer;

        var checkPoint = buffer.createCheckpoint();

        var pairs = this.getSortedPairs(buffer);
        this.updateWithPairs(buffer, pairs.filter(function (p) {
            return p.path !== item.path;
        }));

        buffer.groupChangesSinceCheckpoint(checkPoint);
    },
    updateWithPairs: function (buffer, pairs) {
        var importsRange = bufferParser.getImportsRange(buffer);
        var paramsRange = bufferParser.getParamsRange(buffer);

        var paramsTxt = zipper.generateParamsTxt(pairs, '    ', false);
        buffer.setTextInRange(paramsRange, paramsTxt);

        var importsTxt = zipper.generateImportsTxt(pairs, '    ');
        buffer.setTextInRange(importsRange, importsTxt);
    },
    getReplaceMapFromConfig: function(configFile) {
        var fileContent;
        var parsed;
        try{
            fileContent = fs.readFileSync(configFile, 'utf8');
            parsed = JSON.parse(fileContent);
        } catch(e){
            console.log('File ' + configFile + ' does not exist, or is not JSON.');
            return {}; //no file present, return empty map
        }

        var mapFromPackages = parsed.packages.reduce(function(all, pkg) {
            all[pkg.location] = pkg.name;
            return all;
        }, {});

        var mapFromPathsAndPackages = Object.keys(parsed.paths).reduce(function(all, path) {
            all[parsed.paths[path]] = path;
            return all;
        }, mapFromPackages);

        //sort by length, matching more specific before less
        var sorted = Object.keys(mapFromPathsAndPackages).sort(function(a, b) {
            if(a.length > b.length){
                return -1;
            }else if(a.length < b.length){
                return 1;
            }else{
                return 0;
            }
        }).reduce(function(all, path) {
            all[path] = mapFromPathsAndPackages[path];
            return all;
        }, {});

        return sorted;
    },
    _sort: function (buffer, checkPoint) {
        this.updateWithPairs(buffer, this.getSortedPairs(buffer));

        buffer.groupChangesSinceCheckpoint(checkPoint);
    },
    ensureModulesAreLoaded: function (bufferPath) {
        if (!this.modules) {
            this.modules = crawler.crawl(
                crawler.getBaseFolderPath(bufferPath, atom.config.get('amdbutler.baseFolders')),
                this.getReplaceMapFromConfig(atom.config.get('amdbutler.requirejsConfigFile'))
            );
        }
    },

    // commands
    add: function () {
        console.log('amdbutler:add');
        var buffer = atom.workspace.getActivePaneItem().buffer;

        this.ensureModulesAreLoaded(buffer.getPath());

        var excludes = this.getSortedPairs(buffer).map(function (i) {
            return i.path;
        });

        excludes = excludes.concat(atom.config.get('amdbutler.excludePaths'));

        this.modsView.show(this.modules, 'add', excludes);
    },
    sort: function () {
        console.log('amdbutler:sort');
        var buffer = atom.workspace.getActivePaneItem().buffer;
        var checkPoint = buffer.createCheckpoint();

        this._sort(buffer, checkPoint);
    },
    remove: function () {
        console.log('amdbutler:remove');

        var buffer = atom.workspace.getActivePaneItem().buffer;

        this.modsView.show(this.getSortedPairs(buffer), 'remove');
    }
};
