import * as fs from 'fs';

import * as readline from 'readline';
const lineInterface = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

import log4js from 'log4js';
const logger = log4js.getLogger('Pull');
logger.level = "debug";

import { collectData, filePath } from "./collectData.js";

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
	data = await collectData(data, mapName);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');			// Write the updated data back to the file
}
	
main().then((returnCode) => process.exit(returnCode));