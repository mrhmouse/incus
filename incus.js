(function () {
    'use strict';

    var Incus = function (url, UID, page) {
        this.MAXRETRIES = 6;

        this.socketRetries = 0;
        this.pollRetries = 0;

        this.url = url;
        this.UID = UID;
        this.page = page;

        this.onMessageCbs = {};
        this.connectedCb = false;

        this.socket = null;
        this.poll = null;
        this.connected = false;
        this.socketConnected = false;

        this.connect();
    };

    Incus.prototype.longpoll = function (command) {
        if (this.socketConnected) {
            return;
        }

        if (this.poll !== null && this.poll !== undefined) {
            this.poll.abort();
        }

        this.poll = new XMLHttpRequest();

        var
            self = this,
            data = { user: this.UID },
            query_string = this.serialize(data);

        if (this.page) {
            data.page = this.page;
        }

        if (command !== undefined) {
            data.command = command;
        }

        this.poll.onreadystatechange = function () {
            if (self.poll.readyState !== 4) {
                return;
            }

            var response = {
                data: self.poll.responseText,
                status: self.poll.status,
                success: true
            };

            if (self.poll.status !== 0 && self.pollRetries < self.MAXRETRIES) {
                self.longpoll();
            }

            if (response.status !== 200 && response.status !== 0) {
                self.pollRetries += 1;
            }

            if (response.status === 200 && response.data !== "") {
                self.onMessage(response);
            }
        };

        this.poll.open("GET", this.url + '/lp' + query_string, true);
        this.poll.timeout = 0;
        this.poll.send();

        this.connected = true;

        if (!this.connectedCb && this.onMessageCbs.connect !== undefined) {
            this.connectedCb = true;
            this.onMessageCbs.connect.call(null);
        }
    };

    Incus.prototype.connect = function () {
        this.longpoll();

        if (window.WebSocket !== undefined) {
            this.connectSocket();
        }
    };

    Incus.prototype.connectSocket = function () {
        var
            url = this.url.replace("https", "wss").replace("http", "ws"),
            self = this;
        this.socket = new window.WebSocket(url + '/socket');

        this.socket.onopen = function () { self.authenticate(); };
        this.socket.onmessage = function (e) { self.onMessage(e); };
        this.socket.onclose = function () { self.onClose(); };
    };

    Incus.prototype.newCommand = function (command, message) {
        message.time = Math.round(new Date().getTime() / 1000);
        var obj = {
            command: command,
            message: message
        };

        return JSON.stringify(obj);
    };

    Incus.prototype.authenticate = function () {
        this.socketConnected = true;
        this.poll.abort();

        var message = this.newCommand({
            command: "authenticate",
            user: this.UID
        }, {});

        this.socket.send(message);

        if (this.page) {
            this.setPage(this.page);
        }

        if (!this.connectedCb && this.onMessageCbs.connect !== undefined) {
            this.connectedCb = true;
            this.onMessageCbs.connect.call(null);
        }

        this.connected = true;
    };

    Incus.prototype.on = function (name, func) {
        if (name === 'connect' && this.connected) {
            this.connectedCb = true;
            func();
        }

        this.onMessageCbs[name] = func;
    };

    Incus.prototype.onMessage = function (e) {
        if (e.data === "") {
            this.socketRetries = 0;
            return;
        }

        var msg = JSON.parse(e.data);

        if (msg.event !== undefined && this.onMessageCbs[msg.event] !== undefined) {
            if (typeof this.onMessageCbs[msg.event] === "function") {
                this.onMessageCbs[msg.event].call(null, msg.data);
            }
        }
    };

    Incus.prototype.onClose = function () {
        if (this.socketRetries > this.MAXRETRIES) {
            return;
        }

        this.socketRetries += 1;
        this.connected = false;

        var self = this;
        window.setTimeout(function () {
            console.log("Connection closed, retrying");

            self.connectSocket();
        }, 1000);
    };

    Incus.prototype.MessageUser = function (event, UID, data) {
        var
            command = { command: "message", user: UID },
            message = { event: event, data: data },
            msg = this.newCommand(command, message);
        return this.send(msg);
    };

    Incus.prototype.MessagePage = function (event, page, data) {
        var
            command = { command: "message", page: page },
            message = { event: event, data: data },
            msg = this.newCommand(command, message);
        return this.send(msg);
    };

    Incus.prototype.MessageAll = function (event, data) {
        var
            command = { command: "message" },
            message = { event: event, data: data },
            msg = this.newCommand(command, message);
        return this.send(msg);
    };

    Incus.prototype.setPage = function (page) {
        this.page   = page;

        if (this.socketConnected) {
            var
                command = { command: 'setpage', page: page },
                msg = this.newCommand(command, {});
            return this.send(msg);
        }

        this.send();
    };

    Incus.prototype.serialize = function (obj) {
        var p, str = [];

        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        }

        return '?' + str.join("&");
    };

    Incus.prototype.send = function (command) {
        if (this.socketConnected) {
            this.socket.send(command);
        } else {
            this.longpoll(command);
        }
    };

    if (!window.Incus) {
        window.Incus = Incus;
    }
}());
