//
//  Host
//
//  Created by Ingenuity i/o on 2026/02/02
//
//  Copyright © 2025 Ingenuity i/o. All rights reserved.
//

//inputs
function Joiner_ConnectedInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed (impulsion)");
    joinerConnected = true;
    handleJoinerConnected();
}

function Joiner_FinishedInputCallback(type, name, valueType, value, myData) {
    console.log(name + " changed (impulsion)");
    joinerFinished = true;
    handleJoinerFinished();
}

//services
function GethostnameServiceCallback(senderAgentName, senderAgentUUID, serviceName, serviceArguments, token, hostName) {
    var log = senderAgentName + " called service " + serviceName;
    console.log(log)

    IGS.serviceReply(
        serviceName,
        token,
        "getHostNameResult",
        { "host_name": hostName }
    );
}

//call other agents's services 
function requestJoinerName() {
    console.log("calling Joiner service");
    IGS.serviceCall(
        "Joiner",             // agent cible
        "getJoinerName",      // nom du service
        [],
        "getJoinerNameRequest" // token
    );

}

function getJoinerNameResult(senderAgentName, senderAgentUUID,  serviceName,  args, token, myData) {
    const joinerName = args[0].value;
    console.log("Joiner name received:", joinerName);
    document.getElementById("joiner-name").textContent = joinerName;
    joinerInitialised = true;
}

IGS.serviceInit("getJoinerNameResult", getJoinerNameResult);
IGS.serviceArgAdd("getJoinerNameResult", "joiner_name", ioTypes.IGS_STRING_T);



IGS.netSetServerURL("ws://localhost:8080");
IGS.agentSetName("Host");
IGS.definitionSetClass("Host");
IGS.definitionSetPackage("");


IGS.inputCreate("joiner_connected", ioTypes.IGS_IMPULSION_T, "");
IGS.inputCreate("joiner_finished", ioTypes.IGS_IMPULSION_T, "");

IGS.outputCreate("game_mode", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("player_name", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("character", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("level_selected", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("start", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("has_finished", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("spawn_treat", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("spawn_poison", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("spawn_enemi", ioTypes.IGS_IMPULSION_T, "");
IGS.outputCreate("score_text", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("treat_text", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("chat", ioTypes.IGS_STRING_T, "");
IGS.outputCreate("treat_recolted", ioTypes.IGS_INTEGER_T, 0);
IGS.outputCreate("total_treat", ioTypes.IGS_INTEGER_T, 0);
IGS.outputCreate("reset", ioTypes.IGS_IMPULSION_T, "");


//Initialize agent
IGS.observeInput("joiner_connected", Joiner_ConnectedInputCallback);
IGS.observeInput("joiner_finished", Joiner_FinishedInputCallback);
IGS.serviceInit("getHostName", GethostnameServiceCallback);
IGS.serviceReplyAdd("getHostName", "getHostNameResult");
IGS.serviceReplyArgAdd("getHostName", "getHostNameResult", "host_name", ioTypes.IGS_STRING_T);

//actually start ingescape
IGS.start();


//
// HTML example
//

//write outputs
function setGame_ModeOutput(gameMode) {
    IGS.outputSetString("game_mode", gameMode);
}

function setPlayer_NameOutput(pName) {
    IGS.outputSetString("player_name", pName);
}

function setCharacterOutput(character) {
    IGS.outputSetString("character", character);
}

function setLevel_SelectedOutput(level) {
    IGS.outputSetString("level_selected", level);
}

function setStartOutput() {
    IGS.outputSetImpulsion("start");
}

function setHas_FinishedOutput() {
    IGS.outputSetImpulsion("has_finished");
}

function setSpawn_TreatOutput() {
    IGS.outputSetImpulsion("spawn_treat");
}

function setSpawn_PoisonOutput() {
    IGS.outputSetImpulsion("spawn_poison");
}

function setSpawn_EnemiOutput() {
    IGS.outputSetImpulsion("spawn_enemi");
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

function setTotal_TreatOutput(total_treat) {
    IGS.outputSetInt("total_treat", Number(total_treat));
}

function setResetOutput() {
    IGS.outputSetImpulsion("reset");
}

