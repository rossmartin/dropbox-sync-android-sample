var app = (function() {

    var loadIcon = $('#loader'),
        viewContainer = $('#viewContainer'),
        offScreenNav = $('#effeckt-off-screen-nav'),
        modalViewWrap = $('#effeckt-modal-wrap'),
        modalViewListContainer = $('#modalViewListContainer'),
        topcoatListTpl = Handlebars.compile($('#topcoatList-tpl').html()),
        welcomeViewTpl = Handlebars.compile($('#welcomeView-tpl').html()),
        dropboxViewTpl = Handlebars.compile($('#dropboxView-tpl').html()),
        fileListTpl = Handlebars.compile($('#fileList-tpl').html()),
        fileUploadViewTpl = Handlebars.compile($('#fileUploadView-tpl').html()),
        localFileListTpl = Handlebars.compile($('#localFileList-tpl').html()),
        slider = new PageSlider(viewContainer);
    
    function showWelcomeView() {
        var welcomeView = new WelcomeView(welcomeViewTpl);
        viewContainer.empty();
        slider.slidePageFrom(welcomeView.render().el, 'left');
    }

    function showDropboxView() {
        var dropboxView = new DropboxView(dropboxViewTpl, fileListTpl),
            fromFileUploadView = $('#fileUploadView').length > 0;
        viewContainer.empty();
        slider.slidePageFrom(dropboxView.render().el, (fromFileUploadView) ? 'left' : 'right');
        
        dropboxView.listFolder();
        DropboxSync.addObserver('/');
    }
    
    function showFileUploadView() {
        var fileUploadView = new FileUploadView(fileUploadViewTpl, localFileListTpl);
        viewContainer.empty();
        slider.slidePageFrom(fileUploadView.render().el, 'right');
        
        if (app.localFileFullPath == '') {
            // request the persistent file system
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, fileUploadView.getFSRoot, fileUploadView.FSfail);
        } else {
            fileUploadView.getFolderWithPath();
        }
    }

    function createNavMenu(obj) {
        offScreenNav.empty().html(topcoatListTpl(obj));
    }
    
    function createModal(obj) {
        modalViewListContainer.empty().html(topcoatListTpl(obj));
    }
    
    function showUnlinkModal() {
        createModal({
            header: 'Unlink from Dropbox?',
            listItem:  [
                            {
                                text: 'Unlink',
                                id: 'btn-unlinkDropbox'
                            }
                       ]
        });
        showModal();
    }
    
    function toggleNav() {
        //EffecktOffScreenNav.toggleNav(); // not as reliable as below
        $('#btn-navMenu').trigger('click');
        
        // must wait at least 500 ms for the navMenu transform to finish, webkitTransitionEnd isn't working, i tried :~(
        var deferred = $.Deferred();
        setTimeout(function() {
            deferred.resolve();
        }, 725);
        
        return deferred.promise();
    }

    function showModal() {
        $('#btn-modalView').trigger('click');
    }
    
    function hideModal() {
        $('.effeckt-overlay').trigger('click');
        if (app.modalDeferred) {
            app.modalDeferred.reject();
        }
    }
    
    function resolveModalDeferred(el) {
        app.modalDeferred.resolve(el);
    }

    function navMenuIsVisible() {
        return offScreenNav.hasClass('effeckt-off-screen-nav-show');
    }
    
    function modalIsVisible() {
        return modalViewWrap.hasClass('effeckt-show');
    }

    function showLoader() {
        loadIcon.show();
    }
    
    function hideLoader() {
        loadIcon.hide();
    }
    
    modalViewListContainer.on('click', '#btn-unlinkDropbox', function(event) {
        hideModal();
        toggleNav().done(function() {
            showLoader();
            DropboxSync.unlink(function() {
                hideLoader();
                showWelcomeView();
            }, function(error) {
                console.log('DropboxSync unlink error');
            });
        });
        event.preventDefault();
    });
    
    document.addEventListener("deviceReady", function() {   // ready for kickoff
        FastClick.attach(document.body);
        
        if (navigator.notification) { // Override default HTML alert with native dialog
            window.showConfirm = function(message, title, labels, success) {
                navigator.notification.confirm(
                    message, // message string
                    success, // callback to invoke with index of button pressed
                    title,   // title string
                    labels   // buttonLabels array
                );
            };
            window.showPrompt = function(message, callback, title, labels, defaultText) {
                navigator.notification.prompt(
                    message,
                    callback,
                    title,
                    labels,
                    defaultText // shown in input textbox
                )
            };
        }
        
        DropboxSync.checkLink(showDropboxView, showWelcomeView);
        
        // hook btn-back to the device's back button
        document.addEventListener('backbutton', onBackKeyDown, false);
        function onBackKeyDown(event) {
            if (navMenuIsVisible()) {
                toggleNav(); // no need to wait for deferred
            } else if (modalIsVisible()) {
                hideModal();
            } else {
                $('#btn-back').trigger('click');
            }
            event.preventDefault();
        }
        
        document.addEventListener("menubutton", onMenuKeyDown, false);
        function onMenuKeyDown(event) {
            if (modalIsVisible()) return false;
            toggleNav();
            event.preventDefault();
        }
    });

    Array.prototype.sortByKey = function(key) {
        this.sort(function(a, b) {
            var x = a[key].toLowerCase(); 
            var y = b[key].toLowerCase();
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    
    Array.prototype.contains = function(key, value) {
        for (var i = 0; i < this.length; i++) {
            if (this[i][key] == value) {
                return i;
            }
        }
        return -1;
    };

    return {
        dropboxPath: '/',
        localFileFullPath: '',
        showWelcomeView: showWelcomeView,
        showFileUploadView: showFileUploadView,
        showDropboxView: showDropboxView,
        dropboxViewScrollCache: [],
        fileUploadViewScrollCache: [],
        dropboxViewIScroll: null,
        fileUploadViewIScroll: null,
        showUnlinkModal: showUnlinkModal,
        createModal: createModal,
        createNavMenu: createNavMenu,
        toggleNav: toggleNav,
        showModal: showModal,
        hideModal: hideModal,
        modalDeferred: null,
        resolveModalDeferred: resolveModalDeferred,
        loadIcon: loadIcon,
        showLoader: showLoader,
        hideLoader: hideLoader
    }
    
})();

// called from the onActivityResult method in the plugin when linking is successful.
function dropbox_linked() {
    app.showDropboxView();
}

// called by observer in the plugin when there's a change to the status of background synchronization (download/upload).
function dropbox_onSyncStatusChange(status) {
    (status == 'none') ? app.hideLoader() : app.showLoader();
}

// called by observer in the plugin when a file is changed.
function dropbox_fileChange() {
    /*if ($('#dropboxView').length > 0) {
        app.dropboxView.listFolder();
    }*/
    // no need to list folder anymore since i added pull to refresh feature
    console.log('dropbox_fileChange()');
}