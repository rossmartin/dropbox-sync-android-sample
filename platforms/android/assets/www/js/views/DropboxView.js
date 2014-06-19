function DropboxView(template, listTemplate) {

    var me = this;
    
    this.isTapHolding = false;
    
    this.listTemplate = listTemplate;

    this.initialize = function () {
        
        this.el = $('<div/>');

        this.el.on('click', '#fileList li a.file', function(event) {
            if (me.isTapHolding) return false;
            var filePath = decodeURIComponent($(event.currentTarget).attr('href').substr(1));
            app.showLoader();
            DropboxSync.openFile(filePath, function() {
                app.hideLoader();
            }, function() {
                app.hideLoader();
                console.log('DropboxSync.openFile fail');
            });
            event.preventDefault();
        });
                
        this.el.on('taphold', '#fileList li a', function(event) {
            me.isTapHolding = true;
            var fileName = $(event.target).text().trim(),
                dropboxFilePath = (app.dropboxPath == '/') ? '/' + fileName : app.dropboxPath + '/' + fileName;
            me.showFileTapholdModal(fileName).done(function(el) {
                app.hideModal();
                switch(el.id) {
                    case 'btn-share':
                        // todo
                        break;
                    case 'btn-RenameFile':
                        // todo
                        break;
                    case 'btn-deleteFile':
                        DropboxSync.deleteFile(dropboxFilePath, function(result) {
                            me.listFolder();
                        }, function() {
                            console.log('DropboxSync.deleteFile fail');
                        });
                        break;
                }
                me.isTapHolding = false;
            }).fail(function() {
                me.isTapHolding = false;
            });
            event.preventDefault();
        });
        
        this.el.on('click', '#btn-back', function(event) {
            event.preventDefault();
            (app.dropboxPath == '/') ? navigator.app.exitApp() : window.history.back();
        });
        
        $('#effeckt-off-screen-nav').off(); // unbind previous events from any other view first
        
        $('#effeckt-off-screen-nav').on('click', '#btn-uploadFiles', function(event) {
            app.toggleNav().done(function() {
                app.showFileUploadView();
            });
            event.preventDefault();
        });
        
        $('#effeckt-off-screen-nav').on('click', '#btn-newFolder', function(event) {
            app.toggleNav().done(function() {
                window.showPrompt('Enter folder name', function(results) {
                    event.preventDefault(); // dialog btns can trigger hashchange, need this
                    if (results.buttonIndex == 1) {
                        var folderName = results.input1.trim(),
                            dropboxFilePath = (app.dropboxPath == '/') ? '/' + folderName : app.dropboxPath + '/' + folderName;
                        if (dropboxFilePath == '/') return false; // user tapped OK but didn't type a folder name
                        DropboxSync.createFolder(dropboxFilePath, function() {
                            me.listFolder();
                        }, function() {
                            console.log('DropboxSync.createFolder fail');
                        });
                    }
                }, 'New Folder', ['Ok', 'Cancel'], '');
            });
            event.preventDefault();
        });
        
        $('#effeckt-off-screen-nav').on('click', '#btn-refresh', function(event) {
            app.toggleNav().done(function() {
                me.listFolder();
            });
            event.preventDefault();
        });

        window.onhashchange = function(event) {
            if (me.isTapHolding) { 
                event.preventDefault();
                return false;
            }
            app.dropboxPath = decodeURIComponent(window.location.hash.substr(1));
            if (app.dropboxPath == '') {
                app.dropboxPath = '/';
            }
            $('#path').html(app.dropboxPath);
            me.listFolder();
        };

        me.createNavMenu();

    }; // end initialize

    this.render = function() {
        this.el.html(template());
        return this;
    };

    this.initialize();

};

DropboxView.prototype.listFolder = function() {
    var i,
        html = "",
        file,
        fileArray = [],
        folderArray = [],
        fileList = [],
        me = this;
    DropboxSync.listFolder(app.dropboxPath, function(files) {
        for (i = 0; i < files.length; i++) {
            file = files[i];
            file.fileName = files[i].path.substr(file.path.lastIndexOf("/") + 1);
            file.encodedPath = encodeURIComponent(files[i].path);
            if (file.isFolder) {
                folderArray.push(file);
            } else {
                fileArray.push(file);
            }
        }
        folderArray.sortByKey('path');
        fileArray.sortByKey('path');
        fileList = folderArray.concat(fileArray);
        html = me.listTemplate(fileList);
        $('#path').html(app.dropboxPath);
        $('#fileList').html(html);
        if (app.dropboxViewIScroll) {
            app.dropboxViewIScroll.destroy(); // refresh isn't working correctly
        }
        setTimeout(function() {
            app.dropboxViewIScroll = new IScroll($('#scroller', me.el)[0], {
                scrollbars: true,
                fadeScrollbars: true,
                shrinkScrollbars: 'clip',
                click: true
            });
            $('#scroller', me.el).pullToRefresh({
                callback: function () {
                    var deferred = $.Deferred();
                    
                    setTimeout(function () {
                        deferred.resolve();
                        me.listFolder();
                    }, 2000);

                    return deferred.promise();
                }
            }, app.dropboxViewIScroll);
            app.dropboxViewIScroll.on('scrollEnd', me.onIScrollEnd);
            var checkIndex = app.dropboxViewScrollCache.contains('path', app.dropboxPath);
            if (checkIndex != -1) {
                app.dropboxViewIScroll.scrollTo(0, app.dropboxViewScrollCache[checkIndex].pos);
            }
        }, 50);
    }, function(error) {
        console.log('DropboxSync.listFolder error');
    });
};

DropboxView.prototype.onIScrollEnd = function() {
    var checkIndex = app.dropboxViewScrollCache.contains('path', app.dropboxPath);
    if (checkIndex == -1) {
        app.dropboxViewScrollCache.push({
            path: app.dropboxPath,
            pos: this.y
        });
    } else {
        app.dropboxViewScrollCache[checkIndex].pos = this.y;
    }
};

DropboxView.prototype.createNavMenu = function() {
    app.createNavMenu({
        header: 'Dropbox',
        listItem:  [
                        {
                            text: 'Upload Here',
                            id: 'btn-uploadFiles'
                        },
                        {
                            text: 'New Folder Here',
                            id: 'btn-newFolder'
                        },
                        {
                            text: 'Refresh',
                            id: 'btn-refresh'
                        },
                        {
                            text: 'Unlink',
                            id: 'btn-unlink',
                            onClickEvent: 'app.showUnlinkModal()'
                        }
                   ]
    });
};

DropboxView.prototype.showFileTapholdModal = function(fileName) {
    app.modalDeferred = $.Deferred();
    
    app.createModal({
        header: fileName,
        listItem:  [
                        {
                            text: 'Share',
                            id: 'btn-share',
                            onClickEvent: 'app.resolveModalDeferred(this)'
                        },
                        {
                            text: 'Rename',
                            id: 'btn-RenameFile',
                            onClickEvent: 'app.resolveModalDeferred(this)'
                        },
                        {
                            text: 'Move',
                            id: 'btn-moveFile',
                            onClickEvent: 'app.resolveModalDeferred(this)'
                        },
                        {
                            text: 'Delete',
                            id: 'btn-deleteFile',
                            onClickEvent: 'app.resolveModalDeferred(this)'
                        }
                   ]
    });
    
    app.showModal();
    
    return app.modalDeferred.promise();
};