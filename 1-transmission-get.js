/**
 * Copyright 2014 Antoine Aflalo
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function (RED) {
    function sendFilteredMessage(node, msg) {
        if (node.status == "all") {
            node.send(msg);
            return;
        }
        var newTorrents = [];
        msg.torrents.forEach(function (torrent) {
            if (torrent.status === node.server.transmission.status[node.status]) {
                newTorrents.push(torrent);
            }
        });
        msg.torrents = newTorrents;
        node.send(msg);

    }

    function TransmissionGetNode(n) {
        RED.nodes.createNode(this, n);
        this.status = n.status;
        this.server = RED.nodes.getNode(n.server);
        var node = this;

        this.on("input", function (msg) {
            if (msg.hasOwnProperty('torrentsID')) {
                node.server.transmission.get(msg.torrentsID, function (err, result) {
                    if (err) {
                        return node.error(err);
                    }
                    msg.torrents = result.torrents;
                    sendFilteredMessage(node, msg)
                });
            } else {
                node.server.transmission.get(function (err, result) {
                    if (err) {
                        return node.error(err);
                    }
                    msg.torrents = result.torrents;
                    sendFilteredMessage(node, msg)
                });
            }
        });
    }

    RED.nodes.registerType("BT get", TransmissionGetNode);
}