module.exports = function(RED) {
    function MyGekkoActionNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        node.itemid = config.itemid;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (action)
        node.isInitialized = false;
        node.kind = "actions";
        node.state = false;
        node.locked = false;
        
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
    MyGekkoActionNode.prototype.handleInput = function (msg) {
        if(this.itemid == "") {
            this.warn("no itemid set");
            return;
        }
        var onValue;
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
            this.server.doHttpGetRequest("/api/v1/var/actions/" + this.itemid + "/scmd/set?value=" + (onValue?"1":"-1") + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }        
      }

    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "loads"-block from the response of the QueryApi-Request
     */
    MyGekkoActionNode.prototype.handleQueryApiResponse = function(block) {
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
            msg.payload = ({"item" : this.itemid, "name": this.name, "state" : this.state, "locked" : this.locked});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; state: " + this.state + "; locked: " + this.locked);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoActionNode.prototype.getValuesFromResponse = function (block) {
        var _state;
        var _locked;
        try {
            _state = parseInt(block[this.itemid].sumstate.value.split(";")[0]) == 1 ? true : false;
            _locked = parseInt(block[this.itemid].sumstate.value.split(";")[1]) == 1 ? false : true;
        } catch(err) {
        }
        //was there a value-change?
        if((this.state != _state && typeof _state != "undefined") || (this.locked != _locked && typeof _locked != "undefined")) {
            //yes, values changed, store new values
            this.state = _state;
            this.locked = _locked;
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoActionNode.prototype.registerToServer = function () {
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
    MyGekkoActionNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_action", MyGekkoActionNode);
}