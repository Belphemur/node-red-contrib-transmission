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
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (searchString, position) {
            position = position || 0;
            return this.indexOf(searchString, position) === position;
        };
    }

    const fs = require('fs');
    const Transmission = require('transmission');
    const when = require("when");
    const wget = require('wget-improved');
    const os = require('os');
    const path = require('path');
    const defaultFilePath = os.tmpdir();


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
         * Download a file.
         * @param url
         * @returns {Promise} contains the file path of the downloaded file
         * @constructor
         */
        function DownloadTorrentFile(url) {
            var splited = url.split('/');
            var fileName = splited[splited.length - 1];
            var output = path.join(defaultFilePath, fileName);
            var deferred = when.defer();
            var download = wget.download(url, output);
            download.on("error", function (error) {
                deferred.reject(error);
            });
            download.on("end", function () {
                deferred.resolve(output);
            });
            return deferred.promise;
        }

        /**
         * Return a promise with the ID of the added torrent
         * @param url
         * @param options
         * @returns {Promise}
         * @constructor
         */
        function AddTorrentUrl(url, options) {
            var deferred = when.defer();
            node.server.transmission.addUrl(url, options, function (err, result) {
                if (err) {
                    deferred.reject(err);
                    return;
                }
                deferred.resolve(result.id);
            });
            return deferred.promise;
        }

        /**
         * Return a promise with the ID of the added torrent
         * @param path
         * @param options
         * @returns {Promise}
         * @constructor
         */
        function AddTorrentPath(path, options) {
            var deferred = when.defer();
            node.server.transmission.addFile(path, options, function (err, result) {
                if (err) {
                    deferred.reject(err);
                    return;
                }
                deferred.resolve(result.id);
            });
            return deferred.promise;
        }

        /**
         * Get a torrent from it's ID
         * @param id
         * @returns {Promise}
         * @constructor
         */
        function GetTorrentFromId(id) {
            var deferred = when.defer();
            node.server.transmission.get(id, function (err, result) {
                if (err) {
                    deferred.reject(err);
                    return;
                }
                deferred.resolve(result.torrents[0]);
            });
            return deferred.promise;
        }

        /**
         * Delete a file and return a promise for it.
         * @param path
         * @returns {Promise}
         * @constructor
         */
        function DeleteFile(path) {
            var deferred = when.defer();
            fs.unlink(outputFile, function (error) {
                if (error) {
                    deferred.reject(error);
                    return;
                }
                deferred.resolve();
            });
            return deferred.promise;
        }

        /**
         * Add the torrent to download and return a promise
         * @param url
         * @param options
         * @param download
         * @returns {Promise}
         * @constructor
         */
        function PromiseAddTorrent(url, options, download) {
            if (url.startsWith('http') && download) {
                var file;
                return DownloadTorrentFile(url).then(function (outputFile) {
                    file = outputFile;
                    return AddTorrentPath(outputFile, options);
                }).then(function (id) {
                    return GetTorrentFromId(id)
                }).then(function (torrent) {
                    return DeleteFile(file).then(function () {
                        return when.resolve(torrent);
                    });
                }).catch(function (error) {
                    node.error(error);
                });
            }

            return AddTorrentUrl(url, options).then(function (id) {
                return GetTorrentFromId(id);
            }, function (error) {
                node.error(error);
            });
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
                    promises.push(PromiseAddTorrent(element.trim(), options, msg.download));
                });
                when.all(promises).then(function (torrents) {
                    msg.torrent = torrents;
                    node.send(msg);
                });
            } else {
                PromiseAddTorrent(url.trim(), options, msg.download).then(function (torrent) {
                    msg.torrent = torrent;
                    node.send(msg);
                });
            }

        });
    }

    RED.nodes.registerType("BT add", TransmissionDownloadNode);
};
