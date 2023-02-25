/**
 * dev-server - serves static resources for developing "earth" locally
 */

"use strict";

console.log("============================================================");
console.log(new Date().toISOString() + " - Starting");

var util = require("util");
var nc = require("./public/libs/earth/1.0.0/nomadsClient.js");
var http = require('http');
const url = require('url');
const querystring = require('querystring');

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

//var port = process.argv[2];
const port = process.env.PORT || 3000;
var express = require("express");
const https = require("https");
const fs = require("fs");
const {default: grib2json} = require("grib2json");
var app = express();

const Server = require('http').Server;
const server = new Server(app);
const path = require('path');

app.use(cacheControl());
app.use(express.compress({filter: compressionFilter}));
app.use(logger());
app.use(express.static("./public"));


//const GRIB2JSON_PATH = './public/libs/grib2json/bin/grib2json';
const GRIB2JSON_PATH = './utils/grib2json-0.8.0-SNAPSHOT/grib2json.exe';
function convertGrib2Json(file) {
    var grib2json = require('grib2json').default;
    
    grib2json(file,{
        scriptPath: GRIB2JSON_PATH
    }, function (err, json) {
        //console.log(json);
        return json;
    })
}


server.listen(port, () => console.log("Server at " + port));
app.use('/', express.static(getDir() + '/public'));

app.get('/', function(req, res) {
    res.sendFile(getDir() + '/public/index.html');
});

app.get('/download', (req, res) => {
    // const url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.f000&var_UGRD=on&var_VGRD=on&dir=%2Fgdas.20221120%2F00%2Fatmos";
    //
    // const file = fs.createWriteStream("random.data");
    // https.get(url, function(response) {
    //     console.log(response.statusCode);
    //     if (response.statusCode == 200) {
    //         response.pipe(file);
    //         // after download completed close filestream
    //         file.on("finish", () => {
    //             file.close();
    //             console.log("Download Completed");
    //             grib2json("random.data",{
    //                 scriptPath: GRIB2JSON_PATH
    //             }, function (err, json) {
    //                 //console.log(json);
    //                 res.send(json);
    //             })
    //             //res.send(json);
    //             //console.log(json);
    //         });
    //     }
    // });
    //console.log('parameters=' +req.query);
    var parsedUrl = url.parse(req.url);
    var parsedQs = querystring.parse(parsedUrl.query);
    
    console.log('parsedQs=' +JSON.stringify(parsedQs));
    if (!parsedQs.date || !parsedQs.time || !parsedQs.level) {
        res.status(400);
        res.send('Wrong parameters of the GET request. Call this endpoint with following parameters: ?date=[YYYYMMDD]&time=[XXXX]&level=[XX]');
    }
    
    nc.downloadAndSavaNomadData(parsedQs.date,parsedQs.time,parsedQs.level,res);
    return;
    
    const TEST_FOLDER_PATH = './test_data/';
    const TEST_FILE_NAME = 'gdas.t00z.pgrb2.1p00.f000';
    const GRIB_PATH = './utils/grib2json.exe';
    const ARGUMENTS = ['-c','./test_data/gdas.t00z.pgrb2.1p00.f000'];
    //grib2json -d -n -o current-wind-surface-level-gfs-1.0.json gfs.t00z.pgrb2.1p00.f000
    //[ '-c', './test_data/gdas.t00z.pgrb2.1p00.f000' ]
    var exec = require('child_process').execFile;
    exec(GRIB_PATH, ARGUMENTS, function(err, data) {  
        console.log(err)
        fs.writeFile("./test_data/out.json", data.toString(), function(err) {
            if(err) {
                console.log(err);
                res.status(500);
                res.send("There was an error downloading the file. See console log for detail.");
            }

            res.status(200);
            res.send('File was successfuly downloaded and saved to disk');
        }); 
    });
    
    //sconvertGrib2Json(TEST_FOLDER_PATH+TEST_FILE_NAME)
    //nc.getData(req,res);
});

app.get('/data/weather/:year/:month/:day/:file', (req, res) => {
    console.log(req.params);

    if (req.params.month > 12 || req.params.day > 31) {
        res.status(400);
        res.send('Bad request. Day or month out of bounds.');
    }

    var path = "/data/weather/" + req.params.year + "/" + req.params.month + "/" + req.params.day + "/" + req.params.file; 

    console.log('Trying to load ' + process.cwd()+path);
    fs.readFile(process.cwd()+path, function(err,data)
            {
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
});



// Using a function to set default app path
function getDir() {
    if (process.pkg) {
        return path.resolve(process.execPath + "/..");
    } else {
        return path.join(require.main ? require.main.path : process.cwd());
    }
}

function convertGrib2Json() {

}
