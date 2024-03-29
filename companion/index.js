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

websocket.addEventListener("message", onMessage);

function onMessage(evt) {
    let data = JSON.parse(evt.data);

    if (data.type == "auth_required") {
        websocket.send(JSON.stringify({ "type": "auth", "access_token": KEY }));
    }
    if (data.type == "auth_ok") {
        websocket.send(JSON.stringify({ "id": 1, "type": "subscribe_events", "event_type": "state_changed" }));
    }
    if (data.type == "auth_invalid") {
        console.error("Websocket auth invalid!")
        peerSocket.send({"command": "error", "data": "Invalid access token!"})
    }
    if (data.type == "event") {
        if (data.event.data.entity_id.startsWith("light.")) {
            peerSocket.send({ "command": "update", "data": { "entity_id": data.event.data.entity_id, "state": data.event.data.new_state.state } })
        }
    }

}

console.log("Max message size=" + peerSocket.MAX_MESSAGE_SIZE);

function fetchDevices() {
    console.log("Fetching device data...");
    let url = "https://" + URL + "/api/states";
    fetch(url, {
        method: "GET",
        headers: { Authorization: 'Bearer ' + KEY }
    }).then(function (response) {
        if (!response.ok) {
            return Promise.reject(response);
        }
        return response.text();
    }).then(function (data) {
        data = JSON.parse(data);
        let ret = [];
        for (let i = 0; i < data.length; i++) {
            if (data[i]["entity_id"].startsWith("light.")) {
                ret.push([data[i]["entity_id"], data[i]["attributes"]["friendly_name"], data[i]["state"], data[i]["attributes"]["supported_color_modes"], data[i]["attributes"]["rgb_color"]])
            };
        };
        ret.sort((a, b) => {
            if (a[1] < b[1]) {
                return -1
            }
            if (a[1] > b[1]) {
                return 1
            }
            return 0;
        })
        peerSocket.send({ "command": "fetch", "data": ret });
    }).catch((r) => {
        peerSocket.send({"command": "error", "data": "Failed to connect - check URL"})
    });
};

peerSocket.addEventListener("message", (evt) => {
    console.log(evt.data);
    if (evt.data.command == "fetch") {
        if (!URL) {
            peerSocket.send({ "command": "error", "data": "Homeassistant URL not provided!"})
        } else if (!KEY) {
            peerSocket.send({ "command": "error", "data": "Access token not provided!"})
        } else {
            fetchDevices();
        }
    } else if (evt.data.command == "toggle") {
        let entity_id = evt.data.data.entity_id;

        let url = "https://" + URL + "/api/services/light/toggle"

        fetch(url, {
            method: "POST",
            headers: { Authorization: 'Bearer ' + KEY },
            body: JSON.stringify({ "entity_id": entity_id })
        }).then(function (response) {
            if (!response.ok) {
                console.log(response.status)
                return Promise.reject(response);
            }
            return response.text();
        })
    }
});
