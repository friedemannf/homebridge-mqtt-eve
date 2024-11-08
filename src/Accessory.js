const mqtt = require("./mqtt/mqttClient");

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
      this.displayName = config.name;
      this.serial = config.serial_number;

      // Set up information service
      const informationService = new api.hap.Service.AccessoryInformation()
          .setCharacteristic(api.hap.Characteristic.Manufacturer, config["manufacturer"])
          .setCharacteristic(api.hap.Characteristic.Model, config["model"])
          .setCharacteristic(api.hap.Characteristic.SerialNumber, config["serial_number"])
          .setCharacteristic(api.hap.Characteristic.FirmwareRevision, process.env.npm_package_version);
      this.services.push(informationService);

      // Connect to MQTT
      this.mqtt = new mqtt.MqttClient(config);
      this.mqtt.on(mqtt.KeyConnect, () => {
        this.log.debug("Connected to MQTT server.");
      });
      this.mqtt.on(mqtt.KeyMessage, (topic, message) => {
        this.log.debug(`${topic}: ${message}`);
      });

      let historyService;

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
          historyService = this._createHistoryService(
              "energy",
              config["history"]["storage"],
              config["history"]["filename"],
              config["history"]["filepath"],
              config["history"]["size"],
          );
          this.services.push(historyService);

          powerMeterService.getCharacteristic(characteristics.Consumption).onGet(() => this.values.consumption);
          powerMeterService.getCharacteristic(characteristics.TotalConsumption).onGet(() => this.values.totalConsumption);
          powerMeterService.getCharacteristic(characteristics.Voltage).onGet(() => this.values.voltage);
          powerMeterService.getCharacteristic(characteristics.Ampere).onGet(() => this.values.ampere);
          this.mqtt.on(mqtt.KeyConsumption, (consumption) => {
            this.values.consumption = consumption;
            powerMeterService.setCharacteristic(characteristics.Consumption, consumption);
            historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), power: consumption});
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
          break;
        case "climate":
          this.values = {
            temperature: 0,
            humidity: 0,
            airPressure: 600,
          };
          const temperatureService = new api.hap.Service.TemperatureSensor(this.name);
          if (config.keys["temperature"] !== "-") {
            this.services.push(temperatureService);
          }
          const humidityService = new api.hap.Service.HumiditySensor(this.name);
          if (config.keys["humidity"] !== "-") {
            this.services.push(humidityService);
          }
          const airPressureService = new services.AirPressure(this.name);
          if (config.keys["pressure"] !== "-") {
            this.services.push(airPressureService);
          }
          historyService = this._createHistoryService(
              "weather",
              config["history"]["storage"],
              config["history"]["filename"],
              config["history"]["filepath"],
              config["history"]["size"],
          );
          this.services.push(historyService);

          temperatureService.getCharacteristic(api.hap.Characteristic.CurrentTemperature).onGet(() => this.values.temperature);
          humidityService.getCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity).onGet(() => this.values.humidity);
          airPressureService.getCharacteristic(characteristics.AirPressure).onGet(() => this.values.airPressure);
          this.mqtt.on(mqtt.KeyTemperature, (temperature) => {
            this.values.temperature = temperature;
            temperatureService.setCharacteristic(api.hap.Characteristic.CurrentTemperature, temperature);
            historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), temp: temperature});
          });
          this.mqtt.on(mqtt.KeyHumidity, (humidity) => {
            this.values.humidity = humidity;
            humidityService.setCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity, humidity);
            historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), humidity: humidity});
          });
          this.mqtt.on(mqtt.KeyAirPressure, (airPressure) => {
            this.values.airPressure = airPressure;
            airPressureService.setCharacteristic(characteristics.AirPressure, airPressure);
            historyService.addEntry({time: Math.round(new Date().valueOf() / 1000), pressure: airPressure});
          });
          break;
        case "contact":
          this.values = {
            timesOpened: 0,
            lastReset: 0,
            lastOpening: 0,
            contact: 0,
          };
          // Contact only works with fakegato due to persisted data
          historyService = this._createHistoryService(
              "door",
              config["history"]["storage"],
              config["history"]["filename"],
              config["history"]["filepath"],
              config["history"]["size"],
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
                return;
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
        case "thermo":
          this.values = {
            temperature: 0,
            setTemperature: 10,
            valvePosition: 0,
          };
          const thermostatService = new api.hap.Service.Thermostat(this.name);
          this.services.push(thermostatService);
          historyService = this._createHistoryService(
              "thermo",
              config["history"]["storage"],
              config["history"]["filename"],
              config["history"]["filepath"],
              config["history"]["size"],
          );
          this.services.push(historyService);

          thermostatService.getCharacteristic(api.hap.Characteristic.CurrentTemperature).onGet(() => this.values.temperature);
          thermostatService.getCharacteristic(api.hap.Characteristic.TargetTemperature).onGet(() => this.values.setTemperature);
          thermostatService.addCharacteristic(characteristics.ValvePosition).onGet(() => this.values.valvePosition);
          thermostatService.addCharacteristic(characteristics.ProgramData).onGet(() => "");
          thermostatService.addCharacteristic(characteristics.ProgramCommand).onSet((command) => this.log.debug("ProgramCommand", command));

          const addEntry = function () {
            // Check if all values are populated
            if (this.values.temperature === 0 || this.values.setTemperature === 0 || this.values.valvePosition === 0) {
              return;
            }
            historyService.addEntry({
              time: Math.round(new Date().valueOf() / 1000),
              currentTemp: this.values.temperature,
              setTemp: this.values.setTemperature,
              valvePosition: this.values.valvePosition,
            });
          }.bind(this);

          const ticker = new AdjustingInterval(addEntry, 600_000);
          ticker.start();

          this.mqtt.on(mqtt.KeyTemperature, (temperature) => {
            this.values.temperature = temperature / 100;
            thermostatService.setCharacteristic(api.hap.Characteristic.CurrentTemperature, this.values.temperature);
          });
          this.mqtt.on(mqtt.KeySetTemperature, (setTemperature) => {
            this.values.setTemperature = setTemperature;
            thermostatService.setCharacteristic(api.hap.Characteristic.TargetTemperature, this.values.setTemperature);
          });
          this.mqtt.on(mqtt.KeyValvePosition, (valvePosition) => {
            this.values.valvePosition = valvePosition;
            thermostatService.setCharacteristic(characteristics.ValvePosition, this.values.valvePosition);
          });
          break;
      }
      this.log.info("Setup done.");
    }

    _createHistoryService(type, storage, filename, filepath, size) {
      // Filename cannot be empty
      if (!filename || filename === "") {
        filename = this.serial;
      }
      // Strip .json prefix if specified
      filename = filename.substring(filename.length - 5) === ".json" ? filename : filename + ".json";
      // Default to a history size of 4032 if unspecified
      if (!size || size === 0) {
        size = 4032;
      }
      return new FakeGatoHistoryService(type, this, {
        storage: storage,
        filename: filename,
        path: filepath,
        size: size,
      });
    }

    getServices() {
      return this.services;
    }

    identify(callback) {
      this.log.info("Identify requested!");
      callback();
    }
  };
};

/**
 * Self-adjusting interval to account for drifting
 *
 * @param {function} workFunc  Callback containing the work to be done
 *                             for each interval
 * @param {int}      interval  Interval speed (in milliseconds)
 * @param {function} errorFunc (Optional) Callback to run if the drift
 *                             exceeds interval
 */
function AdjustingInterval(workFunc, interval, errorFunc = undefined) {
  var that = this;
  var expected, timeout;
  this.interval = interval;

  this.start = function () {
    expected = Date.now() + this.interval;
    timeout = setTimeout(step, this.interval);
  };

  this.stop = function () {
    clearTimeout(timeout);
  };

  function step() {
    var drift = Date.now() - expected;
    if (drift > that.interval) {
      // You could have some default stuff here too...
      if (errorFunc) errorFunc();
    }
    workFunc();
    expected += that.interval;
    timeout = setTimeout(step, Math.max(0, that.interval - drift));
  }
}
