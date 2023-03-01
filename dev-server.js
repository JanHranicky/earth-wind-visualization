/**
 * dev-server - serves static resources for developing "earth" locally
 */

"use strict";

console.log("============================================================");
console.log(new Date().toISOString() + " - Starting");

const open = require('open');
var util = require("util");
var nc = require("./public/libs/earth/1.0.0/nomadsClient.js");
const url = require('url');
var express = require("express");
const fs = require("fs");
const querystring = require('querystring');
const Server = require('http').Server;
const path = require('path');
const { tryToDownloadCurrentData } = require('./public/libs/earth/1.0.0/nomadsClient.js');

const port = process.env.PORT || 3000;

/**
 * Returns true if the response should be compressed.
 */
function compressionFilter(req, res) {
    return (/json|text|javascript|font/).test(res.getHeader('Content-Type'));
}

/**
 * Adds headers to a response to enable caching.
 */
function cacheControl() {
    return function(req, res, next) {
        res.setHeader("Cache-Control", "public, max-age=300");
        return next();
    };
}

function logger() {
    express.logger.token("date", function() {
        return new Date().toISOString();
    });
    express.logger.token("response-all", function(req, res) {
        return (res._header ? res._header : "").trim();
    });
    express.logger.token("request-all", function(req, res) {
        return util.inspect(req.headers);
    });
    return express.logger(
        ':date - info: :remote-addr :req[cf-connecting-ip] :req[cf-ipcountry] :method :url HTTP/:http-version ' +
        '":user-agent" :referrer :req[cf-ray] :req[accept-encoding]\\n:request-all\\n\\n:response-all\\n');
}

var app = express();
const server = new Server(app);

app.use(cacheControl());
app.use(express.compress({filter: compressionFilter}));
app.use(logger());
app.use(express.static("./public"));

server.listen(port, () =>  {
    console.log("Server at " + port);
});

app.use('/', express.static(getDir() + '/public'));
app.get('/', function(req, res) {
    res.sendFile(getDir() + '/public/index.html');
});

app.get('/download', (req, res) => {
    var parsedUrl = url.parse(req.url);
    var parsedQs = querystring.parse(parsedUrl.query);
    
    console.log('parsedQs=' +JSON.stringify(parsedQs));
    if (!parsedQs.date || !parsedQs.time || !parsedQs.level) {
        res.status(400);
        res.send('Wrong parameters of the GET request. Call this endpoint with following parameters: ?date=[YYYYMMDD]&time=[XXXX]&level=[XX]');
    }
    
    nc.downloadAndSaveNomadData(parsedQs.date,parsedQs.time,parsedQs.level,res);
});

app.get('/data/weather/current/:file', (req, res) => {
    console.log("Trying to load current file data file");
    console.log(req.params.file);

    var level = req.params.file.split('-')[3].replace('hPa','');
    var variable = req.params.file.split('-')[1];

    var supposedCurrentPath = pathFromDate(level,variable);

    try {
        console.log('File path ' + supposedCurrentPath);
        if (fs.existsSync(supposedCurrentPath)) {
            console.log(supposedCurrentPath +' File exists. Sending it.');

            res.status(200);
            res.send(fs.readFileSync(supposedCurrentPath, 'utf8').toString());        
        } else { //download current date
            //nc.downloadAndSavaNomadData()
            var NDateObj = toNOMADSDate();
            var date = NDateObj.year+NDateObj.month+NDateObj.day;

            nc.tryToDownloadCurrentData(date,NDateObj.time,level,variable,5,res);
        }
    } catch (e) {
        console.log("Error reading current file " + req.params.file + " from disk. " + e);

        res.status(500);
        res.send("Error reading current file " + req.params.file + " from disk. " + e);
    }
});


/**
 * Returns NOMAD's time interval based on given time
 * @param {*} time 
 * @returns 
 */
function getIntervalFromTimeValue(time) {
    if (time < 6) {
        return "0000";
    } else if (time < 12) {
        return "0600";
    } else if (time < 18) {
        return "1200";
    }
    return "1800";
}


function toNOMADSDate(date=null) {
    if (!date) date = new Date();

    var year = date.getFullYear().toString();
    var month = date.getMonth().toString().length == 1 ? "0" + (date.getMonth() + 1).toString() : (date.getMonth() + 1).toString();
    var day = date.getDate().toString().length == 1 ? "0" + date.getDate().toString() : date.getDate().toString();

    var time = getIntervalFromTimeValue(parseInt(date.getHours()));

    return {
        year: year,
        month: month,
        day: day,
        time: time
    };
}

/**
 * Returns path to level's current .json datafile according to given date, if date is null current datetime is used 
 * @param {*} level 
 * @param {*} variable 
 * @param {*} date 
 */
function pathFromDate(level,variable,date = null) {
    if (!date) date = new Date();
    var NDateObj = toNOMADSDate(date);

    var path = "./data/weather/";
    path += NDateObj.year + "/" + NDateObj.month + "/" + NDateObj.day + "/" + NDateObj.time+"-"+variable+"-isobaric-"+level+"hPa-gfs-1.0.json";

    return path;
}

/**
 * Calculates hour difference between two dates
 * @param {*} date1 
 * @param {*} date2 
 * @returns hour difference
 */
function hourDiff(date1,date2) {
    return Math.abs(date1 - date2) / 36e5;
}

/**
 * Returns true, if the current data file with given path is up-to-date
 * @param {*} path 
 * @param {*} res 
 * @returns 
 */
function checkCurrentFileTopicality(path, res) {
    
    try {
        var currentDataFileObj = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (currentDataFileObj[0]) {
            var refDate = new Date(currentDataFileObj[0].header.refTime);
            var now = new Date();

            return hourDiff(refDate,now) < 6;
        }
    } catch (e) {
        console.log('Error. Trying to read current data ' + path + ' file from disk resulted in error: ' + e);

        res.status(500);
        res.send('Error. Trying to read current data ' + path + ' file from disk resulted in error: ' + e);
    }

    return false;
}


app.get('/data/weather/:year/:month/:day/:file', (req, res) => {
    console.log(req.params);

    if (req.params.month > 12 || req.params.day > 31) {
        res.status(400);
        res.send('Bad request. Day or month out of bounds.');
    }

    var path = "/data/weather/" + req.params.year + "/" + req.params.month + "/" + req.params.day + "/" + req.params.file; 
    console.log('Trying to load ' + process.cwd()+path);

    try {
        if (fs.existsSync(process.cwd()+path)) {
            console.log('File exist');

            fs.readFile(process.cwd()+path, function(err,data) {
                if(err) {
                    console.log('Err while sending data file ' + err);

                    res.status(500);
                    res.send('Err while sending data file ' + err);
                }
                else {
                    console.log('OK');

                    res.status(200);
                    res.send(data.toString());
                }
            });
        } else {
            console.log('File doesn\'t exist');

            var date = req.params.year+req.params.month+req.params.day;
            var fileNameParts = req.params.file.split("-");

            const PRESSURE_UNIT = "hPa";
            
            var time = fileNameParts[0];
            var level = fileNameParts[3].includes(PRESSURE_UNIT) ? fileNameParts[3].replace(PRESSURE_UNIT,'') : fileNameParts[3];
            var variable = fileNameParts[1];
            
            if (isForeCast(req.params.day,req.params.month,req.params.year)) nc.downloadAndSaveNomadData(date,time,level,variable,res);
            else {
                const MAX_TRIES = 5;
                nc.downloadForeCastData(date,time,level,variable,MAX_TRIES,res)
            }
        }
    } catch(err) {
        console.log('Err while sending data file ' + err);

        res.status(500);
        res.send('Err while sending data file ' + err);
    }
});

/**
 * Returns true if given date is from the future
 * @param {*} day 
 * @param {*} month 
 * @param {*} year 
 * @returns 
 */
function isForeCast(day,month,year) {
    var date = new Date(year,month-1,day);
    return date > new Date();
}

// Using a function to set default app path
function getDir() {
    if (process.pkg) {
        return path.resolve(process.execPath + "/..");
    } else {
        return path.join(require.main ? require.main.path : process.cwd());
    }
}

function cleanData() {
    try {
        const DATA_DIR_PATH = './data/weather';
        fs.rmSync(DATA_DIR_PATH, { recursive: true, force: true });
    } catch (e) {
        console.log('Error while cleaning the download data. ' + e);
    }
}

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log('cleaning');
        cleanData();
    }
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

open("http://localhost:"+port);