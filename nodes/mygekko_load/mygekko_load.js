module.exports = function(RED) {
    function MyGekkoLoadNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        node.itemid = config.itemid;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (load)
        node.isInitialized = false;
        node.kind = "loads";
        node.state = 0;
        
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
    MyGekkoLoadNode.prototype.handleInput = function (msg) {
        if(this.itemid == "") {
            this.warn("no itemid set");
            return;
        }
        var onValue;
        var updateOn = false;
        //check if simple-mode (only true or false in msg.payload)
        if(typeof msg.payload == typeof true) {
            onValue = msg.payload?2:0;
            updateOn = true;
        }
        //check if msg.state is set -> override value from payload
        if(typeof msg.state == typeof 1) {
            onValue = msg.state;
            updateOn = true;
        }
        //check for valid value
        if(typeof onValue == "undefined" || onValue < 0 || onValue > 2){
            this.error("invalid value for load");
            return;
        }
        if(updateOn) {
            this.server.doHttpGetRequest("/api/v1/var/loads/" + this.itemid + "/scmd/set?value=" + onValue + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }        
      }

    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "loads"-block from the response of the QueryApi-Request
     */
    MyGekkoLoadNode.prototype.handleQueryApiResponse = function(block) {
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
            msg.payload = ({"item" : this.itemid, "name": this.name, "state" : this.state});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; state: " + this.state);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoLoadNode.prototype.getValuesFromResponse = function (block) {
        var _state;
        try {
            _state = parseInt(block[this.itemid].sumstate.value.split(";")[0]);
        } catch(err) {
        }
        //was there a value-change?
        if(this.state != _state && typeof _state != "undefined") {
            //yes, values changed, store new values
            this.state = _state;
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoLoadNode.prototype.registerToServer = function () {
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
    MyGekkoLoadNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_load", MyGekkoLoadNode);
}