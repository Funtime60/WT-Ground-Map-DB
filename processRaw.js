import * as fs from 'fs';
import sanitize from 'sanitize-filename';

import log4js from 'log4js';
const logger = log4js.getLogger('Process');
logger.level = "debug";

import { getHash, filePath } from "./collectData.js";
const workingDir = 'mapFingerprints/';
const outputDBPath = 'mapFingerprintsDB.json';


async function main() {
	let data;
	if(fs.existsSync(filePath)) {														// Check if the file exists
		try {																			// Try to read the file and parse it
			data = fs.readFileSync(filePath, 'utf8');
			data = JSON.parse(data);
		}catch(err) {
			if(err.code != 'ENOENT') {													// If the error is not "file not found", log it and return early
				logger.error(`Error(${getLine()}): can't reading file: ${err}`);
				return getLine();														// Return the line number of the error
			}
		}
	}
	if(!data) {																			// If the file does not exist, create a dummy file content. Have to do this here because existsSync() or ENOENT could be the cause.
		logger.warn(`No file found, continuing to regenerate final DB file from working cache.`);
	}else {
		Object.keys(data).map((obj) => obj.replace(/-.+-/,'-')).filter((obj, index, array) => array.indexOf(obj) == index).forEach((mapName) => {										// Iterate over the map names in the data
			logger.debug(`Processing map: ${mapName}`);									// Log the map name
			const teamCaptures = Object.keys(data).filter((obj) => obj.replace(/-.+-/,'-') == mapName).map((mapName) => data[mapName]);
			let {map_obj: _, capture_team: __, ...outputData} = teamCaptures[0];	// Create a new object with the map objects removed, and the rest of the data kept
			outputData.map_obj = teamCaptures.reduce(({set, out}, capture) => capture.map_obj.reduce(({set, out}, map_obj) => {
				if(!set[map_obj.hash]) {
					set[map_obj.hash] = true;
					out.push(map_obj);
				}
				return {set, out};
			}, {set, out}), {set: {}, out: []}).out;
			outputData.full_ID = mapName;												// Set the full ID to the map name

			try {
				fs.mkdirSync(workingDir);
			}catch(err) {
				if(err.code != 'EEXIST') {												// If the error is not "directory already exists", log it and return early
					logger.error(`Error(${getLine()}): can't create directory: ${err}`);
					return getLine();													// Return the line number of the error
				}
			}
			fs.writeFileSync(`${workingDir}${sanitize(mapName)}.json`, JSON.stringify(outputData, null, 2), 'utf8');
		});
	}

	const outputData = {};
	fs.readdirSync(workingDir, {withFileTypes: true}).forEach((file) => {	// Iterate over the files in the working directory
		data = JSON.parse(fs.readFileSync(`${file.parentPath}${file.name}`, 'utf8'));
		// TODO: update to use the new hash field and function while chaning to use the absolute team names and map capture mode field
		data.map_obj.forEach((map_obj) => {											// Iterate over the map objects in the file
			if(outputData[map_obj.hash]) {
				if(!outputData[map_obj.hash].includes(data.full_ID)) {
					outputData[map_obj.hash].push(data.full_ID);	// If the hash already exists in the outputData, push the map name to the mapList	
				}
			}else {
				outputData[map_obj.hash] = [data.full_ID];
			}
		});
	});
	fs.writeFileSync(outputDBPath, JSON.stringify(outputData, null, 2), 'utf8');
}

main().then((returnCode) => process.exit(returnCode));

function isSameMap_Obj(obj, map_obj) {
	return obj.type == map_obj.type && obj?.x == map_obj?.x && obj?.y == map_obj?.y && obj?.sx == map_obj?.sx && obj?.sy == map_obj?.sy && obj?.ex == map_obj?.ex && obj?.ey == map_obj?.ey && obj?.dx == map_obj?.dx && obj?.dy == map_obj?.dy;
}

function getLine() {
	return Number(new Error().stack?.split(/\n/g)?.[2].split(/:/)?.at(-2));
}
