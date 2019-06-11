module.exports = function(RED) {
    function MyGekkoProfileNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (profile)
        node.itemid = "profile"
        node.isInitialized = false;
        node.kind = "globals";
        node.profileid = 0;
        node.profile = node.getStringFromProfileId(node.profileid);

        //register this node to server for api-responses
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
    MyGekkoProfileNode.prototype.handleInput = function (msg) {
        var profileValue;
        var updateProfile = false;
        //check if simple-mode (only 0 or 1 in msg.payload)
        if(typeof msg.payload == typeof 1) {
            profileValue = msg.payload;
            updateProfile = true;
        }
        //check if msg.profileid is set -> override value from payload
        if(typeof msg.profileid == typeof 1) {
            profileValue = msg.profileid;
            updateProfile = true;
        }
        //check for valid values
        if(typeof profileValue == "undefined" || !(profileValue == 1 || profileValue == 0)) {
            this.error("invalid value for profileid");
        }
        if(updateProfile) {
            this.server.doHttpGetRequest("/api/v1/var/globals/" + this.itemid + "/scmd/set?value=P" + profileValue + "&" + this.server.getCredentialsString(),
            (a,b) => {}, //onResult -> not used TODO implement onResult-Handler
            (a) => {}); //onError -> not used TODO implement onError-Handler}
        }        
    }

    /**
     * handleQueryApiResponse: handles the QueryApi-Response from server
     * @param {string} block: "globals"-block from the response of the QueryApi-Request
     */
    MyGekkoProfileNode.prototype.handleQueryApiResponse = function(block) {
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
            msg.payload = ({"item" : this.itemid, "name": this.name, "profileid" : this.profileid, "profile" : this.profile});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected; profileid: " + this.profileid + "; profile: " + this.profile);
    }
    
    /**
     * try to parse the actual values and compare to property-values
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoProfileNode.prototype.getValuesFromResponse = function (block) {
        var _profileid;
        try {
            _profileid = parseInt(block[this.itemid].sumstate.value);
        } catch(err) {
        }
        //was there a value-change?
        if(this.profileid != _profileid) {
            //yes, value changed, store new values
            this.profileid = _profileid;
            this.profile = this.getStringFromProfileId(this.profileid);
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoProfileNode.prototype.registerToServer = function () {
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
     * returns the String-representation of the ProfileId from MyGekko
     */
    MyGekkoProfileNode.prototype.getStringFromProfileId = function (alarmid) {
        switch (alarmid) {
            case 0:
                return "Away";
                break;
            case 1:
                return "At Home";
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
    MyGekkoProfileNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_profile",MyGekkoProfileNode);
}