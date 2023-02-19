const express = require("express");
const {default: grib2json} = require("grib2json");

/**
 * TODO:
 * Timer function that downloads 00,06,12,18 data,
 * Function that tries to download data on demand
 */

module.exports = function() {
    const url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.anl&lev_70_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgdas.20221025%2F00%2Fatmos;"
    const levels = ['lev_70_mb=on','lev_50_mb=on'];
    const fs = require('fs')
    const GRIB2JSON_PATH = './public/libs/grib2json/bin/grib2json';

    /**
     * Constructs url for a GET request that downloads the NOMAD data
     * @param {String} date date in a YYYYMMDD format 
     * @param {String} time one of following time values [0000,0600,01200,01800]
     * @returns 
     */
    function constructRequestUrl(date, time,level) {
        return "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.f000&lev_"+level+"_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgdas."+date+"%2F"+time+"%2Fatmos";
        //return "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.anl&lev_"+level+"_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgdas."+date+"%2F"+time+"%2Fatmos";
    }


    /**
     * Creates folder for the downloaded .anl file 
     * @param {String} date 
     * @param {String} time 
     * @param {String} level 
     * @returns filepath for the downloaded file
     */
    function createFolder(date,time,level) {
        const FOLDER_PATH = './public/data/weather/';
        var year = date.substring(0,4); //date is given as YYYYMMDD format string, month will always be at position 0 - 4
        var month = date.substring(4,6); //date is given as YYYYMMDD format string, month will always be at position 4 - 6
        var day = date.substring(6,8); //date is given as YYYYMMDD format string, month will always be at position 6 - 8
        var filePath = FOLDER_PATH + year + "/" + month + "/" + day + "/";
        handleFolderCreation(filePath);
        var fileName = filePath + time + "-wind-isobaric-"+level+"hPa-gfs-1.0.f000";

        return fileName;
    }

    /**
     * Tries to download data based on date, time and level form NOMAD's server.
     * If the download is sucessful the data is parsed into JSON format using grib2json utility 
     * and saved into a folder ./public/data/[YEAR]/[DAY]/[TIME]-wind-isobaric-[LEVEL]hPa-gfs-1.0.json
     * @param {String} date 
     * @param {String} time 
     * @param {String} level 
     * @param {*} res Express response object of the /download endpoint request 
     */
    function downloadAndSavaNomadData(date,time,level,res) {  
        const https = require('https');
        const fs = require('fs');

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level);

        const request = https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                const dest = createFolder(date,time,level); //destination of the .anl file
                const file = fs.createWriteStream(dest); 
                response.pipe(file);

                // after download completed close filestream
                file.on("finish", () => {
                    file.close();
                    toJSON(dest,res);
                }).on('error', function(err) { // Handle errors
                    fs.unlink(dest); // Delete the file async. (But we don't check the result)
                    res.status(500);
                    res.send("Error while saving the file to the disk: " + err.message);
                });
                
            } else {
                res.status(500);
                res.send("Error while sending Nomad request. Nomad responded with code: "+response.statusCode);
            }
        });
    }
    
    /**
     * Converts downloaded .anl file to .json used in client side
     * @param {String} filename 
     * @param {*} res epxress /get endpoint responde object
     */
    function toJSON(filename,res) {
        const path = require('path');
        const GRIB_PATH = './utils/grib2json.exe';
        //grib2json -d -n -o current-wind-surface-level-gfs-1.0.json gfs.t00z.pgrb2.1p00.f000
        //[ '-c', './test_data/gdas.t00z.pgrb2.1p00.f000' ]
        var args = ['-n','-d','-o'];
        var ext = path.parse(filename).ext;
        var jsonPath = filename.replace(ext,".json");

        args.push(jsonPath); //out file 
        args.push(filename); //source file


        var exec = require('child_process').execFile;
        exec(GRIB_PATH, args, function(err, data) {  
            console.log(err)
            /*
            fs.writeFile(jsonPath, data.toString(), function(err) {
                if(err) {
                    console.log(err);
                    res.status(500);
                    res.send("There was an converting the downloaded file to JSON: " + err);
                }
    
            }); 
            */
            res.status(200);
            res.send('File was successfuly downloaded and saved to disk');
        });
    }

    function parseDatetime(datetime) {
        if (!datetime) {
            var now = new Date();

            var year = now.getFullYear().toString();
            var month = now.getMonth().toString().length == 1 ? "0" + now.getMonth().toString() : now.getMonth().toString();
            var day = now.getDay().toString().length == 1 ? "0" + now.getDay().toString() : now.getDay().toString();

            return {
                date: (year + month + day),
                time: getIntervalFromTimeValue(parseInt(now.getHours()))
            }
        }
        var split = datetime.toString().split(":");

        return {
            date: split[0],
            time: split[1]
        };
    }

    /**
     * Handles download of data from NOMAD. Check if folders with today's date exists and downloads missing data.
     */
    function getData(req,res) {
        //check data based on today's date
        //iterate over data
        //download missing data
        //convert data from grib2 format to json and save it
        //console.log(req);

        var datetime = req.query.datetime ? req.query.datetime : null;
        var objDateTime = parseDatetime(datetime);

        console.log("getData: objDateTime " + objDateTime);

        return getNomadData(objDateTime.date,objDateTime.time,res);
    }

    function getNomadData(date, time, res) {
        const https = require('https');
        const fs = require('fs');

        function constructRequestUrl(date, time) {
            return "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.f000&var_UGRD=on&var_VGRD=on&dir=%2Fgdas."+date+"%2F"+time+"%2Fatmos";
        }

        const url = constructRequestUrl(date,time);
        console.log(url);

        const TEST_FILE_NAME = "data.f000";
        const FOLDER_PATH = './public/data/weather/';

        var year = date.substring(0,4); //date is given as YYYYMMDD format string, month will always be at position 0 - 4
        var month = date.substring(4,6); //date is given as YYYYMMDD format string, month will always be at position 4 - 6
        var day = date.substring(6,8); //date is given as YYYYMMDD format string, month will always be at position 6 - 8
        console.log(year);
        console.log(month);
        console.log(day);

        var time = time[0] == '0' ? parseInt(time[1]) : parseInt(time);
        var interval = getIntervalFromTimeValue(time);
        console.log(time);
        console.log(interval);

        var filePath = FOLDER_PATH + year + "/" + month + "/" + day + "/";
        handleFolderCreation(filePath);

        var fileName = filePath + interval + "-wind-isobaric-70hPa-gfs-1.0.data"; //TODO create filename from date and time, save as 0600-wind-surface-level-gfs-1.0.json
        //0600-wind-isobaric-70hPa-gfs-1.0.json
        const file = fs.createWriteStream(fileName);
        const request = https.get(url, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                response.pipe(file);
                // after download completed close filestream
                file.on("finish", () => {
                    file.close();
                    console.log("Download Completed");
                    convertGrib2Json(fileName,res);
                });
            } else {
                res.status(500);
                res.send("Error while sending Nomad request");
            }
        });
    }

    function handleFolderCreation(path) {
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
        }
    }

    function convertGrib2Json(file,res) {
        var grib2json = require('grib2json').default;

        grib2json(file,{
            scriptPath: GRIB2JSON_PATH
        }, function (err, json) {
            if (err) {
                res.status(500);
                res.send("Error while parsing data file");
            }
            //console.log(json);
            res.send("File downloaded and saved");
        })
    }

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

    return {
        getData: getData,
        getNomadData: getNomadData,
        downloadAndSavaNomadData: downloadAndSavaNomadData
    };
}();