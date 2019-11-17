node-red-contrib-flow-asserter
====

This module is a node module that supports flow testing on the Node-RED editor UI.

## Description

node-red-contrib-flow-asserter is a node module that assists in testing the Node-RED flow in the editor.

When using Node-RED, the user creates a flow by connecting several nodes on the editor.
And many users will test that the flow is doing what they want.
How do you run the tests at this time? Is it like you check debug node by pressing the inject node's button, change the value and try again? In some cases, you may want to rewire the wire of the node just before the debug node so that unnecessary flows are not executed during the test. In addition, once you have modified your flow after starting production, you may need to repeat the test with all values again. In any case, Node-RED can be very annoying when trying to test a flow.

This module eliminates the hassle of such a flow test. There are two features of node-red-contrib-flow-asserter.

1. Multiple test-cases can be executed with a single button click operation.
2. During test execution, no message is sent to the flow after the position where the value is to be asserted.

The first feature eliminates the need for the user to rewrite the value of inject node many times for the test.

![testcases](./images/testcases.png)

Describe multiple test cases in the node's edit dialog as shown above. Set the input value, value assertion method, and output value in the test case. In addition to the simple `==`, the value assertion method are greater, lesser and the [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal) module's `equals`. By preparing multiple test cases with values set in this way, you can execute them all in one operation.

The second feature is that it saves you the trouble of modifying the flow when switching between test execution and production execution. The figure below shows a simple flow using this node.

![flow-asserter](./images/assertflow.png)

This module has 2 nodes, **flow-asserter in node**(the node with button) and **flow-asserter out node**(the node with one input port and one output port).
The test is executed by clicking the button of flow-asserter in node, and the message object with the test case input value substituted in payload is sent from the upper port. The message reaches flow-asserter out node via delay node and function node. Flow-asserter out node then does **not** send the message to debug node connected to its output port. Instead of that, the node verifies the value. The verification result is sent from the lower port of flow-asserter in node.
So what happens if you run it not during testing? As explained in the previous example, when the button of inject node is pressed, flow-asserter out node is reached via delay node and function node, but here the value verification is **not** performed and the message is passed to debug node without doing anything.

## Usage

Following example flow is in examples/example.json.  
Drag & drop in your Node-RED editor.

1. Prepare the test object flow.  
In this example, the flow consists of inject node, delay node, function node and debug node. This flow sends string, converts `msg.payload` to uppercase and display that.
![intactflow](./images/intactflow.png)

1. **Flow-asserter out node** is dragged over the mid-point of a wire which links between function node and debug node. The reason is we want to ensure the letters becoming the uppercase.

1. Add **flow-asserter in node** to the workspace. The upper output port of the node is wired to the input port of delay node and the lower output port is wired to the input port of debug node which is newly added.
![assertflow](./images/assertflow.png)

1. Open the edit dialog of flow-asserter in node. Push add button 3 times for making 3 test cases. Fill input and output like the below figure. Second row of test-case, testID 1, will fails. Finally select flow-asserter out node's ID at the bottom of the dialog.
![edit-dialog](./images/dialog.png)

1. Save and close the dialog. In workspace, click the button of flow-asserter in node. Test will start, node status is displayed and test-case's result is displayed in debug sidebar. Second test-case, testID 1, will be failure and the others will be success.  
![test-finished](./images/statusfinish.png)  
![debug-sidebar](./images/debugsidebar.png)

1. Check the movement of messages during test execution. When you click the button of flow-asserter in node, the test-case in the first line set in the edit dialog will be executed. The test-case input value is assigned to `msg.payload` and the message is sent from the upper output port. When flow-asserter out node is reached, the message is not sent to debug node connected to the output port, but sent to flow-asserter in node, and the value is verified according to the test-case description. The verification result is sent from the lower output port of flow-asserter in node. At the same time, the test-case in the second line is executed. This is repeated until all test-cases have been executed.

1. Finally, just in case, check the behavior during normal execution that is not a test. When you click the button of inject node, the value is substituted into `msg.payload` and a message is sent. A message arrives at flow-asserter out node on the way, but since the test is not in progress, it passes the message to debug node connected to the output port without performing any processing.

## Install

```
npm install node-red-contrib-flow-asserter
```

[![NPM](https://nodei.co/npm/node-red-contrib-flow-asserter.png)](https://nodei.co/npm/node-red-contrib-flow-asserter/)

## Changelog

[Changelog](https://github.com/s1r-J/node-red-contrib-flow-asserter/blob/master/CHANGELOG.md)

## Licence

[Apache-2.0](http://www.apache.org/licenses/LICENSE-2.0.html)

## Author

[s1r-J](https://github.com/s1r-J)

## Languages

[日本語README](./README_ja.md)
