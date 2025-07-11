const fs = require('fs');
const sanitize = require('sanitize-filename');

const log4js = require('log4js');
const logger = log4js.getLogger('Process');
logger.level = "debug";

const filePath = 'mapFingerprintRaw.json';
const workingDir = 'mapFingerprints/';

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
					if(!accumulator.map_obj.some((obj) => obj.type == map_obj.type && obj?.x == map_obj?.x && obj?.y == map_obj?.y && obj?.sx == map_obj?.sx && obj?.sy == map_obj?.sy && obj?.ex == map_obj?.ex && obj?.ey == map_obj?.ey && obj?.dx == map_obj?.dx && obj?.dy == map_obj?.dy)) {
						if(!sameTeam && map_obj.team) {
							map_obj.team = map_obj.team == "friendly" ? "enemy" : "friendly";			// If the team is not the same, switch it.
						}
						accumulator.map_obj.push(map_obj);
					}
				});
				return accumulator;
			}, {mission: data[mapName][0].mission, map_obj: [], mapInfo: data[mapName][0].mapInfo});	// If the map data is an array, push it to the outputData
		}
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

main().then((returnCode) => process.exit(returnCode));

function getLine() {
	return Number(new Error().stack?.split(/\n/g)?.[2].split(/:/)?.at(-2));
}