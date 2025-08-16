// ZockZeit Homebridge Accessory
let Service, Characteristic;
const http = require('http');
const https = require('https');
const url = require('url');

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-zockzeit", "ZockZeit", ZockZeitAccessory);
};

// HTTP request helper with better error handling and timeout
function httpRequest(requestUrl, timeout = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = url.parse(requestUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.get(requestUrl, (res) => {
        let data = '';
        
        // Handle different response codes
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data.trim()));
      });
      
      req.on('error', reject);
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

class ZockZeitAccessory {
  constructor(log, config) {
    this.log = log;
    this.config = config;
    this.name = config.name || 'ZockZeit';
    
    // Validate required config
    if (!config.elapsedTimeURL && !config.targetTimeURL) {
      throw new Error('At least one of elapsedTimeURL or targetTimeURL must be configured');
    }
    
    // URLs
    this.elapsedTimeURL = config.elapsedTimeURL || null;
    this.targetTimeURL = config.targetTimeURL || null;
    this.setTargetTimeURL = config.setTargetTimeURL || null;
    this.turnOnURLs = Array.isArray(config.turnOnURLs) ? config.turnOnURLs : [];
    this.turnOffURLs = Array.isArray(config.turnOffURLs) ? config.turnOffURLs : [];
    this.resetURL = config.resetURL || null;
    
    // Intervals with bounds checking
    this.elapsedPollInterval = Math.max(1, Math.min(300, config.elapsedPollInterval || 5)) * 1000;
    this.targetPollInterval = Math.max(5, Math.min(3600, config.targetPollInterval || 30)) * 1000;
    this.requestTimeout = Math.max(1000, Math.min(30000, config.requestTimeout || 5000));
    
    // Temperature bounds for thermostat
    this.minTemp = config.minTemp || 0;
    this.maxTemp = config.maxTemp || 240; // 24 hours in minutes
    
    // State
    this.currentValue = 0;
    this.targetValue = 0;
    this.isOn = false;
    this.lastUpdateTime = 0;
    
    // Polling timers
    this.elapsedTimer = null;
    this.targetTimer = null;
    
    this.setupService();
    this.startPolling();
    
    this.log(`ZockZeit accessory initialized: ${this.name}`);
  }
  
  setupService() {
    // Create thermostat service
    this.service = new Service.Thermostat(this.name);
    
    // Current temperature (elapsed time)
    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: 1
      })
      .on("get", this.handleGetCurrent.bind(this));
    
    // Target temperature (target time)
    this.service.getCharacteristic(Characteristic.TargetTemperature)
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: 1
      })
      .on("get", this.handleGetTarget.bind(this))
      .on("set", this.handleSetTarget.bind(this));
    
    // Temperature display units (Celsius = minutes)
    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .setValue(Characteristic.TemperatureDisplayUnits.CELSIUS);
    
    // Heating/Cooling state
    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on("get", this.handleGetCurrentHeatingCoolingState.bind(this));
    
    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [
          Characteristic.TargetHeatingCoolingState.OFF,
          Characteristic.TargetHeatingCoolingState.HEAT
        ]
      })
      .on("get", this.handleGetTargetHeatingCoolingState.bind(this))
      .on("set", this.handleSetTargetHeatingCoolingState.bind(this));
    
    // Optional switch service for reset functionality
    if (this.resetURL) {
      this.resetService = new Service.Switch(this.name + ' Reset', 'reset');
      this.resetService.getCharacteristic(Characteristic.On)
        .on("get", (callback) => callback(null, false))
        .on("set", this.handleReset.bind(this));
    }
  }
  
  startPolling() {
    // Start elapsed time polling
    if (this.elapsedTimeURL) {
      this.updateElapsed(); // Initial update
      this.elapsedTimer = setInterval(() => this.updateElapsed(), this.elapsedPollInterval);
    }
    
    // Start target time polling
    if (this.targetTimeURL) {
      this.updateTarget(); // Initial update
      this.targetTimer = setInterval(() => this.updateTarget(), this.targetPollInterval);
    }
  }
  
  stopPolling() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
    if (this.targetTimer) {
      clearInterval(this.targetTimer);
      this.targetTimer = null;
    }
  }

  async updateElapsed() {
    if (!this.elapsedTimeURL) return;
    
    try {
      const data = await httpRequest(this.elapsedTimeURL, this.requestTimeout);
      const val = this.parseValue(data);
      
      if (val !== this.currentValue) {
        this.currentValue = val;
        this.service.updateCharacteristic(Characteristic.CurrentTemperature, val);
        this.updateHeatingCoolingState();
        this.lastUpdateTime = Date.now();
      }
    } catch (error) {
      this.log.warn('Error updating elapsed time:', error.message);
      // Don't reset to 0 on error, keep last known value
    }
  }

  async updateTarget() {
    if (!this.targetTimeURL) return;
    
    try {
      const data = await httpRequest(this.targetTimeURL, this.requestTimeout);
      const val = this.parseValue(data);
      
      if (val !== this.targetValue) {
        this.targetValue = val;
        this.service.updateCharacteristic(Characteristic.TargetTemperature, val);
        this.updateHeatingCoolingState();
        this.log.debug("Target time updated to", val);
      }
    } catch (error) {
      this.log.warn('Error updating target time:', error.message);
    }
  }
  
  parseValue(data) {
    const parsed = parseInt(data);
    if (isNaN(parsed)) {
      this.log.warn('Received non-numeric data:', data);
      return 0;
    }
    return Math.max(this.minTemp, Math.min(this.maxTemp, parsed));
  }
  
  updateHeatingCoolingState() {
    const currentState = this.currentValue >= this.targetValue ? 
      Characteristic.CurrentHeatingCoolingState.OFF : 
      Characteristic.CurrentHeatingCoolingState.HEAT;
    
    this.service.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, currentState);
  }

  // Characteristic handlers
  handleGetCurrent(callback) {
    callback(null, this.currentValue);
  }

  handleGetTarget(callback) {
    callback(null, this.targetValue);
  }

  async handleSetTarget(value, callback) {
    const clampedValue = Math.max(this.minTemp, Math.min(this.maxTemp, value));
    this.targetValue = clampedValue;

    if (this.setTargetTimeURL) {
        // setTargetTimeURL ist jetzt ein Template mit Platzhalter {kovalue}
        const url = this.setTargetTimeURL.replace('{kovalue}', clampedValue);

        try {
            await httpRequest(url, this.requestTimeout);
            this.log(`Target time set to ${clampedValue} minutes via ${url}`);
        } catch (error) {
            this.log.error("Failed to set target time:", error.message);
            callback(error);
            return;
        }
    }

    this.updateHeatingCoolingState();
    callback(null);
}
  
  handleGetCurrentHeatingCoolingState(callback) {
    const state = this.currentValue >= this.targetValue ? 
      Characteristic.CurrentHeatingCoolingState.OFF : 
      Characteristic.CurrentHeatingCoolingState.HEAT;
    callback(null, state);
  }
  
  handleGetTargetHeatingCoolingState(callback) {
    const state = this.isOn ? 
      Characteristic.TargetHeatingCoolingState.HEAT : 
      Characteristic.TargetHeatingCoolingState.OFF;
    callback(null, state);
  }
  
  async handleSetTargetHeatingCoolingState(value, callback) {
    const turnOn = value === Characteristic.TargetHeatingCoolingState.HEAT;
    
    if (this.isOn === turnOn) {
      callback(null);
      return;
    }
    
    this.isOn = turnOn;
    const urls = turnOn ? this.turnOnURLs : this.turnOffURLs;
    const action = turnOn ? 'turn on' : 'turn off';
    
    if (urls.length === 0) {
      this.log.warn(`No URLs configured to ${action}`);
      callback(null);
      return;
    }
    
    const promises = urls.map(async (requestUrl) => {
      try {
        await httpRequest(requestUrl, this.requestTimeout);
        this.log(`Successfully sent ${action} request to ${requestUrl}`);
      } catch (error) {
        this.log.error(`Failed to ${action} via ${requestUrl}:`, error.message);
        throw error;
      }
    });
    
    try {
      await Promise.all(promises);
      this.log(`Timer ${action} successful`);
      callback(null);
    } catch (error) {
      // At least one request failed
      callback(error);
    }
  }
  
  async handleReset(value, callback) {
    if (!value) {
      callback(null);
      return;
    }
    
    if (!this.resetURL) {
      this.log.warn('Reset requested but no resetURL configured');
      callback(null);
      return;
    }
    
    try {
      await httpRequest(this.resetURL, this.requestTimeout);
      this.log('Timer reset successful');
      
      // Reset the switch back to off
      setTimeout(() => {
        this.resetService.updateCharacteristic(Characteristic.On, false);
      }, 1000);
      
      // Force update elapsed time
      setTimeout(() => this.updateElapsed(), 2000);
      
      callback(null);
    } catch (error) {
      this.log.error('Failed to reset timer:', error.message);
      callback(error);
    }
  }

  getServices() {
    const services = [this.service];
    if (this.resetService) {
      services.push(this.resetService);
    }
    return services;
  }
  
  // Cleanup method
  destroy() {
    this.log('Shutting down ZockZeit accessory');
    this.stopPolling();
  }
}