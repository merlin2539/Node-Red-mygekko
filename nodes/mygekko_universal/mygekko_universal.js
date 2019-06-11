module.exports = function(RED) {
    function MyGekkoUniversalNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;         
        //initialize local properties
        node.name = config.name;
        //get server-node from config
        node.server = RED.nodes.getNode(config.server);
        //add properties for mygekko-api-item (alarm)
        node.isInitialized = false;
        node.kind = "universal";
        node.jsondata = {};

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
     * @param {string} block: complete json from the response of the QueryApi-Request
     */
    MyGekkoUniversalNode.prototype.handleQueryApiResponse = function(block) {
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
            msg.payload = ({"name": this.name, "queryapi" : this.jsondata});
            this.send(msg);
        }
        else
        {
            //only for first receiving of values -> initial values -> no msg generation
            this.isInitialized = true;
        }
        this.setState("ok", "connected");
    }
    
    /**
     * compare the actual json-object to the stored one
     * @return {boolean} returns true if values changed - false if values have not changed
     */
    MyGekkoUniversalNode.prototype.getValuesFromResponse = function (block) {
        //was there a value-change?
        if(JSON.stringify(block) != JSON.stringify(this.jsondata)) {
            //yes, value changed, store new values
            this.jsondata = block
            //return true for changed values
            return true;
        }
        //nothing has changed
        return false;
    }

    /**
     * register this node to the server, if server is not ready, retries every 2,5 seconds
     */
    MyGekkoUniversalNode.prototype.registerToServer = function () {
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
     * setState: sets the state in the webflow-editor and trigger a "warn"-message on "error"
     * @param {string} state: possible values: error, text, ok
     * @param {string} message: text to be displayed
     */
    MyGekkoUniversalNode.prototype.setState = function(state, message) {
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

    RED.nodes.registerType("mygekko_universal",MyGekkoUniversalNode);
}