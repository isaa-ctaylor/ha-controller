import * as document from "document";
import { peerSocket } from "messaging";
import { vibration } from "haptics";

let lightsList = document.getElementById("lightsList");
let loading = document.getElementById("loading");
let error = document.getElementById("error");

let NUM_ELEMS = 0;


peerSocket.addEventListener("open", (evt) => {
    peerSocket.send({ "command": "fetch", "data": null });
});

peerSocket.addEventListener("error", (err) => {
    console.error(`Connection error: ${err.code} - ${err.message}`);
});

let lights = [];
let tiles = [];

peerSocket.addEventListener("message", (evt) => {
    if (evt.data.command == "fetch") {
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
                    tile.getElementById("text").text = `${info.friendly_name}`;
                    let button = tile.getElementById("toggle-button");
                    tiles.push(button);
                    if (info.state == "on") {
                        let img = button.getElementById("image");
                        img.style.fill = "#ffc107";

                        let bg = button.getElementsByTagName("circle")[0];
                        bg.style.fill = "#ffc107";
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
                let button = tiles[index];
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
        document.getElementById("error-message").text = evt.data.data;
        error.style.display = "inline";
    };
});
