module.exports = function(RED) {
    function MyGekkoServerNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        //initialize local properties
        node.active = n.active;
        node.api = n.api;
        node.host = n.host;
        node.interval = parseInt(n.interval) || 5;
        node.gekkoid = node.credentials.gekkoid
        node.username = node.credentials.username;
        node.password = node.credentials.password;
        //add properties for registering consumers,holding the polling-timer and the complete tree of QueryApi (names)
        node.isInitialized = false;
        node.nodes = {};
        node.nodeCount = 0;
        node.timer = {};
        node.tree = {};

/*#########################################################
  ##          Testing & Debugging                        ##
  #########################################################*/
        node.debug = false;
        
        //request for initial state (read all possible groups and names from QueryApi)
        if(node.debug) {
            const fs = require('fs');
            rawdata = fs.readFileSync(RED.settings.userDir + '\\node_modules\\node-red-contrib-mygekko\\nodes\\debug_samples\\init.json');  
            node.tree = JSON.parse(rawdata);
            this.isInitialized = true;
        } else {
            node.doInitialRequest();
        }

        //subscribe listener on 'close'
        node.on('close', function (removed, done) {
            if (removed) {
                //node deleted
            } else {
                //node restarted
            }
            //clear the timer on closing
            this.stopPollingTimer();
            done();
        });
    }

    /**
     * performs the initial request to QueryApi for the complete tree to find all possible names
     */
    MyGekkoServerNode.prototype.doInitialRequest = function () {
        this.doHttpGetRequest(this.getQueryApiInitUrl(), (statusCode, response) => {this.handleQueryApiInitResponse(statusCode, response);}, (error) => {this.handleQueryApiInitError(error);});
    }

    /**
     * called by timer to poll the QueryApi
     */
    MyGekkoServerNode.prototype.pollQueryApi = function () {
        //check if polling is needed (is a consumer(node) registered?)
        if(this.nodeCount <= 0) {
            //no consumer(node) registered -> no polling needed
            this.stopPollingTimer();
            return;
        }

        //is global tree loaded?
        if(this.isInitialized){
/*#########################################################
  ##          Testing & Debugging                        ##
  #########################################################*/
            if(this.debug) {
                const fs = require('fs');
                rawdata = fs.readFileSync(RED.settings.userDir + '\\node_modules\\node-red-contrib-mygekko\\nodes\\debug_samples\\poll.json');  
                this.handleQueryApiResponse(200, rawdata);
            } else {
                //get update for values
                this.doHttpGetRequest(this.getQueryApiUrl(), (statusCode, response) => {this.handleQueryApiResponse(statusCode, response);}, (error) => {this.handleQueryApiError(error);});
            }
        } else {
            //start new timer, perhaps next time
            this.startPollingTimer();
        }
    }    
    
    /**
     * performs the https-request, also used by nodes
     * @param {string} path: the url/path to request
     * @param {callback} onResult: callback ({number}statusCode, {string}response) for completed request
     * @param {callback} onError: callback ({error-object}) for error during request
     */ 
    MyGekkoServerNode.prototype.doHttpGetRequest = function (path, onResult, onError) {
        try {
            //use standard https-module, so no new dependencies
            var https = require('https');
            //set options for request
            var options = {
                host: this.host,
                path: path,
                rejectUnauthorized: false
            };  
            var result = "";

            //get-request
            var req = https.get(options, (res) => {
                res.setEncoding('utf8');
    
                //event subscribe for data-chunks
                res.on('data', (chunk) => {
                    result += chunk;
                });
    
                //event subscribe for finished request
                res.on('end', () => {
                    onResult(res.statusCode, result);
                });
            });
    
            //set timeout for request
            req.setTimeout(2000, () => {
                req.abort();
            });
    
            //event subscribe for error in request
            req.on('error', (err) => {
                onError(err);
            });
            req.end();
        } catch(e) {
            onError(e);
        }
    }
    
    /**
     * handles the response from QueryApi and deliver it to all consumers (nodes)
     * @param {number} statusCode: the statusCode of the https-request
     * @param {string} response: respone of https-request
     */
    MyGekkoServerNode.prototype.handleQueryApiResponse = function (statusCode, response) {
        //check statusCode
        var message = this.getMessageFromStatusCode(statusCode);
        //successful request?
        if(statusCode != 200) {
            this.setAllNodeStates("error", message);
            //start new polling interval
            this.startPollingTimer();
            return;
        }
        //try to parse response to JSON
        try {
            response = JSON.parse(response);
        }
        catch(err) {
            this.setAllNodeStates("error", "error parsing JSON-response");
            //start new polling interval
            this.startPollingTimer();
            return;
        }                        
        
        //TODO
        //Hier vielleicht das JSON-Objekt mit dem letzten JSON vergleichen
        //wenn gleich, muss nicht an alle nodes geschickt werden
        //sparen von internen messages und rechenleistung fuer abgleiche
        //JSON.stringify(<obj>)
        
        //sending json parsed response to each of the registered consumers (nodes)
        //only send json-block needed by node (not complete response)
        var keys = Object.keys(this.nodes);
        var itemCount = keys.length;
        for (var i = 0; i < itemCount; ++i) {
            switch(this.nodes[keys[i]].kind) {
                case "lights":
                    this.nodes[keys[i]].handleQueryApiResponse(response.lights);
                    break;
                case "globals":
                    this.nodes[keys[i]].handleQueryApiResponse(response.globals);
                    break;
                case "universal":
                    this.nodes[keys[i]].handleQueryApiResponse(response);
                    break;
                case "loads":
                    this.nodes[keys[i]].handleQueryApiResponse(response.loads);
                    break;
                case "blinds":
                    this.nodes[keys[i]].handleQueryApiResponse(response.blinds);
                    break;                    
                case "actions":
                    this.nodes[keys[i]].handleQueryApiResponse(response.actions);
                    break;                     
                default:
                    this.nodes[keys[i]].setState("error", "unknown kind of item");
                    break;
            }
        }
        //start new polling interval
        this.startPollingTimer();
    }
    
    /**
     * called when request generates an error, submits error to all consumers (nodes)
     * @param {object} err: error-object of https-request
     */
    MyGekkoServerNode.prototype.handleQueryApiError = function (err) {
        //sending error to all registered consumers(nodes)
        var keys = Object.keys(this.nodes);
        var itemCount = keys.length;
        for (var i = 0; i < itemCount; ++i) {
            switch (err.errno) {
                case "ETIMEDOUT":
                    this.nodes[keys[i]].setState("error", "QueryApi-Timeout");
                    //this.error("QueryApi-Timeout ETIMEOUT: " + err.message);
                    break;
                case "ESOCKETTIMEDOUT":
                    this.nodes[keys[i]].setState("error", "QueryApi-Socket-Timeout");
                    //this.error("QueryApi-Timeout ESOCKETTIMEDOUT: " + err.message);
                    break;
                default:
                    this.nodes[keys[i]].setState("error", "Error: " + err.message);
            }
        }
        //start new polling interval
        this.startPollingTimer();
    }

    /**
     * handles the initial response from QueryApi
     * @param {number} statusCode: the statusCode of the https-request
     * @param {string} response: respone of https-request
     */
    MyGekkoServerNode.prototype.handleQueryApiInitResponse = function (statusCode, response) {
        //check statusCode
        var message = this.getMessageFromStatusCode(statusCode);
        //successful request?
        if(statusCode != 200) {
            this.error(message);
            this.warn(message);
            //an error, do it again
            setTimeout(() => {this.doInitialRequest() }, 2000);
            return;
        }
        //try to parse response to JSON
        try {
            this.tree = JSON.parse(response);
        }
        catch(err) {
            this.error("error parsing initial JSON-response");
            this.warn("error parsing initial JSON-response");
            //an error, do it again
            this.tree = {};
            setTimeout(() => {this.doInitialRequest() }, 2000);
            return;
        }
        this.isInitialized = true;                  
    }
    
    /**
     * called when request generates an error
     * @param {object} err: error-object of https-request
     */
    MyGekkoServerNode.prototype.handleQueryApiInitError = function (err) {
        switch (err.errno) {
            case "ETIMEDOUT":
                this.error("QueryApiInit-Timeout");
                break;
            case "ESOCKETTIMEDOUT":
                this.error("QueryApiInit-Socket-Timeout");
                break;
            default:
                this.error("Error: " + err.message);
        }
        //error, do it again
        setTimeout(() => {this.doInitialRequest() }, 2000);
    }

     /**
     * returns the generated path for api-requests and complete status of all treenodes
     * @return {string} the generated path
     */
    MyGekkoServerNode.prototype.getQueryApiUrl = function () {
        return "/api/v1/var/status?" + this.getCredentialsString();
    }

     /**
     * returns the generated path for initial api-request (finding names etc. for auto-assign)
     * @return {string} the generated path
     */
    MyGekkoServerNode.prototype.getQueryApiInitUrl = function () {
        return "/api/v1/var/?" + this.getCredentialsString();
    }    

    /**
     * returns the uri-component of the needed credentials
     * @return {string} the generated credentials-string
     */
    MyGekkoServerNode.prototype.getCredentialsString = function () {
        if(this.api == "local")
        {
            return "username=" + encodeURIComponent(this.username) + "&password=" + encodeURIComponent(this.password);
        } else {
            return "username=" + encodeURIComponent(this.username) + "&key=" + encodeURIComponent(this.password) + "&gekkoid=" + encodeURIComponent(this.gekkoid);
        }        
    }
    
    /**
     * register a node to the server as consumer
     * @param {object} mygekkoNode: node to register
     * @return {boolean} true-> node could register; false -> node could not register
     */
    MyGekkoServerNode.prototype.register = function (mygekkoNode) {
        //check if itemid is set
        if(mygekkoNode.itemid == "") {
            //try to get itemid automatically
            var block = this.tree[mygekkoNode.kind];
            var keys = Object.keys(block);
            var itemCount = keys.length;
            //check all items, search for name
            for (var i = 0; i < itemCount; ++i) {
                if(block[keys[i]].name == mygekkoNode.name) {
                    mygekkoNode.itemid = keys[i];
                    break;
                }
            }
            //automatic found?
            if(mygekkoNode.itemid == "" ){
                mygekkoNode.setState("error", "ItemId could not auto assign");
                return false;
            }
        }
        //add the new node to collection
        this.nodes[mygekkoNode.id] = mygekkoNode;
        this.nodeCount += 1;
        if(this.nodeCount == 1) {
            //start polling with first registered node
            this.startPollingTimer();
        }
        return true;
    }
    
    /**
     * unregister a node from the server as consumer
     * @param {object} mygekkoNode: node to unregister
     */
    MyGekkoServerNode.prototype.unregister = function (mygekkoNode) {
        delete this.nodes[mygekkoNode.id];
        this.nodeCount -= 1;
        if (this.nodeCount <= 0) {
            //stop polling with last unregistered node
            this.stopPollingTimer();        
        }
    }

    /**
     * starts the Timeout for polling the QueryApi
     */
    MyGekkoServerNode.prototype.startPollingTimer = function () {
        if(this.active == false) return;
        this.timer = setTimeout(() => {this.pollQueryApi() }, this.interval * 1000);
    }

    /**
     * clears the Timeout for polling the QueryApi
     */
    MyGekkoServerNode.prototype.stopPollingTimer = function () {
        clearTimeout(this.timer);
    }

    /**
     * iterates through all registered consumers (nodes) and sets the state in Web-Flow-Editor
     * @param {string} state: possible values "error", "text", "ok"
     * @param {string} message: the text to be displayed
     */
    MyGekkoServerNode.prototype.setAllNodeStates = function (state, message) {
        //sending state to each of the registered consumers (nodes)
        var keys = Object.keys(this.nodes);
        var itemCount = keys.length;
        for (var i = 0; i < itemCount; ++i) {
            this.nodes[keys[i]].setState(state, message);
        }
    }

    /**
     * returns a human readable message from QueryApi-statusCode
     * @return {string} human readable message
     */
    MyGekkoServerNode.prototype.getMessageFromStatusCode = function (statusCode){
        switch (statusCode) {
            case 400:
                return "404 - Bad Request - Syntax";
                break;
            case 403:
                return "403 - Forbidden - False Credentials";
                break;
            case 404:
                return "404 - Ressource not found";
                break;
            case 405:
                return "405 - Method not allowed";
                break;
            case 410:
                return "410 - Gone - Gekko offline or false Gekko ID";
                break;
            case 429:
                return "429 - Too many requests";
                break;
            case 444:
                return "444 - No Response";
                break;
            default:
                return statusCode + " - unknown Error";
                break;
        }
    }
     
    RED.nodes.registerType("mygekko_server",MyGekkoServerNode,{
        credentials: {
            gekkoid: {type:"text"},
            username: {type:"text"},
            password: {type:"password"}
        }
    }
    );
}