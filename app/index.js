import * as document from "document";
import { peerSocket } from "messaging";
import { inbox } from "file-transfer";
import { readFileSync } from "fs";
import { decode } from "cbor";
import { vibration } from "haptics";
import { LongPressDetector } from "fitbit-gestures";

peerSocket.addEventListener("open", (evt) => {
    console.log("Device connected");
    peerSocket.send({ type: "fetch" });
})

peerSocket.addEventListener("error", (err) => {
    console.error(`Connection error: ${err.code} - ${err.message}`);
});


var receivedChunks = [];
var totalChunksExpected = null;
var tiles = [];

function truncate(input, length) {
    if (input.length > length) {
        return input.substring(0, length) + '...';
    }
    return input;
}

// function sortNoArea(jsonObj) {
//     // Specify the key to force to the bottom
//     let keyToBottom = "No Area";
//     console.log(jsonObj);
//     let entries = Object.entries(jsonObj);
//     console.log(entries);
//     entries.sort(([key1], [key2]) => {
//         if (key1 === keyToBottom) return 1;
//         if (key2 === keyToBottom) return -1;
//         return key1.localeCompare(key2);
//     });

//     let sortedJsonObj = Object.fromEntries(entries);

//     return sortedJsonObj;
// }

peerSocket.onmessage = (evt) => {
    const message = evt.data;

    if (message.type === "chunk") {
        receivedChunks[message.index] = message.data;

        if (totalChunksExpected === null) {
            totalChunksExpected = message.totalChunks;
        }

        // Check if all chunks have been received
        if (receivedChunks.filter(chunk => chunk !== undefined).length === totalChunksExpected) {
            const jsonString = receivedChunks.join("");
            try {
                const jsonObject = JSON.parse(jsonString);

                // Clear received chunks after reassembly
                receivedChunks = [];
                totalChunksExpected = null;
            } catch (e) {
                console.error("JSON parse error: ", e);
            }

            // let areas = sortNoArea(jsonObject);

            let areas = jsonObject;

            let areaList = document.getElementById("areaList");
            document.getElementById("bg").style.display = "inline";
            let loading = document.getElementById("loading");
            let NUM_ELEMS = Object.keys(areas).length;
            loading.style.display = "none";
            areaList.style.display = "inline";
            areaList.delegate = {
                getTileInfo: (index) => {
                    return {
                        type: "my-pool",
                        value: "Item",
                        index: index,
                        friendly_name: Object.keys(areas)[index],
                    };
                },
                configureTile: (tile, info) => {
                    if (info.type == "my-pool") {
                        console.log(`Item: ${info.friendly_name}`)
                        tile.getElementById("name").text = `${info.friendly_name}`;
                        tile.onclick = function (evt) {
                            console.log("Clicked.");
                            document.location.assign("./resources/views/devices.view").then(() => {
                                tiles = [];
                                let deviceList = document.getElementById("deviceList");
                                let devices = areas[info.friendly_name];
                                let NUM_ELEMS = Object.keys(devices).length;
                                deviceList.style.display = "inline";
                                deviceList.delegate = {
                                    getTileInfo: (index) => {
                                        return {
                                            type: "my-pool",
                                            value: "Item",
                                            index: index,
                                            entity_id: devices[index].entity_id,
                                            friendly_name: devices[index].name,
                                            state: devices[index].state,
                                            domain: devices[index].domain
                                        };
                                    },
                                    configureTile: (tile, info) => {
                                        if (info.type == "my-pool") {
                                            console.log(`Item: ${info.friendly_name}`)

                                            tile.data_entity_id = info.entity_id;
                                            tile.data_domain = info.domain;
                                            tile.data_state = info.state;

                                            let name = tile.getElementById("name");
                                            name.text = `${info.friendly_name}`;
                                            let length = name.text.length;
                                            while (name.getBBox().width > 185) {
                                                length--;
                                                name.text = truncate(`${info.friendly_name}`, length);
                                            }

                                            let button = tile.getElementById("toggle-button");
                                            let img = button.getElementById("image");
                                            if (info.domain == "light") {
                                                img.href = "../bulb-g.png"
                                            } else if (info.domain == "switch") {
                                                if (info.state == "on") {
                                                    img.href = "../switch-on-g.png";
                                                } else {
                                                    img.href = "../switch-off-g.png";
                                                }
                                            } else {
                                                img.href = "../button-g.png";
                                            }
                                            if (info.state == "on") {
                                                img.style.fill = "#ffc107";

                                                let bg = button.getElementsByTagName("circle")[0];
                                                bg.style.fill = "#ffc107";
                                            }
                                            button.onclick = function (evt) {
                                                vibration.start("confirmation");
                                                peerSocket.send({ type: "command", domain: info.domain, entity_id: info.entity_id, state: tile.data_state });
                                            }

                                            tiles.push(tile);
                                        }
                                    }
                                };

                                // length must be set AFTER delegate
                                deviceList.length = NUM_ELEMS;
                            })
                        }
                    }
                }
            };

            // length must be set AFTER delegate
            areaList.length = NUM_ELEMS;
        }
    } else if (message.type == "error") {
        let error = document.getElementById("error");

        document.getElementById("error-message").text = message.message;
        error.style.display = "inline";
    } else if (evt.data.type == "update") {
        tiles.forEach((tile) => {
            if (tile.data_entity_id == evt.data.entity_id) {
                let button = tile.getElementById("toggle-button");
                let img = button.getElementById("image");

                tile.data_state = evt.data.state;

                img.style.fill = (evt.data.state == "on") ? "#ffc107" : "#9e9e9e";
                // img.href = (evt.data.data.state == "on") ? "lightbulb-on-g.png" : "lightbulb-off-g.png";
                let bg = button.getElementsByTagName("circle")[0];
                bg.style.fill = (evt.data.state == "on") ? "#ffc107" : "#9e9e9e";

                if (tile.data_domain == "switch") {
                    if (evt.data.state == "on") {
                        img.href = "../switch-on-g.png";
                    } else {
                        img.href = "../switch-off-g.png";
                    }
                }
            }
        })
    }
};
