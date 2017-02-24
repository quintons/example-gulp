'use strict';

// gulp modules
var gulp = require('gulp'),
    concat = require('gulp-concat'),
    path = require('path');

/**
 * exports array of js files to be concatenated
 * @type {string[]}
 */
module.exports = function(_bundle){

    const source = require(_bundle); // complete json source of the passed bundle file
    var pipes = []; // contains an array of pipes to be returned

    if(source !== undefined){
        for(var o in source){
            if(source.hasOwnProperty(o)){
                // apply path to each file
                
                var current = source[o]; // grab each file list in the bundle json

                var filesFromSrc = [];
                var files = [];

                for(var i = 0; i < current.files.length; i++){
                    var file = current.files[i];
                    filesFromSrc.push(path.join(current.src, '/' + file));
                    files.push(file);
                }

                // push an object of properties for the calling task to deal with
                pipes.push({
                    process: concat(current.name),
                    srcFiles: filesFromSrc,
                    files: files,
                    src: current.src,
                    dest: current.dest,
                    name: current.name,
                    minify: current.minify
                });
            }
        }
    }

    // returning array of pipes
    return pipes;

};