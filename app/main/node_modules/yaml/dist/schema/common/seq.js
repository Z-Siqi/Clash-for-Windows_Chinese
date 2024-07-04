'use strict';

var createNode = require('../../doc/createNode.js');
var Node = require('../../nodes/Node.js');
var YAMLSeq = require('../../nodes/YAMLSeq.js');

function createSeq(schema, obj, ctx) {
    const { replacer } = ctx;
    const seq = new YAMLSeq.YAMLSeq(schema);
    if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
            if (typeof replacer === 'function') {
                const key = obj instanceof Set ? it : String(i++);
                it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, undefined, ctx));
        }
    }
    return seq;
}
const seq = {
    collection: 'seq',
    createNode: createSeq,
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: 'tag:yaml.org,2002:seq',
    resolve(seq, onError) {
        if (!Node.isSeq(seq))
            onError('Expected a sequence for this tag');
        return seq;
    }
};

exports.seq = seq;
