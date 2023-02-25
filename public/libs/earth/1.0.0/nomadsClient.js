const express = require("express");
const {default: grib2json} = require("grib2json");

/**
 * TODO:
 * Timer function that downloads 00,06,12,18 data,
 * Function that tries to download data on demand
 */

module.exports = function() {
    const fs = require('fs')
    const GRIB2JSON_PATH = './public/libs/grib2json/bin/grib2json';

    /**
     * Constructs url for a GET request that downloads the NOMAD data
     * @param {String} date date in a YYYYMMDD format 
     * @param {String} time one of following time values [0000,0600,01200,01800]
     * @returns 
     */
    function constructRequestUrl(date, time,level) {
        return "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t"+time+"z.pgrb2.1p00.f000&lev_"+level+"_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgdas."+date+"%2F"+time+"%2Fatmos";
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
        const FOLDER_PATH = './data/weather/';
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
        console.log(downloadUrl);

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
                res.status(response.statusCode == 404 ? 404 : 500);
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
            if (err) {
                console.log(err);
                res.status(500);
                res.send("Error while converting the data file to JSON. " + err);
            }
        }).on("exit", (code) => {
            //res.status(200);
            //res.send('File was successfuly downloaded and saved to disk');

            fs.readFile(jsonPath, function(err,data)
            {
                if(err) {
                    console.log('Err while reading saved JSON file ' + err);
                    res.status(500);
                    res.send('Err while reading saved JSON file ' + err);
                }
                else {
                    console.log('OK');
                    res.status(200);
                    res.send(data.toString());
                }
            });
        });
    }

    function handleFolderCreation(path) {
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
        }
    }
    
    return {
        downloadAndSavaNomadData: downloadAndSavaNomadData
    };
}();