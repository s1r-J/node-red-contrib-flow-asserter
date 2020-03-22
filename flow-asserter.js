module.exports = function(RED) {
    'use strict';    
    const equal = require('fast-deep-equal');
    
    const operatorFunctions = {
        'eq': function (actual, expected) {
            return (actual == expected);
        },
        'neq': function (actual, expected) {
            return (actual != expected);
        },
        'lt': function (actual, expected) {
            return (actual < expected);
        },
        'lte': function (actual, expected) {
            return (actual <= expected);
        },
        'gt': function (actual, expected) {
            return (actual > expected);
        },
        'gte': function (actual, expected) {
            return (actual >= expected);
        },
        'equal': function (actual, expected) {
            return equal(actual, expected);
        },
        'cont': function (actual, expected) {
            return ((actual + '').indexOf(expected) != -1);
        },
        'regex': function (actual, expected) {
            return expected.test(actual + '');
        },
        'null': function (actual) {
            return (typeof actual == 'undefined' || actual === null);
        },
        'nnull': function (actual) {
            return (typeof actual != 'undefined' && actual !== null);
        },
        'empty': function (actual) {
            if (typeof actual === 'string' || Array.isArray(actual) || Buffer.isBuffer(actual)) {
                return (actual.length === 0);
            } else if (typeof actual === 'object' && actual !== null) {
                return (Object.keys(actual).length === 0);
            } else {
                return false;
            }
        },
        'nempty': function (actual) {
            if (typeof actual === 'string' || Array.isArray(actual) || Buffer.isBuffer(actual)) {
                return (actual.length !== 0);
            } else if (typeof actual === 'object' && actual !== null) {
                return (Object.keys(actual).length !== 0);
            } else {
                return false;
            }
        },
        'istype': function (actual, expected) {
            switch (expected) {
                case 'array':
                    return Array.isArray(actual);
                case 'buffer':
                    return Buffer.isBuffer(actual);
                case 'json':
                    try {
                        JSON.parse(actual);
                        return true;
                    } catch(e) {
                        return false;
                    }
                case 'null':
                    return (actual === null);
                default:
                    return (typeof actual === expected && !Array.isArray(actual) && !Buffer.isBuffer(actual) && actual !== null);
            }
        },
        'jsonata': function (actual, expected, msg, node) {
            try {
                return (RED.util.evaluateJSONataExpression(expected, msg) === true);
            } catch (e) {
                node.error(RED._('flow-asserter-in.errors.invalid-jsonata', {error: e.message}));
                return false;
            }
        },
    };
    
    const prepareResultMessage = function (node) {
        if (node.testId == 0) {
            return null;
        }
        if (node.onlyfail && node.testcases[node.testId - 1].result == 'Success') {
            return null;
        }        
        return node.testId == 0 ? null: {'payload': node.testcases[node.testId - 1]};
    };
    
    function FlowAsserterInNode(n) {
        
        RED.nodes.createNode(this, n);
        var node = this;
        node.onlyfail = n.onlyfail;
        
        const onlySelectOperators = ['null', 'nnull', 'empty', 'nempty'];
        node.testcases = [];
        for (let i in n.testcases) {
            let tc = n.testcases[i];
            if (tc.inputType == 'fixed') {
                switch (tc.input) {
                    case 'null':
                        tc.input = null;
                        break;
                    case 'undefined':
                        tc.input = undefined;
                        break;
                    default:
                        node.error(RED._('flow-asserter-in.errors.invalid-input', {input: tc.input}));
                }
            } else {
                tc.input = RED.util.evaluateNodeProperty(tc.input, tc.inputType);
            }
            
            if (tc.operator == 'jsonata') {
                tc.assert = RED.util.prepareJSONataExpression(tc.assert, node);
            } else if (onlySelectOperators.includes(tc.operator)) {
                tc.assert = undefined;
                tc.assertType = undefined;
            } else {
                tc.assert = RED.util.evaluateNodeProperty(tc.assert, tc.assertType);
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
            try {
                result = operatorFunctions[tc.operator](msg.payload, tc.assert, msg, node);
            } catch (e) {
                node.error(RED._('flow-asserter-in.errors.invalid-operator', {operator: tc.operator}));
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
            const resultMsg = prepareResultMessage(node);
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
                msg._testcase.resultData = msg.payload;
                RED.events.emit(event, msg);
            } else {
                this.send(msg);
            }
        });
    }

    RED.nodes.registerType('flow-asserter out', FlowAsserterOutNode);
}