/**
 * Copyright 2016 Antoine Aflalo
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
    "use strict";
    var Transmission = require('transmission');
    var when = require("when");


    function TransmissionServerNode(n) {
        RED.nodes.createNode(this, n);
        this.title = n.title;
        this.host = n.host;
        this.port = n.port;
        if (this.credentials) {
            this.user = this.credentials.user;
            this.password = this.credentials.password;
        }
        this.transmission = new Transmission({
            port: this.port,
            host: this.host,
            username: this.user,
            password: this.password
        });
    }

    RED.nodes.registerType("transmission-server", TransmissionServerNode, {
        credentials: {
            user: {
                type: 'text'
            },
            password: {
                type: 'password'
            }
        }
    });

    function TransmissionDownloadNode(n) {
        RED.nodes.createNode(this, n);
        this.location = n.location;
        this.server = RED.nodes.getNode(n.server);
        var node = this;

        /**
         *
         * @param url
         * @param options
         * @returns {when.promise}
         * @constructor
         */
        function PromiseAddTorrent(url, options) {
            var deferred = when.defer();
            node.server.transmission.add(url, options, function (err, result) {
                if (err) {
                    node.error(err);
                    deferred.reject(err);
                    return;
                }
                var id = result.id;
                node.server.transmission.get(id, function (err, result) {
                    if (err) {
                        node.error(err);
                        deferred.reject(err);
                        return;
                    }
                    deferred.resolve(result.torrents[0]);
                })
            });
            return deferred.promise;
        }


        var options = {};
        if (this.location !== "") {
            options["download-dir"] = this.location;
        }
        this.on("input", function (msg) {
            var url = msg.payload;
            if (msg.location) {
                options["download-dir"] = msg.location;
            }

            if (msg.dlgroup) {
                options["downloadGroup"] = msg.dlgroup;
            }

            if (Array.isArray(url)) {
                var promises = [];
                url.forEach(function (element) {
                    promises.push(PromiseAddTorrent(element, options));
                });
                when.all(promises).then(function (torrents) {
                    msg.torrent = torrents;
                    node.send(msg);
                });
            } else {
                node.server.transmission.add(url, options, function (err, result) {
                    if (err) {
                        return node.error(err);
                    }
                    var id = result.id;
                    node.server.transmission.get(id, function (err, result) {
                        if (err) {
                            return node.error(err);
                        }
                        msg.torrent = result.torrents[0];
                        node.send(msg);
                    })
                })
            }

        });
    }

    RED.nodes.registerType("BT add", TransmissionDownloadNode);
}
