var path = require('path');
var glob = require('glob');
var title = require('change-case').title;
var ALIASES = require('./data/preferred-argument-aliases');
var JS_KEYWORDS = require('./data/js-keywords');
var gaze = require('gaze');


module.exports = {
    modules: null,
    getBaseFolderPath: function (filePath, baseFolderNames) {
        var baseFolderName;
        baseFolderNames.some(function (name) {
            var regex = new RegExp('\\' + path.sep + name + '\\' + path.sep);
            if (filePath.match(regex)) {
                baseFolderName = name;
                return true;
            } else {
                return false;
            }
        });

        // TODO: error handle not finding the path
        if (!baseFolderName) {
            throw 'None of the base folders (' + baseFolderNames.join(',') +
                ') were found in the path to the current file (' + filePath + ')!';
        }

        return path.join(filePath.split(baseFolderName)[0], baseFolderName);
    },
    crawl: function (basePath, currentPackage, replaceMap) {
        var excludes = ['**/nls/**', '**/tests/**'];
        var options = {
            cwd: basePath,
            nodir: true,
            ignore: excludes
        };

        var that = this;
        this.modules = glob.sync('**/*.js', options).map(function (entry) {
            return that.getModuleFromPath(entry, null, replaceMap);
        });

        // only watch files in the current package so that we aren't watching all of the
        // project dependencies
        var patterns = ['**/*.js'].concat(excludes.map(function (ex) {
            return '!' + ex;
        }));
        gaze(patterns, {cwd: path.join(basePath, currentPackage)}, function () {
            that.watcher = this;
            this.on('added', function (path) {
                console.log('added: ', path);
                that.modules.push(that.getModuleFromPath(path, basePath, replaceMap));
            });
            this.on('deleted', function (path) {
                console.log('deleted: ', path);
                that.removeModule(path, basePath, replaceMap);
            });
            this.on('rename', function (newPath, oldPath) {
                console.log('renamed: ' + oldPath + ' -> ' + newPath);
                that.removeModule(oldPath, basePath, replaceMap);
                that.modules.push(that.getModuleFromPath(newPath, basePath, replaceMap));
            });
        });
    },
    getModuleFromPath: function (entry, basePath, replaceMap) {
        var modPath = entry.slice(0, -3);
        if (basePath) {
            modPath = modPath.replace(basePath + '/', '');
        }
        return {path: this.getModPath(modPath, replaceMap), rawPath: modPath, name: this.getParamName(modPath)};
    },
    removeModule: function (entry, basePath, replaceMap) {
        var mod = this.getModuleFromPath(entry, basePath, replaceMap);
        var index;
        this.modules.some(function (m, i) {
            if (m.path === mod.path) {
                index = i;
                return true;
            } else {
                return false;
            }
        });

        if (index) {
            this.modules.splice(index, 1);
        }
    },
    getModPath: function (mod, replaceMap) {
      replaceMap = replaceMap || {};
      var toReplace = Object.keys(replaceMap).filter(function(key) {
          return mod.indexOf(key) === 0;
      })[0];

      if(toReplace){
          return mod.replace(toReplace, replaceMap[toReplace]);
      }else{
          return mod;
      }
    },
    getParamName: function (mod) {
        if (Object.keys(ALIASES).indexOf(mod) !== -1) {
            return ALIASES[mod];
        }

        var modParts = mod.split('/');
        var name = modParts[modParts.length - 1];
        if (JS_KEYWORDS.indexOf(name) !== -1) {
            return modParts[0] + title(name);
        } else if (name.indexOf('-') !== -1) {
            var words = name.split('-');
            return words[0] + title(words[1]);
        } else {
            return name;
        }
    },
    destroy: function () {
        this.watcher.close();
    }
};
