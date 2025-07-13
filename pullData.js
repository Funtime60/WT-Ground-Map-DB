const fs = require('fs');

const readline = require('readline');
const lineInterface = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const log4js = require('log4js');
const logger = log4js.getLogger('Pull');
logger.level = "debug";

const filePath = 'mapFingerprintRaw.json';
const pullURL = "http://127.0.0.1:8111/"

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
		logger.debug(`No file found, creating new file: ${filePath}`);
	}
	// const mapName = await new Promise((resolve) => lineInterface.question(`Enter map name for fingerprint: `, (mapName) => resolve(mapName)));	// Ask the user for a map name
	data = await collectData(data);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');			// Write the updated data back to the file
}

export async function collectData(oldData) {
	const mapName = "test";
	logger.debug(`Map Name: ${mapName}`); // Log the map name
	const mapFingerprintRaw = {
		mission: await fetch(`${pullURL}/mission.json`).then(res => res.json()),
		map_obj: (await fetch(`${pullURL}/map_obj.json`).then(res => res.json())).filter(obj => obj.type == "airfield" || obj.type == "ground_model" && obj.icon == "Airdefence" || obj.type == "capture_zone" || obj.type.match(/^respawn_base_.+/)), // Fetch the map objects from the server and filter them to only include airfields, ground models with the Airdefence icon, and capture zones
		mapInfo: await fetch(`${pullURL}/map_info.json`).then(res => res.json())
	}; // Fetch the fingerprint data from the server and parse it as JSON
	const teams = setTeams(mapFingerprintRaw.map_obj); // Set the teams based on the airfields in the data
	mapFingerprintRaw.map_obj.map((obj) => Object.assign(obj, { team: getTeam(obj['color[]'], teams) })); // Assign the team color to each object in the map objects array
	mapFingerprintRaw.map_obj.map((obj) => Object.assign(obj, { hash: getHash(obj) }));
	mapFingerprintRaw['capture type'] = isGroundMap(mapFingerprintRaw.map_obj) ? "ground" : "air"; // Check if the map is an air map and set the airVersion accordingly
	if(oldData[mapName]?.append) { // If the map name does not exist in the data, create an empty array for it
		oldData[mapName].append(mapFingerprintRaw);
	}else if (oldData[mapName]) {
		oldData[mapName] = [oldData[mapName], mapFingerprintRaw]; // If the map name exists, append the new fingerprint to the existing array
	}else {
		oldData[mapName] = mapFingerprintRaw;
	}
	return oldData;
}

// main().then((returnCode) => process.exit(returnCode));

function getLine() {
	return Number(new Error().stack?.split(/\n/g)?.[2].split(/:/)?.at(-2));
}
function getHash(map_obj) {
	const hash_obj = {};
	[...['',...'abcdefghijklmnopqrstuvwxyz'].map((char) => [`${char}x`,`${char}y`]).flat(), 'type', 'icon'].forEach((key) => map_obj?.[key] ? hash_obj[key] = map_obj?.[key] : null);
	return `0x${([...JSON.stringify(hash_obj).replace(/[\s":{},]/g, '')].reduce((hash, char) => 0 | (31 * hash + char.charCodeAt(0)), 0x0) >>> 0).toString(16).padStart(8, '0')}`;		// Return hash after removing constant characters and spaces from the JSON stringified object
}
function getTeam(objColorArr, teams) {
	return teams[getTeamColor(objColorArr)] || 'neutral';						// Return the team color based on the object color array, or 'neutral' if no team is found
}
function setTeams(airfields) {
	const northWestMostAF = getNorthWestMostAirfield(airfields);				// Get the north-west most airfield from the airfields array
	const teams = {}
	teams[getTeamColor(northWestMostAF['color[]'])] = 'team1';					// Set the team of the north-west most airfield to team1
	teams[teams?.red ? 'blue' : 'red'] = 'team2';								// Set the other team to team2
	return teams;
}
function getTeamColor(objColorArr) {
	if(objColorArr[0] > 200 && objColorArr[1] < 80 && objColorArr[2] < 80) return "red";
	if(objColorArr[2] > 200 && objColorArr[0] < 80 && objColorArr[1] < 80) return "blue";
	return null;
}
function getAirfields(airfields) {
	return airfields.filter((obj => obj.type == "airfield"));
}
function getNorthWestMostAirfield(airfields) {
	return getAirfields(airfields).reduce((northWestMostAF, obj) => {
		if(northWestMostAF.sy > obj.sy || northWestMostAF.sy == obj.sy && northWestMostAF.sx > obj.sx) {
			return obj;
		}
		return northWestMostAF;
	});
}
function isGroundMap(airfields) {
	const northWestMostAF = getNorthWestMostAirfield(airfields);
	return northWestMostAF.sx < 0 || northWestMostAF.sx > 1 || northWestMostAF.sy < 0 || northWestMostAF.sy > 1 || northWestMostAF.ex < 0 || northWestMostAF.ex > 1 || northWestMostAF.ey < 0 || northWestMostAF.ey > 1;
}