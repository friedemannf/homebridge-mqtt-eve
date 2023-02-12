const mqtt = require("./mqtt/mqttClient")

exports = module.exports = function (api, characteristics, services) {
  const FakeGatoHistoryService = require("fakegato-history")(api);
  return class {
    services = [];

    values = {};

    constructor(
      log,
      config,
    ) {
      this.log = log;
      this.name = config.name;

      // Set up information service
      const informationService = new api.hap.Service.AccessoryInformation()
        .setCharacteristic(api.hap.Characteristic.Manufacturer, config["info"]["manufacturer"])
        .setCharacteristic(api.hap.Characteristic.Model, config["info"]["model"])
        .setCharacteristic(api.hap.Characteristic.SerialNumber, config["info"]["serialNumber"])
        .setCharacteristic(api.hap.Characteristic.FirmwareRevision, process.env.npm_package_version);
      this.services.push(informationService);

      // Connect to MQTT
      this.mqtt = new mqtt.MqttClient(config);
      this.mqtt.on(mqtt.KeyConnect, () => {
        this.log.debug("Connected to MQTT server.");
      })
      this.mqtt.on(mqtt.KeyMessage, (topic, message) => {
        this.log.debug(`${topic}: ${message}`);
      })

      switch (config.type) {
        case "energy":
          this.values = {
            consumption: 0,
            totalConsumption: 0,
            voltage: 0,
            ampere: 0,
          };
          const powerMeterService = new services.PowerMeter(this.name);
          this.services.push(powerMeterService);
          powerMeterService.getCharacteristic(characteristics.Consumption).onGet(() => this.values.consumption);
          powerMeterService.getCharacteristic(characteristics.TotalConsumption).onGet(() => this.values.totalConsumption);
          powerMeterService.getCharacteristic(characteristics.Voltage).onGet(() => this.values.voltage);
          powerMeterService.getCharacteristic(characteristics.Ampere).onGet(() => this.values.ampere);
          this.mqtt.on(mqtt.KeyConsumption, (consumption) => {
            this.values.consumption = consumption;
            powerMeterService.setCharacteristic(characteristics.Consumption, consumption);
          });
          this.mqtt.on(mqtt.KeyTotalConsumption, (totalConsumption) => {
            this.values.totalConsumption = totalConsumption;
            powerMeterService.setCharacteristic(characteristics.TotalConsumption, totalConsumption);
          });
          this.mqtt.on(mqtt.KeyAmpere, (ampere) => {
            this.values.ampere = ampere;
            powerMeterService.setCharacteristic(characteristics.Ampere, ampere);
          });
          this.mqtt.on(mqtt.KeyVoltage, (voltage) => {
            this.values.voltage = voltage;
            powerMeterService.setCharacteristic(characteristics.Voltage, voltage);
          });

          if (config["history"]["activate"] === true) {
            const historyService = this._createHistoryService(
              "energy",
              config["history"["storage"]],
              config["history"]["filename"],
              config["history"]["filepath"],
            );
            this.mqtt.on(mqtt.KeyConsumption, (consumption) => {
              historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), power: consumption});
            });
            this.services.push(historyService);
          }
          break;
        case "climate":
          this.values = {
            temperature: 0,
            humidity: 0,
            airPressure: 600,
          };
          const climateService = new services.Climate(this.name);
          this.services.push(climateService);
          // TODO: Make configurable
          climateService.getCharacteristic(api.hap.Characteristic.TemperatureDisplayUnits).setValue(api.hap.Characteristic.TemperatureDisplayUnits.CELSIUS); // Celsius
          climateService.getCharacteristic(api.hap.Characteristic.CurrentTemperature).onGet(() => this.values.temperature);
          climateService.getCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity).onGet(() => this.values.humidity);
          climateService.getCharacteristic(characteristics.AirPressure).onGet(() => this.values.airPressure);
          this.mqtt.on(mqtt.KeyTemperature, (temperature) => {
            this.values.temperature = temperature;
            climateService.setCharacteristic(api.hap.Characteristic.CurrentTemperature, temperature);
          });
          this.mqtt.on(mqtt.KeyHumidity, (humidity) => {
            this.values.humidity = humidity;
            climateService.setCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity, humidity);
          });
          this.mqtt.on(mqtt.KeyAirPressure, (airPressure) => {
            this.values.airPressure = airPressure;
            climateService.setCharacteristic(characteristics.AirPressure, airPressure);
          });

          if (config["history"]["activate"] === true) {
            const historyService = this._createHistoryService(
              "weather",
              config["history"["storage"]],
              config["history"]["filename"],
              config["history"]["filepath"],
            );
            this.mqtt.on(mqtt.KeyTemperature, (temperature) => {
              historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), temp: temperature});
            });
            this.mqtt.on(mqtt.KeyHumidity, (humidity) => {
              historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), humidity: humidity});
            });
            this.mqtt.on(mqtt.KeyAirPressure, (airPressure) => {
              historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), pressure: airPressure});
            });
            this.services.push(historyService);
          }
          break;
        case "contact":
          this.values = {
            timesOpened: 0,
            lastReset: 0,
            lastOpening: 0,
            contact: 0,
          };
          // Contact only works with fakegato due to persisted data
          const historyService = this._createHistoryService(
            "door",
            config["history"]["storage"],
            config["history"]["filename"],
            config["history"]["filepath"],
          );
          this.services.push(historyService);
          historyService.load(function (err, loaded) {
            if (loaded) {
              const extraPersistedData = historyService.getExtraPersistedData();
              // this.log.debug("extraPersistedData", extraPersistedData);
              if (extraPersistedData !== undefined) {
                this.values.timesOpened = extraPersistedData.timesOpened || 0;
                this.values.lastReset = extraPersistedData.lastReset || 0;
                this.values.lastOpening = extraPersistedData.lastOpening || 0;
                this.values.contact = extraPersistedData.contact || 1;
              }
            }
          }.bind(this));

          const contactSensorService = new api.hap.Service.ContactSensor(this.name);
          this.services.push(contactSensorService);
          contactSensorService.getCharacteristic(api.hap.Characteristic.ContactSensorState).onGet(() => this.values.contact);
          contactSensorService.addCharacteristic(characteristics.TimesOpened)
            .onGet(() => this.values.timesOpened);
          contactSensorService.addCharacteristic(characteristics.ResetTotal)
            .onGet(() => this.values.lastReset)
            .onSet((lastReset) => {
              this.values.lastReset = lastReset;
              this.values.timesOpened = 0;
              historyService.setExtraPersistedData(this.values);
            });
          contactSensorService.addCharacteristic(characteristics.LastActivation)
            .onGet(() => this.values.lastOpening);
          contactSensorService.addCharacteristic(characteristics.Char118);
          contactSensorService.addCharacteristic(characteristics.Char119);

          this.mqtt.on(mqtt.KeyContact, (contact) => {
            if (contact) {
              // Closed
              this.values.contact = api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
              historyService.setExtraPersistedData(this.values);
            } else {
              // Open
              if (this.values.contact === api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED) {
                // Ignore re-published events to not increase timesOpened
                return
              }
              this.values.contact = api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
              this.values.timesOpened++;
              this.values.lastOpening = Math.round(new Date().valueOf() / 1000) - historyService.getInitialTime();
              historyService.setExtraPersistedData(this.values);
            }
            historyService.addEntry({
              time: Math.round(new Date().valueOf() / 1000),
              status: contact ? 1 : 0,
            });
            contactSensorService.setCharacteristic(api.hap.Characteristic.ContactSensorState,
              contact ? api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED : api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
          });
          break;
      }
      this.log.info("Setup done.")
    }

    _createHistoryService(type, storage, filename, filepath) {
      // Filename cannot be empty
      if (filename === "") {
        filename = this.name;
      }
      filename = filename.substring(filename.length - 5) === ".json" ? filename : filename + ".json";
      return new FakeGatoHistoryService(type, this, {
        storage: storage,
        filename: filename,
        path: filepath
      });
    }

    getServices() {
      return this.services;
    }

    identify(callback) {
      this.log.info("Identify requested!");
      callback();
    }
  }
}