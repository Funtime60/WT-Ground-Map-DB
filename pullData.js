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

/*/
fs.readFile(filePath, 'utf8', (err, data) => {
	// New data to append
	const newData = {name: 'Jane Doe', age: 30};

	if(err) {
		// Handle file not found or other read errors
		console.error('Error reading file:', err);
		return;
	}

	try {
		let jsonData = JSON.parse(data);

		// Assuming the JSON file contains an array
		if (Array.isArray(jsonData)) {
			jsonData.push(newData);
		} else {
			// Handle cases where the root is an object and you want to add a property
			// Or create an array if the file was empty or not an array initially
			console.warn('JSON file does not contain an array at the root. Appending as a new property or converting to array.');
			// Example: If the file was an object, add the new data as a property
			// jsonData.newEntry = newData; 
			// Or, if you want to ensure it's an array for future appends:
			jsonData = [jsonData, newData]; 
		}

		const updatedJsonString = JSON.stringify(jsonData, null, 2);

		fs.writeFile(filePath, updatedJsonString, 'utf8', (err) => {
			if (err) {
				console.error('Error writing file:', err);
				return;
			}
			console.log('Data successfully appended to JSON file.');
		});

	} catch (parseError) {
		console.error('Error parsing JSON:', parseError);
	}
});//*/

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
	const mapName = await new Promise((resolve) => lineInterface.question(`Enter map name for fingerprint: `, (mapName) => resolve(mapName)));	// Ask the user for a map name
	logger.debug(`Map Name: ${mapName}`);											// Log the map name
	const mapFingerprintRaw = {
		mission: await fetch(`${pullURL}/mission.json` ).then(res => res.json()),
		map_obj: (await fetch(`${pullURL}/map_obj.json` ).then(res => res.json())).filter(obj => obj.type == "airfield" || obj.type == "ground_model" && obj.icon == "Airdefence" || obj.type == "capture_zone" || obj.type.match(/^respawn_base_.+/)).map((obj => Object.assign(obj, {team: getTeam(obj['color[]'])}))),
		mapInfo: await fetch(`${pullURL}/map_info.json`).then(res => res.json())
	};	// Fetch the fingerprint data from the server and parse it as JSON
	if(data[mapName]?.append) {														// If the map name does not exist in the data, create an empty array for it
		data[mapName].append(mapFingerprintRaw);
	}else if(data[mapName]) {
		data[mapName] = [data[mapName], mapFingerprintRaw];						// If the map name exists, append the new fingerprint to the existing array
	}else {
		data[mapName] = mapFingerprintRaw;
	}
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');				// Write the updated data back to the file
}

main().then((returnCode) => process.exit(returnCode));

function getLine() {
	return Number(new Error().stack?.split(/\n/g)?.[2].split(/:/)?.at(-2));
}
function getTeam(objColorArr) {
	if(objColorArr[0] > 200 && objColorArr[1] < 80 && objColorArr[2] < 80) return "enemy";
	if(objColorArr[2] > 200 && objColorArr[0] < 80 && objColorArr[1] < 80) return "friendly";
	return null;
}