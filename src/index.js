const CustomCharacteristic = {
  // Power Meter
  Consumption: undefined,
  TotalConsumption: undefined,
  Voltage: undefined,
  Ampere: undefined,
  // Climate
  AirPressure: undefined,
  // Contact
  ResetTotal: undefined,
  LastActivation: undefined,
  TimesOpened: undefined,
  Char118: undefined,
  Char119: undefined,
};
let CustomServices = {
  PowerMeter: undefined,
};

module.exports = function (api) {
  const Characteristic = api.hap.Characteristic;
  const Service = api.hap.Service;

  // Custom Characteristics
  // Power Meter
  CustomCharacteristic.Consumption = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
      this.setProps({
        format: Characteristic.Formats.UINT16,
        unit: "Watts",
        maxValue: 3600,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
      });
    };
  };
  CustomCharacteristic.TotalConsumption = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
      this.setProps({
        format: Characteristic.Formats.FLOAT,
        unit: 'kWh',
        maxValue: 1000000000,
        minValue: 0,
        minStep: 0.01,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
      });
    };
  };
  CustomCharacteristic.Voltage = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Volt', 'E863F10A-079E-48FF-8F27-9C2605A29F52');
      this.setProps({
        format: Characteristic.Formats.FLOAT,
        unit: 'Volt',
        maxValue: 250,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
      });
    };
  };
  CustomCharacteristic.Ampere = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Ampere', 'E863F126-079E-48FF-8F27-9C2605A29F52');
      this.setProps({
        format: Characteristic.Formats.FLOAT,
        unit: 'Ampere',
        maxValue: 20,
        minValue: 0,
        minStep: 0.1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
      });
    };
  };

  // Climate
  CustomCharacteristic.AirPressure = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Air Pressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
      this.setProps({
        format: Characteristic.Formats.UINT16,
        unit: 'mBar',
        maxValue: 1200,
        minValue: 600,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
      });
    };
  };

  // Contact
  CustomCharacteristic.ResetTotal = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, 'Reset', "E863F112-079E-48FF-8F27-9C2605A29F52");
      this.setProps({
        format: Characteristic.Formats.UINT32,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
      });
    };
  };
  CustomCharacteristic.LastActivation = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, "LastActivation", "E863F11A-079E-48FF-8F27-9C2605A29F52");
      this.setProps({
        format: Characteristic.Formats.UINT32,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
      });
    };
  };
  CustomCharacteristic.TimesOpened = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, "TimesOpened", "E863F129-079E-48FF-8F27-9C2605A29F52");
      this.setProps({
        format: Characteristic.Formats.UINT32,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
      });
    };
  };
  CustomCharacteristic.Char118 = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, "Char118", "E863F118-079E-48FF-8F27-9C2605A29F52");
      this.setProps({
        format: Characteristic.Formats.UINT32,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
      });
    };
  };
  CustomCharacteristic.Char119 = class extends Characteristic {
    constructor() {
      super();
      Characteristic.call(this, "Char119", "E863F119-079E-48FF-8F27-9C2605A29F52");
      this.setProps({
        format: Characteristic.Formats.UINT32,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
      });
    };
  };

  // Custom Services

  CustomServices.PowerMeter = class extends Service {
    constructor(displayName, subType) {
      super(displayName, "2d528896-bbbd-44b0-bfe7-d31142a6828b", subType);
      Service.call(this, displayName, '2d528896-bbbd-44b0-bfe7-d31142a6828b', subType);
      this.addCharacteristic(CustomCharacteristic.Consumption);
      this.addCharacteristic(CustomCharacteristic.TotalConsumption);
      this.addCharacteristic(CustomCharacteristic.Voltage);
      this.addCharacteristic(CustomCharacteristic.Ampere);
    }
  };

  CustomServices.AirPressure = class extends Service {
    constructor(displayName, subType) {
      super(displayName, "c0af0878-343f-4d26-9637-32410b2bf3de", subType);
      Service.call(this, displayName, 'c0af0878-343f-4d26-9637-32410b2bf3de', subType);
      this.addCharacteristic(CustomCharacteristic.AirPressure);
    }
  };

  const Accessory = require("./Accessory")(api, CustomCharacteristic, CustomServices);

  // Register with Homebridge
  api.registerAccessory("homebridge-mqtt-eve", "mqtt-eve-accessory", Accessory);
};
