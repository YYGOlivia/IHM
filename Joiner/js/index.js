//
//  Joiner
//
//  Created by Ingenuity i/o on 2026/02/02
//
//  Copyright © 2025 Ingenuity i/o. All rights reserved.
//

//server connection
function isConnectedToServerChanged(isConnected) {
    handleConnection(isConnected);
}


//inputs
function Host_CharacterInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed to " + value);
    charType = value === 'cat' ? 'dog' : 'cat'
}

function Level_SelectedInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed to " + value);
    levelSelected = value;
}


function StartInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed (impulsion)");
    gameStart();
}

function Host_FinishedInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed (impulsion)");
    hostFinished = true;
    handleHostFinished();
}

function Total_TreatInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed to " + value);
    total_treat = Number(value);
    resultTreats();
}



//services
function SpawnenemiServiceCallback(senderAgentName, senderAgentUUID, serviceName, serviceArguments, token, myData) {
    var log = senderAgentName + " called service " + serviceName;
    console.log(log)
    spawnObject('enemy');
}
function SpawnpoisonServiceCallback(senderAgentName, senderAgentUUID, serviceName, serviceArguments, token, myData) {
    var log = senderAgentName + " called service " + serviceName;
    console.log(log)
    spawnObject('poison');
}
function SpawntreatServiceCallback(senderAgentName, senderAgentUUID, serviceName, serviceArguments, token, myData) {
    var log = senderAgentName + " called service " + serviceName;
    console.log(log)
    spawnObject('food');
}
function GetjoinernameServiceCallback(senderAgentName, senderAgentUUID,  serviceName,  serviceArguments, token, myData) {
    console.log(senderAgentName + " called getJoinerNameService");
    IGS.serviceCall(
        senderAgentName,           
        "getJoinerNameResult",     
        [{ name: "joiner_name", type: ioTypes.IGS_STRING_T, value: pName }],
        token
    );
}


IGS.agentSetName("Joiner");
IGS.definitionSetClass("Joiner");
IGS.definitionSetPackage("");
IGS.observeWebSocketState(isConnectedToServerChanged);



IGS.inputCreate("host_character", ioTypes.IGS_STRING_T, "");
IGS.inputCreate("level_selected", ioTypes.IGS_STRING_T, "");
IGS.inputCreate("start", ioTypes.IGS_IMPULSION_T, "");
IGS.inputCreate("host_finished", ioTypes.IGS_IMPULSION_T, "");
IGS.inputCreate("total_treat", ioTypes.IGS_INTEGER_T, 0);

IGS.outputCreate("is_connected", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("has_finished", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("player_name", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("character", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("score_text", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("treat_text", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("chat", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("treat_recolted", ioTypes.IGS_INTEGER_T, 0);


//Initialize agent
IGS.observeInput("host_character", Host_CharacterInputCallback);
IGS.observeInput("host_finished", Host_FinishedInputCallback);
IGS.observeInput("level_selected", Level_SelectedInputCallback);
IGS.observeInput("start", StartInputCallback);
IGS.observeInput("total_treat", Total_TreatInputCallback);
IGS.serviceInit("spawnEnemi", SpawnenemiServiceCallback);
IGS.serviceInit("spawnPoison", SpawnpoisonServiceCallback);
IGS.serviceInit("spawnTreat", SpawntreatServiceCallback);
IGS.serviceInit("getJoinerName", GetjoinernameServiceCallback);
IGS.serviceReplyAdd("getJoinerName", "getJoinerNameResult");
IGS.serviceReplyArgAdd("getJoinerName", "getJoinerNameResult", "joiner_name", ioTypes.IGS_STRING_T);


//
// HTML example
//

//update websocket config
function setServerURL(url) {
    IGS.netSetServerURL(url);
}

//write outputs
function setIs_ConnectedOutput() {
    IGS.outputSetImpulsion("is_connected");
}

function setHas_FinishedOutput() {
    IGS.outputSetImpulsion("has_finished");
}

function setPlayer_NameOutput(pName) {
    IGS.outputSetString("player_name", pName);
}

function setCharacterOutput(char) {
    IGS.outputSetString("character", char);
}

function setScore_TextOutput(score_text) {
    IGS.outputSetString("score_text", score_text);
}

function setTreat_TextOutput(treat_text) {
    IGS.outputSetString("treat_text", treat_text);
}

function setChatOutput(chat) {
    IGS.outputSetString("chat", chat);
}

function setTreat_RecoltedOutput(treat) {
    IGS.outputSetInt("treat_recolted", Number(treat));
}

