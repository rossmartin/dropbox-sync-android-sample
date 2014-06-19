function FileUploadView(template, listTemplate) {

    var me = this;
    
    this.isTapHolding = false;

    this.listTemplate = listTemplate;

    this.initialize = function () {

        this.el = $('<div/>');
        
        this.el.on('click', '#localFileList li a.file', function(event) {
            if (me.isTapHolding) {
                return false;
            }
            window.plugins.fileOpener.open($(this).attr('fullPath'));
            event.preventDefault();
        });

        this.el.on('click', '#localFileList li a.folder', function(event) {
            if (me.isTapHolding) {
                return false;
            }
            app.localFileFullPath = $(this).attr('fullPath');
            me.getFolderWithPath();
            event.preventDefault();
        });

        this.el.on('taphold', '#localFileList li a', function(event) {
            me.isTapHolding = true;
            var fullPath = $(event.target).attr('fullPath'),
                fileName = $(event.target).attr('fileName'),
                isFile = $(event.target).hasClass('file');
            me.showFileTapholdModal(fileName, isFile).done(function(el) {
                app.hideModal();
                switch(el.id) {
                    case 'btn-uploadFile':
                        DropboxSync.uploadFile({
                            filePath: fullPath, 
                            dropboxPath: app.dropboxPath
                        }, function() {
                            console.log('DropboxSync.uploadFile success');
                        }, function (error) {
                            console.log('DropboxSync.uploadFile fail');
                        });
                        break;
                    case 'btn-uploadFolderRecursive':
                        DropboxSync.uploadFolder({
                            folderPath: fullPath, 
                            dropboxPath: app.dropboxPath, 
                            doRecursive: true
                        }, function() {
                            console.log('DropboxSync.uploadFolder success (recursive)');
                        }, function (error) {
                            console.log('DropboxSync.uploadFolder fail');
                        });
                        break;
                    case 'btn-uploadFolder':
                        DropboxSync.uploadFolder({
                            folderPath: fullPath, 
                            dropboxPath: app.dropboxPath
                        }, function() {
                            console.log('DropboxSync.uploadFolder success');
                        }, function (error) {
                            console.log('DropboxSync.uploadFolder fail');
                        });
                        break;
                    case 'btn-RenameFile':
                        // todo
                        break;
                    case 'btn-deleteFile':
                        // todo
                        break;
                }
                me.isTapHolding = false;
            }).fail(function() {
                me.isTapHolding = false;
            });
            event.preventDefault();
        });

        this.el.on('click', '#btn-back', function(event) {
            if (app.localFileFullPath == 'file:///') { // if we're at root
                me.showBackToDropboxModal().done(function(el) {
                    app.hideModal();
                    app.showDropboxView();
                });
            } else {
                me.getParentFolder();
            }
            event.preventDefault();
        });
        
        $('#effeckt-off-screen-nav').off(); // unbind previous events from any other view first
        
        $('#effeckt-off-screen-nav').on('click', '#btn-backToDropboxView', function(event) {
            app.toggleNav().done(function() {
                app.showDropboxView();
            });
            event.preventDefault();
        });
        
        window.onhashchange = null; // the notification dialog buttons can trigger a hashchange event, destroy the event listener
        
        me.createNavMenu();
         
    }; // end initialize

    this.render = function() {
        this.el.html(template());
        return this;
    };
    
    this.getFSRoot = function(fileSystem) { // not really root on first run, but you can get to root if you're rooted by clicking back
        window.resolveLocalFileSystemURI("file:///storage", function(dir) {
           app.localFileFullPath = dir.fullPath;
           var directoryReader = dir.createReader();
           directoryReader.readEntries(me.readerSuccess,me.readerFail);
        }, function(err){
           console.log('failed to get /storage directory, error ' + err.code + '\nfalling back to using fileSystem.root.fullPath');
           app.localFileFullPath = fileSystem.root.fullPath;
           var directoryReader = fileSystem.root.createReader();
           directoryReader.readEntries(me.readerSuccess,me.readerFail);
        });
    };
    
    this.readerSuccess = function(entries) {
        me.appendToLocalFileList(entries);
    };

    this.initialize();

}; // end FileUploadView

FileUploadView.prototype.appendToLocalFileList = function(entries) {
    var fileCount = entries.length,
        html = '',
        file,
        fileArray = [],
        folderArray = [],
        fileList = [],
        me = this;
    if (fileCount > 0) {
        for (var i = 0; i < fileCount; i++) {
            file = entries[i];
            if (file.isDirectory) {
                folderArray.push(file);
            } else {
                fileArray.push(file);
            }
        }
        folderArray.sortByKey('name');
        fileArray.sortByKey('name');
        fileList = folderArray.concat(fileArray);
        html = this.listTemplate(fileList);
    } else {
        html = this.listTemplate();
    }
    $('#localPath').text( (app.localFileFullPath != '') ? app.localFileFullPath : 'file:///storage' );
    $('#localFileList').html(html);
    if (app.fileUploadViewIScroll) {
        app.fileUploadViewIScroll.destroy(); // refresh isn't working correctly
    }
    setTimeout(function() {
        app.fileUploadViewIScroll = new IScroll($('#localFileListScroller', me.el)[0], {
            scrollbars: true,
            fadeScrollbars: true,
            shrinkScrollbars: 'clip',
            click: true
        });
        app.fileUploadViewIScroll.on('scrollEnd', me.onIScrollEnd);
        var checkIndex = app.fileUploadViewScrollCache.contains('path', app.localFileFullPath);
        if (checkIndex != -1) {
            app.fileUploadViewIScroll.scrollTo(0, app.fileUploadViewScrollCache[checkIndex].pos);
        }
    }, 50);
};

FileUploadView.prototype.onIScrollEnd = function() {
    var checkIndex = app.fileUploadViewScrollCache.contains('path', app.localFileFullPath);
    if (checkIndex == -1) {
        app.fileUploadViewScrollCache.push({
            path: app.localFileFullPath,
            pos: this.y
        });
    } else {
        app.fileUploadViewScrollCache[checkIndex].pos = this.y;
    }
};

FileUploadView.prototype.getFolderWithPath = function() {
    var me = this;
    window.resolveLocalFileSystemURI(app.localFileFullPath, function(dir) {
        var directoryReader = dir.createReader();
        directoryReader.readEntries(me.readerSuccess,me.readerFail);
    }, function(err){
        console.log("getDirectory error " + err.code);
    });
};

FileUploadView.prototype.getParentFolder = function() {
    var me = this;
    if (app.localFileFullPath != 'file:///storage/sdcard0' && app.localFileFullPath != 'file:///storage/sdcard') {
        window.resolveLocalFileSystemURI(app.localFileFullPath, function(dir) {
            dir.getParent(function(parent) {
                app.localFileFullPath = parent.fullPath;
                var directoryReader = parent.createReader(); // this gives the wrong path when at file:///storage/sdcard
                directoryReader.readEntries(me.readerSuccess,me.readerFail);
            }, function(err){
                console.log("getParent error " + err.code);
            });
        }, function(err){
            console.log("getDirectory error " + err.code);
        });
    } else {
        window.resolveLocalFileSystemURI('file:///storage', function(dir) {
            app.localFileFullPath = dir.fullPath;
            var directoryReader = dir.createReader();
            directoryReader.readEntries(me.readerSuccess,me.readerFail);
        }, function(err){
            console.log("error getting storage directory, error " + err.code);
        });
    }
};

FileUploadView.prototype.FSfail = function(err) {
    console.log("FSfail and error is below");
    console.log(err);
};
        
FileUploadView.prototype.readerFail = function(error) {
    alert("Failed to list directory contents: " + error.code);
};

FileUploadView.prototype.createNavMenu = function() {
    app.createNavMenu({
        header: 'Local File Browser',
        listItem:  [
                        {
                            text: 'Back to Dropbox List',
                            id: 'btn-backToDropboxView'
                        },
                        {
                            text: 'New Folder Here',
                            id: 'btn-newFolder'
                        },
                        {
                            text: 'Unlink',
                            id: 'btn-unlink',
                            onClickEvent: 'app.showUnlinkModal()'
                        }
                   ]
    });
};

FileUploadView.prototype.showFileTapholdModal = function(fileName, isFile) {
    app.modalDeferred = $.Deferred();
    
    var listObjs = [];
    
    if (isFile) {
        listObjs.push(
            {
                text: 'Upload File',
                id: 'btn-uploadFile',
                onClickEvent: 'app.resolveModalDeferred(this)'
            }
        );
    } else {
        listObjs.push(
            {
                text: 'Upload Folder Recursively',
                id: 'btn-uploadFolderRecursive',
                onClickEvent: 'app.resolveModalDeferred(this)'
            },
            {
                text: 'Upload Folder',
                id: 'btn-uploadFolder',
                onClickEvent: 'app.resolveModalDeferred(this)'
            }
        );
    }
    
    listObjs.push(
        {
            text: 'Rename',
            id: 'btn-RenameFile',
            onClickEvent: 'app.resolveModalDeferred(this)'
        }
    );
    
    app.createModal({
        header: fileName,
        listItem: listObjs
    });
    
    app.showModal();
    
    return app.modalDeferred.promise();
};

FileUploadView.prototype.showBackToDropboxModal = function() {
    app.modalDeferred = $.Deferred();
    
    app.createModal({
        header: 'Go back to Dropbox List?',
        listItem:  [
                        {
                            text: 'Back to Dropbox List',
                            id: 'btn-backToDropbox',
                            onClickEvent: 'app.resolveModalDeferred(this)'
                        }
                   ]
    });
    
    app.showModal();
    
    return app.modalDeferred.promise();
}