module.exports = function(RED) {
    'use strict';    
    const equal = require('fast-deep-equal');
    
    function FlowAsserterInNode(n) {
        
        RED.nodes.createNode(this, n);
        var node = this;
        const onlySelectOperators = ['null', 'nnull', 'empty', 'nempty'];
        node.testcases = [];
        for (let i in n.testcases) {
            let tc = n.testcases[i];
            tc.input = RED.util.evaluateNodeProperty(tc.input, tc.inputType);
            tc.assert = RED.util.evaluateNodeProperty(tc.assert, tc.assertType);
            if (onlySelectOperators.includes(tc.operator)) {
                tc.assert = undefined;
                tc.assertType = undefined;
            } 
            tc.flowAsserterIds = {'input': n.id, 'output': n.flowasserterout};
            node.testcases.push(tc);
        }
        node.testId = 0;
        node.failedCase = 0;
        
        var event = 'node:' + n.id;
        var handler = function(msg) {
            let tc = msg._testcase;
            let result;
            switch (tc.operator) {
                case 'eq':
                    result = (msg.payload == tc.assert);
                    break;
                case 'lt':
                    result = (msg.payload < tc.assert);
                    break;
                case 'lte':
                    result = (msg.payload <= tc.assert);
                    break;
                case 'gt':
                    result = (msg.payload > tc.assert);
                    break;
                case 'gte':
                    result = (msg.payload >= tc.assert);
                    break;
                case 'equal':
                    result = equal(msg.payload, tc.assert);
                    break;
                case 'null':
                    result = (typeof msg.payload == 'undefined' || msg.payload === null);
                    break;
                case 'nnull':
                    result = (typeof msg.payload != 'undefined' && msg.payload !== null);
                    break;
                case 'empty':
                    if (typeof msg.payload === 'string' || Array.isArray(msg.payload) || Buffer.isBuffer(msg.payload)) {
                        result = (msg.payload.length === 0);
                    } else if (typeof msg.payload === 'object' && msg.payload !== null) {
                        result = (Object.keys(msg.payload).length === 0);
                    } else {
                        result = false;
                    }
                    break;
                case 'nempty':
                    if (typeof msg.payload === 'string' || Array.isArray(msg.payload) || Buffer.isBuffer(msg.payload)) {
                        result = (msg.payload.length !== 0);
                    } else if (typeof msg.payload === 'object' && msg.payload !== null) {
                        result = (Object.keys(msg.payload).length !== 0);
                    } else {
                        result = false;
                    }
                    break;
                default:
                    RED._('flow-asserter-in.errors.invalid-operator', {operator: tc.operator});
            }
            tc.result = result ? 'Success': 'Failure';
            node.failedCase += result ? 0 : 1;
            node.testcases[node.testId].result = tc.result;
            
            node.testId++;
            node.receive(msg);
        }
        RED.events.on(event, handler);

        this.on('input', function(msg) {
            this.status({
                fill: (node.failedCase == 0 ? 'green' : 'red'),
                shape: 'ring',
                text: RED._('flow-asserter-in.status.running', {currentnum: (node.testId + 1), testcasenum: node.testcases.length})
            });
            let resultMsg = node.testId == 0 ? null: {'payload': node.testcases[node.testId - 1]};
            if (node.testId < node.testcases.length) { // testcase remains
                msg._testcase = node.testcases[node.testId];
                msg.payload = msg._testcase['input'];
                this.send([msg, resultMsg]);
            } else { // no testcase is left
                this.status({
                    fill: (node.failedCase == 0 ? 'green' : 'red'),
                    shape: 'dot',
                    text: RED._('flow-asserter-in.status.finished', {failedcase: node.failedCase})
                });
                this.send([null, resultMsg])
                node.testId = 0;
                node.failedCase = 0;
            }
        });
        this.on('close',function() {
            this.status({});
            RED.events.removeListener(event, handler);
        });
    }

    RED.nodes.registerType('flow-asserter in', FlowAsserterInNode);

    RED.httpAdmin.post('/flow-asserter-in/:id', RED.auth.needsPermission('flow-asserter in.write'), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.sendStatus(200);
            } catch(err) {
                res.sendStatus(500);
                node.error(RED._('flow-asserter-in.notification.failed',{error:err.toString()}));
            }
        } else {
            res.sendStatus(404);
        }
    });
    
    function FlowAsserterOutNode(n) {
        
        RED.nodes.createNode(this, n);
        var node = this;
        node.id = n.id;
        
        this.on('input', function(msg) {
            if (msg._testcase !== undefined && msg._testcase.flowAsserterIds.output == node.id) {
                let event = 'node:' + msg._testcase.flowAsserterIds.input;
                RED.events.emit(event, msg);
            } else {
                this.send(msg);
            }
        });
    }

    RED.nodes.registerType('flow-asserter out', FlowAsserterOutNode);
}