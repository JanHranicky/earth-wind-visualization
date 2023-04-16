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
     * @param {String} variable needed variable, default null for wind
     * @param {String} hours forecast in hours
     * @returns 
     */
    function constructRequestUrl(date, time,level,variable=null,hours=null) {
        if (!hours) hours = '000';
        switch (variable) {
            case "air_density":
            case "temp":
                return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t"+time+"z.pgrb2.0p25.f"+hours+"&lev_"+level+"_mb=on&var_TMP=on&dir=%2Fgfs."+date+"%2F"+time+"%2Fatmos";
            case "vvel":
                return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t"+time+"z.pgrb2.0p25.f"+hours+"&lev_"+level+"_mb=on&var_VVEL=on&dir=%2Fgfs."+date+"%2F"+time+"%2Fatmos";
            case "dzdt":
                return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t"+time+"z.pgrb2.0p25.f"+hours+"&lev_"+level+"_mb=on&var_DZDT=on&dir=%2Fgfs."+date+"%2F"+time+"%2Fatmos";
            case "hgt":
                return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t"+time+"z.pgrb2.0p25.f"+hours+"&lev_"+level+"_mb=on&var_HGT=on&dir=%2Fgfs."+date+"%2F"+time+"%2Fatmos";
            default:
                return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t"+time+"z.pgrb2.0p25.f"+hours+"&lev_"+level+"_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgfs."+date+"%2F"+time+"%2Fatmos";
        }
        //return "https://nomads.ncep.noaa.gov/cgi-bin/filter_fnl.pl?file=gdas.t00z.pgrb2.1p00.anl&lev_"+level+"_mb=on&var_UGRD=on&var_VGRD=on&dir=%2Fgdas."+date+"%2F"+time+"%2Fatmos";
    }


    /**
     * Creates folder for the downloaded .anl file 
     * @param {String} date 
     * @param {String} time 
     * @param {String} level 
     * @param {String} variable 
     * @returns filepath for the downloaded file
     */
    function createFolder(date,time,level,variable=null) {
        const FOLDER_PATH = './data/weather/';
        variable = variable ? variable : "wind";

        var year = date.substring(0,4); //date is given as YYYYMMDD format string, month will always be at position 0 - 4
        var month = date.substring(4,6); //date is given as YYYYMMDD format string, month will always be at position 4 - 6
        var day = date.substring(6,8); //date is given as YYYYMMDD format string, month will always be at position 6 - 8
        var filePath = FOLDER_PATH + year + "/" + month + "/" + day + "/";
        handleFolderCreation(filePath);
        var fileName = filePath + time + "-"+variable+"-isobaric-"+level+"hPa-gfs-1.0.f000";

        return fileName;
    }

    /**
     * Tries to download data based on date, time and level form NOMAD's server.
     * If the download is sucessful the data is parsed into JSON format using grib2json utility 
     * and saved into a folder ./public/data/[YEAR]/[DAY]/[TIME]-wind-isobaric-[LEVEL]hPa-gfs-1.0.json)
     * This function is called in a GET request to download file and the result is send via the res object
     * @param {String} date 
     * @param {String} time 
     * @param {String} level 
     * @param {String} variable 
     * @param {*} res Express response object of the /download endpoint request 
     */
    function downloadAndSaveNomadData(date,time,level,variable,res) {  
        const https = require('https');
        const fs = require('fs');

        var isAirDensity = variable == "air_density";
        variable = isAirDensity ? "temp" : variable; //air density is calculated from temperature

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level,variable);
        console.log(downloadUrl);

        const request = https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                const dest = createFolder(date,time,level,variable); //destination of the .anl file
                const file = fs.createWriteStream(dest); 
                response.pipe(file);

                // after download completed close filestream
                file.on("finish", () => {
                    file.close();
                    toJSON(dest,res,isAirDensity);
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
     * Converts Date into YYYYMMDD format, if not date is provided the format is returned for today's date
     * @param {Date} date 
     */
    function toYYYYMMDD(date=null) {
        if (!date) date = new Date();
        else date = new Date(date);
        var year = date.getFullYear().toString();
        var month = date.getMonth().toString().length == 1 ? "0" + (date.getMonth() + 1).toString() : (date.getMonth() + 1).toString();
        var day = date.getDate().toString().length == 1 ? "0" + date.getDate().toString() : date.getDate().toString();

        return year+month+day;
    }

    /**
     * 
     * @param {String} date YYYYMMDD string date 
     * @param {String} time one of the following times [0000,0600,1200,1800]
     * @returns 
     */
    function YYYYMMDDHHToDate(date,time=null) {
        var year = date.substring(0,4);
        var month = date.substring(4,6);
        var day = date.substring(6,8);
        if (!time) return new Date(year, month-1, day);

        var time = time.substring(0,2);
        return new Date(year, month-1, day,time);
    }

    /**
     * Returns the previous timestep 0000->0600->1200->1800->0000->...
     * @param {*} dateString 
     * @param {*} time 
     * @returns 
     */
    function getPreviousStep(dateString,time) {
        switch (time) {
            case "0000":
                var date = YYYYMMDDHHToDate(dateString);
                console.log('New date',date);

                return {date: toYYYYMMDD(date.setDate(date.getDate() - 1)), time: "1800"};

            case "1800": return {date: dateString, time: "1200"};
            case "1200": return {date: dateString, time: "0600"};
            default: return {date: dateString, time: "0000"};
        }
    }

    /**
     * Tries to download data based on date, time and level form NOMAD's server.
     * If the download is sucessful the data is parsed into JSON format using grib2json utility 
     * and saved into a folder ./public/data/[YEAR]/[DAY]/[TIME]-wind-isobaric-[LEVEL]hPa-gfs-1.0.json
     * If the download failes the function tries to download older data up to cnt times. 
     * @param {String} date 
     * @param {String} time 
     * @param {String} level
     * @param {String} variable  
     * @param {Int} cnt 
     * @param {*} res Express response object of the /download endpoint request 
     */
    function tryToDownloadCurrentData(date,time,level,variable,cnt,res) { 
        console.log('Trying to download current data. try num. ' + cnt);
        if (cnt == 0) {
            res.status(500);
            res.send("Error while trying to download current data.");
        }

        const https = require('https');
        const fs = require('fs');

        var isAirDensity = variable == "air_density";

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level,isAirDensity ? "temp" : variable);
        console.log(downloadUrl);

        const request = https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                const dest = createFolder(date,time,level,isAirDensity ? "temp" : variable); //destination of the .anl file
                const file = fs.createWriteStream(dest); 
                response.pipe(file);

                // after download completed close filestream
                file.on("finish", () => {
                    file.close();
                    toJSON(dest,res,isAirDensity);
                }).on('error', function(err) { // Handle errors
                    fs.unlink(dest); // Delete the file async. (But we don't check the result)
                    res.status(500);
                    res.send("Error while saving the file to the disk: " + err.message);
                });
                
            } else if (response.statusCode == 404) { //Current data is not yet published, Download 6hr older data
                var dateTimeObj = getPreviousStep(date,time);
                cnt -= 1;
                tryToDownloadCurrentData(dateTimeObj.date,dateTimeObj.time,level,variable,cnt,res);
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
    function toJSON(filename,res,isAirDensity=null) {
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
                    res.send(isAirDensity ? calculateAirDensity(filename,data.toString()) : data.toString());
                }
            });
        });
    }

    function getLatestDataDate(date,time,level,variable,cnt,res) {
        console.log('Trying to look for current data url. try num. ' + cnt);
        if (cnt == 0) {
            res.status(500);
            res.send("Error while trying to lookup current data url.");
        }

        const https = require('https');
        const util = require('util')
 
        var isAirDensity = variable == "air_density";

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level,isAirDensity ? "temp" : variable);
        console.log(downloadUrl);

        return https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                return YYYYMMDDHHToDate(date,time);
            } else if (response.statusCode == 404) { //Current data is not yet published, Download 6hr older data
                var dateTimeObj = getPreviousStep(date,time);
                cnt -= 1;
                return getLatestDataDate(dateTimeObj.date,dateTimeObj.time,level,variable,cnt,res);
            } else {
                res.status(500);
                res.send("Error while sending Nomad request. Nomad responded with code: "+response.statusCode);
            }
        });
    }

    /**
     * Tries to find the latest data url, if it is found another function that tries to download forecast data is called.
     * @param {*} reqDate 
     * @param {*} date 
     * @param {*} time 
     * @param {*} level 
     * @param {*} variable 
     * @param {*} cnt 
     * @param {*} res 
     */
    function findLatestDataUrl(reqDate,date,time,level,variable,cnt,res) {
        console.log('Trying to look for current data url. try num. ' + cnt);
        if (cnt == 0) {
            res.status(404);
            res.send("Latstdataurl not found.");
        }

        const https = require('https');
        const fs = require('fs');

        var isAirDensity = variable == "air_density";

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level,isAirDensity ? "temp" : variable);
        console.log(downloadUrl);

        const request = https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                const FORECAST_TRIES = 6;
                var hours = hourDiff(reqDate,YYYYMMDDHHToDate(date,time));
                downloadForeCastData(hours,reqDate,date,time.slice(0,2),level,variable,FORECAST_TRIES,res);
            } else if (response.statusCode == 404) { //Current data is not yet published, Download 6hr older data
                var dateTimeObj = getPreviousStep(date,time);
                cnt -= 1;
                findLatestDataUrl(reqDate,dateTimeObj.date,dateTimeObj.time,level,variable,cnt,res);
            } else {
                res.status(500);
                res.send("Error while sending Nomad request. Nomad responded with code: "+response.statusCode);
            }
        });
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
     * Takes in hour value and zero pads it with 0 in the prefix. E.g 24 -> 024
     * @param {String/Int} hours 
     * @param {Int} len 
     * @returns 
     */
    function zeroPadHours(hours,len) {
        var decimals = hours.toString().length;
        var strHours = "";

        for (decimals; decimals < len; decimals++) {
            strHours += "0";
        }
        strHours += hours.toString();

        return strHours;
    }

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

    function downloadForeCastData(hours,reqDate,date,time,level,variable,cnt,res) {
        console.log('downloadForeCastData: hourdiff='+hours);
        if (cnt == 0) {
            res.status(404);
            res.send("Forecast data not found.");
        }

        const https = require('https');
        const fs = require('fs');

        var isAirDensity = variable == "air_density";

        var downloadUrl = constructRequestUrl(date,time.slice(0,2),level,isAirDensity ? "temp" : variable,zeroPadHours(hours,3));
        console.log(downloadUrl);

        const request = https.get(downloadUrl, function(response) {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                var reqDateObj = toNOMADSDate(reqDate);
                var folderDate = reqDateObj.year+reqDateObj.month+reqDateObj.day;
                const dest = createFolder(folderDate,reqDateObj.time,level,isAirDensity ? "temp" : variable); //destination of the .anl file
                const file = fs.createWriteStream(dest); 
                response.pipe(file);

                // after download completed close filestream
                file.on("finish", () => {
                    file.close();
                    toJSON(dest,res,isAirDensity);
                }).on('error', function(err) { // Handle errors
                    fs.unlink(dest); // Delete the file async. (But we don't check the result)
                    res.status(500);
                    res.send("Error while saving the file to the disk: " + err.message);
                });
                
            } else if (response.statusCode == 404) { //Current data is not yet published, Download 6hr older data
                cnt -= 1;
                hours -= 1;
                downloadForeCastData(hours,reqDate,date,time,level,variable,cnt,res);
            } else {
                res.status(500);
                res.send("Error while sending Nomad request. Nomad responded with code: "+response.statusCode);
            }
        });
    }

    function calculateAirDensity(filename,data) {
        try {
            console.log('Calculating airDensity on data');

            var fileNameParts = filename.split('/');
            var file = fileNameParts[fileNameParts.length-1];
            var level = parseInt(file.split('-')[3].replace('hPa',''));

            var tmpDataObj = JSON.parse(data);
            var dataArr = tmpDataObj[0].data;

            const AIR_CONSANT = 0.348432;
            for (var i = 0; i < dataArr.length; i++) {
                dataArr[i] = AIR_CONSANT*level/parseFloat(dataArr[i]);
            }
            console.log(tmpDataObj);
            return tmpDataObj;
        } catch (e) {
            console.log('Erorr while calculating air density from temperature data');
        }
        return null;
    }

    function handleFolderCreation(path) {
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
        }
    }
    
    return {
        downloadAndSaveNomadData: downloadAndSaveNomadData,
        tryToDownloadCurrentData: tryToDownloadCurrentData,
        downloadForeCastData: findLatestDataUrl,
        YYYYMMDDHHToDate: YYYYMMDDHHToDate,
        toNOMADSDate: toNOMADSDate,
        getLatestDataDate: getLatestDataDate
    };
}();