module.exports = function(RED) {
    function MyGekkoAlarmNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (alarm)
        node.itemid = "alarm"
        node.isInitialized = false;
        node.kind = "globals";
        node.alarmid = 0;
        node.alarm = "OK";

        //register this node to server for api-responses
        if(node.server) {
            node.registerToServer();
        } else {
            //set status
            node.setState("text", "no server assigned");
        }
        
        //subscribe event listener on 'close'
        node.on('close', function() {
            //unregister from server when closing
            if(node.server) {
                node.server.unregister(node);
            }
        });
    }
    
    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "globals"-block from the response of the QueryApi-Request
     */
    MyGekkoAlarmNode.prototype.handleQueryApiResponse = function(block) {
        //check if response is a object
        if(typeof block != "object") {
            //response is no object, change status and cancel handling
            this.setState("error", "invalid QueryApi response");
            return;
        }

        //get actual values and check for change
        if(this.getValuesFromResponse(block) && this.isInitialized) {
            //there was a change, send a message with actual values
            msg = {};
            msg.payload = {};
            msg.payload = ({"item" : this.itemid, "name": this.name, "alarmid" : this.alarmid, "alarm" : this.alarm});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; alarmid: " + this.alarmid + "; alarm: " + this.alarm);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoAlarmNode.prototype.getValuesFromResponse = function (block) {
        var _alarmid;
        try {
            _alarmid = parseInt(block[this.itemid].sumstate.value);
        } catch(err) {
        }
        //was there a value-change?
        if(this.alarmid != _alarmid) {
            //yes, value changed, store new values
            this.alarmid = _alarmid;
            this.alarm = this.getStringFromAlarmId(this.alarmid);
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoAlarmNode.prototype.registerToServer = function () {
        this.setState("text", "waiting for server to be ready");
        //is server ready?
        if(this.server.isInitialized){
            if(!this.server.register(this)) {
                this.setState("error", "Error on registering to Server");
                return;
            };
            this.setState("ok", "connected");
            return;
        }
        //server not ready, retry in 2,5 seconds
        setTimeout(() => {this.registerToServer() }, 2500);
    }
    
    /**
     * returns the String-representation of the AlarmId from MyGekko
     * @param {int} alarmid The alarmid to convert.
     */
    MyGekkoAlarmNode.prototype.getStringFromAlarmId = function (alarmid) {
        switch (alarmid) {
            case 0:
                return "OK";
                break;
            case 2:
                return "ACKNOWLEDGED";
                break;
            case 3:
                return "ALARM";
                break;
            default:
                return "UNKNOWN";
                break;
        }
    }

    /**
     * setState: sets the state in the webflow-editor and trigger a "warn"-message on "error"
     * @param {string} state: possible values: error, text, ok
     * @param {string} message: text to be displayed
     */
    MyGekkoAlarmNode.prototype.setState = function(state, message) {
        if(typeof message === "undefined") message = "";

        switch(state) {
            case "error":
                this.status({fill:"red",shape:"dot",text: message});
                this.warn(message);
                break;
            case "text":
                this.status({fill:"yellow",shape:"ring",text: message});
                break;
            case "ok":
                this.status({fill:"green",shape:"dot",text: message});
        }
    }

    RED.nodes.registerType("mygekko_alarm",MyGekkoAlarmNode);
}