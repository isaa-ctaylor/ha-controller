import * as document from "document";
import { peerSocket } from "messaging";
import { vibration } from "haptics";
import { LongPressDetector } from "fitbit-gestures";

peerSocket.addEventListener("open", (evt) => {
    console.log("Socket open");
    document.getElementById("light-button").onclick = function (evt) {
        document.location.assign("views/lights.view");

        let lights = [];
        let tiles = [];

        let NUM_ELEMS = 0;

        peerSocket.addEventListener("message", (evt) => {
            if (evt.data.command == "fetch") {
                let lightsList = document.getElementById("lightsList");
                let loading = document.getElementById("loading");
                lights = evt.data.data;
                NUM_ELEMS = lights.length;
                loading.style.display = "none";
                lightsList.style.display = "inline";
                lightsList.delegate = {
                    getTileInfo: (index) => {
                        return {
                            type: "my-pool",
                            value: "Item",
                            index: index,
                            entity_id: lights[index][0],
                            friendly_name: lights[index][1],
                            state: lights[index][2],
                            supported_colour_modes: lights[index][3],
                            colour: lights[index][3],
                        };
                    },
                    configureTile: (tile, info) => {
                        if (info.type == "my-pool") {
                            tile.getElementById("name").text = `${info.friendly_name}`;
                            tiles.push(tile);
                            let button = tile.getElementById("toggle-button");
                            if (info.state == "on") {
                                let img = button.getElementById("image");
                                img.style.fill = "#ffc107";

                                let bg = button.getElementsByTagName("circle")[0];
                                bg.style.fill = "#ffc107";
                            }
                            if (JSON.stringify(info.supported_colour_modes) != JSON.stringify(["onoff"])) {
                                let detector = new LongPressDetector(button, (e) => {
                                    console.log("Long press!");
                                })
                            }
                            tile.data_entity_id = info.entity_id;
                            button.onclick = function (evt) {
                                vibration.start("confirmation");
                                peerSocket.send({ "command": "toggle", "data": { "entity_id": info.entity_id } })
                            };
                        }
                    }
                };

                // length must be set AFTER delegate
                lightsList.length = NUM_ELEMS;
            } else if (evt.data.command == "update") {
                lights.every((item, index) => {
                    if (item[0] == evt.data.data.entity_id) {
                        let tile = tiles[index];
                        let button = tile.getElementById("toggle-button");
                        let img = button.getElementById("image");
                        img.style.fill = (evt.data.data.state == "on") ? "#ffc107" : "#9e9e9e";
                        // img.href = (evt.data.data.state == "on") ? "lightbulb-on-g.png" : "lightbulb-off-g.png";
                        let bg = button.getElementsByTagName("circle")[0];
                        bg.style.fill = (evt.data.data.state == "on") ? "#ffc107" : "#9e9e9e";
                        return false;
                    }
                    return true;
                })
            } else if (evt.data.command == "error") {
                let error = document.getElementById("error");

                document.getElementById("error-message").text = evt.data.data;
                error.style.display = "inline";
            };
        });

        peerSocket.send({ "command": "fetch", "data": null });
    }
})

peerSocket.addEventListener("error", (err) => {
    console.error(`Connection error: ${err.code} - ${err.message}`);
});

