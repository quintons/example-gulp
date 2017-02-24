
/*
* Order of execution - copy, build, deploy
* See: 
* */

'use static';

var gulp = require('gulp'),
    path = require('path'),
    del = require('del'),
    concat = require('gulp-concat'),
    watch = require('gulp-watch'),
    minify = require('gulp-minify'),
    cleanCSS = require('gulp-clean-css'),
    sourcemaps = require('gulp-sourcemaps'),
    runSq = require('run-sequence'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    args = require('minimist')(process.argv.slice(2)),
    gulpif = require('gulp-if'),
    insert = require('gulp-insert'),
    minifyCshtml = require('gulp-minify-cshtml'),
    fs = require('fs'),
    tap = require('gulp-tap'); // tap into the pipe stream/access files being processed

/**
 * pulls in the settings file.
 */
var settings = require('./processes/settings.json');
var datetime;

/**
 * path setup
 */
var localRoot = settings.localRoot,
    remoteRoot = settings.remoteRoot.replace('{target}', args.target),
    mobileRootCshtml = path.join(settings.localRoot + settings.mainFolder, 'Titan/Views/CustomFieldHelperPartialsMobile/'),
    isMinify = settings.minify,
    quoodaMobileRoot = localRoot + 'QUOODA Mobile\\Resources\\webview\\',
    root = localRoot + settings.mainFolder + 'Titan\\Content\\mobile\\',
    webviewRemote = path.join(remoteRoot, '/Resources/webview');

/**
 * checks if the '--target' argument has been passed and if the target exists.
 * note: this has not been implemented, should be implemented once tested, placed
 *       at top of each task that processes/copies files to target
 * @returns {boolean}
 */
var check = function(){
    var isOk =  !!(args.target !== undefined || args.target.length > 0);

    if(!isOk){
        console.error('you have not passed a value for "--target" argument');
        console.error('you must define a target location for a deployment.');
        return false;
    }else{
        if(fs.existsSync(remoteRoot)){ // TODO: needs testing against file system - possible permisison issue
            return true;
        }else{
            console.error('the target location ' + remoteRoot + ' does not exist.');
            console.error('please check and try again.');
            return false;
        }
    }
};

/**
 * passes datetime to the bundle tasks to be applied to the bundled files
 * @returns {string}
 */
var getDateTime = function(){
    var datetime = (datetime !== undefined) ? datetime : new Date();
    var localTime = new Date(Date.now() - (datetime.getTimezoneOffset() * 60000));
    return localTime.toUTCString();
};

/**
 * copies the script files.
 */
gulp.task('scripts-copy', function () {
    return require('./processes/copyProc.js')('./jsbundles.json', root + 'dev\\src\\app\\');
});

/**
 * bundles up the script files, copying them to there respective build destination.
 */
gulp.task('scripts-bundle', function () {

    /**
     * Contains an array of promises
     * @type {Array}
     */
    var p = [];

    // source and destination of the files to be bundled
    var src = path.join(root, 'dev/src/');
    var destination = path.join(root, 'dev/build/app/js');

    // captures the list of bundled files from the json file
    var js = require('./processes/bundleProc.js')('./jsbundles.json');

    if(js !== undefined && js.length) {
        for (var i = 0; i < js.length; i++) {
            // pushing to the 'p' array the logic to be called in each promise
            p.push(
                new Promise(function(resolve, reject){
                    (function(_i) {
                        gulp.src(js[_i].files.map(
                            function (e) {
                                return path.join(src, '/' + js[_i].src + '/' + e);
                            }
                        ))
                        .pipe(js[_i].process) //concat process
                        .pipe(insert.transform(function (contents, file) {
                            var comment = '/*! @bundleDateTime ' + getDateTime() + ' */' + '\n';
                            comment += '/*! @BuildVersion ' + settings.version + ' */' + '\n\n';
                            return comment + contents;
                        }))
                        .pipe(gulp.dest(destination, {overwrite: true}))
                        .on('error', reject)
                        .on('end', resolve);
                    }(i))
                })
            )
        }
        return Promise.all(p);
    }else{
        console.error('error on accessing javascript bundle.')
    }
});

/**
 * compresses all scripts, minifying them.
 */
gulp.task('scripts-compress', function(){

    if(!isMinify){
        console.log('minify has been set to false for 1 or more bundles, change to true in the settings file(s) to enable minification.');
    }

    var build = path.join(root, 'dev/build/');
    var isThisMinify = isMinify;

    // test if minify is enabled on file in pipe
    var bundle = require('./processes/bundleProc.js')('./jsbundles.json');

    return del(path.join(build, 'app/js/*-min.js'), {force: true}).then(paths => {
        return gulp.src(path.join(build, 'app/js/*.js'))
            .pipe(tap(function(file) {
                var filename = path.basename(file.path);
                for (var i = 0; i < bundle.length; i++) {
                    var item = bundle[i];
                    if (filename === item.name && item.minify !== undefined) {
                        isThisMinify = item.minify; // set to individual bundle minify settings state
                    } else if (item.minify === undefined) {
                        isThisMinify = isMinify; // set to default (global settings) minify state
                    }
                }
                gulp.src(path.join(build, 'app/js/' + filename))
                .pipe(gulpif(isThisMinify, minify({
                    ext:{
                        src:'.js',
                        min:'-min.js'
                    }
                    ,preserveComments: 'some'
                })))
                .pipe(gulpif(!isThisMinify, rename({
                    suffix: '-min'
                })))
                .pipe(gulp.dest(path.join(build, 'app/js/')));
            }))

    });
});

/**
 * deploys the scripts to both the remote and local locations.
 */
gulp.task('scripts-deploy', function(){

    if(!check()){ return; }

    var target,
        p = [];

    target = [path.join(webviewRemote, 'js')]; //, path.join(quoodaMobileRoot, 'js')

    for(var i = 0; i < target.length; i++){
        p.push(
            new Promise(function(resolve, reject){
                 (function(_i){
                    gulp.src(path.join(root, 'dev/build/app/js/**/*-min.js'))
                        .pipe(insert.transform(function (contents, file) {
                            var comment = '/*! @deployDateTime ' + getDateTime() + ' */' + '\n';
                            return comment + contents;
                        }))
                        .pipe(gulp.dest(target[_i], {overwrite: true}))
                        .on('error', reject)
                        .on('end', resolve);
                }(i));
            })
        )
    }

    return Promise.all(p);
});


/**
 * copies all css files needed.
 */
gulp.task('css-copy', function () {
    return require('./processes/copyProc.js')('./cssbundles.json', root + 'dev\\src\\app\\');
});

/**
 * bundles up all css files, copying them to there respective build folders.
 */
gulp.task('css-bundle', function () {

    var p = [],
        src = path.join(root, 'dev/src/'),
        destination = path.join(root, 'dev/build/app/css');

    var css = require('./processes/bundleProc.js')('./cssbundles.json');

    if(css !== undefined && css.length) {
        //del(destination + '\\**\\*.css', {force: true}).then(paths =>{
            for (var i = 0; i < css.length; i++) {
                p.push(
                    new Promise(function (resolve, reject) {
                         (function(_i) {
                            gulp.src(css[_i].files.map(
                                function (e) {
                                    return path.join(src, '/' + css[_i].src + '/' + e);
                                }
                            ))
                            .pipe(insert.transform(function (contents, file) {
                                var comment = '/*! @bundleDateTime ' + getDateTime() + '*/' + '\n';
                                comment += '/*! @BuildVersion ' + settings.version + ' */' + '\n\n';
                                return comment + contents;
                            }))
                            .pipe(css[_i].process) //concat process
                            .pipe(replace('/Content/', '../content/'))
                            .pipe(replace('Default/', '../Default/'))
                            .pipe(gulp.dest(destination, {overwrite: true}))
                            .on('error', reject)
                            .on('end', resolve);
                        }(i))
                    })
                )
            }
       // });
        return Promise.all(p);
    }else{
        console.error('error on accessing javascript bundle.')
    }
});

/**
 * compreses all css files, minifying them.
 */
gulp.task('css-compress', function(){

    if(!isMinify){
        console.log('minify has been set to false, change to true in the settings file to enable minification.');
    }

    // no need for separate processes...do in single task 'all' processes
    var build = path.join(root, 'dev/build/app');
    var cssBuild = path.join(build, '/css/');

     return del(path.join(cssBuild, '*-min.css'), {force: true}).then(paths => {
        var stream = gulp.src(path.join(cssBuild, '*.css'))
            .pipe(rename({
                suffix: '-min'
            }))
            .pipe(gulpif(isMinify, cleanCSS()))
            .pipe(gulp.dest(cssBuild));

        // source maps created
        stream.on('end', function(){
            gulp.src(path.join(cssBuild, '*.css'))
                .pipe(sourcemaps.init())
                .pipe(sourcemaps.write('maps'))
                .pipe(gulp.dest(cssBuild));
        })
     });
});

/**
 * deploys the css files to both remote and local locations.
 */
gulp.task('css-deploy', function(){

    if(!check()){ return; }

    // copy CSS files to either web or mobile (remote)
    var target,
        p = [];

    target = [path.join(webviewRemote, 'css')]; // , path.join(quoodaMobileRoot, 'css')

    for(var i = 0; i < target.length; i++){
        p.push(
            new Promise(function (resolve, reject) {
                 (function(_i) {
                    var stream = gulp.src(path.join(root, 'dev/build/app/css/*.css'))
                        .pipe(insert.transform(function (contents, file) {
                            var comment = '/*! @deployDateTime ' + getDateTime() + ' */' + '\n';
                            return comment + contents;
                        }))
                        .pipe(gulp.dest(target[_i]))
                        .on('error', reject)
                        .on('end', resolve);
                     
                    if (_i === 1) { // hack as remote 'mac' permissions on 'maps' folder issue
                        stream.on('end', (function (inner) {
                            return function () {
                                gulp.src(path.join(root, 'dev/build/app/css/maps/*.*'))
                                    .pipe(gulp.dest(path.join(target[inner], '/maps/'), {overwrite: true}))
                                    .on('error', reject)
                                    .on('end', resolve);
                            }
                        }(_i)));
                    }
                 }(i))
            })
        )
    }

    return Promise.all(p);
});


/**
 * collection of helper tasks
 */
gulp.task('copy', function(){
    runSq('css-copy', 'scripts-copy');
});

gulp.task('scripts-build', function(){
    runSq('scripts-bundle', 'scripts-compress');
});

gulp.task('css-build', function(){
    runSq('css-bundle', 'css-compress');
});

gulp.task('build', function(){
   runSq(
        'scripts-bundle', 'scripts-compress', // scripts
        'css-bundle', 'css-compress' // css
   );
});

gulp.task('deploy', function(){
    if(!check()){ return; };
    runSq('scripts-deploy', 'css-deploy');
});

gulp.task('deploy-css', function(){
    if(!check()){ return; };
    runSq('css-deploy');
});

gulp.task('deploy-scripts', function(){
    if(!check()){ return; };
    runSq('scripts-deploy');
});

/**
 * minifies the html contained within the cshtml razor views.
 */
gulp.task('cshtmlMinify-mobile', function(){
    return gulp
        .src(mobileRootCshtml + '\\src\\*-dev.cshtml')
        .pipe(minifyCshtml({
            comments: true,
            razorComments: true,
            whitespace: true
        }))
        .pipe(rename(function(name){
            name.basename = name.basename.replace('-dev', '');
        }))
        .pipe(gulp.dest(mobileRootCshtml));
});

/**
 * automatically watches for any changes to cshtml '-dev' razor views.
 * note: you can run any task to watch for changes and run the task 'cshtmlMinify-mobile'.
 */
//gulp.watch(mobileRootCshtml + '\\src\\*-dev.cshtml', ['cshtmlMinify-mobile']);

gulp.task('cshtmlMobile-watcher', function(){
    return gulp.watch(mobileRootCshtml + '\\src\\*-dev.cshtml', ['cshtmlMinify-mobile']);
});

gulp.task('default', ['cshtmlMobile-watcher']);