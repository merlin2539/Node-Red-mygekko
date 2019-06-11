module.exports = function(RED) {
    function MyGekkoLightNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        node.itemid = config.itemid;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (lights)
        node.isInitialized = false;
        node.kind = "lights";
        node.state = false;
        node.dimvalue = 0;
        node.rgbvalue = 0;
        
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
    MyGekkoLightNode.prototype.handleInput = function (msg) {
        if(this.itemid == "") {
            this.warn("no itemid set");
            return;
        }
        var onValue = false;
        var updateOn = false;
        //check if simple-mode (only true or false in msg.payload)
        if(typeof msg.payload == typeof true) {
            onValue = msg.payload;
            updateOn = true;
        }
        //check if msg.state is set -> override value from payload
        if(typeof msg.state == typeof true) {
            onValue = msg.state;
            updateOn = true;
        }
        if(updateOn) {
            this.server.doHttpGetRequest("/api/v1/var/lights/" + this.itemid + "/scmd/set?value=" + (onValue?"1":"0") + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }        
        //check if msg.dimvalue is set and valid
        if(typeof msg.dimvalue == "number" && msg.dimvalue >= 0 && msg.dimvalue <= 100) {
            this.server.doHttpGetRequest("/api/v1/var/lights/" + this.itemid + "/scmd/set?value=D" + msg.dimvalue + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }
        //check if msg.rgbvalue is set and valid
        if(typeof msg.rgbvalue == "number" && msg.rgbvalue >= 0 && msg.rgbvalue <= 16777216) {
            //check is not correct, but better than calculating possible correct values
            this.server.doHttpGetRequest("/api/v1/var/lights/" + this.itemid + "/scmd/set?value=C" + msg.rgbvalue + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }
    }

    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "lights"-block from the response of the QueryApi-Request
     */
    MyGekkoLightNode.prototype.handleQueryApiResponse = function(block) {
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
            msg.payload = ({"item" : this.itemid, "name": this.name, "state" : this.state, "dim" : this.dimvalue, "rgb" : this.rgbvalue});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; state: " + (this.state?"1":"0") + "; dim: " + this.dimvalue + "; rgb: " + this.rgbvalue);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoLightNode.prototype.getValuesFromResponse = function (block) {
        var _state;
        var _dimvalue;
        var _rgbvalue;
        var values;
        try {
            values = block[this.itemid].sumstate.value.split(";");
            _state = parseInt(values[0]) == 1;
            _dimvalue = parseInt(values[1]);
            _rgbvalue = parseInt(values[2]);
        } catch(err) {
        }
        _dimvalue = _dimvalue || 0;
        _rgbvalue = _rgbvalue || 0
        //was there a value-change?
        if(this.state != _state || this.dimvalue != _dimvalue || this.rgbvalue != _rgbvalue) {
            //yes, values changed, store new values
            this.state = _state;
            this.dimvalue = _dimvalue;
            this.rgbvalue = _rgbvalue;
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoLightNode.prototype.registerToServer = function () {
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
     * setState: sets the state in the webflow-editor and trigger a "warn"-message on "error"
     * @param {string} state: possible values: error, text, ok
     * @param {string} message: text to be displayed
     */
    MyGekkoLightNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_light",MyGekkoLightNode);
}