/*
 *    ingescape.js
 *
 *    Copyright (c) 2021-2025 Ingenuity i/o. All rights reserved.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at http://mozilla.org/MPL/2.0/
 *
 */

// Enum for io types
const ios = {
    IGS_INPUT_T: 1,
    IGS_OUTPUT_T: 2,
    IGS_ATTRIBUTE_T: 3
};

// Enum for io value types
const ioTypes = {
    IGS_UNKNOWN_T: 0,
    IGS_INTEGER_T: 1,
    IGS_DOUBLE_T: 2,
    IGS_STRING_T: 3,
    IGS_BOOL_T: 4,
    IGS_IMPULSION_T: 5,
    IGS_DATA_T: 6
};

// Enum for agent events
const agentEvents = {
    IGS_PEER_ENTERED: 1,
    IGS_PEER_EXITED: 2,
    IGS_AGENT_ENTERED: 3,
    IGS_AGENT_UPDATED_DEFINITION: 4,
    IGS_AGENT_KNOWS_US: 5,
    IGS_AGENT_EXITED: 6,
    IGS_AGENT_UPDATED_MAPPING : 7,
    IGS_AGENT_WON_ELECTION : 8,
    IGS_AGENT_LOST_ELECTION : 9
};

class Agent {
    static _ourAgents = new Map();
    static _messagesToSendOnWS = [];
    static _isConnected = false;

    static _ioTypesToString() {
        var toString = "Io types on Ingescape platform :\n"
        for (var type in ioTypes) {
            toString += type + " = " + ioTypes[type] + "\n";
        }
        return toString;
    }

    static _ioTypeExists(ioType) {
        for (var type in ioTypes) {
            if (ioTypes[type] === ioType) {
                return true;
            }
        }
        return false;
    }

    static _isValueTypeOK(ioType, value) {
        switch (ioType) {
            case ioTypes.IGS_INTEGER_T:
                if (typeof(value) !== "number") {
                    return "number";
                }
                break;
            case ioTypes.IGS_DOUBLE_T:
                if (typeof(value) !== "number") {
                    return "number";
                }
                break;
            case ioTypes.IGS_STRING_T :
                if (typeof(value) !== "string") {
                    return "string";
                }
                break;
            case ioTypes.IGS_BOOL_T :
                if (typeof(value) !== "boolean") {
                    return "boolean";
                }
                break;
            case ioTypes.IGS_IMPULSION_T :
                // All accepted
                break;
            case ioTypes.IGS_DATA_T :
                if (!(value instanceof(ArrayBuffer))) {
                    return "array buffer";
                }
                break
            default :
                console.warn("Unknow ioType.");
                return "unknow";
        }
        return "";
    }

    static _ioTypeToJSONType(ioTypeNumber) {
        switch (ioTypeNumber) {
            case ioTypes.IGS_INTEGER_T:
                return "INTEGER";
            case ioTypes.IGS_DOUBLE_T:
                return "DOUBLE";
            case ioTypes.IGS_STRING_T:
                return "STRING";
            case ioTypes.IGS_BOOL_T:
                return "BOOL";
            case ioTypes.IGS_IMPULSION_T:
                return "IMPULSION";
            case ioTypes.IGS_DATA_T:
                return "DATA";
            case ioTypes.IGS_UNKNOWN_T:
            default:
                console.error("Unknown io type :", ioTypeNumber);
                return "UNKNOWN";
        }
    }

    static _jsonTypeToIOType(ioTypeJson) {
        switch (ioTypeJson) {
            case "INTEGER":
                return ioTypes.IGS_INTEGER_T;
            case "DOUBLE":
                return ioTypes.IGS_DOUBLE_T;
            case "STRING":
                return ioTypes.IGS_STRING_T;
            case "BOOL":
                return ioTypes.IGS_BOOL_T;
            case "IMPULSION":
                return ioTypes.IGS_IMPULSION_T;
            case "DATA":
                return ioTypes.IGS_DATA_T;
            default:
                console.error("Unknown io type :", ioTypeJson);
                return ioTypes.IGS_UNKNOWN_T;
        }
    }

    static _parseConstraint(ioType, constraint) {
        // First, check min pattern ...
        let regex = "min ([+-]?(\\d*[.])?\\d+)";
        let match = constraint.match(regex);
        if (match != null) {
            // Min pattern matching
            let value = match[1];
            if (ioType === ioTypes.IGS_INTEGER_T)
                return "min " + Math.trunc(parseFloat(value));
            else if (ioType === ioTypes.IGS_DOUBLE_T)
                return "min " + parseFloat(value);
            else {
                console.error("min constraint is allowed on integer and double IOA only");
                return undefined;
            }
        }
        else {
            // Then, check max pattern ...
            regex = "max ([+-]?(\\d*[.])?\\d+)";
            match = constraint.match(regex);
            if (match != null) {
                // Max pattern matching
                let value = match[1];
                if (ioType === ioTypes.IGS_INTEGER_T)
                    return "max " + Math.trunc(parseFloat(value));
                else if (ioType === ioTypes.IGS_DOUBLE_T)
                    return "max " + parseFloat(value);
                else {
                    console.error("max constraint is allowed on integer and double IOA only");
                    return undefined;
                }
            }
            else {
                // Then, check range pattern...
                regex = "\\[([+-]?(\\d*[.])?\\d+)\\s*,\\s*([+-]?(\\d*[.])?\\d+)\\]";
                match = constraint.match(regex);
                if (match != null) {
                    // Range pattern matching
                    let minValue = match[1];
                    let maxValue = match[3];
                    if (ioType === ioTypes.IGS_INTEGER_T) {
                        let minInt = Math.trunc(parseFloat(minValue));
                        let maxInt = Math.trunc(parseFloat(maxValue));
                        if (maxInt < minInt) {
                            console.error("range min is superior to range max in " + constraint);
                            return undefined;
                        }
                        else {
                            return "[" + minInt + ", " + maxInt + "]";
                        }
                    }
                    else if (ioType === ioTypes.IGS_DOUBLE_T) {
                        let minDouble = parseFloat(minValue);
                        let maxDouble = parseFloat(maxValue);
                        if (maxDouble < minDouble) {
                            console.error("range min is superior to range max in " + constraint);
                            return undefined;
                        }
                        else {
                            return "[" + minDouble + ", " + maxDouble + "]";
                        }
                    }
                    else {
                        console.error("range constraint is allowed on integer and double IOA only");
                        return undefined;
                    }
                }
                else {
                    // Then, check regexp pattern...
                    regex = "~ ([^\n]+)";
                    match = constraint.match(regex);
                    if (match != null) {
                        // Regexp pattern matching
                        let value = match[1];
                        if (ioType === ioTypes.IGS_STRING_T) {
                            let isValid = true;
                            try {
                                new RegExp(value);
                            } catch(e) {
                                isValid = false;
                            }

                            if (isValid) {
                                return "~ " + value;
                            }
                            else {
                                console.error("expression '" + value + "' did not match the allowed syntax");
                                return undefined;
                            }
                        }
                        else {
                            console.error("regexp constraint is allowed on string IOA only");
                            return undefined;
                        }
                    }
                    else {
                        console.error("expression'" + constraint + "' did not match the allowed syntax");
                        return undefined;
                    }
                }
            }
        }
    }

    static _modelCheckString(value) {
        return (!value.includes("\r") && !value.includes("\n") && !value.includes("\t") && !value.includes("\f") && !value.includes("\v"));
    }

    // Encode Array Buffer to B64 String
    static _arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // Decode B64 String in Array Buffer
    static _base64ToArrayBuffer(base64) {
        var binary_string =  window.atob(base64);
        var len = binary_string.length;
        var bytes = new Uint8Array( len );
        for (var i = 0; i < len; i++)        {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    static _writeIOOnWS(uuid, ioType, valueType, name, value)
    {
        var writeIOJSON = {
            event: "write_iop",
            uuid: uuid,
            iop: {
                type: ioType,
                name: name,
                value_type: valueType,
                value: value
            }
        };
        Agent._messagesToSendOnWS.push(JSON.stringify(writeIOJSON));
    }


    constructor(name, activateImmediately) {
        if (typeof(name) !== "string") {
            console.error("Agent(name, activateImmediately) : 'name' must be a string");
            return undefined;
        }
        if (typeof(activateImmediately) !== "boolean") {
            console.error("Agent(name, activateImmediately) : 'activateImmediately' must be a boolean");
            return undefined;
        }
        this.uuid = this._uuidv4();
        this.agentDefinition = {
            name: name,
            description: "",
            version: "",
            inputs: [],
            outputs: [],
            attributes: [],
            services: []
        };
        this.agentDefinitionIsUpdated = true;

        this.agentMapping = {
            mappings: []
        };
        this.agentMappingIsUpdated = false;

        this.isStarted = false;
        this.wasStarted = activateImmediately; // to start pseudo agent on reconnection
        this.observeInputsCbs = new Map();
        this.observeAttributesCbs = new Map();
        this.serviceCbs = new Map();
        this.observeAgentEventsCbs = [];

        Agent._ourAgents.set(this.uuid, this);

        if (Agent._isConnected) {
            var initPseudoAgentJSON = {
                event: "init_pseudo_agent",
                uuid: this.uuid,
                name: this.agentDefinition.name
            };
            Agent._messagesToSendOnWS.push(JSON.stringify(initPseudoAgentJSON));
        }
        // else: it will be done on websocket connection

        if (activateImmediately)
            this.activate();
        return this;
    }

    _uuidv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    _getInput(name) {
        let ioArray =  this.agentDefinition.inputs;
        for (let i = 0; i < ioArray.length; i++) {
            let io = ioArray[i];
            if (io.name === name) {
                return io;
            }
        }
        return null;
    }

    _getOutput(name) {
        let ioArray =  this.agentDefinition.outputs;
        for (let i = 0; i < ioArray.length; i++) {
            let io = ioArray[i];
            if (io.name === name) {
                return io;
            }
        }
        return null;
    }

    _getAttribute(name) {
        let ioArray =  this.agentDefinition.attributes;
        for (let i = 0; i < ioArray.length; i++) {
            let io = ioArray[i];
            if (io.name === name) {
                return io;
            }
        }
        return null;
    }

    _getService(name) {
        let servicesArray =  this.agentDefinition.services;
        for (let i = 0; i < servicesArray.length; i++) {
            let service = servicesArray[i];
            if (service.name === name) {
                return service;
            }
        }
        return null;
    }

    destroy() {
        var destroyPseudoAgentJSON = {
            event: "destroy_pseudo_agent",
            uuid: this.uuid
        };
        Agent._messagesToSendOnWS.push(JSON.stringify(destroyPseudoAgentJSON));
        Agent._ourAgents.delete(this.uuid);
    }

    activate() {
        if (this.isStarted) {
            console.error("Agent.activate(): agent " + this.name() + " ("
            + this.uuid + ") is already activated");
            return false;
        }

        this.isStarted = true;
        var startPseudoAgentJSON = {
            event: "start",
            uuid: this.uuid
        };
        Agent._messagesToSendOnWS.push(JSON.stringify(startPseudoAgentJSON));
        console.log("Agent.activate(): agent " + this.name() + " ("
                    + this.uuid + ") has been activated");
        return true;
    }

    deactivate() {
        if (!this.isStarted) {
            console.error("Agent.deactivate(): agent " + this.name + " ("
            + this.uuid + ") is not activated");
            return false;
        }

        this.isStarted = false;
        var stopPseudoAgentJSON = {
            event: "stop",
            uuid: this.uuid
        };
        Agent._messagesToSendOnWS.push(JSON.stringify(stopPseudoAgentJSON));
        return true;
    }

    isActivated() {
        return this.isStarted;
    }

    setName(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.setName(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.setName(name) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.setName(name) : 'name' " + name + " contains invalid characters");
            return false;
        }

        this.agentDefinition.name = name;
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    name() {
        return this.agentDefinition.name;
    }

    // Example of callback handle by observeAgentEvents function :
    // function callback(agent, event, uuid, name, eventData, myData)
    //      Parameters types : agent [Agent class], event [agentEvents enum], uuid[string],
    //      name[string], eventData[ArrayBuffer], myData (stored when use observeAgentEvents)
    observeAgentEvents(callback, myData) {
        if (typeof(callback) !== "function") {
            console.error("Agent.observeAgentEvents(callback, myData) : 'callback' must be a function");
            return false;
        }

        // Add callback and its data to the observe agent events list
        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: this
        };
        this.observeAgentEventsCbs.push(observeCbObject);
        return true;
    }

    clearDefinition() {
        this.observeInputsCbs.clear();
        this.observeAttributesCbs.clear();
        this.serviceCbs.clear();
        var previousName = this.agentDefinition.name
        this.agentDefinition = {
            name: previousName,
            description: "",
            version: "",
            inputs: [],
            outputs: [],
            attributes: [],
            services: []
        }
        this.agentDefinitionIsUpdated = true;
    }

    definitionDescription() {
        return this.agentDefinition.description;
    }

    definitionPackage() {
        return this.agentDefinition.package;
    }

    definitionClass() {
        return this.agentDefinition.class;
    }

    definitionVersion() {
        return this.agentDefinition.version;
    }

    definitionSetDescription(description) {
        if (typeof(description) !== "string") {
            console.error("Agent.definitionSetDescription(description) : 'description' must be a string");
            return false;
        }

        this.agentDefinition.description = description;
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    definitionSetPackage(packageName) {
        if (typeof(packageName) !== "string") {
            console.error("Agent.definitionSetPackage(packageName) : 'packageName' must be a string");
            return false;
        }

        if (!Agent._modelCheckString(packageName)) {
            console.error("Agent.definitionSetPackage(packageName) : 'packageName' " + packageName + " contains invalid characters");
            return false;
        }

        this.agentDefinition.package = packageName;
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    definitionSetClass(className) {
        if (typeof(className) !== "string") {
            console.error("Agent.definitionSetClass(className) : 'className' must be a string");
            return false;
        }

        if (!Agent._modelCheckString(className)) {
            console.error("Agent.definitionSetClass(className) : 'className' " + className + " contains invalid characters");
            return false;
        }

        this.agentDefinition.class = className;
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    definitionSetVersion(version) {
        if (typeof(version) !== "string") {
            console.error("Agent.definitionSetVersion(version) : 'version' must be a string");
            return false;
        }
        if (!Agent._modelCheckString(version)) {
            console.error("Agent.definitionSetVersion(version) : 'version' " + version + " contains invalid characters");
            return false;
        }

        this.agentDefinition.version = version;
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    inputCreate(name, valueType, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputCreate(name, valueType, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.inputCreate(name, valueType, value) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.inputCreate(name, valueType, value) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if ((typeof(valueType) !== "number") || (!Agent._ioTypeExists(valueType))) {
            console.error("Agent.inputCreate(name, valueType, value) : 'valueType' must be a number & must exist on Ingescape platform" + Agent._ioTypesToString());
            return false;
        }
        var isValueTypeOK = Agent._isValueTypeOK(valueType, value);
        if (isValueTypeOK !== "") {
            console.error("Agent.inputCreate(name, valueType, value) : 'value' must be " + isValueTypeOK + " if valueType = " + valueType);
            return false;
        }

        // Check input not already exists
        if (this.inputExists(name)) {
            console.error("Agent.inputCreate(name, valueType, value) : input '" + name + "' already exists");
            return false;
        }

        // Create an entry in the input map
        this.observeInputsCbs.set(name, []);

        // Encode data in a b64 string if value ixs data
        if (valueType === ioTypes.IGS_DATA_T) {
            value = Agent._arrayBufferToBase64(value);
        }
        else if (valueType === ioTypes.IGS_BOOL_T) {
            value = (value === true) ? "true" : "false"
        }

        // Update agent definition
        var inputObject = {
            name : name,
            type : Agent._ioTypeToJSONType(valueType),
            value : value
        };
        this.agentDefinition.inputs.push(inputObject);
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    outputCreate(name, valueType, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputCreate(name, valueType, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputCreate(name, valueType, value) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.outputCreate(name, valueType, value) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if ((typeof(valueType) !== "number") || (!Agent._ioTypeExists(valueType))) {
            console.error("Agent.outputCreate(name, valueType, value) : 'valueType' must be a number & must exist on Ingescape platform." + Agent._ioTypesToString());
            return false;
        }
        var isValueTypeOK = Agent._isValueTypeOK(valueType, value);
        if (isValueTypeOK !== "") {
            console.error("Agent.outputCreate(name, valueType, value) : 'value' must be " + isValueTypeOK + " if valueType = " + valueType);
            return false;
        }

        // Check output not already exists
        if (this.outputExists(name)) {
            console.error("Agent.outputCreate(name, valueType, value) : output '" + name + "' already exists");
            return false;
        }

        // Encode data in a b64 string if value is data
        if (valueType === ioTypes.IGS_DATA_T) {
            value = Agent._arrayBufferToBase64(value);
        }
        else if (valueType === ioTypes.IGS_BOOL_T) {
            value = (value === true) ? "true" : "false"
        }

        // Update agent definition
        var outputObject = {
            name : name,
            type : Agent._ioTypeToJSONType(valueType),
            value : value
        };
        this.agentDefinition.outputs.push(outputObject)
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    attributeCreate(name, valueType, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeCreate(name, valueType, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.attributeCreate(name, valueType, value) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.attributeCreate(name, valueType, value) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if ((typeof(valueType) !== "number") || (!Agent._ioTypeExists(valueType))) {
            console.error("Agent.attributeCreate(name, valueType, value) : 'valueType' must be a number & must exist on Ingescape platform." + Agent._ioTypesToString());
            return false;
        }
        if (valueType === ioTypes.IGS_IMPULSION_T) {
            console.error("Agent.attributeCreate(name, valueType, value) : impulsion type is not allowed as attribute");
            return false;
        }
        var isValueTypeOK = Agent._isValueTypeOK(valueType, value);
        if (isValueTypeOK !== "") {
            console.error("Agent.attributeCreate(name, valueType, value) : 'value' must be " + isValueTypeOK + " if valueType = " + valueType);
            return false;
        }

        // Check attribute not already exists
        if (this.attributeExists(name)) {
            console.error("Agent.attributeCreate(name, valueType, value) : attribute '" + name + "' already exists");
            return false;
        }

        // Create an entry in the attributes map
        this.observeAttributesCbs.set(name, []);

        // Encode data in a b64 string if value is data
        if (valueType === ioTypes.IGS_DATA_T) {
            value = Agent._arrayBufferToBase64(value);
        }
        else if (valueType === ioTypes.IGS_BOOL_T) {
            value = (value === true) ? "true" : "false"
        }

        // Update agent definition
        var attributeObject = {
            name : name,
            type : Agent._ioTypeToJSONType(valueType),
            value : value
        };
        this.agentDefinition.attributes.push(attributeObject)
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    inputRemove(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputRemove(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.inputRemove(name) : 'name' can't be empty");
            return false;
        }

        if (this.inputExists(name))
        {
            // Remove from inputs map
            this.observeInputsCbs.delete(name);

            // Update definition
            for (var i = 0; i < this.agentDefinition.inputs.length; i++)
            {
                if (this.agentDefinition.inputs[i].name === name)
                {
                    this.agentDefinition.inputs.splice(i, 1);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
        }
        console.error("Agent.inputRemove(name) : input '" + name + "' doesn't exist");
        return false;
    }

    outputRemove(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputRemove(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputRemove(name) : 'name' can't be empty");
            return false;
        }

        if (this.outputExists(name))
        {
            // Update definition
            for (var i = 0; i < this.agentDefinition.outputs.length; i++)
            {
                if (this.agentDefinition.outputs[i].name === name)
                {
                    this.agentDefinition.outputs.splice(i, 1);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
        }
        console.error("Agent.outputRemove(name) : output " + name + " doesn't exist");
        return false;
    }

    attributeRemove(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeRemove(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.attributeRemove(name) : 'name' can't be empty");
            return false;
        }

        // Remove from our outputs map
        this.observeAttributesCbs.delete(name);

        if (this.attributeExists(name))
        {
            // Update definition
            for (var i = 0; i < this.agentDefinition.attributes.length; i++)
            {
                if (this.agentDefinition.attributes[i].name === name)
                {
                    this.agentDefinition.attributes.splice(i, 1);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
        }
        console.error("Agent.attributeRemove(name) : attribute " + name + " doesn't exist");
        return false;
    }

    inputExists(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputExists(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.inputExists(name) : 'name' can't be empty");
            return false;
        }
        return (this._getInput(name) != null);
    }

    outputExists(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputExists(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputExists(name) : 'name' can't be empty");
            return false;
        }
        return (this._getOutput(name) != null);
    }

    attributeExists(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeExists(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.attributeExists(name) : 'name' can't be empty");
            return false;
        }
        return (this._getAttribute(name) != null);
    }

    inputCount() {
        return this.agentDefinition.inputs.length;
    }

    outputCount() {
        return this.agentDefinition.outputs.length;
    }

    attributeCount() {
        return this.agentDefinition.attributes.length;
    }

    inputCount() {
        return this.agentDefinition.inputs.length;
    }

    inputType(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputType(name) : 'name' must be a string");
            return ioTypes.IGS_UNKNOWN_T;
        }
        if (name.length === 0) {
            console.error("Agent.inputType(name) : 'name' can't be empty");
            return ioTypes.IGS_UNKNOWN_T;
        }

        let ioa = this._getInput(name);
        if (ioa != null) {
            return Agent._jsonTypeToIOType(ioa.type);
        }
        else {
            console.error("Agent.inputType(name) : input '" + name + "' doesn't exist");
            return ioTypes.IGS_UNKNOWN_T;
        }
    }

    outputType(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputType(name) : 'name' must be a string");
            return ioTypes.IGS_UNKNOWN_T;
        }
        if (name.length === 0) {
            console.error("Agent.outputType(name) : 'name' can't be empty");
            return ioTypes.IGS_UNKNOWN_T;
        }

        let ioa = this._getOutput(name);
        if (ioa != null) {
            return Agent._jsonTypeToIOType(ioa.type);
        }
        else {
            console.error("Agent.outputType(name) : output '" + name + "' doesn't exist");
            return ioTypes.IGS_UNKNOWN_T;
        }
    }

    attributeType(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeType(name) : 'name' must be a string");
            return ioTypes.IGS_UNKNOWN_T;
        }
        if (name.length === 0) {
            console.error("Agent.attributeType(name) : 'name' can't be empty");
            return ioTypes.IGS_UNKNOWN_T;
        }

        let ioa = this._getAttribute(name);
        if (ioa != null) {
            return Agent._jsonTypeToIOType(ioa.type);
        }
        else {
            console.error("Agent.attributeType(name) : attribute '" + name + "' doesn't exist");
            return ioTypes.IGS_UNKNOWN_T;
        }
    }

    inputDescription(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputDescription(name) : 'name' must be a string");
            return undefined;
        }
        if (name.length === 0) {
            console.error("Agent.inputDescription(name) : 'name' can't be empty");
            return undefined;
        }

        let io = this._getInput(name);
        if (io != null) {
            return io.description;
        }
        else {
            console.error("Agent.inputDescription(name) : input '" + name + "' doesn't exist");
            return undefined;
        }
    }

    outputDescription(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputDescription(name) : 'name' must be a string");
            return undefined;
        }
        if (name.length === 0) {
            console.error("Agent.outputDescription(name) : 'name' can't be empty");
            return undefined;
        }

        let io = this._getOutput(name);
        if (io != null) {
            return io.description;
        }
        else {
            console.error("Agent.outputDescription(name) : output '" + name + "' doesn't exist");
            return undefined;
        }
    }

    attributeDescription(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeDescription(name) : 'name' must be a string");
            return undefined;
        }
        if (name.length === 0) {
            console.error("Agent.attributeDescription(name) : 'name' can't be empty");
            return undefined;
        }

        let io = this._getAttribute(name);
        if (io != null) {
            return io.description;
        }
        else {
            console.error("Agent.attributeDescription(name) : attribute '" + name + "' doesn't exist");
            return undefined;
        }
    }

    inputSetDescription(name, description) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputSetDescription(name, description) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.inputSetDescription(name, description) : 'name' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.inputSetDescription(name, description) : 'description' must be a string");
            return false;
        }

        let io = this._getInput(name);
        if (io != null) {
            if (description.length == 0)
                io.description = undefined;
            else
                io.description = description;
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.inputSetDescription(name, description) : input '" + name + "' doesn't exist");
            return false;
        }
    }

    outputSetDescription(name, description) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetDescription(name, description) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetDescription(name, description) : 'name' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.outputSetDescription(name, description) : 'description' must be a string");
            return false;
        }

        let io = this._getOutput(name);
        if (io != null) {
            if (description.length == 0)
                io.description = undefined;
            else
                io.description = description;
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.outputSetDescription(name, description) : output '" + name + "' doesn't exist");
            return false;
        }
    }

    attributeSetDescription(name, description) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeSetDescription(name, description) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.attributeSetDescription(name, description) : 'name' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.attributeSetDescription(name, description) : 'description' must be a string");
            return false;
        }

        let io = this._getAttribute(name);
        if (io != null) {
            if (description.length == 0)
                io.description = undefined;
            else
                io.description = description;
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.attributeSetDescription(name, description) : attribute '" + name + "' doesn't exist");
            return false;
        }
    }

    inputSetDetailedType(inputName, typeName, specification) {
        if (typeof(inputName) !== "string") {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : 'inputName' must be a string");
            return false;
        }
        if (inputName.length === 0) {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : 'inputName' can't be empty");
            return false;
        }
        if (typeof(typeName) !== "string") {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : 'typeName' must be a string");
            return false;
        }
        if (!Agent._modelCheckString(typeName)) {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : 'typeName' " + typeName + " contains invalid characters");
            return false;
        }
        if (typeof(specification) !== "string") {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : 'specification' must be a string");
            return false;
        }

        let io = this._getInput(inputName);
        if (io != null) {
            if (typeName.length == 0) {
                io.detailed_type = undefined;
                io.specification = undefined;
            }
            else {
                io.detailed_type = typeName;
                io.specification = specification;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.inputSetDetailedType(inputName, typeName, specification) : input '" + inputName + "' doesn't exist");
            return false;
        }
    }

    outputSetDetailedType(outputName, typeName, specification) {
        if (typeof(outputName) !== "string") {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : 'outputName' must be a string");
            return false;
        }
        if (outputName.length === 0) {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : 'outputName' can't be empty");
            return false;
        }
        if (typeof(typeName) !== "string") {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : 'typeName' must be a string");
            return false;
        }
        if (!Agent._modelCheckString(typeName)) {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : 'typeName' " + typeName + " contains invalid characters");
            return false;
        }
        if (typeof(specification) !== "string") {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : 'specification' must be a string");
            return false;
        }

        let io = this._getOutput(outputName);
        if (io != null) {
            if (typeName.length == 0) {
                io.detailed_type = undefined;
                io.specification = undefined;
            }
            else {
                io.detailed_type = typeName;
                io.specification = specification;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.outputSetDetailedType(outputName, typeName, specification) : output '" + outputName + "' doesn't exist");
            return false;
        }
    }

    attributeSetDetailedType(attributeName, typeName, specification) {
        if (typeof(attributeName) !== "string") {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : 'attributeName' must be a string");
            return false;
        }
        if (attributeName.length === 0) {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : 'attributeName' can't be empty");
            return false;
        }
        if (typeof(typeName) !== "string") {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : 'typeName' must be a string");
            return false;
        }
        if (!Agent._modelCheckString(typeName)) {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : 'typeName' " + typeName + " contains invalid characters");
            return false;
        }
        if (typeof(specification) !== "string") {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : 'specification' must be a string");
            return false;
        }

        let io = this._getAttribute(attributeName);
        if (io != null) {
            if (typeName.length == 0) {
                io.detailed_type = undefined;
                io.specification = undefined;
            }
            else {
                io.detailed_type = typeName;
                io.specification = specification;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.attributeSetDetailedType(attributeName, typeName, specification) : attribute '" + attributeName + "' doesn't exist");
            return false;
        }
    }

    inputAddConstraint(name, constraint) {
        if (typeof(name) !== "string") {
            console.error("Agent.inputAddConstraint(name, constraint) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.inputAddConstraint(name, constraint) : 'name' can't be empty");
            return false;
        }
        if (typeof(constraint) !== "string") {
            console.error("Agent.inputAddConstraint(name, constraint) : 'constraint' must be a string");
            return false;
        }

        let io = this._getInput(name);
        if (io != null) {
            if (constraint.length == 0)
                io.constraint = undefined;
            else {
                io.constraint = Agent._parseConstraint(Agent._jsonTypeToIOType(io.type), constraint);
                if (io.constraint == undefined)
                    return false;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.inputAddConstraint(name, constraint) : input '" + name + "' doesn't exist");
            return false;
        }
    }

    outputAddConstraint(name, constraint) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputAddConstraint(name, constraint) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputAddConstraint(name, constraint) : 'name' can't be empty");
            return false;
        }
        if (typeof(constraint) !== "string") {
            console.error("Agent.outputAddConstraint(name, constraint) : 'constraint' must be a string");
            return false;
        }

        let io = this._getOutput(name);
        if (io != null) {
            if (constraint.length == 0)
                io.constraint = undefined;
            else {
                io.constraint = Agent._parseConstraint(Agent._jsonTypeToIOType(io.type), constraint);
                if (io.constraint == undefined)
                    return false;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.outputAddConstraint(name, constraint) : output '" + name + "' doesn't exist");
            return false;
        }
    }

    attributeAddConstraint(name, constraint) {
        if (typeof(name) !== "string") {
            console.error("Agent.attributeAddConstraint(name, constraint) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.attributeAddConstraint(name, constraint) : 'name' can't be empty");
            return false;
        }
        if (typeof(constraint) !== "string") {
            console.error("Agent.attributeAddConstraint(name, constraint) : 'constraint' must be a string");
            return false;
        }

        let io = this._getAttribute(name);
        if (io != null) {
            if (constraint.length == 0)
                io.constraint = undefined;
            else {
                io.constraint = Agent._parseConstraint(Agent._jsonTypeToIOType(io.type), constraint);
                if (io.constraint == undefined)
                    return false;
            }
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.attributeAddConstraint(name, constraint) : attribute '" + name + "' doesn't exist");
            return false;
        }
    }

    outputSetBool(name, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetBool(name, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetBool(name, value) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetBool(name, value) : output '" + name + "' doesn't exist.");
            return false;
        }

        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_BOOL_T, name, value);
        return true;
    }

    outputSetInt(name, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetInt(name, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetInt(name, value) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetInt(name, value) : output '" + name + "' doesn't exist.");
            return false;
        }

        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_INTEGER_T, name, value);
        return true;
    }

    outputSetDouble(name, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetDouble(name, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetDouble(name, value) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetDouble(name, value) : output '" + name + "' doesn't exist.");
            return false;
        }

        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_DOUBLE_T, name, value);
        return true;
    }

    outputSetString(name, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetString(name, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetString(name, value) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetString(name, value) : output '" + name + "' doesn't exist.");
            return false;
        }

        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_STRING_T, name, value);
        return true;
    }

    outputSetImpulsion(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetImpulsion(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetImpulsion(name) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetImpulsion(name) : output '" + name + "' doesn't exist.");
            return false;
        }

        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_IMPULSION_T, name, "");
        return true;
    }

    outputSetData(name, value) {
        if (typeof(name) !== "string") {
            console.error("Agent.outputSetData(name, value) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.outputSetData(name, value) : 'name' can't be empty");
            return false;
        }
        if (!this.outputExists(name)) {
            console.error("Agent.outputSetData(name, value) : output '" + name + "' doesn't exist.");
            return false;
        }

        var valueEncodedB64 = Agent._arrayBufferToBase64(value); // Encode data in a b64 string
        Agent._writeIOOnWS(this.uuid, ios.IGS_OUTPUT_T, ioTypes.IGS_DATA_T, name, valueEncodedB64);
        return true;
    }

    // Example of callback handle by observeInput and observeAttribute functions :
    // function callback(agent, ioType, name, valueType, value, myData);
    //      Parameters types : agent [Agent class], ioType [ios enum], name[string],
    //                         valueType[ioTypes enum], value[number| string | boolean | null | ArrayBuffer],
    //                         myData (stored when use observeIO)
    observeInput(name, callback, myData) {
        if (typeof(name) !== "string") {
            console.error("Agent.observeInput(name, callback, myData) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.observeInput(name, callback, myData) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.observeInput(name, callback, myData) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if (typeof(callback) !== "function") {
            console.error("Agent.observeInput(name, callback, myData) : 'callback' must be a function");
            return false;
        }

        // Add callback and its data to the outputs map
        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: this
        };
        var observeCbArray = this.observeInputsCbs.get(name);
        if (observeCbArray == undefined) {
            console.error("Agent.observeInput(name, callback, myData) : input '" + name + "' doesn't exist.");
            return false;
        }
        observeCbArray.push(observeCbObject);
        return true;
    }

    observeAttribute(name, callback, myData) {
        if (typeof(name) !== "string") {
            console.error("Agent.observeAttribute(name, callback, myData) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.observeAttribute(name, callback, myData) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.observeAttribute(name, callback, myData) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if (typeof(callback) !== "function") {
            console.error("Agent.observeAttribute(name, callback, myData): 'callback' must be a function");
            return false;
        }

        // Add callback and its data to the attributes map
        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: this
        };
        var observeCbArray = this.observeAttributesCbs.get(name);
        if (observeCbArray == undefined) {
            console.error("Agent.observeAttribute(name, callback, myData) : attribute '" + name + "' doesn't exist.");
            return;
        }
        observeCbArray.push(observeCbObject);
        return true;
    }

    clearMappings() {
        this.agentMapping = {
            mappings: []
        };
        this.agentMappingIsUpdated = true;
    }

    mappingAdd(fromOurInput, toAgent, withOutput) {
        if (typeof(fromOurInput) !== "string") {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'fromOurInput' must be a string");
            return false;
        }
        if (fromOurInput.length === 0) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'fromOurInput' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(fromOurInput)) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'fromOurInput' " + fromOurInput + " contains invalid characters");
            return false;
        }
        if (typeof(toAgent) !== "string") {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'toAgent' must be a string");
            return false;
        }
        if (toAgent.length === 0) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'toAgent' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(toAgent)) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'toAgent' " + toAgent + " contains invalid characters");
            return false;
        }
        if (typeof(withOutput) !== "string") {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'withOutput' must be a string");
            return false;
        }
        if (withOutput.length === 0) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'withOutput' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(withOutput)) {
            console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : 'withOutput' " + withOutput + " contains invalid characters");
            return false;
        }

        let mappingsArray =  this.agentMapping.mappings;
        for (let i = 0; i < mappingsArray.length; i++) {
            let mapping = mappingsArray[i];
            if (mapping.fromInput === fromOurInput && mapping.toAgent === toAgent && mapping.toOutput === withOutput) {
                console.error("Agent.mappingAdd(fromOurInput, toAgent, withOutput) : mapping from " + fromOurInput + " to agent" + toAgent + " with output " + withOutput + " already exists");
                return false;
            }
        }

        var mappingObject = {
            fromInput: fromOurInput,
            toAgent: toAgent,
            toOutput: withOutput
        };
        this.agentMapping.mappings.push(mappingObject);
        this.agentMappingIsUpdated = true;
        return true;
    }

    mappingRemove(fromOurInput, toAgent, withOutput) {
        if (typeof(fromOurInput) !== "string") {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'fromOurInput' must be a string");
            return false;
        }
        if (fromOurInput.length === 0) {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'fromOurInput' can't be empty");
            return false;
        }
        if (typeof(toAgent) !== "string") {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'toAgent' must be a string");
            return false;
        }
        if (toAgent.length === 0) {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'toAgent' can't be empty");
            return false;
        }
        if (typeof(withOutput) !== "string") {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'withOutput' must be a string");
            return false;
        }
        if (withOutput.length === 0) {
            console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : 'withOutput' can't be empty");
            return false;
        }

        for (var i = 0; i < this.agentMapping.mappings.length; i++)
        {
            var mappingObject = this.agentMapping.mappings[i];
            if ((mappingObject.fromInput === fromOurInput)
                    && (mappingObject.toAgent === toAgent)
                    && (mappingObject.toOutput === withOutput))
            {
                this.agentMapping.mappings.splice(i, 1);
                this.agentMappingIsUpdated = true;
                return true;
            }
        }
        console.error("Agent.mappingRemove(fromOurInput, toAgent, withOutput) : mapping from input '"
        + fromOurInput + "' to agent '" + toAgent + "' output '" + withOutput + "' doesn't exist");
        return false;
    }

    mappingCount() {
        return this.agentMapping.mappings.length;
    }

    serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) {
        if (typeof(agentNameOrUUID) !== "string") {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'agentNameOrUUID' must be a string");
            return false;
        }
        if (agentNameOrUUID.length === 0) {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'agentNameOrUUID' can't be empty");
            return false;
        }
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'serviceName' can't be empty");
            return false;
        }
        if (!Array.isArray(argumentsArray)) {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'argumentsArray' must be an array");
            return false;
        }
        if (typeof(token) !== "string") {
            console.error("Agent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) : 'token' must be a string");
            return false;
        }

        var serviceCallJSON = {
            event: "send_call",
            uuid: this.uuid,
            agent_name: agentNameOrUUID,
            service_name: serviceName,
            arguments_call: argumentsArray,
            token: token
        };
        Agent._messagesToSendOnWS.push(JSON.stringify(serviceCallJSON));
        return true;
    }

    // Example of callback handle by igsAgent_serviceInit function :
    // function callback(agent, senderAgentName, senderAgentUUID, serviceName, arguments, token, myData);
    //      Parameters types : agent [Agent class], senderAgentName [string], senderAgentUUID[string],
    //                         serviceName[string], arguments[Array of number| string | boolean | ArrayBuffer], token[string],
    //                         myData (stored when use igsAgent_serviceInit)
    serviceInit(name, callback, myData) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceInit(name, callback, myData) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.serviceInit(name, callback, myData) : 'name' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(name)) {
            console.error("Agent.serviceInit(name, callback, myData) : 'name' " + name + " contains invalid characters");
            return false;
        }
        if (typeof(callback) !== "function") {
            console.error("Agent.serviceInit(name, callback, myData) : 'callback' must be a function");
            return false;
        }

        // Check service not already exists
        if (this.serviceCbs.get(name) !== undefined) {
            console.error("Agent.serviceInit(name, callback, myData) : service '" + name + "' already exists");
            return false;
        }

        // Add callback and its data to the services map
        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: this
        };
        this.serviceCbs.set(name, observeCbObject);

        // Update agent definition
        var serviceObject = {
            name: name,
            arguments: [],
            replies: []
        }
        this.agentDefinition.services.push(serviceObject);
        this.agentDefinitionIsUpdated = true;
        return true;
    }

    serviceRemove(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceRemove(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.serviceRemove(name) : 'name' can't be empty");
            return false;
        }

        // Remove from our services map
        this.serviceCbs.delete(name);

        // Update definition
        for (var i = 0; i < this.agentDefinition.services.length; i++)
        {
            if (this.agentDefinition.services[i].name === name)
            {
                this.agentDefinition.services.splice(i, 1);
                this.agentDefinitionIsUpdated = true;
                return true;
            }
        }
        console.error("Agent.serviceRemove(name) : service '" + name + "' doesn't exist");
        return false;
    }

    serviceCount() {
        return this.agentDefinition.services.length;
    }

    serviceExists(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceExists(name) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.serviceExists(name) : 'name' can't be empty");
            return false;
        }
        return (this._getService(name) != null);
    }

    serviceDescription(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceDescription(name) : 'name' must be a string");
            return undefined;
        }
        if (name.length === 0) {
            console.error("Agent.serviceDescription(name) : 'name' can't be empty");
            return undefined;
        }

        let service = this._getService(name);
        if (service != null) {
            return service.description;
        }
        else {
            console.error("Agent.serviceDescription(name) : service '" + name + "' doesn't exist");
            return undefined;
        }
    }

    serviceSetDescription(name, description) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceSetDescription(name, description) : 'name' must be a string");
            return false;
        }
        if (name.length === 0) {
            console.error("Agent.serviceSetDescription(name, description) : 'name' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.serviceSetDescription(name, description) : 'description' must be a string");
            return false;
        }

        let service = this._getService(name);
        if (service != null) {
            if (description.length == 0)
                service.description = undefined;
            else
                service.description = description;
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.serviceSetDescription(name, description) : service '" + name + "' doesn't exist");
            return false;
        }
    }

    serviceArgAdd(serviceName, argName, type) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceArgAdd(serviceName, argName, type): 'serviceName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : 'argName' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(argName)) {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : 'argName' " + argName + " contains invalid characters");
            return false;
        }
        if ((typeof(type) !== "number") || (!Agent._ioTypeExists(type))) {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : 'type' must be a number & must exist on Ingescape platform." + Agent._ioTypesToString());
            return false;
        }
        if (type === ioTypes.IGS_IMPULSION_T) {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : impulsion type is not allowed as a service argument");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            var argumentObject = {
                name: argName,
                type: Agent._ioTypeToJSONType(type)
            };
            service.arguments.push(argumentObject);
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.serviceArgAdd(serviceName, argName, type) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceArgRemove(serviceName, argName) { //removes first occurence with this name
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceArgRemove(serviceName, argName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceArgRemove(serviceName, argName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceArgRemove(serviceName, argName) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceArgRemove(serviceName, argName) : 'argName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var j = 0; j < service.arguments.length; j++) {
                var argumentObject = service.arguments[j];
                if (argumentObject.name === argName) {
                    service.arguments.splice(j, 1);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
            console.error("Agent.serviceArgRemove(serviceName, argName) : argument '" + argName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceArgRemove(serviceName, argName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceArgExists(serviceName, argName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceArgExists(serviceName, argName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceArgExists(serviceName, argName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceArgExists(serviceName, argName) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceArgExists(serviceName, argName) : 'argName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var j = 0; j < service.arguments.length; j++) {
                var argumentObject = service.arguments[j];
                if (argumentObject.name === argName) {
                    return true;
                }
            }
            return false;
        }
        else {
            console.error("Agent.serviceArgExists(serviceName, argName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceArgCount(name) {
        if (typeof(name) !== "string") {
            console.error("Agent.serviceArgCount(name) : 'name' must be a string");
            return 0;
        }
        if (name.length === 0) {
            console.error("Agent.serviceArgCount(name) : 'name' can't be empty");
            return 0;
        }

        let service = this._getService(name);
        if (service != null) {
            return service.arguments.length;
        }
        else {
            console.error("Agent.serviceArgCount(name) : service '" + name + "' doesn't exist");
            return 0;
        }
    }

    serviceArgDescription(serviceName, argName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceArgDescription(serviceName, argName) : 'serviceName' must be a string");
            return undefined;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceArgDescription(serviceName, argName) : 'serviceName' can't be empty");
            return undefined;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceArgDescription(serviceName, argName) : 'argName' must be a string");
            return undefined;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceArgDescription(serviceName, argName) : 'argName' can't be empty");
            return undefined;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var j = 0; j < service.arguments.length; j++) {
                var argumentObject = service.arguments[j];
                if (argumentObject.name === argName) {
                    return argumentObject.description;
                }
            }
            console.error("Agent.serviceArgDescription(serviceName, argName) : argument '" + argName + "' doesn't exist");
            return undefined;
        }
        else {
            console.error("Agent.serviceArgDescription(serviceName, argName) : service '" + serviceName + "' doesn't exist");
            return undefined;
        }
    }

    serviceArgSetDescription(serviceName, argName, description) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : 'argName' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : 'description' must be a string");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var j = 0; j < service.arguments.length; j++) {
                var argumentObject = service.arguments[j];
                if (argumentObject.name === argName) {
                    if (description.length == 0)
                        argumentObject.description = undefined;
                    else
                        argumentObject.description = description;
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : argument '" + argName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceArgSetDescription(serviceName, argName, description) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyAdd(serviceName, replyName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyAdd(serviceName, replyName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyAdd(serviceName, replyName): 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyAdd(serviceName, replyName) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyAdd(serviceName, replyName) : 'replyName' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(replyName)) {
            console.error("Agent.serviceReplyAdd(serviceName, replyName) : 'replyName' " + replyName + " contains invalid characters");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            var replyObject = {
                name: replyName,
                arguments: []
            };
            service.replies.push(replyObject);
            this.agentDefinitionIsUpdated = true;
            return true;
        }
        else {
            console.error("Agent.serviceReplyAdd(serviceName, replyName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyRemove(serviceName, replyName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : 'replyName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    service.replies.splice(i, 1);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplyRemove(serviceName, replyName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceHasReplies(serviceName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceHasReplies(serviceName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceHasReplies(serviceName) : 'serviceName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            return (service.replies.length > 0);
        }
        else {
            console.error("Agent.serviceHasReplies(serviceName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceHasReply(serviceName, replyName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceHasReply(serviceName, replyName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceHasReply(serviceName, replyName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceHasReply(serviceName, replyName) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceHasReply(serviceName, replyName) : 'replyName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    return true;
                }
            }
            return false;
        }
        else {
            console.error("Agent.serviceHasReply(serviceName, replyName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyDescription(serviceName, replyName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : 'serviceName' must be a string");
            return undefined;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : 'serviceName' can't be empty");
            return undefined;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : 'replyName' must be a string");
            return undefined;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : 'replyName' can't be empty");
            return undefined;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    return replyObject.description;
                }
            }
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : reply '" + replyName + "' doesn't exist");
            return undefined;
        }
        else {
            console.error("Agent.serviceReplyDescription(serviceName, replyName) : service '" + serviceName + "' doesn't exist");
            return undefined;
        }
    }

    serviceReplySetDescription(serviceName, replyName, description) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : 'replyName' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : 'description' must be a string");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    if (description.length == 0)
                        replyObject.description = undefined;
                    else
                        replyObject.description = description;
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplySetDescription(serviceName, replyName, description) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyArgAdd(serviceName, replyName, argName, type) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type): 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'replyName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'argName' can't be empty");
            return false;
        }
        if (!Agent._modelCheckString(argName)) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'argName' " + argName + " contains invalid characters");
            return false;
        }
        if ((typeof(type) !== "number") || (!Agent._ioTypeExists(type))) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : 'type' must be a number & must exist on Ingescape platform." + Agent._ioTypesToString());
            return false;
        }
        if (type === ioTypes.IGS_IMPULSION_T) {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : impulsion type is not allowed as a service argument");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    var argumentObject = {
                        name: argName,
                        type: Agent._ioTypeToJSONType(type)
                    };
                    replyObject.arguments.push(argumentObject);
                    this.agentDefinitionIsUpdated = true;
                    return true;
                }
            }
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplyArgAdd(serviceName, replyName, argName, type) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyArgRemove(serviceName, replyName, argName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'replyName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : 'argName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    for (var j = 0; j < replyObject.arguments.length; j++) {
                        var argumentObject = replyObject.arguments[j];
                        if (argumentObject.name === argName) {
                            replyObject.arguments.splice(j, 1);
                            this.agentDefinitionIsUpdated = true;
                            return true;
                        }
                    }
                    console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : argument '" + argName + "' doesn't exist");
                    return false;
                }
            }
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplyArgRemove(serviceName, replyName, argName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyArgsCount(serviceName, replyName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : 'serviceName' must be a string");
            return 0;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : 'serviceName' can't be empty");
            return 0;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : 'replyName' must be a string");
            return 0;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : 'replyName' can't be empty");
            return 0;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    return replyObject.arguments.length;
                }
            }
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : reply '" + replyName + "' doesn't exist");
            return 0;
        }
        else {
            console.error("Agent.serviceReplyArgsCount(serviceName, replyName) : service '" + serviceName + "' doesn't exist");
            return 0;
        }
    }

    serviceReplyArgExists(serviceName, replyName, argName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'replyName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : 'argName' can't be empty");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    for (var j = 0; j < replyObject.arguments.length; j++) {
                        var argumentObject = replyObject.arguments[j];
                        if (argumentObject.name === argName) {
                            return true;
                        }
                    }
                    return false;
                }
            }
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplyArgExists(serviceName, replyName, argName) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }

    serviceReplyArgDescription(serviceName, replyName, argName) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'serviceName' must be a string");
            return undefined;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'serviceName' can't be empty");
            return undefined;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'replyName' must be a string");
            return undefined;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'replyName' can't be empty");
            return undefined;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'argName' must be a string");
            return undefined;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : 'argName' can't be empty");
            return undefined;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    for (var j = 0; j < replyObject.arguments.length; j++) {
                        var argumentObject = replyObject.arguments[j];
                        if (argumentObject.name === argName) {
                            return argumentObject.description;
                        }
                    }
                    console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : argument '" + argName + "' doesn't exist");
                    return undefined;
                }
            }
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : reply '" + replyName + "' doesn't exist");
            return undefined;
        }
        else {
            console.error("Agent.serviceReplyArgDescription(serviceName, replyName, argName) : service '" + serviceName + "' doesn't exist");
            return undefined;
        }
    }

    serviceReplyArgSetDescription(serviceName, replyName, argName, description) {
        if (typeof(serviceName) !== "string") {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'serviceName' must be a string");
            return false;
        }
        if (serviceName.length === 0) {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'serviceName' can't be empty");
            return false;
        }
        if (typeof(replyName) !== "string") {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'replyName' must be a string");
            return false;
        }
        if (replyName.length === 0) {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'replyName' can't be empty");
            return false;
        }
        if (typeof(argName) !== "string") {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'argName' must be a string");
            return false;
        }
        if (argName.length === 0) {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'argName' can't be empty");
            return false;
        }
        if (typeof(description) !== "string") {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : 'description' must be a string");
            return false;
        }

        let service = this._getService(serviceName);
        if (service != null) {
            for (var i = 0; i < service.replies.length; i++) {
                var replyObject = service.replies[i];
                if (replyObject.name === replyName) {
                    for (var j = 0; j < replyObject.arguments.length; j++) {
                        var argumentObject = replyObject.arguments[j];
                        if (argumentObject.name === argName) {
                            if (description.length == 0)
                                argumentObject.description = undefined;
                            else
                                argumentObject.description = description;
                            this.agentDefinitionIsUpdated = true;
                            return true;
                        }
                    }
                    console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : argument '" + argName + "' doesn't exist");
                    return false;
                }
            }
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : reply '" + replyName + "' doesn't exist");
            return false;
        }
        else {
            console.error("Agent.serviceReplyArgSetDescription(serviceName, replyName, argName, description) : service '" + serviceName + "' doesn't exist");
            return false;
        }
    }
}

class IGS {
    static _serverURL = "";
    static _receiveCloseEventOnWS = false;
    static _observeWebSocketState = [];
    static _globalAgent = new Agent("no_name", false);
    // launch timer to handle server down and definition/mapping updates every 1s
    static _handleDefinitionAndMappingTimer = window.setInterval(IGS._handleDefinitionAndMappingUpdatesOnWS, 1000, this);
    static _socket = undefined;

    /* *************************** */
    /* WebSocket listener functions */
    /* *************************** */
    static ws_onOpen(openEvent) {
        console.log("socket is opened");
        Agent._isConnected = true;

        IGS._observeWebSocketState.forEach(function(observeCbObject) {
            (observeCbObject.cb)(true);
        });

        // First, initiate our created pseudo agents
        Agent._ourAgents.forEach(function(pseudoAgent) {
            var initPseudoAgentJSON = {
                event: "init_pseudo_agent",
                uuid: pseudoAgent.uuid,
                name: pseudoAgent.agentDefinition.name
            };
            IGS._socket.send(JSON.stringify(initPseudoAgentJSON));
        });

        // Then, handle if there was a definition or mapping update
        IGS._handleDefinitionAndMappingUpdatesOnWS();

        // Then, handle if pseudo agents were started
        Agent._ourAgents.forEach(function(agent) {
            if (agent.wasStarted) {
                agent.isStarted = false;
                agent.activate();
            }
        });

        // Finally, send stored messages (will send messages every 10 ms after its execution)
        IGS._sendStoredMessagesOnWebSocket();
    }


    static ws_onMessage(event) {
        try {
            var msg = JSON.parse(event.data);
            var receivingAgent = Agent._ourAgents.get(msg.uuid);
            if (receivingAgent === undefined) {
                console.error("Unknown pseudo agent with uuid " +  msg.uuid);
                return;
            }

            switch (msg.event) {
                case "iop_written":
                    // If server send data, decode b64 string in array buffer
                    var value = msg.value;
                    if (msg.value_type === ioTypes.IGS_DATA_T) {
                        value = Agent._base64ToArrayBuffer(value);
                    }

                    // Get observe callbacks
                    var observeCbsArray = [];
                    if (msg.type === ios.IGS_INPUT_T) {
                        observeCbsArray = receivingAgent.observeInputsCbs.get(msg.name);
                    }
                    else if (msg.type === ios.IGS_ATTRIBUTE_T) {
                        observeCbsArray = receivingAgent.observeAttributesCbs.get(msg.name);
                    }

                    // Launch observe callbacks
                    if (observeCbsArray !== undefined) {
                        observeCbsArray.forEach(function(observeCbObject) {
                            (observeCbObject.cb)(observeCbObject.object, msg.type, msg.name, msg.value_type, value, observeCbObject.myData);
                        });
                    }
                    break;
                case "call_received":
                    // If server send data, decode b64 string in array buffer
                    var argumentsServiceCall = msg.arguments;
                    for (var i = 0; i < argumentsServiceCall.length; i++) {
                        if (argumentsServiceCall[i].type === ioTypes.IGS_DATA_T) {
                            argumentsServiceCall[i].value = Agent._base64ToArrayBuffer(argumentsServiceCall[i].value);
                        }
                    }

                    // Launch init service callback
                    var initCbObject = receivingAgent.serviceCbs.get(msg.service_name);
                    if (initCbObject !== undefined) {
                        (initCbObject.cb)(receivingAgent, msg.sender_name, msg.sender_uuid, msg.service_name, argumentsServiceCall, msg.token, initCbObject.myData);
                    }
                    break;
                case "agent_event_raised":
                    // Decode eventData b64 string in array buffer
                    var eventDataDecoded = Agent._base64ToArrayBuffer(msg.event_data);

                    // Launch callbacks observe agent events if exist
                    receivingAgent.observeAgentEventsCbs.forEach(function(observeCbObject) {
                        (observeCbObject.cb)(receivingAgent, msg.agent_event, msg.agent_uuid, msg.agent_name, eventDataDecoded, observeCbObject.myData);
                    });
                    break;
                default:
                    console.warn("Don't know the event received : " + msg.event);
            }
        } catch (e) {
            console.warn("Failed to parse json :" + event.data);
            console.warn(e);
            return;
        }
    }


    static ws_onClose(closeEvent) {
        IGS._receiveCloseEventOnWS = true;
        Agent._isConnected = false;

        // Stop send message timers
        window.clearTimeout(IGS.sendMessagesOnWSTimer)

        Agent._ourAgents.forEach(function(pseudoAgent) {
            pseudoAgent.wasStarted = pseudoAgent.isStarted;
            pseudoAgent.agentDefinitionIsUpdated = true;
            pseudoAgent.agentMappingIsUpdated = true;
        });

        // Check ws close event
        if (closeEvent.code != 1000) {
            console.warn("The connection ended abnormally.",
                "Close event code received : " + closeEvent.code,
                "Close event reason received : " + closeEvent.reason);
        }
        else {
            console.log("The connection ended normally.");
        }

        IGS._observeWebSocketState.forEach(function(observeCbObject) {
            (observeCbObject.cb)(false);
        });
    }


    /* ******************** */
    /* IGS static public funtions */
    /* ******************** */
    static netSetServerURL (serverURL) {
        // Test arguments
        if (typeof(serverURL) !== "string") {
            console.error("igs.netSetServerURL(serverURL) : 'serverURL' must be a string");
            return;
        }
        if (serverURL.length === 0) {
            console.error("igs.netSetServerURL(serverURL) : 'serverURL' can't be empty");
            return;
        }

        IGS._serverURL = serverURL;
        console.log("Opening WS at " + serverURL);
        if (typeof IGS._socket !== 'undefined') {
            IGS._socket.close();
        }
        IGS._socket = new WebSocket(IGS._serverURL);
        IGS._socket.onopen = function(openEvent) {
            IGS.ws_onOpen(openEvent);
        }
        IGS._socket.onmessage = function(event) {
            IGS.ws_onMessage(event);
        }
        IGS._socket.onclose = function(closeEvent) {
            IGS.ws_onClose(closeEvent);
        }
    }


    static netServerURL () {
        return IGS._serverURL;
    }

    // Example of callback handle by observeWebSocketState function :
    // function callback(isConnected)
    //      Parameters types : isConnected [bool]
    static observeWebSocketState (callback) {
        // Test arguments
        if (typeof(callback) !== "function") {
            console.error("igs.observeWebSocketState(callback) : 'callback' must be a function");
            return false;
        }
        var observeCbObject = {
            cb: callback
        };
        IGS._observeWebSocketState.push(observeCbObject);
        return true;
    }


    static agentSetName (name) {
        return IGS._globalAgent.setName(name);
    }

    static agentName () {
        return IGS._globalAgent.name();
    }

    static start () {
        return IGS._globalAgent.activate();
    }

    static stop () {
        return IGS._globalAgent.deactivate();
    }

    // Example of callback handle by observeAgentEvents function :
    // function callback(event, uuid, name, eventData, myData)
    //      Parameters types : event [agentEvents enum], uuid[string], name[string], eventData[ArrayBuffer],
    //                         myData (stored when use observeAgentEvents)
    static observeAgentEvents (callback, myData) {
        if (typeof(callback) !== "function") {
            console.error("igs.observeAgentEvents(callback, myData) : 'callback' must be a function");
            return false;
        }
        var observeCbObject = {
            cb: callback,
            myData: myData,
            objet: null
        };
        return IGS._globalAgent.observeAgentEvents(IGS._globalAgent_observeAgentEventsCallback, observeCbObject);
    }

    static outputSetBool (name, value) {
        return IGS._globalAgent.outputSetBool(name, value);
    }

    static outputSetInt (name, value) {
        return IGS._globalAgent.outputSetInt(name, value);
    }

    static outputSetDouble (name, value) {
        return IGS._globalAgent.outputSetDouble(name, value);
    }

    static outputSetString (name, value) {
        return IGS._globalAgent.outputSetString(name, value);
    }

    static outputSetImpulsion (name) {
        return IGS._globalAgent.outputSetImpulsion(name);
    }

    static outputSetData (name, value) {
        return IGS._globalAgent.outputSetData(name, value);
    }

    // Example of callback handled by observeInput and observeAttribute functions :
    // function callback(ioType, name, valueType, value, myData);
    //      Parameters types : ioType [ios enum], name[string], valueType[ioTypes enum],
    //                         value [number| string | boolean | null | ArrayBuffer],
    //                         myData (stored when using observeInput)
    static observeInput(name, callback, myData) {
        if (typeof(callback) !== "function") {
            console.error("igs.observeInput(name, callback, myData) : 'callback' must be a function");
            return;
        }

        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: null
        };
        return IGS._globalAgent.observeInput(name, IGS._globalAgent_observeIO, observeCbObject);
    }

    static observeAttribute(name, callback, myData) {
        if (typeof(callback) !== "function") {
            console.error("igs.observeAttribute(name, callback, myData) : 'callback' must be a function");
            return;
        }

        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: null
        };
        return IGS._globalAgent.observeAttribute(name, IGS._globalAgent_observeIO, observeCbObject);
    }

    static clearDefinition() {
        return IGS._globalAgent.clearDefinition();
    }

    static definitionDescription() {
        return IGS._globalAgent.definitionDescription();
    }

    static definitionPackage() {
        return IGS._globalAgent.definitionPackage();
    }

    static definitionClass() {
        return IGS._globalAgent.definitionClass();
    }

    static definitionVersion() {
        return IGS._globalAgent.definitionVersion();
    }

    static definitionSetDescription(description) {
        return IGS._globalAgent.definitionSetDescription(description);
    }

    static definitionSetPackage(packageName) {
        return IGS._globalAgent.definitionSetPackage(packageName);
    }

    static definitionSetClass(className) {
        return IGS._globalAgent.definitionSetClass(className);
    }

    static definitionSetVersion(version) {
        return IGS._globalAgent.definitionSetVersion(version);
    }

    static inputCreate(name, valueType, value) {
        return IGS._globalAgent.inputCreate(name, valueType, value);
    }

    static outputCreate(name, valueType, value) {
        return IGS._globalAgent.outputCreate(name, valueType, value);
    }

    static attributeCreate(name, valueType, value) {
        return IGS._globalAgent.attributeCreate(name, valueType, value);
    }

    static inputExists(name) {
        return IGS._globalAgent.inputExists(name);
    }

    static outputExists(name) {
        return IGS._globalAgent.outputExists(name);
    }

    static attributeExists(name) {
        return IGS._globalAgent.attributeExists(name);
    }

    static inputRemove(name) {
        return IGS._globalAgent.inputRemove(name);
    }

    static outputRemove(name) {
        return IGS._globalAgent.outputRemove(name);
    }

    static attributeRemove(name) {
        return IGS._globalAgent.attributeRemove(name);
    }

    static inputCount() {
        return IGS._globalAgent.inputCount();
    }

    static outputCount() {
        return IGS._globalAgent.outputCount();
    }

    static attributeCount() {
        return IGS._globalAgent.attributeCount();
    }

    static inputType(name) {
        return IGS._globalAgent.inputType(name);
    }

    static outputType(name) {
        return IGS._globalAgent.outputType(name);
    }

    static attributeType(name) {
        return IGS._globalAgent.attributeType(name);
    }

    static inputDescription(name) {
        return IGS._globalAgent.inputDescription(name);
    }

    static outputDescription(name) {
        return IGS._globalAgent.outputDescription(name);
    }

    static attributeDescription(name) {
        return IGS._globalAgent.attributeDescription(name);
    }

    static inputSetDescription(name, description) {
        return IGS._globalAgent.inputSetDescription(name, description);
    }

    static outputSetDescription(name, description) {
        return IGS._globalAgent.outputSetDescription(name, description);
    }

    static attributeSetDescription(name, description) {
        return IGS._globalAgent.attributeSetDescription(name, description);
    }

    static inputSetDetailedType(inputName, typeName, specification) {
        return IGS._globalAgent.inputSetDetailedType(inputName, typeName, specification);
    }

    static outputSetDetailedType(outputName, typeName, specification) {
        return IGS._globalAgent.outputSetDetailedType(outputName, typeName, specification);
    }

    static attributeSetDetailedType(attributeName, typeName, specification) {
        return IGS._globalAgent.attributeSetDetailedType(attributeName, typeName, specification);
    }

    static inputAddConstraint(name, constraint) {
        return IGS._globalAgent.inputAddConstraint(name, constraint);
    }

    static outputAddConstraint(name, constraint) {
        return IGS._globalAgent.outputAddConstraint(name, constraint);
    }

    static attributeAddConstraint(name, constraint) {
        return IGS._globalAgent.attributeAddConstraint(name, constraint);
    }

    static clearMappings() {
        return IGS._globalAgent.clearMappings();
    }

    static mappingAdd(fromOurInput, toAgent, withOutput) {
        return IGS._globalAgent.mappingAdd(fromOurInput, toAgent, withOutput);
    }

    static mappingRemove(fromOurInput, toAgent, withOutput) {
        return IGS._globalAgent.mappingRemove(fromOurInput, toAgent, withOutput);
    }

    static mappingCount() {
        return IGS._globalAgent.mappingCount();
    }

    static serviceArgsAddInt(argumentsArray, value) { // returns updated argumentsArray if success
        if (!Array.isArray(argumentsArray)) {
            console.error("igs.serviceArgsAddInt(argumentsArray, value): 'argumentsArray' must be an array");
            return argumentsArray;
        }
        if (typeof(value) !== "number") {
            console.error("igs.serviceArgsAddInt(argumentsArray, value): 'value' must be a number");
            return argumentsArray;
        }

        var argumentObject = {
            type: ioTypes.IGS_INTEGER_T,
            value: value
        };
        argumentsArray.push(argumentObject);
        return argumentsArray;
    }

    static serviceArgsAddBool(argumentsArray, value) { // returns updated argumentsArray if success
        if (!Array.isArray(argumentsArray)) {
            console.error("igs.serviceArgsAddBool(argumentsArray, value): 'argumentsArray' must be an array");
            return argumentsArray;
        }
        if (typeof(value) !== "boolean") {
            console.error("igs.serviceArgsAddBool(argumentsArray, value): 'value' must be a boolean");
            return argumentsArray;
        }

        var argumentObject = {
            type: ioTypes.IGS_BOOL_T,
            value: value
        };
        argumentsArray.push(argumentObject);
        return argumentsArray;
    }

    static serviceArgsAddDouble(argumentsArray, value) { // returns updated argumentsArray if success
        if (!Array.isArray(argumentsArray)) {
            console.error("igs.serviceArgsAddDouble(argumentsArray, value): 'argumentsArray' must be an array");
            return argumentsArray;
        }
        if (typeof(value) !== "number") {
            console.error("igs.serviceArgsAddDouble(argumentsArray, value): 'value' must be a number");
            return argumentsArray;
        }

        var argumentObject = {
            type: ioTypes.IGS_DOUBLE_T,
            value: value
        };
        argumentsArray.push(argumentObject);
        return argumentsArray;
    }

    static serviceArgsAddString(argumentsArray, value) { // returns updated argumentsArray if success
        if (!Array.isArray(argumentsArray)) {
            console.error("igs.serviceArgsAddString(argumentsArray, value): 'argumentsArray' must be an array");
            return argumentsArray;
        }
        if (typeof(value) !== "string") {
            console.error("igs.serviceArgsAddString(argumentsArray, value): 'value' must be a number");
            return argumentsArray;
        }

        var argumentObject = {
            type: ioTypes.IGS_STRING_T,
            value: value
        };
        argumentsArray.push(argumentObject);
        return argumentsArray;
    }

    static serviceArgsAddData(argumentsArray, value) { // returns updated argumentsArray if success
        if (!Array.isArray(argumentsArray)) {
            console.error("igs.serviceArgsAddData(argumentsArray, value): 'argumentsArray' must be an array");
            return argumentsArray;
        }
        if (!(value instanceof(ArrayBuffer))) {
            console.error("igs.serviceArgsAddData(argumentsArray, value): 'value' must be an ArrayBuffer");
            return argumentsArray;
        }

        var argumentObject = {
            type: ioTypes.IGS_DATA_T,
            value: Agent._arrayBufferToBase64(value)
        };
        argumentsArray.push(argumentObject);
        return argumentsArray;
    }

    static serviceCall(agentNameOrUUID, serviceName, argumentsArray, token) {
        return IGS._globalAgent.serviceCall(agentNameOrUUID, serviceName, argumentsArray, token);
    }

    // Example of callback handle by serviceInit function :
    // function callback(senderAgentName, senderAgentUUID, serviceName, argumentsArray, token, myData);
    //      Parameters types : senderAgentName [string], senderAgentUUID[string], serviceName[string],
    //                         argumentsArray[Array of number| string | boolean | ArrayBuffer], token[string],
    //                         myData (stored when use serviceInit)
    static serviceInit(name, callback, myData) {
        if (typeof(callback) !== "function") {
            console.error("igs.serviceInit(name, callback, myData) : 'callback' must be a function");
            return false;
        }

        var observeCbObject = {
            cb: callback,
            myData: myData,
            object: null
        };
        return IGS._globalAgent.serviceInit(name, IGS._globalAgent_service, observeCbObject);
    }

    static serviceRemove(name) {
        return IGS._globalAgent.serviceRemove(name);
    }

    static serviceCount() {
        return IGS._globalAgent.serviceCount();
    }

    static serviceExists(name) {
        return IGS._globalAgent.serviceExists(name);
    }

    static serviceDescription(name) {
        return IGS._globalAgent.serviceDescription(name);
    }

    static serviceSetDescription(name, description) {
        return IGS._globalAgent.serviceSetDescription(name, description);
    }

    static serviceArgAdd(serviceName, argName, type) {
        return IGS._globalAgent.serviceArgAdd(serviceName, argName, type);
    }

    static serviceArgRemove(serviceName, argName) { //removes first occurence with this name
        return IGS._globalAgent.serviceArgRemove(serviceName, argName);
    }

    static serviceArgExists(serviceName, argName) {
        return IGS._globalAgent.serviceArgExists(serviceName, argName);
    }

    static serviceArgCount(name) {
        return IGS._globalAgent.serviceArgCount(name);
    }

    static serviceArgDescription(serviceName, argName) {
        return IGS._globalAgent.serviceArgDescription(serviceName, argName);
    }

    static serviceArgSetDescription(serviceName, argName, description) {
        return IGS._globalAgent.serviceArgSetDescription(serviceName, argName, description);
    }

    static serviceReplyAdd(serviceName, replyName) {
        return IGS._globalAgent.serviceReplyAdd(serviceName, replyName);
    }

    static serviceReplyRemove(serviceName, replyName) {
        return IGS._globalAgent.serviceReplyRemove(serviceName, replyName);
    }

    static serviceHasReplies(serviceName) {
        return IGS._globalAgent.serviceHasReplies(serviceName);
    }

    static serviceHasReply(serviceName, replyName) {
        return IGS._globalAgent.serviceHasReply(serviceName, replyName);
    }

    static serviceReplyDescription(serviceName, replyName) {
        return IGS._globalAgent.serviceReplyDescription(serviceName, replyName);
    }

    static serviceReplySetDescription(serviceName, replyName, description) {
        return IGS._globalAgent.serviceReplySetDescription(serviceName, replyName, description);
    }

    static serviceReplyArgAdd(serviceName, replyName, argName, type) {
        return IGS._globalAgent.serviceReplyArgAdd(serviceName, replyName, argName, type);
    }

    static serviceReplyArgRemove(serviceName, replyName, argName) {
        return IGS._globalAgent.serviceReplyArgRemove(serviceName, replyName, argName);
    }

    static serviceReplyArgsCount(serviceName, replyName) {
        return IGS._globalAgent.serviceReplyArgsCount(serviceName, replyName);
    }

    static serviceReplyArgExists(serviceName, replyName, argName) {
        return IGS._globalAgent.serviceReplyArgExists(serviceName, replyName, argName);
    }

    static serviceReplyArgDescription(serviceName, replyName, argName) {
        return IGS._globalAgent.serviceReplyArgDescription(serviceName, replyName, argName);
    }

    static serviceReplyArgSetDescription(serviceName, replyName, argName, description) {
        return IGS._globalAgent.serviceReplyArgSetDescription(serviceName, replyName, argName, description);
    }

    /* ********************** */
    /* Utils private funtions */
    /* ********************** */

    static _sendStoredMessagesOnWebSocket() {
        while (Agent._messagesToSendOnWS.length > 0) {
            if (IGS._socket && (IGS._socket.readyState === 1)) {
                var message = Agent._messagesToSendOnWS.shift();
                IGS._socket.send(message);
            }
        }
        IGS.sendMessagesOnWSTimer = window.setTimeout(IGS._sendStoredMessagesOnWebSocket, 10);
    }

    static _handleDefinitionAndMappingUpdatesOnWS() {
        if (IGS._receiveCloseEventOnWS && !Agent._isConnected) {
            console.log("Connection to proxy " + IGS._serverURL + " failed... retrying.")
            IGS._receiveCloseEventOnWS = false;
            IGS._socket = new WebSocket(IGS._serverURL);
            IGS._socket.onopen = function(openEvent) {
                IGS.ws_onOpen(openEvent);
            }
            IGS._socket.onmessage = function(event) {
                IGS.ws_onMessage(event);
            }
            IGS._socket.onclose = function(closeEvent) {
                IGS.ws_onClose(closeEvent);
            }
        }

        Agent._ourAgents.forEach(function(pseudoAgent) {
            if (pseudoAgent.agentMappingIsUpdated) {
                var updateMappingJSON = {
                    event: "update_mapping",
                    uuid: pseudoAgent.uuid,
                    mapping: pseudoAgent.agentMapping
                };
                // Add mapping JSON to the beginning of our list
                Agent._messagesToSendOnWS.unshift(JSON.stringify(updateMappingJSON));
                pseudoAgent.agentMappingIsUpdated = false;
            }

            if (pseudoAgent.agentDefinitionIsUpdated) {
                var updateDefinitionJSON = {
                    event: "update_definition",
                    uuid: pseudoAgent.uuid,
                    definition: {
                        definition : pseudoAgent.agentDefinition
                    }
                };
                // Add definitionJSON to the beginning of our list
                Agent._messagesToSendOnWS.unshift(JSON.stringify(updateDefinitionJSON));
                pseudoAgent.agentDefinitionIsUpdated = false;
            }
        });
    }

    // Ingescape callbacks for global API (i.e. without agent as 1st parameter)
    static _globalAgent_observeAgentEventsCallback(agent, event, uuid, name, eventData, myData) {
        (myData.cb)(event, uuid, name, eventData, myData.myData);
    }

    static _globalAgent_observeIO(agent, ioType, name, valueType, value, myData) {
        (myData.cb)(ioType, name, valueType, value, myData.myData);
    }

    static _globalAgent_service(agent, senderAgentName, senderAgentUUID, serviceName, argumentsArray, token, myData) {
        (myData.cb)(senderAgentName, senderAgentUUID, serviceName, argumentsArray, token, myData.myData);
    }
}

