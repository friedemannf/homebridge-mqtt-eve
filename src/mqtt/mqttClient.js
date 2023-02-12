const mqtt = require("mqtt")
const EventEmitter = require("events")

const
  KeyConnect = "connect",
  KeyMessage = "message",
  KeyConsumption = "consumption",
  KeyTotalConsumption = "totalConsumption",
  KeyVoltage = "voltage",
  KeyAmpere = "ampere",
  KeyTemperature = "temperature",
  KeyHumidity = "humidity",
  KeyAirPressure = "pressure",
  KeyContact = "contact"
;

const DefaultKeys = {
  consumption: "power",
  totalConsumption: "energy",
  voltage: "voltage",
  ampere: "ampere",
  temperature: "temperature",
  humidity: "humidity",
  pressure: "pressure",
  contact: "contact",
};

class MqttClient extends EventEmitter {
  constructor(config) {
    super();

    this.keys = config.keys ? config.keys : DefaultKeys;

    this.mqtt = mqtt.connect(config.mqtt.url, {
      keepalive: 10,
      clientId: "mqttjs_".concat(Math.random().toString(16).substring(2, 8)),
      protocolId: "MQTT",
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30_000,
      username: config.mqtt.username,
      password: config.mqtt.password,
      rejectUnauthorized: false,
    })

    this.mqtt.on("connect", () => {
      this.emit(KeyConnect, null);
      this.mqtt.subscribe(config.mqtt.topic);
    })

    this.mqtt.on("message", (topic, payload) => {
      this.emit(KeyMessage, topic, payload.toString());
      const mqttData = JSON.parse(payload.toString());

      if (mqttData === null) {
        return;
      }

      if (mqttData.hasOwnProperty(this.keys[KeyConsumption])) {
        const consumption = parseFloat(mqttData[this.keys[KeyConsumption]]);
        this.emit(KeyConsumption, consumption);
      }
      if (mqttData.hasOwnProperty(this.keys[KeyTotalConsumption])) {
        const totalConsumption = parseFloat(mqttData[this.keys[KeyTotalConsumption]]);
        this.emit(KeyTotalConsumption, totalConsumption);
      }
      if (mqttData.hasOwnProperty(this.keys[KeyVoltage])) {
        const voltage = parseFloat(mqttData[this.keys[KeyVoltage]]);
        this.emit(KeyVoltage, voltage);
      }
      if (mqttData.hasOwnProperty(this.keys[KeyAmpere])) {
        const ampere = parseFloat(mqttData[this.keys[KeyAmpere]]);
        this.emit(KeyAmpere, ampere);
      }


      if (mqttData.hasOwnProperty(this.keys[KeyTemperature])) {
        const temperature = parseFloat(mqttData[this.keys[KeyTemperature]]);
        this.emit(KeyTemperature, temperature);
      }
      if (mqttData.hasOwnProperty(this.keys[KeyHumidity])) {
        const humidity = parseFloat(mqttData[this.keys[KeyHumidity]]);
        this.emit(KeyHumidity, humidity);
      }
      if (mqttData.hasOwnProperty(this.keys[KeyAirPressure])) {
        const airPressure = parseFloat(mqttData[this.keys[KeyAirPressure]]);
        this.emit(KeyAirPressure, airPressure);
      }


      if (mqttData.hasOwnProperty(this.keys[KeyContact])) {
        const contactBool = mqttData[this.keys[KeyContact]]
        this.emit(KeyContact, contactBool ? 1 : 0);
      }
    });
  };
}

module.exports = {
  MqttClient,
  KeyConnect,
  KeyMessage,
  KeyConsumption,
  KeyTotalConsumption,
  KeyVoltage,
  KeyAmpere,
  KeyTemperature,
  KeyHumidity,
  KeyAirPressure,
  KeyContact,
};