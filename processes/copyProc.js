'use strict';

// imported gulp modules
var gulp = require('gulp'),
    path = require('path');

/**
 *
 * @param _bundle
 * @param rootDestination
 */
module.exports = function(_bundle, rootDestination){

    const source = require(_bundle); // complete json source of the passed bundle file

    if(source !== undefined){

        var settings = require('./settings.json');

        for(var o in source){
            if(source.hasOwnProperty(o)){

                var current = source[o]; // grab each file list in the bundle json
                var currentFiles = current.files; // grabs the list of files in the JSON file
                // replaces the '{mainFolder}' string with the main folder located in the settings json file
                var originalSrc = current.originalSrc.replace('{mainFolder}', settings.mainFolder);

                if(originalSrc !== '') { // if original source does not exist, do not continue
                    for (var h = 0; h < currentFiles.length; h++) {
                        
                        var index = currentFiles[h].lastIndexOf('/');
                        var loc = (index === -1) ? '' : '/' + currentFiles[h].substring(0, currentFiles[h].lastIndexOf('/'));

                        var src = path.join(originalSrc, currentFiles[h]);
                        
                        var dest = path.join(rootDestination, '/' + current.dest + loc);

                        // processes the files from its source to its destination
                        gulp.src(src)
                            .pipe(gulp.dest(dest))
                    }
                }
            }
        }
    }else{
        // no JSON passed to _bundle argument
        console.error('error on accessing javascript bundle.')
    }

};


