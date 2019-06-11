# node-red-contrib-mygekko

Connects to the Query-Api of the homeautomation system MyGEKKO.  

## Installation
Copy this package to your local node-red installation.  
Copy to directory "node-modules" and restart node-red.  
Mostly ~/.node-red/node_modules/node-red-contrib-mygekko  

## How to use
  * Add a **mygekko_light** node to your flow  
  **Note:** If you want to use the **auto-itemid-assign-feature**, you have to use the same **Name** for the node as used in MyGekko.  
  The server will then try to auto-assign the correct MyGekko-ItemId to the node.  
  You can also assign your own ItemId directly, therefor enter the MyGekko-ItemId (like item18). In such case, the **Name** can be any value.   
  The node produce a msg-object on every status-change of the light-object. Additionally the different values can be set.  

  * Add a **mygekko_load** node to your flow  
  **Note:** If you want to use the **auto-itemid-assign-feature**, you have to use the same **Name** for the node as used in MyGekko.  
  The server will then try to auto-assign the correct MyGekko-ItemId to the node.  
  You can also assign your own ItemId directly, therefor enter the MyGekko-ItemId (like item3). In such case, the **Name** can be any value.  
  The node produce a msg-object on every status-change of the load-object. Additionally the value for start, stop, impuls_start can be set.   
  
  * Add a **mygekko_action** node to your flow  
  **Note:** If you want to use the **auto-itemid-assign-feature**, you have to use the same **Name** for the node as used in MyGekko.  
  The server will then try to auto-assign the correct MyGekko-ItemId to the node.  
  You can also assign your own ItemId directly, therefor enter the MyGekko-ItemId (like item3). In such case, the **Name** can be any value.  
  The node produce a msg-object on every status-change of the action-object. Additionally the action can start and stop.  

  * Add a **mygekko_blind** node to your flow  
  **Note:** If you want to use the **auto-itemid-assign-feature**, you have to use the same **Name** for the node as used in MyGekko.  
  The server will then try to auto-assign the correct MyGekko-ItemId to the node.  
  You can also assign your own ItemId directly, therefor enter the MyGekko-ItemId (like item18). In such case, the **Name** can be any value.  
  The node produce a msg-object on every status-change of the blind-object. Additionally the position and the action (hold_down, down, up, ...) can be set.  
  
  * Add a **mygekko_alarm** node to your flow  
  The node produce a msg-object on every status-change of the alarm-object.  
  
  * Add a **mygekko_universal** node to your flow  
  A simple node that produces a msg-object with the complete json-response on every value-change on any item from MyGekko-Homeautomation-System.  
  Be careful, produces a lot of Message-Payload. For testing and debugging purposes.

  * Add a **mygekko_profile** node to your flow  
  A simple node that represents the actual profile from MyGekko-Homeautomation-System. Get and set value over QueryApi.  
  The node produce a msg-object on every status-change of the profile-object. Additionally the profile can be set.

  * Config a **mygekko_server** config node.  
  **Note:** You can set the **Active** flag in the config for polling the QueryApi.  
  If you just want to write values back to QueryApi, you can disable polling.  
    
  **Further information to each individual node can be found in the info-tab within the flow-editor.**  

## Features
  * LIGHT - Get/Set the current state (on/off)
  * LIGHT - Get/Set the current dimming-value
  * LIGHT - Get/Set the current light-color (24-bit-value)
  * LOAD - Get/Set the current state (on, impulse on, off)
  * ACTION - Get the current state
  * ACTION - Set the current state (start, stop)
  * BLIND - Get/Set the current state (hold_down, stop, up, ...)
  * BLIND - Get/Set the current position
  * BLIND - Get/Set the current angle (slate-rotation)
  * ALARM - Get the current status from alarm-system
  * UNIVERSAL - Get the complete JSON-Response from QueryApi
  * PROFILE - Get/Set the current profile (Away, at Home)

## Requirements
This package has no extra requirements, it doesn't add any dependencies, so it can be used in every standard-node-red-installation.