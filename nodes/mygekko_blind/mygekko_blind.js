module.exports = function(RED) {
    function MyGekkoBlindNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        node.itemid = config.itemid;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (blinds)
        node.isInitialized = false;
        node.kind = "blinds";
        node.stateid = 0;
        node.state = "stop";
        node.position = 0;
        node.angle = 0;
        
        //check for valid name
        if(typeof node.name === "undefined" || node.name.length <= 0) {
            node.setState("error","not a valid name");
            return;
        }
        //check for valid itemid
        if(typeof node.itemid === "undefined") {
            node.itemid = "";
        }
        //register this node to server for api-responses
        //server sets the node.itemid for QueryApi if needed
        if(node.server) {
            node.registerToServer();
        } else {
            //set status
            node.setState("text", "no server assigned");
        }
        
        //subscribe event listener on 'input'
        node.on('input', function(msg){
            node.handleInput(msg);
        });
        
        //subscribe event listener on 'close'
        node.on('close', function() {
            //unregister from server when closing
            if(node.server) {
                node.server.unregister(node);
            }
        });
    }
    
    /**
     * handles the payload on input-event
     * @param {object} msg: message from input to handle
     */
    MyGekkoBlindNode.prototype.handleInput = function (msg) {
        if(this.itemid == "") {
            this.warn("no itemid set");
            return;
        }
        var positionValue = 0;
        var updatePosition = false;
        //check if simple-mode (only true or false in msg.payload)
        if(typeof msg.payload == typeof true) {
            positionValue = msg.payload ? 100 : 0;
            updatePosition = true;
        }
        //check if msg.position is set -> override value from payload
        if(typeof msg.position == typeof 1) {
            
            if(!isNaN(parseFloat(msg.position)) && parseFloat(msg.position) >= 0 && parseFloat(msg.position) <= 100) {
                positionValue = parseFloat(msg.position);
                updatePosition = true;
            }
        }
        if(updatePosition) {
            this.server.doHttpGetRequest("/api/v1/var/blinds/" + this.itemid + "/scmd/set?value=P" + positionValue + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }        
        //check if msg.stateid is set and valid
        if(!isNaN(parseInt(msg.stateid)) && msg.stateid >= -2 && msg.stateid <= 2 ) {
            this.server.doHttpGetRequest("/api/v1/var/blinds/" + this.itemid + "/scmd/set?value=" + parseInt(msg.stateid) + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }
        //check if msg.angle is set and valid
        if(!isNaN(parseFloat(msg.angle)) && parseFloat(msg.angle) >= 0 && parseFloat(msg.angle) <= 100) {
            this.server.doHttpGetRequest("/api/v1/var/blinds/" + this.itemid + "/scmd/set?value=S" + parseFloat(msg.angle) + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }
    }

    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "blinds"-block from the response of the QueryApi-Request
     */
    MyGekkoBlindNode.prototype.handleQueryApiResponse = function(block) {
        //check if response is a object
        if(typeof block != "object") {
            //response is no object, change status and cancel handling
            this.setState("error", "invalid QueryApi response");
            return;
        }
        //check if itemid is set
        if (this.itemid == "") {
            this.setState("error", "itemId not set");
            return;
        }

        //get actual values and check for change
        if(this.getValuesFromResponse(block) && this.isInitialized) {
            //there was a change, send a message with actual values
            msg = {};
            msg.payload = {};
            msg.payload = ({"item" : this.itemid, "name": this.name, "position" : this.position, "stateid" : this.stateid, "state" : this.state, "angle" : this.angle});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; position: " + this.position + "; stateid: " + this.stateid + "; angle: " + this.angle);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoBlindNode.prototype.getValuesFromResponse = function (block) {
        var _position;
        var _stateid;
        var _angle;
        var values;
        try {
            values = block[this.itemid].sumstate.value.split(";");
            _stateid = parseInt(values[0]);
            _position = parseFloat(values[1]);
            _angle = parseFloat(values[2]);
        } catch(err) {
        }
        _angle = _angle || 0;
        //was there a value-change?
        if(this.stateid != _stateid || this.position != _position || this.angle != _angle) {
            //yes, values changed, store new values
            this.stateid = _stateid;
            this.state = this.getStringFromStateId(this.stateid);
            this.position = _position;
            this.angle = _angle;
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoBlindNode.prototype.registerToServer = function () {
        this.setState("text", "waiting for server to be ready");
        //is server ready?
        if(this.server.isInitialized){
            if(!this.server.register(this)) {
                this.setState("error", "ItemId could not auto assign");
                return;
            };
            this.setState("ok", "connected");
            return;
        }
        //server not ready, retry in 2 seconds
        setTimeout(() => {this.registerToServer() }, 2500);
    }
    
    /**
     * returns the String-representation of the AlarmId from MyGekko
     * @param {int} stateid The stateid to convert.
     */
    MyGekkoBlindNode.prototype.getStringFromStateId = function (stateid) {
        switch (stateid) {
            case -2:
                return "hold_down";
                break;
            case -1:
                return "down";
                break;
            case 0:
                return "stop";
                break;
            case 1:
                return "up";
                break;
            case 2:
                return "hold_up";
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
    MyGekkoBlindNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_blind",MyGekkoBlindNode);
}