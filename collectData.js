export const filePath = 'mapFingerprintRaw.json';
const pullURL = "http://127.0.0.1:8111/"

export async function collectData(oldData, mapName, battleRating) {
	const mapFingerprintRaw = {
		mission: await fetch(`${pullURL}/mission.json`).then(res => res.json()),
		map_obj: (await fetch(`${pullURL}/map_obj.json`).then(res => res.json())).filter(obj => obj.type == "airfield" || obj.type == "ground_model" && obj.icon == "Airdefence" || obj.type == "capture_zone" || obj.type.match(/^respawn_base_.+/)), // Fetch the map objects from the server and filter them to only include airfields, ground models with the Airdefence icon, and capture zones
		mapInfo: await fetch(`${pullURL}/map_info.json`).then(res => res.json())
	};																											// Fetch the fingerprint data from the server and parse it as JSON
	const teams = setTeams(mapFingerprintRaw.map_obj);															// Set the teams based on the airfields in the data
	mapFingerprintRaw['capture_team'] = teams['blue'];															// Gets the team name that is blue, which is the team that the capture was taken by
	mapFingerprintRaw.map_obj.forEach((obj) => Object.assign(obj, { team: getTeam(obj['color[]'], teams) }));	// Assign the team color to each object in the map objects array
	mapFingerprintRaw.map_obj.forEach((obj) => Object.assign(obj, { hash: getHash(obj) }));
	mapFingerprintRaw.map_obj.forEach((obj) => {delete obj['color'] ; delete obj['color[]'];});					// Remove the color property from each object in the map objects array since it varies by team while the team field is agnostic
	mapFingerprintRaw['capture_type'] = isGroundMap(mapFingerprintRaw.map_obj) ? "ground" : "air";				// Check if the map is an air map and set the airVersion accordingly
	mapFingerprintRaw['map_name'] = mapName;
	mapFingerprintRaw['battle_rating'] = battleRating;
	mapFingerprintRaw['full_ID'] = `[${battleRating}]${mapName} - ${teams['blue']} - ${mapFingerprintRaw['capture_type']}`;
	oldData[mapFingerprintRaw.full_ID] = mapFingerprintRaw;
	return oldData;
}

function getLine() {
	return Number(new Error().stack?.split(/\n/g)?.[2].split(/:/)?.at(-2));
}
export function getHash(map_obj) {
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