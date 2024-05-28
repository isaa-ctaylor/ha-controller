import { settingsStorage } from "settings";
import { peerSocket } from "messaging";


const URL = JSON.parse(settingsStorage.getItem("url")).name;
const KEY = JSON.parse(settingsStorage.getItem("key")).name;

if (!URL) {
    console.error("No url provided! Notifying user...");
}
if (!KEY) {
    console.error("No key provided! Notifying user...");
}

const WSURL = "wss://" + URL + "/api/websocket";
const websocket = new WebSocket(WSURL);

const entityListEnum = 1;
const deviceStatesEnum = 3;
const deviceListEnum = 4;
const areaListEnum = 5;

var websocketIndex = 5;

const PATTERN = /^light\.|^switch\.|^button\./

var devices = {};
var areaMapping = {};

function splitJsonObject(jsonObject, chunkSize) {
    const jsonString = JSON.stringify(jsonObject);
    const numberOfChunks = Math.ceil(jsonString.length / chunkSize);
    let chunks = [];

    for (let i = 0; i < numberOfChunks; i++) {
        chunks.push(jsonString.slice(i * chunkSize, (i + 1) * chunkSize));
    }
    return chunks;
}

function sendChunk(chunk, index, totalChunks) {
    if (peerSocket.readyState === peerSocket.OPEN) {
        peerSocket.send({
            type: "chunk",
            index: index,
            totalChunks: totalChunks,
            data: chunk
        });
    }
}

function sendJsonObjectInChunks(jsonObject) {
    const chunkSize = 500; // Adjust size according to your needs
    const chunks = splitJsonObject(jsonObject, chunkSize);
    const totalChunks = chunks.length;

    chunks.forEach((chunk, index) => {
        sendChunk(chunk, index, totalChunks);
    });
}

peerSocket.addEventListener("open", (evt) => {
    console.log("Companion connected.");
})

console.log("Max message size=" + peerSocket.MAX_MESSAGE_SIZE);

peerSocket.addEventListener("message", (evt) => {
    let message = evt.data;
    console.log(message);
    if (message.type == "fetch") {
        websocket.addEventListener("error", websocketError);
        websocket.addEventListener("message", onMessage);

        function websocketError(evt) {
            peerSocket.send({ type: "error", message: "Websocket connection failed!\nPlease check URL in settings." })
        }


        if (!URL) {
            peerSocket.send({ type: "error", message: "No URL provided!" });
        } else if (!KEY) {
            peerSocket.send({ type: "error", message: "No API key provided!" });
        }

        function onMessage(evt) {
            let data = JSON.parse(evt.data);
            // console.log(data);

            if (data.type == "auth_required") {
                websocket.send(JSON.stringify({ type: "auth", access_token: KEY }));
            }
            if (data.type == "auth_ok") {
                websocket.send(JSON.stringify({ id: entityListEnum, type: "config/entity_registry/list" }))
                websocket.send(JSON.stringify({ id: 2, type: "subscribe_events", event_type: "state_changed" }));
            }
            if (data.type == "auth_invalid") {
                console.error("Websocket auth invalid!")
                peerSocket.send({ type: "error", message: "Invalid access token!" })
            }
            if (data.type == "event") {
                if (PATTERN.test(data.event.data.entity_id)) {
                    console.log({ entity_id: data.event.data.entity_id, state: data.event.data.new_state.state });
                    peerSocket.send({ type: "update", entity_id: data.event.data.entity_id, state: data.event.data.new_state.state })
                }
            }
            if (data.type == "result") {
                if (data.id == entityListEnum) {
                    data.result.forEach((d) => {
                        if (PATTERN.test(d.entity_id)) {
                            if (d.hidden_by == null && d.disabled_by == null) {
                                devices[d.entity_id] = d;
                            }
                        }
                    })

                    websocket.send(JSON.stringify({ id: deviceStatesEnum, type: "get_states" }));
                }

                else if (data.id == deviceStatesEnum) {
                    data.result.forEach((d) => {
                        if (devices.hasOwnProperty(d.entity_id)) {
                            devices[d.entity_id]["state"] = d.state;
                        }
                    })
                    // console.log(devices);

                    websocket.send(JSON.stringify({ id: deviceListEnum, type: "config/device_registry/list" }));
                }

                else if (data.id == deviceListEnum) {
                    let uniqueToEntityMapping = {};
                    for (const [key, value] of Object.entries(devices)) {
                        uniqueToEntityMapping[value.unique_id] = key;
                    };

                    // console.log(uniqueToEntityMapping);

                    data.result.forEach((d) => {
                        if (d.identifiers.length) {
                            let entity_id = uniqueToEntityMapping[d.identifiers[0][1]];
                            if (devices.hasOwnProperty(entity_id)) {
                                devices[entity_id]["area_id"] = d.area_id;
                            }
                        }
                    })

                    // console.log(devices);

                    for (const [key, value] of Object.entries(devices)) {
                        if (!(areaMapping.hasOwnProperty(value.area_id))) {
                            areaMapping[value.area_id] = [];
                        }

                        let name = value.name || value.entity_id.split(".")[1].replace("_", " ");

                        areaMapping[value.area_id].push({ entity_id: value.entity_id, state: value.state, name: name, domain: value.entity_id.split(".")[0] })
                    };

                    // console.log(areaMapping);

                    websocket.send(JSON.stringify({ id: areaListEnum, type: "config/area_registry/list" }))
                }

                else if (data.id == areaListEnum) {
                    // Resolve area ids to area names
                    let areaNameMapping = {};
                    data.result.forEach((a) => {
                        areaNameMapping[a.area_id] = a.name;
                    });

                    // console.log(areaMapping)

                    let resolvedAreaMapping = {};
                    let noArea = [];

                    for (const [key, value] of Object.entries(areaMapping)) {
                        let newKey = key;
                        if (key != "null") {
                            newKey = areaNameMapping[key];
                            resolvedAreaMapping[newKey] = value.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0));
                        } else {
                            noArea = value;
                        }
                    }

                    if (noArea != []) {
                        resolvedAreaMapping["No Area"] = noArea.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0));
                    }

                    // console.log(resolvedAreaMapping);

                    sendJsonObjectInChunks(resolvedAreaMapping);
                }
            }
        }
    }

    if (message.type == "command") {
        let entity_id = message.entity_id;

        if (message.domain == "light") {
            websocketIndex++;
            websocket.send(JSON.stringify({ id: websocketIndex, type: "call_service", domain: "light", service: "toggle", target: { entity_id: entity_id } }));
        } else if (message.domain == "switch") {
            websocketIndex++;
            websocket.send(JSON.stringify({ id: websocketIndex, type: "call_service", domain: "switch", service: "toggle", target: { entity_id: entity_id } }));
        } else if (message.domain == "button") {
            websocketIndex++;
            websocket.send(JSON.stringify({ id: websocketIndex, type: "call_service", domain: "button", service: "press", target: { entity_id: entity_id } }));
        };
    }
});
