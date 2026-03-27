"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpUrl = exports.mqttUrl = exports.config = void 0;
exports.config = {
    mqtt: {
        host: process.env.MQTT_HOST || 'localhost',
        port: parseInt(process.env.MQTT_PORT || '1883'),
        protocol: 'mqtt'
    },
    http: {
        host: process.env.HTTP_HOST || 'localhost',
        port: parseInt(process.env.HTTP_PORT || '3000'),
        baseUrl: ''
    }
};
exports.mqttUrl = `${exports.config.mqtt.protocol}://${exports.config.mqtt.host}:${exports.config.mqtt.port}`;
exports.httpUrl = `http://${exports.config.http.host}:${exports.config.http.port}`;
//# sourceMappingURL=index.js.map