export const config = {
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

export const mqttUrl = `${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`;
export const httpUrl = `http://${config.http.host}:${config.http.port}`;
