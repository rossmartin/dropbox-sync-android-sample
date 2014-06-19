var pluginName = 'DropboxSync',
    exec = require('cordova/exec');
    
function DropboxSync() {
}

DropboxSync.prototype.link = function() {
    exec(function() {
            console.log('DropboxSync link call success');
        },
        function() {
            console.log('DropboxSync link call fail');
        },
        pluginName, 'link', ['']
    );
};

DropboxSync.prototype.checkLink = function(successCB, failCB) {
    exec(successCB, failCB, pluginName, 'checkLink', ['']);
};

DropboxSync.prototype.unlink = function(successCB, failCB) {
    exec(successCB, failCB, pluginName, 'unlink', ['']);
};

DropboxSync.prototype.listFolder = function(dropboxPath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'listFolder', [dropboxPath]);
};

DropboxSync.prototype.addObserver = function(dropboxPath) {
    exec(function() {
            console.log('DropboxSync addObserver success');
        },
        function(error) {
            console.log('DropboxSync addObserver error');
        },
        pluginName, 'addObserver', [dropboxPath]
    );
};

DropboxSync.prototype.getImageBase64String = function(dropboxFilePath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'getImageBase64String', [dropboxFilePath]);
};

DropboxSync.prototype.readString = function(dropboxFilePath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'readString', [dropboxFilePath]);
};

DropboxSync.prototype.uploadFile = function(options, successCB, failCB) {
    if (!options.filePath) {
        alert('Specify local file path for upload.');
        failCB();
    }
    options.dropboxPath = options.dropboxPath || '/';
    exec(successCB, failCB, pluginName, 'uploadFile', [options.filePath, options.dropboxPath]);
};

DropboxSync.prototype.uploadFolder = function(options, successCB, failCB) {
    if (!options.folderPath) {
        alert('Specify local folder path for upload.');
        failCB();
    }
    options.dropboxPath = options.dropboxPath || '/';
    options.doRecursive = options.doRecursive || false;
    exec(successCB, failCB, pluginName, 'uploadFolder', 
        [options.folderPath, options.dropboxPath, options.doRecursive]
    );
};

DropboxSync.prototype.deleteFile = function(dropboxFilePath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'deleteFile', [dropboxFilePath]);
};

DropboxSync.prototype.createFolder = function(dropboxFilePath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'createFolder', [dropboxFilePath]);
};

DropboxSync.prototype.openFile = function(dropboxFilePath, successCB, failCB) {
    exec(successCB, failCB, pluginName, 'openFile', [dropboxFilePath]);
};

module.exports = new DropboxSync();