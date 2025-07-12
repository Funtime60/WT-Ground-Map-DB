const fs = require('fs');
const sanitize = require('sanitize-filename');

const log4js = require('log4js');
const logger = log4js.getLogger('Process');
logger.level = "debug";

const filePath = 'mapFingerprintRaw.json';
const workingDir = 'mapFingerprints/';
const outputDBPath = 'mapFingerprintsDB.json';

async function main() {
	let data;
	if(fs.existsSync(filePath)) {													// Check if the file exists
		try {																		// Try to read the file and parse it
			data = fs.readFileSync(filePath, 'utf8');
			data = JSON.parse(data);
		}catch(err) {
			if(err.code != 'ENOENT') {												// If the error is not "file not found", log it and return early
				logger.error(`Error(${getLine()}): can't reading file: ${err}`);
				return getLine();													// Return the line number of the error
			}
		}
	}
	if(!data) {																		// If the file does not exist, create a dummy file content. Have to do this here because existsSync() or ENOENT could be the cause.
		data = {};
		logger.warn(`No file found, exiting early`);
		return getLine();
	}
	Object.keys(data).forEach((mapName) => {										// Iterate over the map names in the data
		logger.debug(`Processing map: ${mapName}`);									// Log the map name
		let outputData = data[mapName];
		if(Array.isArray(data[mapName])) {
			outputData = data[mapName].reduce((accumulator, currentValue, index) => {
				currentValue.map_obj.forEach((map_obj, iter_index) => {
					const sameTeam = index == 0 || map_obj.team == accumulator.map_obj?.[0]?.team;
					if(!accumulator.map_obj.some((obj) => isSameMap_Obj(obj, map_obj))) {
						if(!sameTeam && map_obj.team) {
							map_obj.team = map_obj.team == "friendly" ? "enemy" : "friendly";			// If the team is not the same, switch it.
						}
						accumulator.map_obj.push(map_obj);
					}
				});
				return accumulator;
			}, {mission: data[mapName][0].mission, map_obj: [], mapInfo: data[mapName][0].mapInfo});	// If the map data is an array, push it to the outputData
		}
		outputData.map_obj.forEach((map_obj) => {											// Iterate over the map objects in the outputData
			map_obj.team = map_obj?.team?.replace(/friendly|enemy/, (match) => match == "friendly" ? "team1" : "team2");	// Capitalize the team name
		});
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
	const outputData = {x:{}, y:{}};
	fs.readdirSync(workingDir, {withFileTypes: true}).forEach((file) => {	// Iterate over the files in the working directory
		data = JSON.parse(fs.readFileSync(`${file.parentPath}${file.name}`, 'utf8')).map_obj;
		data.forEach((map_obj) => {											// Iterate over the map objects in the file
			const xCoords = ['',...'abcdefghijklmnopqrstuvwxyz'].map((char) => map_obj[`${char}x`]).filter((value) => value != undefined);
			const yCoords = ['',...'abcdefghijklmnopqrstuvwxyz'].map((char) => map_obj[`${char}y`]).filter((value) => value != undefined);
			xCoords.forEach((_, index) => {
				map_obj.map_name = [file.name.replace(/\.json$/, '')];	// Set the map name to the file name without the .json extension
				outputData.x[xCoords[index]] = {};
				outputData.y[yCoords[index]] = {};
				if(outputData.x[xCoords[index]][yCoords[index]]) {		// If the x and y coordinates already exist in the outputData, handle the map_obj
					const existingIndex = outputData.x[xCoords[index]][yCoords[index]].findIndex((obj) => isSameMap_Obj(obj, map_obj));	// Check if the map_obj already exists in the outputData
					if(existingIndex != -1) {	// If the map_obj already exists, update it
						if(!outputData.x[xCoords[index]][yCoords[index]][existingIndex].map_name.includes(map_obj.map_name[0])) {		// If the map name is not already in the map_name array, push it
							outputData.x[xCoords[index]][yCoords[index]][existingIndex].map_name.push(map_obj.map_name[0]);
						}
					}else {	// If the map_obj does not exist, push it to the outputData
						outputData.x[xCoords[index]][yCoords[index]].push(map_obj);
					}
				}else {	// If the x and y coordinates do not exist in the outputData, create them and push the map_obj
					outputData.x[xCoords[index]][yCoords[index]] = [map_obj];
				}
			});
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