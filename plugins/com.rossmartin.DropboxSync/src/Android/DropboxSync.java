package com.rossmartin.DropboxSync;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URL;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.List;

import com.dropbox.sync.android.DbxAccountManager;
import com.dropbox.sync.android.DbxException;
import com.dropbox.sync.android.DbxException.Unauthorized;
import com.dropbox.sync.android.DbxFileInfo;
import com.dropbox.sync.android.DbxFileSystem;
import com.dropbox.sync.android.DbxPath;
import com.dropbox.sync.android.DbxFileSystem.PathListener.Mode;
import com.dropbox.sync.android.DbxFile;
import com.dropbox.sync.android.DbxSyncStatus;


/**
 * PhoneGap Dropbox Sync Plugin for Android - Ross Martin 8/21/13.
 */
public class DropboxSync extends CordovaPlugin {
    
    private static final String TAG = "DropboxSync";
    private static final String APP_KEY = "81v5tm7jg21zk8c"; // Your app key here
    private static final String APP_SECRET = "f9cwicck72tuhpx"; // Your app secret here
    static final int REQUEST_LINK_TO_DBX = 1337;  // This value is up to you
    private DbxAccountManager mDbxAcctMgr;
    
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        Log.d(TAG, "execute method starting");
        mDbxAcctMgr = DbxAccountManager.getInstance(cordova.getActivity().getApplicationContext(), APP_KEY, APP_SECRET);
        if (action.equals("checkLink")) {
            checkLink(callbackContext);
            return true;
        } else if (action.equals("link")) {
            link(callbackContext);
            return true;
        } else if (action.equals("unlink")) {
            unlink(callbackContext);
            return true;
        } else if (action.equals("listFolder")) {
            String path = args.getString(0);
            listFolder(path, callbackContext);
            return true;
        } else if (action.equals("addObserver")) {
            String path = args.getString(0);
            addObserver(path, callbackContext);
            return true;
        } else if (action.equals("getImageBase64String")) {
            String path = args.getString(0);
            getImageBase64String(path, callbackContext);
            return true;
        } else if (action.equals("readString")) {
            String path = args.getString(0);
            readString(path, callbackContext);
            return true;
        } else if (action.equals("uploadFile")) {
            String localPath = args.getString(0);
            String dropboxPath = args.getString(1);
            if (! dropboxPath.endsWith("/")) {
                dropboxPath += "/";
            }
            uploadFile(localPath, dropboxPath, callbackContext);
            return true;
        } else if (action.equals("uploadFolder")) {
            String localPath = args.getString(0);
            String dropboxPath = args.getString(1);
            if (! dropboxPath.endsWith("/")) {
                dropboxPath += "/";
            }
            boolean doRecursive = args.getBoolean(2);
            uploadFolder(localPath, dropboxPath, doRecursive, callbackContext);
            return true;
        } else if (action.equals("deleteFile")) {
            String dropboxPath = args.getString(0);
            deleteFile(dropboxPath, callbackContext);
            return true;
        } else if (action.equals("createFolder")) {
            String dropboxPath = args.getString(0);
            createFolder(dropboxPath, callbackContext);
            return true;
        } else if (action.equals("openFile")) {
            String path = args.getString(0);
            openFile(path, callbackContext);
            return true;
        }
        return false;
    }
    
    private void checkLink(CallbackContext callbackContext) {
        Log.d(TAG, "checkLink method executing");
        if (mDbxAcctMgr.hasLinkedAccount()){
            callbackContext.success();
        } else {
            callbackContext.error("User not authenticated yet");
        }
    }

    private void link(CallbackContext callbackContext) {
        Log.d(TAG, "link method executing");
        
        cordova.setActivityResultCallback(DropboxSync.this);
        
        mDbxAcctMgr.startLink(cordova.getActivity(), REQUEST_LINK_TO_DBX);
        callbackContext.success();
    }
    
    private void unlink(CallbackContext callbackContext) {
        Log.d(TAG, "unlink method executing");
        mDbxAcctMgr.unlink();
        callbackContext.success();
    }
    
    private void listFolder(final String path, final CallbackContext callbackContext) {
        Log.d(TAG, "listFolder method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                JSONArray jsonArray = new JSONArray();
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    List<DbxFileInfo> infos = dbxFs.listFolder(new DbxPath(path));
                    for (DbxFileInfo info : infos) {
                        JSONObject dbFile = new JSONObject();
                        dbFile.put("path", info.path);
                        dbFile.put("modifiedTime", info.modifiedTime);
                        dbFile.put("size", info.size);
                        dbFile.put("isFolder", info.isFolder);
                        jsonArray.put(dbFile);
                    }
                    callbackContext.success(jsonArray);
                } catch (Exception e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
        
    }
    
    private void addObserver(final String path, final CallbackContext callbackContext) {
        Log.d(TAG, "addObserver method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    dbxFs.addPathListener(new DbxFileSystem.PathListener() {
                        @Override
                        public void onPathChange(DbxFileSystem arg0, DbxPath arg1, Mode arg2) {
                            webView.sendJavascript("dropbox_fileChange();");
                        }
                        
                    }, new DbxPath(path), Mode.PATH_OR_CHILD);
                    
                    dbxFs.addSyncStatusListener(new DbxFileSystem.SyncStatusListener() {
                        @Override
                        public void onSyncStatusChange(DbxFileSystem fs) {
                            try {
                                DbxSyncStatus dbSyncStatus = fs.getSyncStatus();
                                if (! dbSyncStatus.anyInProgress()) {
                                    webView.sendJavascript("dropbox_onSyncStatusChange('none');");
                                } else {
                                    webView.sendJavascript("dropbox_onSyncStatusChange('sync');");
                                }
                            } catch (DbxException e) {
                                e.printStackTrace();
                            }
                        }
                    });
                    
                    callbackContext.success();
                } catch (Unauthorized e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void getImageBase64String(final String path, final CallbackContext callbackContext) {
        Log.d(TAG, "getImageBase64String method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    DbxPath filePath = new DbxPath(path);
                    DbxFile file = dbxFs.open(filePath);
                    try {
                        FileInputStream contents = file.getReadStream();
                        BufferedInputStream buf = new BufferedInputStream(contents);
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        // read until a single byte is available
                        while(buf.available() > 0) {
                           // read the byte and convert the integer to character
                           char c = (char)buf.read();
                           baos.write(c);
                        }
                        String encodedImage = Base64.encodeToString(baos.toByteArray(), Base64.DEFAULT);
                        callbackContext.success(encodedImage);
                        baos.flush();
                        buf.close();
                    } catch (IOException e) {
                        e.printStackTrace();
                        callbackContext.error(e.getMessage());
                    } finally {
                        file.close();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void readString(final String path, final CallbackContext callbackContext) {
        Log.d(TAG, "readString method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    DbxPath filePath = new DbxPath(path);
                    DbxFile file = dbxFs.open(filePath);
                    try {
                        String contents = file.readString();
                        callbackContext.success(contents);
                    } catch (IOException e) {
                        e.printStackTrace();
                        callbackContext.error(e.getMessage());
                    } finally {
                        file.close();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void uploadFile(final String localPath, final String dropboxPath, final CallbackContext callbackContext) {
        Log.d(TAG, "uploadFile method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    File uploadFile = resolveLocalFileSystemURI(localPath);
                    Log.d(TAG, "dropboxPath + uploadFile.getName() -> " + dropboxPath + uploadFile.getName());
                    DbxPath filePath = new DbxPath(dropboxPath + uploadFile.getName());
                    DbxFile dbxFile;
                    if (dbxFs.exists(filePath)){
                        dbxFile = dbxFs.open(filePath);
                    } else {
                        dbxFile = dbxFs.create(filePath);
                    }
                    dbxFile.writeFromExistingFile(uploadFile, false);
                    dbxFs.syncNowAndWait();
                    dbxFile.close();
                    callbackContext.success();
                } catch (Exception e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void uploadFolder(final String localPath, final String dropboxPath, final boolean doRecursive, final CallbackContext callbackContext) {
        Log.d(TAG, "uploadFolder method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                DbxFileSystem dbxFs;
                List<File> localFileList = new ArrayList<File>();
                
                try {
                    dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    File uploadPath = resolveLocalFileSystemURI(localPath);
                    directorySearch(uploadPath, localFileList, doRecursive);
                    Log.d(TAG, "uploadFolder after directorySearch method call, localFileList -> " + localFileList + " \r\n\r\nRecursion: " + doRecursive);
                    if (localFileList.size() > 0) {
                        for (File file : localFileList) {
                            DbxFile dbxFile;
                            String parentName = uploadPath.getName();
                            int needle = file.getPath().indexOf(parentName);
                            String fileUploadName = file.getPath().substring(needle);
                            Log.d(TAG, "fileUploadName -> " + fileUploadName);
                            if (file.isDirectory()) {
                                DbxPath filePath = new DbxPath(dropboxPath + fileUploadName);
                                if (!dbxFs.exists(filePath)) {
                                    Log.d(TAG, "Creating new directory in Dropbox, directory name -> " + fileUploadName);
                                    dbxFs.createFolder(filePath);
                                }
                            } else {
                                DbxPath filePath = new DbxPath(dropboxPath + fileUploadName);
                                if (dbxFs.exists(filePath)) {
                                    dbxFile = dbxFs.open(filePath);
                                } else {
                                    dbxFile = dbxFs.create(filePath);
                                }
                                dbxFile.writeFromExistingFile(file, false);
                                dbxFs.syncNowAndWait();
                                dbxFile.close();
                            }
                        }
                    } else { // just an empty directory to make
                        if (uploadPath.isDirectory()) {
                            DbxPath filePath = new DbxPath(dropboxPath + uploadPath.getName());
                            if (!dbxFs.exists(filePath)) {
                                Log.d(TAG, "Creating new directory in Dropbox, directory name -> " + uploadPath.getName());
                                dbxFs.createFolder(filePath);
                            }
                        } 
                    }
                    callbackContext.success();
                } catch (Exception e) {
                    e.printStackTrace();
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void deleteFile(final String dropboxPath, final CallbackContext callbackContext) {
        Log.d(TAG, "deleteFile method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                try {
                    DbxFileSystem dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    DbxPath dbxPath = new DbxPath(dropboxPath);
                    
                    dbxFs.delete(dbxPath);
                    dbxFs.syncNowAndWait();
                    
                    callbackContext.success();
                } catch (Exception e) {
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void createFolder(final String dropboxPath, final CallbackContext callbackContext) {
        Log.d(TAG, "createFolder method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                try {
                    DbxFileSystem dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    DbxPath dbxPath = new DbxPath(dropboxPath);
                    
                    dbxFs.createFolder(dbxPath);
                    dbxFs.syncNowAndWait();
                    
                    callbackContext.success();
                } catch (Exception e) {
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
    
    private void openFile(final String path, final CallbackContext callbackContext) {
        Log.d(TAG, "openFile method executing");
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                try {
                    DbxFileSystem dbxFs = DbxFileSystem.forAccount(mDbxAcctMgr.getLinkedAccount());
                    DbxPath filePath = new DbxPath(path);
                    DbxFile file = dbxFs.open(filePath);
                    
                    int fileNameNeedle = path.lastIndexOf("/");
                    String fileName = path.substring(fileNameNeedle);
                    Log.d(TAG, "fileName: " + fileName);
                    
                    File cacheFolder = cordova.getActivity().getApplicationContext().getExternalCacheDir();
                    
                    File tempFile = new File(cacheFolder + "/" + fileName);
                    Log.d(TAG, "tempFile.getPath(): " + tempFile.getPath());
                    
                    FileInputStream inputStream = null;
                    FileOutputStream ouputStream = new FileOutputStream(tempFile);
                    // write the contents of the chosen Dropbox file to the tempFile
                    try {
                        inputStream = file.getReadStream();
                        
                        int read = 0;
                        byte[] bytes = new byte[1024];
                 
                        while ((read = inputStream.read(bytes)) != -1) {
                            ouputStream.write(bytes, 0, read);
                        }
                        
                    } catch (IOException e) {
                        e.printStackTrace();
                        callbackContext.error(e.getMessage());
                    } finally {
                        inputStream.close();
                        ouputStream.close();
                        file.close();
                    }
                    
                    openTempFile(tempFile.getPath());
                    callbackContext.success();
                } catch (Exception e) {
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }
        
    @SuppressWarnings("deprecation")
    private File resolveLocalFileSystemURI(String url) throws IOException, JSONException {
        String decoded = URLDecoder.decode(url, "UTF-8");

        File fp = null;

        // Handle the special case where you get an Android content:// uri.
        if (decoded.startsWith("content:")) {
            Cursor cursor = this.cordova.getActivity().managedQuery(Uri.parse(decoded), new String[] { MediaStore.Images.Media.DATA }, null, null, null);
            // Note: MediaStore.Images/Audio/Video.Media.DATA is always "_data"
            int column_index = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
            cursor.moveToFirst();
            fp = new File(cursor.getString(column_index));
        } else {
            // Test to see if this is a valid URL first
            @SuppressWarnings("unused")
            URL testUrl = new URL(decoded);

            if (decoded.startsWith("file://")) {
                int questionMark = decoded.indexOf("?");
                if (questionMark < 0) {
                    fp = new File(decoded.substring(7, decoded.length()));
                } else {
                    fp = new File(decoded.substring(7, questionMark));
                }
            } else {
                fp = new File(decoded);
            }
        }

        if (!fp.exists()) {
            throw new FileNotFoundException();
        }
        if (!fp.canRead()) {
            throw new IOException();
        }
        return fp;
    }
    
    private static void directorySearch(File dir, List<File> localFileList, boolean recursive) {
        try {
            File[] files = dir.listFiles();
            for (File file : files) {
                localFileList.add(file);
                if (file.isDirectory()) {
                    Log.d(TAG, "directory:" + file.getCanonicalPath());
                    if (recursive) {
                        directorySearch(file, localFileList, true);
                    }
                } else {
                    Log.d(TAG, "file:" + file.getCanonicalPath());
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    
    private void openTempFile(String url) throws IOException {
        // Create URI
        Uri uri = Uri.parse(url);

        Intent intent = null;
        // Check what kind of file you are trying to open, by comparing the url with extensions.
        // When the if condition is matched, plugin sets the correct intent (mime) type, 
        // so Android knew what application to use to open the file
        
        if (url.contains(".doc") || url.contains(".docx")) {
            // Word document
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/msword");
        } else if(url.contains(".pdf")) {
            // PDF file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/pdf");
        } else if(url.contains(".ppt") || url.contains(".pptx")) {
            // Powerpoint file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.ms-powerpoint");
        } else if(url.contains(".xls") || url.contains(".xlsx")) {
            // Excel file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.ms-excel");
        } else if(url.contains(".rtf")) {
            // RTF file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/rtf");
        } else if(url.contains(".wav")) {
            // WAV audio file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "audio/x-wav");
        } else if(url.contains(".gif")) {
            // GIF file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "image/gif");
        } else if(url.contains(".jpg") || url.contains(".jpeg")) {
            // JPG file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "image/jpeg");
        } else if(url.contains(".txt")) {
            // Text file
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "text/plain");
        } else if(url.contains(".mpg") || url.contains(".mpeg") || url.contains(".mpe") || url.contains(".mp4") || url.contains(".avi")) {
            // Video files
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "video/*");
        }         
                
        //if you want you can also define the intent type for any other file
        
        //additionally use else clause below, to manage other unknown extensions
        //in this case, Android will show all applications installed on the device
        //so you can choose which application to use
        
        else {
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "*/*");
        }

        this.cordova.getActivity().startActivity(intent);
    }
    
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult, requestCode: " + requestCode);
        if (requestCode == REQUEST_LINK_TO_DBX) {
            if (resultCode == Activity.RESULT_OK) {
                // ... You can now start using Dropbox Sync API.
                super.webView.sendJavascript("dropbox_linked();");
            } else {
                // ... Link failed or was cancelled by the user.
                Log.d(TAG, "Dropbox link failed or was cancelled by the user.");
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }
   
}